"""Analysis nodes. Each writes only its own state keys so parallel branches are safe."""

from __future__ import annotations

from langchain_core.runnables import RunnableConfig

from app.agents.nodes.common import emit, today
from app.agents.prompts.schemas import ConflictAdjudication
from app.agents.prompts.templates import conflict_prompt
from app.agents.state import ResearchState
from app.agents.templates import field_map
from app.schemas.research import Conflict, CoverageStatus, ScopeNote, StageError
from app.services.analysis.checklist import build_checklist
from app.services.analysis.conflicts import detect_conflicts
from app.services.analysis.freshness import freshness_warnings, source_freshness
from app.services.analysis.gaps import build_coverage_matrix, detect_gaps
from app.services.analysis.relationships import build_graph
from app.services.analysis.scoring import assess_claims, compute_completeness
from app.services.llm.grok_client import LLMError, get_llm_client
from app.services.metadata import current_academic_cycle

MAX_LLM_PAIRS = 12


async def conflict_detector(state: ResearchState, config: RunnableConfig) -> dict:
    events = [await emit(config, "conflicts", "started")]
    domain = state["domain"]
    fields = field_map(domain)
    claims = state.get("claims", [])
    conflicts, notes, text_pairs = detect_conflicts(claims, fields)
    errors: list[StageError] = []

    client = get_llm_client()
    if client is not None and text_pairs:
        pairs = text_pairs[:MAX_LLM_PAIRS]
        listing = "\n".join(
            f"pair_id=P{i} field={a.claim_category}\n  A [{a.source_id}] scope={a.scope} period={a.relevant_period}: "
            f"{a.claim_text}\n  B [{b.source_id}] scope={b.scope} period={b.relevant_period}: {b.claim_text}"
            for i, (a, b) in enumerate(pairs)
        )
        try:
            system, user = conflict_prompt(domain, listing)
            result = await client.structured(system, user, ConflictAdjudication, max_tokens=2500)
            by_id = {f"P{i}": p for i, p in enumerate(pairs)}
            for d in result.decisions:
                pair = by_id.get(d.pair_id)
                if not pair:
                    continue
                a, b = pair
                if d.is_conflict and d.same_scope:
                    conflicts.append(Conflict(
                        conflict_id=f"K{len(conflicts) + 1}", label="Potential inconsistency", claim_a=a.claim_id,
                        claim_b=b.claim_id, source_a=a.source_id, source_b=b.source_id,
                        quotation_a=a.supporting_quote, quotation_b=b.supporting_quote, field=a.claim_category,
                        explanation=d.explanation, conflict_type=d.conflict_type, confidence=round(min(d.confidence, 0.7), 2),
                        scope_checks={"assessment": "LLM judged both claims to share entity, period and scope"},
                        recommended_verification=fields[a.claim_category].verification, detection_method="llm",
                    ))
                elif d.is_conflict and not d.same_scope:
                    notes.append(ScopeNote(claim_a=a.claim_id, claim_b=b.claim_id, field=a.claim_category,
                                           note=f"Different scope: {d.explanation}"))
        except LLMError as exc:
            errors.append(StageError(stage="conflicts", message=f"LLM conflict adjudication skipped: {exc}"))

    msg = f"{len(conflicts)} possible conflict(s)"
    if notes:
        msg += f"; {len(notes)} difference(s) explained by different scope/period (not flagged)"
    events.append(await emit(config, "conflicts", "completed", msg))
    return {"conflicts": conflicts, "scope_notes": notes, "progress": events, "errors": errors}


async def freshness_checker(state: ResearchState, config: RunnableConfig) -> dict:
    events = [await emit(config, "freshness", "started")]
    ref = today(state)
    per_source = source_freshness(state.get("sources", []), state["domain"], ref)
    warnings = freshness_warnings(state.get("sources", []), state.get("claims", []), per_source, state["domain"], ref)
    events.append(await emit(config, "freshness", "completed", f"{len(warnings)} freshness warning(s)"))
    return {"source_freshness": per_source, "freshness_warnings": warnings, "progress": events}


async def information_gap_detector(state: ResearchState, config: RunnableConfig) -> dict:
    events = [await emit(config, "gaps", "started")]
    gaps = detect_gaps(state["domain"], state["topic"], state.get("sources", []), state.get("claims", []),
                       state.get("conflicts", []), current_academic_cycle(today(state)))
    nf = sum(1 for g in gaps if g.coverage_status == CoverageStatus.not_found)
    events.append(await emit(config, "gaps", "completed",
                             f"{len(gaps)} potential gap(s); {nf} field(s) not found in the sources reviewed"))
    return {"information_gaps": gaps, "progress": events}


async def evidence_evaluator(state: ResearchState, config: RunnableConfig) -> dict:
    events = [await emit(config, "evidence", "started")]
    assessment, claims = assess_claims(
        state.get("claims", []), state.get("sources", []), state.get("conflicts", []),
        state.get("source_freshness", []), state["topic"], state.get("research_question", ""),
    )
    events.append(await emit(config, "evidence", "completed", f"Scored {len(assessment.claims)} claim(s) on 5 components"))
    return {"evidence_assessment": assessment, "claims": claims, "progress": events}


async def coverage_matrix_generator(state: ResearchState, config: RunnableConfig) -> dict:
    events = [await emit(config, "coverage", "started")]
    matrix = build_coverage_matrix(state["domain"], state.get("sources", []), state.get("claims", []),
                                   state.get("conflicts", []))
    events.append(await emit(config, "coverage", "completed",
                             f"{len(matrix.rows)} fields × {len(matrix.sources)} sources"))
    return {"coverage_matrix": matrix, "progress": events}


async def claim_relationship_graph_generator(state: ResearchState, config: RunnableConfig) -> dict:
    events = [await emit(config, "graph", "started")]
    graph = build_graph(state.get("sources", []), state.get("claims", []), state.get("conflicts", []),
                        state.get("information_gaps", []))
    events.append(await emit(config, "graph", "completed", f"{len(graph.nodes)} nodes, {len(graph.edges)} relationships"))
    return {"claim_relationships": graph, "progress": events}


async def checklist_generator(state: ResearchState, config: RunnableConfig) -> dict:
    events = [await emit(config, "checklist", "started")]
    items = build_checklist(state["domain"], state.get("sources", []), state.get("claims", []),
                            state.get("conflicts", []), state.get("information_gaps", []),
                            state.get("freshness_warnings", []))
    events.append(await emit(config, "checklist", "completed", f"{len(items)} verification task(s)"))
    return {"verification_checklist": items, "progress": events}


async def completeness_calculator(state: ResearchState, config: RunnableConfig) -> dict:
    events = [await emit(config, "completeness", "started")]
    matrix = state.get("coverage_matrix")
    statuses = {r.field: r.overall for r in matrix.rows} if matrix else {}
    result = compute_completeness(state["domain"], state.get("sources", []), state.get("claims", []),
                                  state.get("conflicts", []), state.get("information_gaps", []), statuses,
                                  state.get("evidence_assessment"))
    events.append(await emit(config, "completeness", "completed", f"{result.score}/100 — {result.label}"))
    return {"research_completeness": result, "progress": events}
