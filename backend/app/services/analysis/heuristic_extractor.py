"""Rule-based claim extractor used when no Grok API key is configured.

It is deliberately conservative: every claim is a verbatim sentence from the source,
labelled extraction_method="heuristic", so the downstream evidence pipeline can still
run and the UI can be tested. It is NOT a substitute for LLM extraction.
"""

from __future__ import annotations

import re

from app.agents.templates import ExpectedField, get_template
from app.agents.prompts.schemas import ExtractedClaim
from app.schemas.research import Domain
from app.services.analysis.values import MONEY_RE, MULTIPLIERS
from app.services.metadata import CYCLE_PATTERN, find_dates_in_text, normalize_cycle

# Split after sentence punctuation followed by whitespace, so "2.5 lakh" and URLs stay intact.
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(₹])")
UNCERTAINTY_MARKERS = ("unclear", "not yet known", "not known", "not confirmed", "remains to be seen",
                       "under investigation", "yet to be", "not specified")
MAX_CATEGORIES_PER_SENTENCE = 2
PERCENT_RE = re.compile(r"(\d{1,3}(?:\.\d+)?)\s*(%|per\s?cent|percent)", re.I)
CGPA_RE = re.compile(r"(\d(?:\.\d+)?)\s*cgpa|cgpa\s*(?:of\s*)?(\d(?:\.\d+)?)", re.I)
STAT_RE = re.compile(
    r"(\d[\d,]*)\s+(?:people\s+|persons\s+|workers\s+|passengers\s+)?(?:were\s+|have\s+been\s+|had\s+been\s+)?"
    r"(killed|dead|deaths|died|injured|wounded|hurt|missing|displaced|evacuated|fatalities)",
    re.I,
)
STAT_RE_2 = re.compile(r"(death toll|toll|number of (?:dead|injured))\D{0,30}?(\d[\d,]*)", re.I)
URL_RE = re.compile(r"https?://[^\s)\]>\"']+|www\.[^\s)\]>\"']+", re.I)
WEEKDAY_RE = re.compile(r"\bon (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b", re.I)

DOCUMENTS = (
    "aadhaar card", "income certificate", "caste certificate", "domicile certificate", "mark sheet",
    "marksheet", "bank passbook", "passport size photograph", "photograph", "bonafide certificate",
    "fee receipt", "admission letter", "disability certificate", "transfer certificate", "id proof",
    "self-declaration", "previous year mark sheet",
)
SCOPE_QUALIFIERS = (
    "post-matric", "pre-matric", "undergraduate", "postgraduate", "class 10", "class 12", "girls",
    "sc", "st", "obc", "minority", "general category", "ews", "diploma", "phd",
)
MAX_PER_FIELD = 3
VALUE_FIELDS = {
    "minimum_marks", "income_criteria", "deadline", "required_documents", "academic_cycle", "official_link",
    "statistics", "date_location",
}


def _sentences(text: str):
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue  # headings are titles, not claims
        for s in SENTENCE_SPLIT_RE.split(line.lstrip("*-• ")):
            s = s.strip()
            if 25 <= len(s) <= 450:
                yield s


def _scope(sentence: str) -> str | None:
    low = sentence.lower()
    found = [q for q in SCOPE_QUALIFIERS if re.search(rf"\b{re.escape(q)}\b", low)]
    return ", ".join(found) if found else None


def _money(sentence: str) -> tuple[str, float] | None:
    for m in MONEY_RE.finditer(sentence):
        prefix = sentence[max(0, m.start() - 4): m.start() + 4].lower()
        has_marker = m.group(2) or any(k in prefix for k in ("₹", "rs", "inr", "$"))
        if not has_marker:
            continue
        num = float(m.group(1).replace(",", ""))
        mult = MULTIPLIERS.get((m.group(2) or "").lower(), 1)
        return m.group(0).strip(), num * mult
    return None


