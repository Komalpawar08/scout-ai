"""Value normalisation and comparison used by conflict detection and corroboration."""

from __future__ import annotations

import re

from app.schemas.research import Claim
from app.services.metadata import iso_date

STOPWORDS = {
    "the", "a", "an", "of", "for", "to", "in", "on", "and", "or", "is", "are", "was", "were", "be", "by",
    "with", "at", "as", "this", "that", "from", "it", "its", "scholarship", "scheme", "has", "have",
}

NUMBER_RE = re.compile(r"-?\d[\d,]*(?:\.\d+)?")
MONEY_RE = re.compile(
    r"(?:(?:₹|rs\.?|inr|\$|usd)\s*)?(\d[\d,]*(?:\.\d+)?)\s*(lakh|lakhs|lac|crore|crores|million|billion|thousand|k)?",
    re.I,
)
MULTIPLIERS = {
    "lakh": 1e5, "lakhs": 1e5, "lac": 1e5, "crore": 1e7, "crores": 1e7,
    "million": 1e6, "billion": 1e9, "thousand": 1e3, "k": 1e3,
}

UNIT_SYNONYMS = {
    "killed": "deaths", "dead": "deaths", "death": "deaths", "deaths": "deaths", "fatalities": "deaths",
    "died": "deaths", "lives": "deaths", "injured": "injured", "injuries": "injured", "hurt": "injured",
    "wounded": "injured", "missing": "missing", "displaced": "displaced", "evacuated": "evacuated",
    "%": "percent", "percent": "percent", "per cent": "percent", "percentage": "percent",
}


def tokens(text: str | None) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", (text or "").lower()) if t not in STOPWORDS and len(t) > 1}


def jaccard(a: str | None, b: str | None) -> float:
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def parse_number(text: str | None) -> float | None:
    if not text:
        return None
    m = NUMBER_RE.search(text.replace("₹", ""))
    if not m:
        return None
    try:
        return float(m.group(0).replace(",", ""))
    except ValueError:
        return None


def parse_money(text: str | None) -> float | None:
    if not text:
        return None
    m = MONEY_RE.search(text)
    if not m:
        return None
    try:
        num = float(m.group(1).replace(",", ""))
    except ValueError:
        return None
    mult = MULTIPLIERS.get((m.group(2) or "").lower(), 1)
    return num * mult


def normalize_unit(unit: str | None) -> str | None:
    if not unit:
        return None
    u = unit.lower().strip()
    return UNIT_SYNONYMS.get(u, u)


def list_items(claim: Claim) -> set[str]:
    raw = claim.normalized_value or claim.value
    parts = re.split(r"[;,\n]| and ", raw.lower())
    return {re.sub(r"[^a-z0-9 ]", "", p).strip() for p in parts if p.strip() and len(p.strip()) > 2}


def numeric_value(claim: Claim) -> float | None:
    if claim.value_type == "money":
        if claim.normalized_value:
            n = parse_number(claim.normalized_value)
            if n is not None:
                return n
        return parse_money(claim.value)
    return parse_number(claim.normalized_value) if claim.normalized_value else parse_number(claim.value)


def date_value(claim: Claim) -> str | None:
    return iso_date(claim.normalized_value) or iso_date(claim.value)


def comparable_kind(claim: Claim) -> str:
    if claim.value_type in ("number", "percent", "money"):
        return "numeric"
    if claim.value_type == "date":
        return "date"
    if claim.value_type == "list":
        return "list"
    return "text"


def values_agree(a: Claim, b: Claim) -> bool | None:
    """True if values agree, False if they disagree, None if not comparable."""
    ka, kb = comparable_kind(a), comparable_kind(b)
    if ka != kb:
        return None
    if ka == "numeric":
        va, vb = numeric_value(a), numeric_value(b)
        if va is None or vb is None:
            return None
        if va == vb:
            return True
        return abs(va - vb) / max(abs(va), abs(vb), 1e-9) <= 0.01
    if ka == "date":
        da, db = date_value(a), date_value(b)
        if not da or not db:
            return None
        return da == db
    if ka == "list":
        ia, ib = list_items(a), list_items(b)
        if not ia or not ib:
            return None
        return ia == ib
    sim = jaccard(a.normalized_value or a.value, b.normalized_value or b.value)
    if sim >= 0.5:
        return True
    return None  # free-text difference is not decidable by rules


def units_compatible(a: Claim, b: Claim) -> bool:
    ua, ub = normalize_unit(a.unit), normalize_unit(b.unit)
    if a.value_type == "percent" and b.value_type == "percent":
        return True
    if ua and ub:
        return ua == ub
    return True
