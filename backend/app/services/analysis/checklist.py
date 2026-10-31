"""Prioritised verification checklist derived from real gaps, conflicts, freshness
warnings and unsupported evidence."""

from __future__ import annotations

from app.agents.templates import field_map
from app.schemas.research import (
    ChecklistItem, Claim, Conflict, CoverageStatus, Domain, EvidenceStatus, FreshnessStatus, FreshnessWarning,
    InformationGap, Priority, Source, SourceType,
)

PRIORITY_RANK = {Priority.critical: 0, Priority.high: 1, Priority.medium: 2, Priority.low: 3}

SCHOLARSHIP_TASKS = {
    "deadline": "Verify the current scholarship application deadline",
    "required_documents": "Confirm the official list of required documents",
    "renewal_requirements": "Check the latest renewal policy",
    "income_criteria": "Verify the family income limit",
    "minimum_marks": "Confirm the minimum marks requirement",
    "eligibility": "Confirm eligibility conditions",
    "official_link": "Locate the official application portal",
    "academic_cycle": "Confirm the notice applies to the current academic cycle",
    "application_process": "Confirm the step-by-step application process",
    "selection_process": "Confirm how recipients are selected",
}
NEWS_TASKS = {
    "official_response": "Confirm the latest official response to the event",
    "statistics": "Verify the latest official figures",
    "date_location": "Confirm the event date and location",
    "event_description": "Confirm what happened from independent sources",
    "subsequent_developments": "Check for subsequent developments",
    "main_entities": "Confirm the names and roles of those involved",
    "key_claims": "Trace the key claims to attributed statements",
    "context": "Find context needed to interpret the event",
    "background": "Review background and earlier incidents",
    "unanswered_questions": "Follow up on unanswered questions",
}


def _official_hint(sources: list[Source], domain: Domain) -> str:
    official = [s for s in sources if s.source_type == SourceType.official_primary and s.url]
    if official:
        return f"Official source already reviewed: {official[0].url} ({official[0].source_id}) — check its latest version"
    if domain == Domain.scholarship:
        return "Official scholarship portal or the issuing department/institution website"
    return "Official statements from the responsible authority (government, police or organisation press releases)"


def build_checklist(domain: Domain, sources: list[Source], claims: list[Claim], conflicts: list[Conflict],
                    gaps: list[InformationGap], warnings: list[FreshnessWarning]) -> list[ChecklistItem]:
    fields = field_map(domain)
    tasks = SCHOLARSHIP_TASKS if domain == Domain.scholarship else NEWS_TASKS
    hint = _official_hint(sources, domain)
    items: list[ChecklistItem] = []
    seen: set[str] = set()

    def add(**kw):
        key = kw["task"] + (kw.get("related_conflict_id") or "") + (kw.get("related_gap_id") or "")
        if key in seen:
            return
        seen.add(key)
        items.append(ChecklistItem(task_id="", **kw))

    by_field: dict[str, list[Conflict]] = {}
    for k in conflicts:
        by_field.setdefault(k.field, []).append(k)
    for field_key, group in by_field.items():
        f = fields.get(field_key)
        prio = Priority.critical if f and f.critical else Priority.high
        base = tasks.get(field_key, f"Resolve differing information about {field_key.replace('_', ' ')}")
        srcs = sorted({s for k in group for s in (k.source_a, k.source_b)})
        reason = f"{len(group)} possible conflict(s) across {', '.join(srcs)}: " + " ".join(
            f"[{k.conflict_id}] {k.explanation}" for k in group)
        add(task=f"{base} — sources disagree", reason=reason, priority=prio,
            related_conflict_id=", ".join(k.conflict_id for k in group),
            suggested_source=hint, suggested_action=group[0].recommended_verification)

    for g in gaps:
        if g.coverage_status == CoverageStatus.conflicting:
            continue  # covered by conflict items
        base = tasks.get(g.expected_field, f"Find information about {g.field_label.lower()}")
        add(task=base, reason=g.explanation, priority=g.priority, related_gap_id=g.gap_id,
            suggested_source=hint, suggested_action=f"{g.recommended_verification} Suggested search: \"{g.suggested_search}\"")

    for w in warnings:
        if w.status in (FreshnessStatus.potentially_outdated, FreshnessStatus.conflicting_dates):
            prio = Priority.high if domain == Domain.scholarship else Priority.medium
            if w.source_id:
                task = f"Check whether information in {w.source_id} is still current"
            elif domain == Domain.scholarship:
                task = "Confirm which academic cycle the information applies to"
            else:
                task = "Confirm the correct event date"
            add(task=task, reason=w.reason, priority=prio,
                related_claim_id=w.claim_id, suggested_source=hint,
                suggested_action="Compare against the most recent official publication or update." )

    for c in claims:
        f = fields.get(c.claim_category)
        if c.evidence_status in (EvidenceStatus.unsupported, EvidenceStatus.ai_inferred) and f and f.critical:
            add(task=f"Verify unsupported claim {c.claim_id}: {c.claim_text[:90]}",
                reason="The supporting quotation could not be located verbatim in the source text.",
                priority=Priority.medium, related_claim_id=c.claim_id,
                suggested_source=f"Re-read {c.source_id} and an official source",
                suggested_action="Locate the exact statement in the original document before relying on it.")

    items.sort(key=lambda i: PRIORITY_RANK[i.priority])
    for n, item in enumerate(items, start=1):
        item.task_id = f"T{n}"
    return items
