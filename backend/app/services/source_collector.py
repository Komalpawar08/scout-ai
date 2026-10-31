"""Source collection and content extraction (web pages, remote PDFs, uploaded PDFs, demo fixtures)."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.config import get_settings
from app.schemas.research import (
    DateStatus, ExtractionStatus, PageSpan, Source, SourceOrigin, SourceType, UploadedDocument,
)
from app.services.fetcher import USER_AGENT, FetchError, fetch_url
from app.services.html_extractor import extract_html
from app.services.metadata import classify_source, dominant_academic_cycle, host_of, publisher_from_host
from app.services.pdf_extractor import PdfError, extract_pdf, looks_like_pdf

MIN_TEXT_CHARS = 200


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _truncate(text: str, spans: list[PageSpan], limit: int) -> tuple[str, list[PageSpan], bool]:
    if len(text) <= limit:
        return text, spans, False
    kept = [s.model_copy(update={"end": min(s.end, limit)}) for s in spans if s.start < limit]
    return text[:limit], kept, True


def _status_for(text: str, truncated: bool) -> ExtractionStatus:
    if not text.strip():
        return ExtractionStatus.empty
    if len(text) < MIN_TEXT_CHARS or truncated:
        return ExtractionStatus.partial
    return ExtractionStatus.success


def build_source_from_pdf(source_id: str, data: bytes, origin: SourceOrigin, *, url: str | None = None,
                          filename: str | None = None, fixture: dict | None = None) -> Source:
    settings = get_settings()
    retrieved = now_iso()
    base_title = (fixture or {}).get("title") or filename or url or source_id
    try:
        pdf = extract_pdf(data, settings.max_chars_per_source)
    except PdfError as exc:
        return Source(source_id=source_id, title=base_title, url=url, filename=filename, domain=host_of(url),
                      origin=origin, source_type=SourceType.user_provided if origin == SourceOrigin.uploaded_pdf
                      else SourceType.research_document, retrieved_at=retrieved,
                      extraction_status=ExtractionStatus.failed, extraction_error=str(exc),
                      is_demo=origin == SourceOrigin.demo_fixture)
    text, spans, truncated = _truncate(pdf.text, pdf.spans, settings.max_chars_per_source)
    truncated = truncated or pdf.pages_extracted < pdf.page_count
    stype, reason = classify_source(url, origin, is_pdf=True)
    if fixture and fixture.get("source_type"):
        stype, reason = SourceType(fixture["source_type"]), fixture.get("source_type_reason", "Demo fixture classification.")
    published = (fixture or {}).get("publication_date") or pdf.modified or pdf.created
    origin_note = "demo fixture metadata" if (fixture or {}).get("publication_date") else (
        "PDF file metadata (modification/creation date)" if (pdf.modified or pdf.created) else None)
    return Source(
        source_id=source_id, title=(fixture or {}).get("title") or pdf.title or filename or url or source_id,
        url=url, filename=filename, publisher=(fixture or {}).get("publisher") or pdf.author or publisher_from_host(host_of(url)),
        domain=host_of(url), origin=origin, source_type=stype, source_type_reason=reason,
        publication_date=published, publication_date_origin=origin_note,
        updated_date=pdf.modified if pdf.modified and pdf.modified != published else None,
        date_status=DateStatus.found if published else DateStatus.not_stated if text else DateStatus.unavailable,
        retrieved_at=retrieved, extraction_status=_status_for(text, truncated),
        extraction_error=f"Extracted {pdf.pages_extracted} of {pdf.page_count} pages" if truncated else None,
        extracted_text=text, text_truncated=truncated, spans=spans, is_demo=origin == SourceOrigin.demo_fixture,
    )


def build_source_from_html(source_id: str, html: str, url: str, origin: SourceOrigin, *, snippet: str | None = None,
                           fixture: dict | None = None, truncated_response: bool = False) -> Source:
    settings = get_settings()
    ext = extract_html(html, url)
    text, spans, truncated = _truncate(ext.text, ext.spans, settings.max_chars_per_source)
    stype, reason = classify_source(url, origin, is_pdf=False)
    if fixture and fixture.get("source_type"):
        stype, reason = SourceType(fixture["source_type"]), fixture.get("source_type_reason", "Demo fixture classification.")
    host = host_of(url)
    return Source(
        source_id=source_id, title=ext.title or (fixture or {}).get("title") or url, url=url,
        publisher=ext.publisher or publisher_from_host(host), domain=host, origin=origin, source_type=stype,
        source_type_reason=reason, publication_date=ext.published, publication_date_origin=ext.published_origin,
        updated_date=ext.updated,
        date_status=DateStatus.found if (ext.published or ext.updated) else DateStatus.not_stated if text else DateStatus.unavailable,
        retrieved_at=now_iso(), extraction_status=_status_for(text, truncated or truncated_response),
        extracted_text=text, text_truncated=truncated or truncated_response, spans=spans, search_snippet=snippet,
        is_demo=origin == SourceOrigin.demo_fixture,
    )


def failed_source(source_id: str, url: str | None, origin: SourceOrigin, error: str, blocked: bool,
                  title: str | None = None, filename: str | None = None) -> Source:
    host = host_of(url)
    stype, reason = classify_source(url, origin, is_pdf=False)
    return Source(
        source_id=source_id, title=title or filename or url or source_id, url=url, filename=filename, domain=host,
        publisher=publisher_from_host(host), origin=origin, source_type=stype, source_type_reason=reason,
        retrieved_at=now_iso(), extraction_status=ExtractionStatus.blocked if blocked else ExtractionStatus.failed,
        extraction_error=error, date_status=DateStatus.unavailable,
    )


async def extract_candidate(candidate: dict[str, Any], client: httpx.AsyncClient) -> Source:
    sid = candidate["source_id"]
    origin = SourceOrigin(candidate["origin"])
    if origin == SourceOrigin.uploaded_pdf:
        doc: UploadedDocument = candidate["document"]
        return await asyncio.to_thread(build_source_from_pdf, sid, doc.data, origin, filename=doc.filename)
    if origin == SourceOrigin.demo_fixture:
        fx = candidate["fixture"]
        if fx.get("pdf_bytes"):
            return await asyncio.to_thread(build_source_from_pdf, sid, fx["pdf_bytes"], origin,
                                           filename=fx.get("filename"), url=fx.get("url"), fixture=fx)
        return build_source_from_html(sid, fx["html"], fx["url"], origin, fixture=fx)

    url = candidate["url"]
    try:
        result = await fetch_url(url, client=client)
    except FetchError as exc:
        return failed_source(sid, url, origin, str(exc), exc.blocked, title=candidate.get("title"))
    is_pdf = "application/pdf" in result.content_type or looks_like_pdf(result.content)
    if is_pdf:
        if result.truncated:
            return failed_source(sid, result.url, origin, "PDF exceeds the maximum download size", False,
                                 title=candidate.get("title"))
        return await asyncio.to_thread(build_source_from_pdf, sid, result.content, origin, url=result.url)
    if not any(t in result.content_type for t in ("html", "xml", "text/plain")) and result.content_type:
        return failed_source(sid, result.url, origin, f"Unsupported content type: {result.content_type}", False,
                             title=candidate.get("title"))
    html = result.content.decode("utf-8", errors="replace")
    try:
        return await asyncio.to_thread(build_source_from_html, sid, html, result.url, origin,
                                       snippet=candidate.get("snippet"), truncated_response=result.truncated)
    except Exception as exc:  # noqa: BLE001 - malformed markup must not fail the run
        return failed_source(sid, result.url, origin, f"Content extraction failed: {exc.__class__.__name__}", False,
                             title=candidate.get("title"))


async def extract_all(candidates: list[dict[str, Any]]) -> list[Source]:
    settings = get_settings()
    sem = asyncio.Semaphore(settings.fetch_concurrency)
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(settings.request_timeout_seconds), follow_redirects=False,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5"},
    ) as client:
        async def run(c):
            async with sem:
                return await extract_candidate(c, client)
        return list(await asyncio.gather(*(run(c) for c in candidates)))


def enrich_metadata(source: Source) -> Source:
    """Academic cycle detection from explicit text mentions (never guessed)."""
    if source.extracted_text and not source.academic_cycle:
        cycle = dominant_academic_cycle(source.extracted_text[:20000])
        if cycle:
            return source.model_copy(update={"academic_cycle": cycle})
    return source
