"""Typed LangGraph state. A fresh state is created per request and never persisted
(no checkpointer is configured)."""

from __future__ import annotations

import operator
from typing import Annotated, Any, TypedDict

from app.schemas.research import (
    ChecklistItem, Claim, ClaimRelationships, Conflict, CoverageMatrix, Domain, EvidenceAssessment, FinalReport,
    FreshnessWarning, InformationGap, ProgressEvent, ResearchCompleteness, ScopeNote, Source, SourceFreshness,
    StageError, UploadedDocument,
)


class ResearchState(TypedDict, total=False):
    # Inputs
    research_id: str
    topic: str
    research_question: str
    domain: Domain
    user_urls: list[str]
    uploaded_documents: list[UploadedDocument]
    automatic_search: bool
    max_sources: int
    demo_scenario: str | None
    reference_date: str  # ISO date used as "today" for freshness (injectable for tests)
    llm_enabled: bool

    # Collection
    search_queries: list[str]
    candidates: list[dict[str, Any]]
    extracted_documents: list[dict[str, Any]]
    sources: list[Source]

    # Analysis (each written by exactly one node, so parallel branches never overwrite each other)
    claims: list[Claim]
    conflicts: list[Conflict]
    scope_notes: list[ScopeNote]
    information_gaps: list[InformationGap]
    freshness_warnings: list[FreshnessWarning]
    source_freshness: list[SourceFreshness]
    evidence_assessment: EvidenceAssessment
    coverage_matrix: CoverageMatrix
    claim_relationships: ClaimRelationships
    verification_checklist: list[ChecklistItem]
    research_completeness: ResearchCompleteness
    final_report: FinalReport

    # Accumulated by many nodes (reducers merge parallel updates)
    errors: Annotated[list[StageError], operator.add]
    progress: Annotated[list[ProgressEvent], operator.add]
    limitations: Annotated[list[str], operator.add]
