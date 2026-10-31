"""report_generator node: narrative summary (Grok when available, deterministic otherwise).

Also serves as the terminal node of the 'insufficient sources' route, where it fills
empty-but-valid analysis results so the API contract is always satisfied.
"""

from __future__ import annotations

from langchain_core.runnables import RunnableConfig

from app.agents.nodes.common import emit
from app.agents.prompts.schemas import ReportNarrative
from app.agents.prompts.templates import report_prompt
from app.agents.state import ResearchState
from app.schemas.research import FinalReport, StageError
from app.services.analysis.checklist import build_checklist
from app.services.analysis.gaps import build_coverage_matrix, detect_gaps
from app.services.analysis.relationships import build_graph
from app.services.analysis.report import deterministic_report, findings_digest
from app.services.analysis.scoring import CLAIM_WEIGHTS, compute_completeness
from app.schemas.research import ClaimRelationships, EvidenceAssessment
from app.services.llm.grok_client import LLMError, get_llm_client


def _fill_missing(state: ResearchState) -> dict:
    """Defaults for the insufficient-sources route (no claims could be analysed)."""
    domain, sources = state["domain"], state.get("sources", [])
    gaps = detect_gaps(domain, state["topic"], sources, [], [])
    matrix = build_coverage_matrix(domain, sources, [], [])
    return {
        "claims": [], "conflicts": [], "scope_notes": [], "information_gaps": gaps,
        "freshness_warnings": [], "source_freshness": [],
        "evidence_assessment": EvidenceAssessment(method="No claims to assess.", weights=CLAIM_WEIGHTS, claims=[], sources=[]),
        "coverage_matrix": matrix,
        "claim_relationships": build_graph(sources, [], [], gaps) if sources else ClaimRelationships(nodes=[], edges=[]),
        "verification_checklist": build_checklist(domain, sources, [], [], gaps, []),
        "research_completeness": compute_completeness(domain, sources, [], [], gaps,
                                                      {r.field: r.overall for r in matrix.rows}, None),
    }


async def report_generator(state: ResearchState, config: RunnableConfig) -> dict:
    events = [await emit(config, "report", "started")]
    updates: dict = {}
    errors: list[StageError] = []
    if "research_completeness" not in state:
        updates = _fill_missing(state)
        events.append(await emit(config, "report", "warning",
                                 "No source content could be analysed; returning a partial report"))
    merged = {**state, **updates}

    report = deterministic_report(
        merged["domain"], merged["topic"], merged.get("sources", []), merged.get("claims", []),
        merged.get("conflicts", []), merged.get("information_gaps", []), merged.get("freshness_warnings", []),
        merged.get("research_completeness"),
    )
    client = get_llm_client()
    if client is not None and merged.get("claims"):
        digest = findings_digest(merged.get("sources", []), merged.get("claims", []), merged.get("conflicts", []),
                                 merged.get("information_gaps", []), merged.get("freshness_warnings", []),
                                 merged.get("research_completeness"))
        try:
            system, user = report_prompt(merged["domain"], merged["topic"], merged.get("research_question", ""), digest)
            narrative = await client.structured(system, user, ReportNarrative, max_tokens=1500)
            report = FinalReport(title=report.title, executive_summary=narrative.executive_summary,
                                 key_findings=narrative.key_findings or report.key_findings,
                                 unanswered_questions=narrative.unanswered_questions or report.unanswered_questions,
                                 generated_by="llm")
        except LLMError as exc:
            errors.append(StageError(stage="report", message=f"Grok summary failed; deterministic summary used: {exc}"))
    events.append(await emit(config, "report", "completed", "Report ready"))
    return {**updates, "final_report": report, "progress": events, "errors": errors}
