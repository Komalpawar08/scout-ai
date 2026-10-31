"""Pydantic schemas shared by the API, the LangGraph workflow and the exporters."""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class Domain(str, Enum):
    news = "news"
    scholarship = "scholarship"


class SourceType(str, Enum):
    official_primary = "official_primary"
    secondary_reporting = "secondary_reporting"
    research_document = "research_document"
    user_provided = "user_provided"
    other_web = "other_web"


class SourceOrigin(str, Enum):
    search = "search"
    user_url = "user_url"
    uploaded_pdf = "uploaded_pdf"
    demo_fixture = "demo_fixture"


class ExtractionStatus(str, Enum):
    success = "success"
    partial = "partial"
    failed = "failed"
    blocked = "blocked"
    empty = "empty"


class DateStatus(str, Enum):
    found = "found"  # a date was located in the source metadata or text
    not_stated = "not_stated"  # source was extracted fully and states no date (known undated)
    unavailable = "unavailable"  # extraction failed / could not determine


class EvidenceStatus(str, Enum):
    directly_supported = "directly_supported"
    corroborated = "corroborated"
    partially_supported = "partially_supported"
    conflicting = "conflicting"
    unsupported = "unsupported"
    ai_inferred = "ai_inferred"


class QuoteMatch(str, Enum):
    exact = "exact"
    normalized = "normalized"  # matched after whitespace/case/punctuation normalisation
    not_found = "not_found"


class CoverageStatus(str, Enum):
    found = "found"
    partially_found = "partially_found"
    not_found = "not_found"  # "Not found in the sources reviewed"
    conflicting = "conflicting"
    unable_to_determine = "unable_to_determine"


class Priority(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class FreshnessStatus(str, Enum):
    current = "current"
    potentially_outdated = "potentially_outdated"
    undated = "undated"
    unknown = "unknown"
    conflicting_dates = "conflicting_dates"


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------


class ResearchRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=300)
    research_question: str = Field(default="", max_length=600)
    domain: Domain
    user_urls: list[str] = Field(default_factory=list, max_length=15)
    automatic_search: bool = True
    max_sources: int = Field(default=6, ge=1, le=20)
    demo_scenario: Literal["scholarship", "news"] | None = None

    @field_validator("topic", "research_question")
    @classmethod
    def strip_text(cls, v: str) -> str:
        return v.strip()

    @field_validator("user_urls")
    @classmethod
    def clean_urls(cls, v: list[str]) -> list[str]:
        seen: list[str] = []
        for url in v:
            url = url.strip()
            if url and url not in seen:
                seen.append(url)
        return seen


class UploadedDocument(BaseModel):
    filename: str
    content_type: str
    size_bytes: int
    data: bytes = Field(repr=False, exclude=True)


# ---------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------


class PageSpan(BaseModel):
    """Maps a character range of extracted_text to a page or section."""

    label: str  # e.g. "Page 2" or "Section: Eligibility"
    page_number: int | None = None
    section: str | None = None
    start: int
    end: int


class Source(BaseModel):
    source_id: str
    title: str
    url: str | None = None
    filename: str | None = None
    publisher: str | None = None
    domain: str | None = None
    origin: SourceOrigin
    source_type: SourceType
    source_type_reason: str = ""
    publication_date: str | None = None
    publication_date_origin: str | None = None
    updated_date: str | None = None
    date_status: DateStatus = DateStatus.unavailable
    retrieved_at: str
    academic_cycle: str | None = None
    event_date: str | None = None
    extraction_status: ExtractionStatus
    extraction_error: str | None = None
    extracted_text: str = ""
    text_truncated: bool = False
    spans: list[PageSpan] = Field(default_factory=list)
    search_snippet: str | None = None
    is_demo: bool = False


# ---------------------------------------------------------------------------
# Claims
# ---------------------------------------------------------------------------


ValueType = Literal["number", "percent", "money", "date", "list", "text", "boolean"]


class Claim(BaseModel):
    claim_id: str
    claim_text: str
    claim_category: str  # expected-field key from the domain template
    subject: str
    value: str
    value_type: ValueType = "text"
    normalized_value: str | None = None
    unit: str | None = None
    relevant_period: str | None = None
    scope: str | None = None  # e.g. scholarship category, geography
    source_id: str
    supporting_quote: str
    quote_match: QuoteMatch = QuoteMatch.not_found
    page_number: int | None = None
    section: str | None = None
    start_offset: int | None = None
    end_offset: int | None = None
    extraction_confidence: float = Field(ge=0, le=1, default=0.5)
    extraction_method: Literal["llm", "heuristic"] = "llm"
    evidence_status: EvidenceStatus = EvidenceStatus.unsupported
    is_inferred: bool = False
    is_uncertain: bool = False  # source states the information is unclear/unknown


# ---------------------------------------------------------------------------
# Analysis outputs
# ---------------------------------------------------------------------------


