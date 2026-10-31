import httpx
import pymupdf
import pytest

from app.schemas.research import QuoteMatch
from app.services.analysis.evidence import chunk_text, locate_quote, span_for_offset
from app.services.fetcher import FetchError, fetch_url
from app.services.html_extractor import extract_html
from app.services.metadata import classify_source, dominant_academic_cycle, find_dates_in_text, iso_date
from app.services.pdf_extractor import PdfError, extract_pdf
from app.schemas.research import SourceOrigin, SourceType
from app.services.url_security import UnsafeURLError, check_url_syntax, validate_public_url


# --- URL security --------------------------------------------------------------------------

@pytest.mark.parametrize("url", [
    "ftp://example.com/file", "file:///etc/passwd", "http://localhost/admin", "http://127.0.0.1/",
    "http://10.0.0.5/", "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/", "http://metadata.google.internal/", "http://user:pass@example.com/",
    "http://2130706433/", "http://example.com:22/", "http://100.64.0.1/",
])
def test_rejects_unsafe_urls(url):
    with pytest.raises(UnsafeURLError):
        check_url_syntax(url)


def test_accepts_public_url():
    assert check_url_syntax("https://www.example.com/news")[1] == "www.example.com"


async def test_dns_resolving_to_private_ip_is_blocked():
    async def resolver(host):
        return ["10.1.2.3"]

    with pytest.raises(UnsafeURLError):
        await validate_public_url("https://innocent.example/", resolver=resolver)


async def test_redirect_to_private_address_is_revalidated_and_blocked():
    def handler(request: httpx.Request):
        return httpx.Response(302, headers={"location": "http://169.254.169.254/latest"})

    async def resolver(host):
        return ["93.184.216.34"]

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(FetchError) as exc:
            await fetch_url("https://public.example/start", client=client, resolver=resolver)
    assert exc.value.blocked


async def test_fetch_respects_size_limit(monkeypatch):
    from app.core import config

    monkeypatch.setattr(config.get_settings(), "max_response_bytes", 1000)

    def handler(request):
        size = 1500 if request.url.path == "/small" else 5000
        return httpx.Response(200, content=b"a" * size, headers={"content-type": "text/html"})

    async def resolver(host):
        return ["93.184.216.34"]

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        # Streamed body over the limit is truncated...
        result = await fetch_url("https://public.example/small", client=client, resolver=resolver)
        assert result.truncated and len(result.content) <= 1000
        # ...and a declared Content-Length far above the limit is rejected before download.
        with pytest.raises(FetchError, match="too large"):
            await fetch_url("https://public.example/big", client=client, resolver=resolver)


# --- HTML / PDF extraction ----------------------------------------------------------------

HTML = """<html><head><title>Test Notice</title>
<meta property="article:published_time" content="2025-03-04T10:00:00Z">
<meta property="article:modified_time" content="2025-03-06T10:00:00Z">
<meta property="og:site_name" content="Example Board"></head>
<body><article><h1>Notice</h1><h2>Eligibility</h2>
<p>Students who have passed Class 12 are eligible to apply for the 2025-26 academic year scholarship.</p>
<h2>Deadline</h2><p>The last date to apply is 15 March 2025 and no extension will be given to applicants.</p>
</article></body></html>"""


def test_html_extraction_metadata_and_sections():
    ext = extract_html(HTML, "https://board.example/notice")
    assert ext.published == "2025-03-04"
    assert ext.published_origin == "HTML meta tag"
    assert ext.updated == "2025-03-06"
    assert ext.publisher == "Example Board"
    assert "last date to apply" in ext.text
    sections = {s.section for s in ext.spans}
    assert "Eligibility" in sections and "Deadline" in sections


def test_html_without_dates_does_not_invent_one():
    ext = extract_html("<html><body><p>" + "Plain text without any date information. " * 10 + "</p></body></html>",
                       "https://x.example/")
    assert ext.published is None


def _pdf_bytes(pages):
    doc = pymupdf.open()
    for text in pages:
        doc.new_page().insert_text((50, 72), text)
    data = doc.tobytes()
    doc.close()
    return data


def test_pdf_extraction_with_page_spans():
    pdf = extract_pdf(_pdf_bytes(["First page about eligibility.", "Second page: deadline 1 May 2026."]), 10000)
    assert pdf.page_count == 2
    assert [s.page_number for s in pdf.spans] == [1, 2]
    idx = pdf.text.find("deadline")
    assert span_for_offset(pdf.spans, idx).page_number == 2


def test_invalid_pdf_rejected():
    with pytest.raises(PdfError):
        extract_pdf(b"not a pdf at all", 1000)


# --- metadata ----------------------------------------------------------------------------

def test_dates_and_cycles():
    assert iso_date("2024-01-15T10:00:00Z") == "2024-01-15"
    assert iso_date("D:20230102120000") == "2023-01-02"
    assert iso_date("not a date") is None
    found = [d for d, _, _ in find_dates_in_text("Apply by 15 March 2025 or by 03/04/2025.")]
    assert "2025-03-15" in found and "2025-04-03" in found
    assert dominant_academic_cycle("Session 2024-25. Academic year 2024-2025 notice; see 2023-24.") == "2024-25"


def test_source_classification():
    assert classify_source("https://scholarships.gov.in/x", SourceOrigin.search, False)[0] == SourceType.official_primary
    assert classify_source("https://www.thehindu.com/x", SourceOrigin.search, False)[0] == SourceType.secondary_reporting
    assert classify_source(None, SourceOrigin.uploaded_pdf, True)[0] == SourceType.user_provided
    assert classify_source("https://random.example/x", SourceOrigin.search, False)[0] == SourceType.other_web


# --- quote verification ----------------------------------------------------------------------

def test_locate_quote_exact_normalized_and_missing():
    text = "The   annual family income must not exceed ₹2.5 lakh.\nApply  online."
    m, s, e = locate_quote(text, "Apply  online.")
    assert m == QuoteMatch.exact and text[s:e] == "Apply  online."
    m, s, e = locate_quote(text, "the annual family income must not exceed Rs 2.5 lakh")
    assert m == QuoteMatch.normalized and "annual family income" in text[s:e]
    m, s, e = locate_quote(text, "Income limit is three lakh rupees for all students")
    assert m == QuoteMatch.not_found and s is None


def test_chunking_is_bounded():
    chunks = chunk_text("para. " * 5000, 2000, 3)
    assert len(chunks) == 3 and all(len(c) <= 2000 for _, c in chunks)
