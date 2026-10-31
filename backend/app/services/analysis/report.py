"""Deterministic report narrative and the findings digest handed to Grok."""

from __future__ import annotations

from app.schemas.research import (
    Claim, Conflict, CoverageStatus, Domain, EvidenceStatus, FinalReport, FreshnessWarning, InformationGap,
    ResearchCompleteness, Source,
)
from app.services.analysis.gaps import usable_sources


def findings_digest(sources: list[Source], claims: list[Claim], conflicts: list[Conflict],
                    gaps: list[InformationGap], warnings: list[FreshnessWarning],
                    completeness: ResearchCompleteness | None) -> str:
    lines = ["SOURCES:"]
    for s in sources:
        lines.append(f"[{s.source_id}] {s.title} | {s.source_type.value} | published {s.publication_date or 'n/a'} | "
                     f"{s.extraction_status.value}")
    lines.append("CLAIMS (verified quotes only):")
    for c in claims[:40]:
        lines.append(f"[{c.claim_id}/{c.source_id}] ({c.claim_category}, {c.evidence_status.value}) {c.claim_text[:200]}")
    lines.append("POSSIBLE CONFLICTS:")
    for k in conflicts:
        lines.append(f"[{k.conflict_id}] {k.field}: {k.explanation}")
    lines.append("GAPS:")
    for g in gaps:
        lines.append(f"[{g.gap_id}] {g.field_label}: {g.coverage_status.value} — {g.explanation}")
    lines.append("FRESHNESS WARNINGS:")
    for w in warnings:
        lines.append(f"[{w.warning_id}] {w.status.value}: {w.reason}")
    if completeness:
        lines.append(f"RESEARCH COMPLETENESS: {completeness.score}/100 ({completeness.label})")
    return "\n".join(lines)


def deterministic_report(domain: Domain, topic: str, sources: list[Source], claims: list[Claim],
                         conflicts: list[Conflict], gaps: list[InformationGap], warnings: list[FreshnessWarning],
                         completeness: ResearchCompleteness | None) -> FinalReport:
    usable = usable_sources(sources)
    strong = [c for c in claims if c.evidence_status in (EvidenceStatus.directly_supported, EvidenceStatus.corroborated)]
    not_found = [g for g in gaps if g.coverage_status == CoverageStatus.not_found]
    summary = (
        f"Scout reviewed {len(usable)} of {len(sources)} source(s) about \"{topic}\" and extracted "
        f"{len(claims)} traceable claim(s), {len(strong)} of which are directly quoted or corroborated. "
        f"It found {len(conflicts)} possible conflict(s), {len(not_found)} expected field(s) not found in the sources "
        f"reviewed and {len(warnings)} freshness warning(s)."
    )
    if completeness:
        summary += f" Research completeness against the {domain.value} criteria is {completeness.score}/100 ({completeness.label.lower()})."
    findings: list[str] = []
    corroborated = [c for c in claims if c.evidence_status == EvidenceStatus.corroborated]
    seen_fields: set[str] = set()
    for c in corroborated:
        if c.claim_category not in seen_fields:
            seen_fields.add(c.claim_category)
            findings.append(f"Corroborated: {c.claim_text[:160]} [{c.source_id}]")
    for k in conflicts[:3]:
        findings.append(f"{k.label} on {k.field.replace('_', ' ')}: {k.explanation}")
    for g in not_found[:3]:
        findings.append(f"{g.field_label}: not found in the sources reviewed.")
    questions = [f"What is the confirmed {g.field_label.lower()}?" for g in gaps
                 if g.coverage_status in (CoverageStatus.not_found, CoverageStatus.conflicting)][:6]
    return FinalReport(
        title=f"Scout AI — {domain.value.title()} Intelligence Report: {topic}",
        executive_summary=summary, key_findings=findings[:8], unanswered_questions=questions,
        generated_by="deterministic",
    )
