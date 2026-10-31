"""Deterministic metadata helpers: dates, academic cycles and source classification.

Nothing here infers a publication date from body text guesses; dates come only from
explicit metadata or explicit date statements, and their origin is recorded.
"""

from __future__ import annotations

import re
from collections import Counter
from datetime import date, datetime
from urllib.parse import urlsplit

from dateutil import parser as dateparser

from app.schemas.research import SourceOrigin, SourceType

MONTHS = (
    "january|february|march|april|may|june|july|august|september|october|november|december|"
    "jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec"
)
DATE_PATTERNS = [
    re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+(" + MONTHS + r")\.?,?\s+(\d{4})\b", re.I),
    re.compile(r"\b(" + MONTHS + r")\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b", re.I),
    re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b"),
    re.compile(r"\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b"),
]

CYCLE_PATTERN = re.compile(r"\b(20\d{2})\s*[-–/]\s*(20\d{2}|\d{2})\b")

OFFICIAL_SUFFIXES = (".gov", ".gov.in", ".nic.in", ".gov.uk", ".gc.ca", ".gov.au", ".europa.eu", ".int", ".mil")
ACADEMIC_SUFFIXES = (".edu", ".ac.in", ".ac.uk", ".edu.au", ".edu.in", ".res.in")
OFFICIAL_HOST_HINTS = ("scholarships.gov.in", "pib.gov.in", "who.int", "un.org")
NEWS_HOST_HINTS = (
    "reuters", "apnews", "bbc", "nytimes", "theguardian", "washingtonpost", "cnn", "aljazeera",
    "thehindu", "hindustantimes", "indianexpress", "timesofindia", "ndtv", "news18", "indiatoday",
    "livemint", "economictimes", "scroll.in", "thewire", "theprint", "npr", "bloomberg", "ft.com",
    "wsj", "abcnews", "cbsnews", "nbcnews", "news", "deccanherald", "firstpost", "moneycontrol",
)
ACADEMIC_HOST_HINTS = ("arxiv", "doi.org", "researchgate", "springer", "nature.com", "sciencedirect", "jstor")


def iso_date(value: str | None) -> str | None:
    """Parse an explicit date string to ISO format. Returns None if not a clear date."""
    if not value:
        return None
    value = value.strip()
    # PDF metadata format: D:20240115093000+05'30'
    m = re.match(r"^D:(\d{4})(\d{2})(\d{2})", value)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    try:
        dt = dateparser.parse(value, fuzzy=False, dayfirst=False, default=datetime(1900, 1, 1))
    except (ValueError, OverflowError, TypeError):
        return None
    if dt is None or dt.year < 1990 or dt.year > 2100:
        return None
    return dt.date().isoformat()


def parse_iso(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def find_dates_in_text(text: str) -> list[tuple[str, int, int]]:
    """Return (iso_date, start, end) for explicit calendar dates stated in text."""
    found: list[tuple[str, int, int]] = []
    for pat in DATE_PATTERNS:
        for m in pat.finditer(text):
            raw = m.group(0)
            if pat is DATE_PATTERNS[3]:
                # dd/mm/yyyy (common in Indian notices)
                d, mo, y = m.groups()
                try:
                    iso = date(int(y), int(mo), int(d)).isoformat()
                except ValueError:
                    continue
            else:
                iso = iso_date(raw)
            if iso:
                found.append((iso, m.start(), m.end()))
    found.sort(key=lambda t: t[1])
    return found


def normalize_cycle(start: str, end: str) -> str | None:
    y1 = int(start)
    y2 = int(end) if len(end) == 4 else int(str(y1)[:2] + end)
    if y2 != y1 + 1:
        return None
    return f"{y1}-{str(y2)[2:]}"


def detect_academic_cycles(text: str) -> list[str]:
    cycles = []
    for m in CYCLE_PATTERN.finditer(text):
        c = normalize_cycle(m.group(1), m.group(2))
        if c:
            cycles.append(c)
    return cycles


def dominant_academic_cycle(text: str) -> str | None:
    cycles = detect_academic_cycles(text)
    if not cycles:
        return None
    return Counter(cycles).most_common(1)[0][0]


def cycle_end_date(cycle: str) -> date | None:
    """Academic cycle '2023-24' is treated as ending on 31 May of the second year."""
    m = re.match(r"^(20\d{2})-(\d{2})$", cycle or "")
    if not m:
        return None
    return date(int(m.group(1)) + 1, 5, 31)


def current_academic_cycle(today: date) -> str:
    start = today.year if today.month >= 6 else today.year - 1
    return f"{start}-{str(start + 1)[2:]}"


def host_of(url: str | None) -> str | None:
    if not url:
        return None
    host = (urlsplit(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host or None


def classify_source(url: str | None, origin: SourceOrigin, is_pdf: bool) -> tuple[SourceType, str]:
    """Rule-based source classification with an explanation (documented in README)."""
    host = host_of(url) or ""
    if origin == SourceOrigin.uploaded_pdf:
        return SourceType.user_provided, "Uploaded by the user; origin and authority cannot be verified automatically."
    if host.endswith(OFFICIAL_SUFFIXES) or any(h in host for h in OFFICIAL_HOST_HINTS):
        return SourceType.official_primary, f"Domain '{host}' is a government/intergovernmental domain."
    if host.endswith(ACADEMIC_SUFFIXES) or any(h in host for h in ACADEMIC_HOST_HINTS):
        if is_pdf:
            return SourceType.research_document, f"Document hosted on academic domain '{host}'."
        return SourceType.official_primary, f"Domain '{host}' is an academic institution domain."
    if any(h in host for h in NEWS_HOST_HINTS):
        return SourceType.secondary_reporting, f"Domain '{host}' matches a known news publisher pattern."
    if is_pdf:
        return SourceType.research_document, f"PDF document from '{host}' (authority not established)."
    return SourceType.other_web, f"Domain '{host}' is not a recognised official or news domain."


def publisher_from_host(host: str | None) -> str | None:
    if not host:
        return None
    parts = host.split(".")
    if len(parts) >= 3 and parts[-2] in {"gov", "nic", "ac", "co", "edu", "org", "com"}:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])