def _claim_for(field: ExpectedField, sentence: str, domain: Domain) -> ExtractedClaim | None:
    low = sentence.lower()
    base = dict(category=field.key, supporting_quote=sentence, scope=_scope(sentence), confidence=0.5)
    subject = field.label
    key = field.key

    if key == "minimum_marks":
        m = PERCENT_RE.search(sentence)
        if m and any(k in low for k in ("marks", "percentage", "scored", "minimum", "aggregate")):
            return ExtractedClaim(claim_text=sentence, subject=subject, value=m.group(0), value_type="percent",
                                  normalized_value=m.group(1), unit="percent", **base)
        m = CGPA_RE.search(sentence)
        if m:
            v = m.group(1) or m.group(2)
            return ExtractedClaim(claim_text=sentence, subject=subject, value=m.group(0), value_type="number",
                                  normalized_value=v, unit="cgpa", **base)
        return None
    if key == "income_criteria":
        if "income" not in low:
            return None
        money = _money(sentence)
        if not money:
            return None
        return ExtractedClaim(claim_text=sentence, subject=subject, value=money[0], value_type="money",
                              normalized_value=str(int(money[1])), unit="currency per year", **base)
    if key == "deadline":
        if not any(k in low for k in ("last date", "deadline", "closes", "apply by", "extended")):
            return None
        dates = find_dates_in_text(sentence)
        if not dates:
            return None
        iso, s, e = dates[-1]
        return ExtractedClaim(claim_text=sentence, subject=subject, value=sentence[s:e], value_type="date",
                              normalized_value=iso, **base)
    if key == "required_documents":
        docs = sorted({d for d in DOCUMENTS if d in low})
        if len(docs) < 1 or not any(k in low for k in ("document", "certificate", "submit", "upload", "attach", "required")):
            return None
        return ExtractedClaim(claim_text=sentence, subject=subject, value=", ".join(docs), value_type="list",
                              normalized_value="; ".join(docs), **base)
    if key == "academic_cycle":
        m = CYCLE_PATTERN.search(sentence)
        if not m or not any(k in low for k in ("academic", "session", "year", "cycle")):
            return None
        cycle = normalize_cycle(m.group(1), m.group(2))
        if not cycle:
            return None
        return ExtractedClaim(claim_text=sentence, subject=subject, value=cycle, value_type="text",
                              normalized_value=cycle, relevant_period=cycle, **base)
    if key == "official_link":
        m = URL_RE.search(sentence)
        if not m:
            return None
        return ExtractedClaim(claim_text=sentence, subject=subject, value=m.group(0).rstrip(".,"), value_type="text",
                              normalized_value=m.group(0).rstrip(".,").lower(), **base)
    if key == "statistics":
        m = STAT_RE.search(sentence)
        if m:
            unit = m.group(2).lower()
            return ExtractedClaim(claim_text=sentence, subject=f"Number {unit}", value=m.group(0),
                                  value_type="number", normalized_value=m.group(1).replace(",", ""),
                                  unit=unit, **base)
        m = STAT_RE_2.search(sentence)
        if m:
            return ExtractedClaim(claim_text=sentence, subject="Death toll", value=m.group(0), value_type="number",
                                  normalized_value=m.group(2).replace(",", ""), unit="deaths", **base)
        return None
    if key == "date_location":
        dates = find_dates_in_text(sentence)
        if dates and any(k in low for k in ("occurred", "happened", "took place", "collapsed", "struck", "on ")):
            iso, s, e = dates[0]
            return ExtractedClaim(claim_text=sentence, subject="Event date", value=sentence[s:e], value_type="date",
                                  normalized_value=iso, **base)
        if WEEKDAY_RE.search(sentence) and any(k in low for k in ("district", "city", "near", "village", "town")):
            return ExtractedClaim(claim_text=sentence, subject="Event date and location", value=sentence,
                                  value_type="text", **base)
        return None

    # Text-valued fields: keyword cue required.
    if not any(k in low for k in field.keywords):
        return None
    return ExtractedClaim(claim_text=sentence, subject=subject, value=sentence, value_type="text",
                          confidence=0.4, category=key, supporting_quote=sentence, scope=base["scope"])


def heuristic_extract(domain: Domain, text: str) -> list[ExtractedClaim]:
    # Value-bearing fields first so "income below ₹2.5 lakh ... eligible" becomes an income claim.
    template = sorted(get_template(domain), key=lambda f: f.key not in VALUE_FIELDS)
    counts: dict[str, int] = {}
    claims: list[ExtractedClaim] = []
    seen: set[tuple[str, str]] = set()
    for sentence in _sentences(text):
        per_sentence = 0
        uncertain = any(m in sentence.lower() for m in UNCERTAINTY_MARKERS)
        for field in template:
            if per_sentence >= MAX_CATEGORIES_PER_SENTENCE:
                break
            if counts.get(field.key, 0) >= MAX_PER_FIELD:
                continue
            claim = _claim_for(field, sentence, domain)
            if claim is None:
                continue
            sig = (claim.category, claim.supporting_quote)
            if sig in seen:
                continue
            seen.add(sig)
            # A sentence saying something is unknown does not answer that field.
            if uncertain and field.key != "unanswered_questions":
                claim.is_uncertain = True
            counts[field.key] = counts.get(field.key, 0) + 1
            per_sentence += 1
            claims.append(claim)
    return claims
