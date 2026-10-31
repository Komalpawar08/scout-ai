"""Structured-output schemas requested from Grok. Kept small and flat for reliability."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ResearchPlan(BaseModel):
    search_queries: list[str] = Field(description="3-5 focused web search queries", max_length=6)
    focus_points: list[str] = Field(default_factory=list, description="What the research must establish")


class ExtractedClaim(BaseModel):
    claim_text: str = Field(description="One self-contained factual claim made by the source")
    category: str = Field(description="One expected-field key from the provided list")
    subject: str = Field(description="Entity or topic the claim is about, short and canonical")
    value: str = Field(description="The asserted value or statement, as written")
    value_type: Literal["number", "percent", "money", "date", "list", "text", "boolean"] = "text"
    normalized_value: str | None = Field(
        default=None,
        description="Machine-comparable value: plain number, ISO date (YYYY-MM-DD), or semicolon-separated list items",
    )
    unit: str | None = None
    relevant_period: str | None = Field(default=None, description="Date, period or academic cycle the claim applies to")
    scope: str | None = Field(default=None, description="Category, geography or programme the claim is limited to")
    supporting_quote: str = Field(description="EXACT verbatim sentence(s) copied from the source text")
    confidence: float = Field(ge=0, le=1)
    is_inferred: bool = Field(default=False, description="True if the claim is an interpretation not stated verbatim")
    is_uncertain: bool = Field(
        default=False,
        description="True if the source says this information is unclear, unknown, unconfirmed or under investigation",
    )


class ClaimExtractionOutput(BaseModel):
    claims: list[ExtractedClaim] = Field(default_factory=list)


class ConflictDecision(BaseModel):
    pair_id: str
    is_conflict: bool
    same_scope: bool = Field(description="Same entity, period, geography, category and definition")
    conflict_type: str = Field(default="statement_mismatch")
    explanation: str
    confidence: float = Field(ge=0, le=1)


class ConflictAdjudication(BaseModel):
    decisions: list[ConflictDecision] = Field(default_factory=list)


class ReportNarrative(BaseModel):
    executive_summary: str
    key_findings: list[str] = Field(default_factory=list, max_length=8)
    unanswered_questions: list[str] = Field(default_factory=list, max_length=8)
