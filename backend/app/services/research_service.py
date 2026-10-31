"""Runs one research request through the LangGraph workflow, entirely in memory."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Awaitable, Callable

from app.agents.graph import get_graph
from app.agents.state import ResearchState
from app.core.config import get_settings
from app.schemas.research import (
    ExtractionStatus, ProgressEvent, ResearchRequest, ResearchResponse, UploadedDocument,
)

BASE_LIMITATIONS = [
    "Findings are based only on the sources reviewed; information not found may still exist elsewhere.",
    "Possible conflicts and gaps are prompts for verification, not verdicts on which source is correct.",
    "Evidence and completeness scores are rule-based indicators of evidence quality and coverage, not probabilities of truth.",
    "Publication dates come only from explicit page/PDF metadata; undated sources cannot be checked for freshness.",
    "Results are held only in this browser tab and are not stored on the server.",
]

Emit = Callable[[ProgressEvent], Awaitable[None]]


def initial_state(req: ResearchRequest, uploads: list[UploadedDocument], reference_date: date | None = None) -> ResearchState:
    settings = get_settings()
    return ResearchState(
        research_id=f"R-{uuid.uuid4().hex[:10]}",
        topic=req.topic,
        research_question=req.research_question,
        domain=req.domain,
        user_urls=req.user_urls,
        uploaded_documents=uploads,
        automatic_search=req.automatic_search,
        max_sources=req.max_sources,
        demo_scenario=req.demo_scenario,
        reference_date=(reference_date or date.today()).isoformat(),
        llm_enabled=settings.llm_enabled,
        errors=[], progress=[], limitations=[],
    )


def mode_for(req: ResearchRequest) -> tuple[str, str]:
    settings = get_settings()
    if req.demo_scenario:
        engine = f"Grok ({settings.grok_model})" if settings.llm_enabled else "heuristic extraction"
        return "demo", (f"DEMO: analysing clearly labelled fictional fixture sources with {engine}. "
                        "This is not live research.")
    if settings.llm_enabled:
        return "live", f"Live research using Grok ({settings.grok_model}) structured extraction."
    return "heuristic", ("Heuristic mode: no GROK_API_KEY configured, so claims are extracted with conservative "
                         "rule-based sentence matching. Configure Grok for full-quality analysis.")


async def run_research(req: ResearchRequest, uploads: list[UploadedDocument], emit: Emit | None = None,
                       reference_date: date | None = None) -> ResearchResponse:
    state = initial_state(req, uploads, reference_date)
    config = {"configurable": {"emit": emit}, "recursion_limit": 60}
    final: ResearchState = await get_graph().ainvoke(state, config=config)
    # Release uploaded bytes as soon as the run is complete.
    state["uploaded_documents"] = []
    return to_response(req, final)


def to_response(req: ResearchRequest, final: ResearchState) -> ResearchResponse:
    mode, mode_expl = mode_for(req)
    sources = final.get("sources", [])
    usable = [s for s in sources if s.extraction_status in (ExtractionStatus.success, ExtractionStatus.partial)]
    errors = final.get("errors", [])
    if not usable:
        status = "failed"
    elif errors or len(usable) < len(sources):
        status = "partial"
    else:
        status = "success"
    # Grok was configured but extraction calls failed: the heuristic fallback did the work, so say so.
    if mode == "live" and any(e.stage == "claims" and "Grok" in e.message for e in errors):
        mode_expl = ("Live sources, but Grok extraction failed for at least one source (see processing warnings), "
                     "so rule-based heuristic extraction was used there.")
    limitations = list(dict.fromkeys(final.get("limitations", []) + BASE_LIMITATIONS))
    if mode == "heuristic" or mode_expl.startswith("Live sources, but"):
        limitations.insert(0, mode_expl)
    report = final["final_report"]
    return ResearchResponse(
        research_id=final["research_id"],
        created_at=datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        domain=final["domain"], topic=final["topic"], research_question=final.get("research_question", ""),
        mode=mode, mode_explanation=mode_expl, status=status, summary=report.executive_summary,
        search_queries=final.get("search_queries", []), sources=sources, claims=final.get("claims", []),
        conflicts=final.get("conflicts", []), scope_notes=final.get("scope_notes", []),
        information_gaps=final.get("information_gaps", []), freshness_warnings=final.get("freshness_warnings", []),
        source_freshness=final.get("source_freshness", []), coverage_matrix=final["coverage_matrix"],
        claim_relationships=final["claim_relationships"], evidence_assessment=final["evidence_assessment"],
        research_completeness=final["research_completeness"], verification_checklist=final.get("verification_checklist", []),
        final_report=report, limitations=limitations, errors=errors,
    )