class Conflict(BaseModel):
    conflict_id: str
    label: str = "Possible conflict"
    claim_a: str
    claim_b: str
    source_a: str
    source_b: str
    quotation_a: str
    quotation_b: str
    field: str
    explanation: str
    conflict_type: str
    confidence: float
    scope_checks: dict[str, str] = Field(default_factory=dict)
    recommended_verification: str
    detection_method: Literal["rule", "llm"] = "rule"


class ScopeNote(BaseModel):
    """Differences that look like conflicts but differ in scope (not flagged as conflicts)."""

    claim_a: str
    claim_b: str
    field: str
    note: str


class InformationGap(BaseModel):
    gap_id: str
    expected_field: str
    field_label: str
    explanation: str
    why_it_matters: str
    coverage_status: CoverageStatus
    sources_checked: list[str]
    related_claims: list[str]
    suggested_search: str
    recommended_verification: str
    priority: Priority
    confidence: float


class FreshnessWarning(BaseModel):
    warning_id: str
    source_id: str | None = None
    claim_id: str | None = None
    status: FreshnessStatus
    reason: str
    reference_date: str | None = None


class SourceFreshness(BaseModel):
    source_id: str
    status: FreshnessStatus
    reason: str
    age_days: int | None = None


class CoverageCell(BaseModel):
    source_id: str
    status: Literal["found", "partial", "conflict", "missing", "failed"]
    claim_ids: list[str] = Field(default_factory=list)


class CoverageRow(BaseModel):
    field: str
    label: str
    critical: bool
    cells: list[CoverageCell]
    overall: CoverageStatus
    overall_label: str


class CoverageMatrix(BaseModel):
    domain: Domain
    sources: list[str]
    rows: list[CoverageRow]


class GraphNode(BaseModel):
    id: str
    type: Literal["source", "claim", "gap"]
    label: str
    data: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relation: Literal["states", "corroborates", "conflicts_with", "missing_evidence"]
    explanation: str = ""


class ClaimRelationships(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class ScoreComponent(BaseModel):
    name: Literal["authority", "relevance", "freshness", "directness", "corroboration"]
    value: float
    weight: float
    reason: str


class ClaimAssessment(BaseModel):
    claim_id: str
    components: list[ScoreComponent]
    score: float
    evidence_status: EvidenceStatus
    supporting_sources: list[str]
    conflicting_claims: list[str]
    missing_evidence: list[str]
    reason: str


class SourceAssessment(BaseModel):
    source_id: str
    source_type: SourceType
    authority: float
    authority_reason: str
    freshness: float
    freshness_reason: str
    relevance: float
    relevance_reason: str
    claim_count: int


class EvidenceAssessment(BaseModel):
    method: str
    weights: dict[str, float]
    claims: list[ClaimAssessment]
    sources: list[SourceAssessment]


class CompletenessComponent(BaseModel):
    name: str
    value: float
    weight: float
    explanation: str


class ResearchCompleteness(BaseModel):
    score: float
    label: str
    components: list[CompletenessComponent]
    formula: str
    disclaimer: str


class ChecklistItem(BaseModel):
    task_id: str
    task: str
    reason: str
    priority: Priority
    related_gap_id: str | None = None
    related_conflict_id: str | None = None
    related_claim_id: str | None = None
    suggested_source: str
    suggested_action: str
    status: Literal["pending", "done"] = "pending"


class ProgressEvent(BaseModel):
    stage: str
    label: str
    status: Literal["started", "completed", "failed", "skipped", "warning"]
    message: str = ""
    detail: dict[str, Any] = Field(default_factory=dict)


class StageError(BaseModel):
    stage: str
    message: str
    source_id: str | None = None
    recoverable: bool = True


class FinalReport(BaseModel):
    title: str
    executive_summary: str
    key_findings: list[str]
    unanswered_questions: list[str]
    generated_by: Literal["llm", "deterministic"]


class ResearchResponse(BaseModel):
    research_id: str
    created_at: str
    domain: Domain
    topic: str
    research_question: str
    mode: Literal["live", "heuristic", "demo"]
    mode_explanation: str
    status: Literal["success", "partial", "failed"]
    summary: str
    search_queries: list[str]
    sources: list[Source]
    claims: list[Claim]
    conflicts: list[Conflict]
    scope_notes: list[ScopeNote] = Field(default_factory=list)
    information_gaps: list[InformationGap]
    freshness_warnings: list[FreshnessWarning]
    source_freshness: list[SourceFreshness]
    coverage_matrix: CoverageMatrix
    claim_relationships: ClaimRelationships
    evidence_assessment: EvidenceAssessment
    research_completeness: ResearchCompleteness
    verification_checklist: list[ChecklistItem]
    final_report: FinalReport
    limitations: list[str]
    errors: list[StageError]
