"""LangGraph workflow definition.

    research_planner → source_collector → content_extractor → metadata_extractor
        ├─(insufficient sources)→ report_generator → END
        └─(usable)→ claim_evidence_extractor
                      → [conflict_detector ∥ freshness_checker]
                      → [information_gap_detector ∥ evidence_evaluator]
                      → [coverage_matrix_generator ∥ claim_relationship_graph_generator]
                      → checklist_generator → completeness_calculator → report_generator → END

The graph is compiled WITHOUT a checkpointer: state lives only for one invocation.
"""

from __future__ import annotations

from functools import lru_cache

from langgraph.graph import END, START, StateGraph

from app.agents.nodes.analysis import (
    checklist_generator, claim_relationship_graph_generator, completeness_calculator, conflict_detector,
    coverage_matrix_generator, evidence_evaluator, freshness_checker, information_gap_detector,
)
from app.agents.nodes.claims import claim_evidence_extractor
from app.agents.nodes.collection import (
    content_extractor, has_usable_sources, metadata_extractor, research_planner, source_collector,
)
from app.agents.nodes.report import report_generator
from app.agents.state import ResearchState


def build_graph():
    g = StateGraph(ResearchState)
    g.add_node("research_planner", research_planner)
    g.add_node("source_collector", source_collector)
    g.add_node("content_extractor", content_extractor)
    g.add_node("metadata_extractor", metadata_extractor)
    g.add_node("claim_evidence_extractor", claim_evidence_extractor)
    g.add_node("conflict_detector", conflict_detector)
    g.add_node("freshness_checker", freshness_checker)
    g.add_node("information_gap_detector", information_gap_detector)
    g.add_node("evidence_evaluator", evidence_evaluator)
    g.add_node("coverage_matrix_generator", coverage_matrix_generator)
    g.add_node("claim_relationship_graph_generator", claim_relationship_graph_generator)
    g.add_node("checklist_generator", checklist_generator)
    g.add_node("completeness_calculator", completeness_calculator)
    g.add_node("report_generator", report_generator)

    g.add_edge(START, "research_planner")
    g.add_edge("research_planner", "source_collector")
    g.add_edge("source_collector", "content_extractor")
    g.add_edge("content_extractor", "metadata_extractor")
    g.add_conditional_edges("metadata_extractor", has_usable_sources,
                            {"usable": "claim_evidence_extractor", "insufficient": "report_generator"})

    g.add_edge("claim_evidence_extractor", "conflict_detector")
    g.add_edge("claim_evidence_extractor", "freshness_checker")
    g.add_edge(["conflict_detector", "freshness_checker"], "information_gap_detector")
    g.add_edge(["conflict_detector", "freshness_checker"], "evidence_evaluator")
    g.add_edge(["information_gap_detector", "evidence_evaluator"], "coverage_matrix_generator")
    g.add_edge(["information_gap_detector", "evidence_evaluator"], "claim_relationship_graph_generator")
    g.add_edge(["coverage_matrix_generator", "claim_relationship_graph_generator"], "checklist_generator")
    g.add_edge("checklist_generator", "completeness_calculator")
    g.add_edge("completeness_calculator", "report_generator")
    g.add_edge("report_generator", END)
    return g.compile()  # no checkpointer: nothing is persisted


@lru_cache
def get_graph():
    return build_graph()
