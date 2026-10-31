"""HTML content and metadata extraction with Trafilatura + BeautifulSoup."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

import trafilatura
from bs4 import BeautifulSoup

from app.schemas.research import PageSpan
from app.services.metadata import iso_date

PUBLISHED_META = (
    ("property", "article:published_time"),
    ("name", "article:published_time"),
    ("itemprop", "datePublished"),
    ("name", "publish-date"),
    ("name", "pubdate"),
    ("name", "date"),
    ("name", "dc.date"),
    ("name", "DC.date.issued"),
    ("property", "og:published_time"),
)
UPDATED_META = (
    ("property", "article:modified_time"),
    ("name", "article:modified_time"),
    ("itemprop", "dateModified"),
    ("property", "og:updated_time"),
    ("name", "last-modified"),
)


@dataclass
class HtmlExtraction:
    title: str | None
    publisher: str | None
    text: str
    published: str | None
    published_origin: str | None
    updated: str | None
    spans: list[PageSpan] = field(default_factory=list)


def _meta(soup: BeautifulSoup, keys) -> str | None:
    for attr, name in keys:
        tag = soup.find("meta", attrs={attr: re.compile(f"^{re.escape(name)}$", re.I)})
        if tag and tag.get("content"):
            iso = iso_date(tag["content"])
            if iso:
                return iso
    return None


def _jsonld_dates(soup: BeautifulSoup) -> tuple[str | None, str | None, str | None]:
    published = updated = publisher = None
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        items = data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []
        for item in items:
            if not isinstance(item, dict):
                continue
            published = published or iso_date(str(item.get("datePublished") or ""))
            updated = updated or iso_date(str(item.get("dateModified") or ""))
            pub = item.get("publisher")
            if isinstance(pub, dict) and pub.get("name") and not publisher:
                publisher = str(pub["name"])
    return published, updated, publisher


def build_section_spans(text: str) -> list[PageSpan]:
    """Create section spans from markdown-style heading lines in extracted text."""
    spans: list[PageSpan] = []
    headings = [(m.start(), m.group(2).strip()) for m in re.finditer(r"^(#{1,6})\s+(.+)$", text, re.M)]
    if not headings:
        return [PageSpan(label="Main text", section="Main text", start=0, end=len(text))]
    if headings[0][0] > 0:
        spans.append(PageSpan(label="Introduction", section="Introduction", start=0, end=headings[0][0]))
    for i, (start, title) in enumerate(headings):
        end = headings[i + 1][0] if i + 1 < len(headings) else len(text)
        spans.append(PageSpan(label=f"Section: {title[:80]}", section=title[:80], start=start, end=end))
    return spans


def extract_html(html: str, url: str) -> HtmlExtraction:
    soup = BeautifulSoup(html, "lxml")
    ld_pub, ld_upd, ld_publisher = _jsonld_dates(soup)

    published = _meta(soup, PUBLISHED_META)
    published_origin = "HTML meta tag" if published else None
    if not published and ld_pub:
        published, published_origin = ld_pub, "JSON-LD datePublished"
    if not published:
        time_tag = soup.find("time", attrs={"datetime": True})
        if time_tag:
            published = iso_date(time_tag["datetime"])
            published_origin = "<time datetime> element" if published else None
    updated = _meta(soup, UPDATED_META) or ld_upd

    text = trafilatura.extract(
        html, url=url, output_format="markdown", include_comments=False, include_tables=True,
        include_links=False, favor_recall=True,
    ) or ""
    # Trafilatura's markdown output escapes characters like "[" — keep the source text literal.
    text = re.sub(r"\\([\[\]*_#`()!.>|{}+-])", r"\1", text)

    tmeta = None
    try:
        tmeta = trafilatura.extract_metadata(html, default_url=url, extensive=False)
    except Exception:  # noqa: BLE001 - metadata extraction is best effort
        tmeta = None
    if not published and tmeta is not None and getattr(tmeta, "date", None):
        published = iso_date(tmeta.date)
        published_origin = "page markup (trafilatura/htmldate)" if published else None

    if not text.strip():
        # Fallback: visible text via BeautifulSoup
        for bad in soup(["script", "style", "noscript", "nav", "footer", "header", "form"]):
            bad.decompose()
        text = re.sub(r"\n{3,}", "\n\n", soup.get_text("\n")).strip()

    og_title = soup.find("meta", attrs={"property": "og:title"})
    title = (
        (tmeta.title if tmeta is not None and getattr(tmeta, "title", None) else None)
        or (og_title.get("content") if og_title else None)
        or (soup.title.string.strip() if soup.title and soup.title.string else None)
    )
    og_site = soup.find("meta", attrs={"property": "og:site_name"})
    publisher = (
        (og_site.get("content") if og_site else None)
        or ld_publisher
        or (tmeta.sitename if tmeta is not None and getattr(tmeta, "sitename", None) else None)
    )
    return HtmlExtraction(
        title=title, publisher=publisher, text=text.strip(), published=published,
        published_origin=published_origin, updated=updated, spans=build_section_spans(text.strip()),
    )
