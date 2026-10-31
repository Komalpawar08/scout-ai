"""In-memory PDF text extraction with PyMuPDF. Bytes are never written to disk."""

from __future__ import annotations

from dataclasses import dataclass, field

import pymupdf

from app.schemas.research import PageSpan
from app.services.metadata import iso_date

MAX_PDF_PAGES = 60


class PdfError(Exception):
    pass


@dataclass
class PdfExtraction:
    title: str | None
    author: str | None
    text: str
    created: str | None
    modified: str | None
    page_count: int
    pages_extracted: int
    spans: list[PageSpan] = field(default_factory=list)


def looks_like_pdf(data: bytes) -> bool:
    return data[:1024].lstrip().startswith(b"%PDF-")


def extract_pdf(data: bytes, max_chars: int) -> PdfExtraction:
    if not looks_like_pdf(data):
        raise PdfError("File is not a valid PDF (missing %PDF header)")
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:  # noqa: BLE001 - PyMuPDF raises several error types
        raise PdfError(f"Could not open PDF: {exc}") from exc
    try:
        if doc.needs_pass:
            raise PdfError("PDF is password protected")
        meta = doc.metadata or {}
        parts: list[str] = []
        spans: list[PageSpan] = []
        cursor = 0
        pages_extracted = 0
        for index, page in enumerate(doc):
            if index >= MAX_PDF_PAGES or cursor >= max_chars:
                break
            page_text = page.get_text("text").strip()
            pages_extracted += 1
            if not page_text:
                continue
            block = page_text + "\n\n"
            spans.append(PageSpan(label=f"Page {index + 1}", page_number=index + 1, start=cursor, end=cursor + len(page_text)))
            parts.append(block)
            cursor += len(block)
        text = "".join(parts)
        return PdfExtraction(
            title=(meta.get("title") or "").strip() or None,
            author=(meta.get("author") or "").strip() or None,
            text=text.strip(),
            created=iso_date(meta.get("creationDate")),
            modified=iso_date(meta.get("modDate")),
            page_count=doc.page_count,
            pages_extracted=pages_extracted,
            spans=spans,
        )
    finally:
        doc.close()
