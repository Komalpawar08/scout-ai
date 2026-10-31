"""Information gap detection and the Information Coverage Matrix.

Both are computed per expected field of the domain template from verified claims,
conflicts and source extraction status. Absence is always phrased as
"Not found in the sources reviewed", never as "does not exist".
"""

from __future__ import annotations

from datetime import date

from app.agents.templates import ExpectedField, get_template
from app.schemas.research import (
    Claim, Conflict, CoverageCell, CoverageMatrix, CoverageRow, CoverageStatus, Domain, ExtractionStatus,
    InformationGap, Priority, QuoteMatch, Source,
)
from app.services.metadata import current_academic_cycle

NOT_FOUND = "Not found in the sources reviewed"
PRIORITY_ORDER = [Priority.critical, Priority.high, Priority.medium, Priority.low]
OVERALL_LABELS = {
    CoverageStatus.found: "Complete",
    CoverageStatus.partially_found: "Partial",
    CoverageStatus.not_found: "Gap",
    CoverageStatus.conflicting: "Needs review",
    CoverageStatus.unable_to_determine: "Unable to determine",
}


def usable_sources(sources: list[Source]) -> list[Source]:
    return [s for s in sources if s.extraction_status in (ExtractionStatus.success, ExtractionStatus.partial)]


def is_verified(c: Claim) -> bool:
    """Directly quoted, not inferred, and not a statement that the information is unknown."""
    return c.quote_match != QuoteMatch.not_found and not c.is_inferred and not c.is_uncertain


def _lower(p: Priority, steps: int = 1) -> Priority:
    return PRIORITY_ORDER[min(PRIORITY_ORDER.index(p) + steps, len(PRIORITY_ORDER) - 1)]


def _raise_to(p: Priority, floor: Priority) -> Priority:
    return PRIORITY_ORDER[min(PRIORITY_ORDER.index(p), PRIORITY_ORDER.index(floor))]


def field_status(field: ExpectedField, claims: list[Claim], conflicts: list[Conflict],
                 usable: list[Source]) -> tuple[CoverageStatus, list[Claim], set[str]]:
    field_claims = [c for c in claims if c.claim_category == field.key]
    verified_sources = {c.source_id for c in field_claims if is_verified(c)}
    if not usable:
        return CoverageStatus.unable_to_determine, field_claims, verified_sources
    if any(k.field == field.key for k in conflicts):
        return CoverageStatus.conflicting, field_claims, verified_sources
    if verified_sources:
        return CoverageStatus.found, field_claims, verified_sources
    if field_claims:
        return CoverageStatus.partially_found, field_claims, verified_sources
    return CoverageStatus.not_found, field_claims, verified_sources


def suggested_search(domain: Domain, topic: str, field: ExpectedField, today_cycle: str) -> str:
    if domain == Domain.scholarship:
        return f"{topic} {field.search_hint} {today_cycle} official notice"
    return f"{topic} {field.search_hint} latest"


def detect_gaps(domain: Domain, topic: str, sources: list[Source], claims: list[Claim],
                conflicts: list[Conflict], today_cycle: str | None = None) -> list[InformationGap]:
    today_cycle = today_cycle or current_academic_cycle(date.today())
    usable = usable_sources(sources)
    checked = [s.source_id for s in usable]
    gaps: list[InformationGap] = []

    for field in get_template(domain):
        status, field_claims, verified_sources = field_status(field, claims, conflicts, usable)
        related = [c.claim_id for c in field_claims]
        n = len(usable)
        if status == CoverageStatus.found:
            # A critical field supported by only one of several sources lacks independent corroboration.
            if field.critical and len(verified_sources) == 1 and n >= 2:
                sid = next(iter(verified_sources))
                gaps.append(_gap(gaps, field, CoverageStatus.partially_found, checked, related, domain, topic,
                                 today_cycle, _lower(field.priority),
                                 f"{field.label} is stated only in {sid}; the other {n - 1} source(s) reviewed do not "
                                 "mention it, so it has no independent corroboration.", 0.6))
            continue
        if status == CoverageStatus.conflicting:
            ids = [k.conflict_id for k in conflicts if k.field == field.key]
            gaps.append(_gap(gaps, field, status, checked, related, domain, topic, today_cycle,
                             _raise_to(field.priority, Priority.high),
                             f"Sources disagree about {field.label.lower()} (see {', '.join(ids)}).", 0.7))
        elif status == CoverageStatus.partially_found:
            uncertain = [c for c in field_claims if c.is_uncertain]
            if uncertain:
                ids = sorted({c.source_id for c in uncertain})
                why = (f"{field.label} is mentioned, but {', '.join(ids)} explicitly state(s) it is unclear or "
                       "unconfirmed. No source reviewed provides the actual information.")
            else:
                why = (f"{field.label} is only mentioned indirectly or the supporting quotation could not be "
                       "located verbatim in the source text.")
            gaps.append(_gap(gaps, field, status, checked, related, domain, topic, today_cycle, field.priority, why, 0.6))
        elif status == CoverageStatus.not_found:
            conf = round(min(0.9, 0.4 + 0.12 * n), 2)
            gaps.append(_gap(gaps, field, status, checked, related, domain, topic, today_cycle, field.priority,
                             f"{field.label}: {NOT_FOUND} ({n} source(s) checked). This does not mean the "
                             "information does not exist.", conf))
        else:
            gaps.append(_gap(gaps, field, status, checked, related, domain, topic, today_cycle, field.priority,
                             f"{field.label} could not be assessed because no source content was extracted.", 0.3))
    return gaps


def _gap(gaps, field: ExpectedField, status, checked, related, domain, topic, cycle, priority, explanation, conf):
    return InformationGap(
        gap_id=f"G{len(gaps) + 1}", expected_field=field.key, field_label=field.label, explanation=explanation,
        why_it_matters=field.why_it_matters, coverage_status=status, sources_checked=checked,
        related_claims=related, suggested_search=suggested_search(domain, topic, field, cycle),
        recommended_verification=field.verification, priority=priority, confidence=conf,
    )


def build_coverage_matrix(domain: Domain, sources: list[Source], claims: list[Claim],
                          conflicts: list[Conflict]) -> CoverageMatrix:
    usable = usable_sources(sources)
    rows: list[CoverageRow] = []
    conflict_claims: dict[str, set[str]] = {}
    for k in conflicts:
        conflict_claims.setdefault(k.field, set()).update({k.claim_a, k.claim_b})
    for field in get_template(domain):
        status, field_claims, verified_sources = field_status(field, claims, conflicts, usable)
        cells: list[CoverageCell] = []
        for s in sources:
            sc = [c for c in field_claims if c.source_id == s.source_id]
            ids = [c.claim_id for c in sc]
            if s not in usable:
                cell = "failed"
            elif any(cid in conflict_claims.get(field.key, set()) for cid in ids):
                cell = "conflict"
            elif any(is_verified(c) for c in sc):
                cell = "found"
            elif sc:
                cell = "partial"
            else:
                cell = "missing"
            cells.append(CoverageCell(source_id=s.source_id, status=cell, claim_ids=ids))
        label = OVERALL_LABELS[status]
        if status == CoverageStatus.found and len(verified_sources) == 1 and len(usable) >= 2:
            label = "Single source"
        rows.append(CoverageRow(field=field.key, label=field.label, critical=field.critical, cells=cells,
                                overall=status, overall_label=label))
    return CoverageMatrix(domain=domain, sources=[s.source_id for s in sources], rows=rows)
