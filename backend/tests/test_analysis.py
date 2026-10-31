from datetime import date

from app.agents.templates import field_map
from app.schemas.research import (
    CoverageStatus, DateStatus, Domain, EvidenceStatus, ExtractionStatus, FreshnessStatus, Priority, QuoteMatch,
    SourceType,
)
from app.services.analysis.checklist import build_checklist
from app.services.analysis.conflicts import detect_conflicts
from app.services.analysis.freshness import freshness_warnings, source_freshness
from app.services.analysis.gaps import NOT_FOUND, build_coverage_matrix, detect_gaps
from app.services.analysis.heuristic_extractor import heuristic_extract
from app.services.analysis.relationships import build_graph
from app.services.analysis.scoring import CLAIM_WEIGHTS, assess_claims, compute_completeness

SCH = field_map(Domain.scholarship)
NEWS = field_map(Domain.news)
TODAY = date(2026, 10, 30)


# --- heuristic extraction -------------------------------------------------------------------

def test_heuristic_extractor_values():
    text = ("The annual family income must not exceed ₹2.5 lakh from all sources. "
            "Applicants must have scored a minimum of 60% marks in Class 12. "
            "The last date to apply is 15 December 2026. "
            "It remains unclear whether the scholarship can be renewed.")
    claims = {c.category: c for c in heuristic_extract(Domain.scholarship, text)}
    assert claims["income_criteria"].normalized_value == "250000"
    assert claims["minimum_marks"].normalized_value == "60"
    assert claims["deadline"].normalized_value == "2026-12-15"
    assert claims["renewal_requirements"].is_uncertain


def test_heuristic_news_statistics():
    claims = heuristic_extract(Domain.news, "At least 12 people were killed and 30 were injured, officials said.")
    stats = [c for c in claims if c.category == "statistics"]
    assert stats and stats[0].normalized_value == "12" and stats[0].unit == "killed"


# --- conflicts -----------------------------------------------------------------------------

def test_numeric_conflict_detected(make_claim):
    a = make_claim(source_id="S1", value="₹2.5 lakh", value_type="money", normalized_value="250000")
    b = make_claim(source_id="S2", value="₹3 lakh", value_type="money", normalized_value="300000")
    conflicts, notes, _ = detect_conflicts([a, b], SCH)
    assert len(conflicts) == 1 and not notes
    k = conflicts[0]
    assert k.label == "Possible conflict" and k.conflict_type == "numeric_mismatch"
    assert k.quotation_a == a.supporting_quote and k.recommended_verification


def test_different_academic_cycles_are_not_conflicts(make_claim):
    a = make_claim(source_id="S1", claim_category="minimum_marks", value="60%", value_type="percent",
                   normalized_value="60", relevant_period="2026-27")
    b = make_claim(source_id="S2", claim_category="minimum_marks", value="55%", value_type="percent",
                   normalized_value="55", relevant_period="2025-26")
    conflicts, notes, _ = detect_conflicts([a, b], SCH)
    assert not conflicts and len(notes) == 1 and "academic cycles" in notes[0].note


def test_different_scope_and_units_are_not_conflicts(make_claim):
    a = make_claim(source_id="S1", claim_category="minimum_marks", value="60%", value_type="percent",
                   normalized_value="60", scope="post-matric")
    b = make_claim(source_id="S2", claim_category="minimum_marks", value="50%", value_type="percent",
                   normalized_value="50", scope="pre-matric")
    c = make_claim(source_id="S1", claim_category="statistics", value="12 killed", value_type="number",
                   normalized_value="12", unit="killed", subject="toll")
    d = make_claim(source_id="S2", claim_category="statistics", value="30 injured", value_type="number",
                   normalized_value="30", unit="injured", subject="toll")
    conflicts, notes, _ = detect_conflicts([a, b, c, d], {**SCH, **NEWS})
    assert not conflicts and len(notes) == 2


def test_agreeing_values_and_same_source_not_conflicts(make_claim):
    a = make_claim(source_id="S1", value_type="date", claim_category="deadline", normalized_value="2026-12-15")
    b = make_claim(source_id="S2", value_type="date", claim_category="deadline", normalized_value="2026-12-15")
    c = make_claim(source_id="S1", value_type="date", claim_category="deadline", normalized_value="2026-11-01")
    conflicts, _, _ = detect_conflicts([a, b, c], SCH)
    # a/c share a source (ignored); b vs c differ -> exactly one conflict
    assert len(conflicts) == 1 and {conflicts[0].claim_a, conflicts[0].claim_b} == {b.claim_id, c.claim_id}


def test_document_list_conflict(make_claim):
    a = make_claim(source_id="S1", claim_category="required_documents", value_type="list",
                   normalized_value="aadhaar card; income certificate; domicile certificate")
    b = make_claim(source_id="S2", claim_category="required_documents", value_type="list",
                   normalized_value="aadhaar card; income certificate; caste certificate")
    conflicts, _, _ = detect_conflicts([a, b], SCH)
    assert conflicts[0].label == "Potential inconsistency"
    assert "domicile certificate" in conflicts[0].explanation and "caste certificate" in conflicts[0].explanation


# --- gaps & coverage -----------------------------------------------------------------------

def test_scholarship_gaps_use_responsible_language(make_claim, make_source):
    sources = [make_source("S1"), make_source("S2")]
    claims = [make_claim(source_id="S1", claim_category="deadline", value_type="date", normalized_value="2026-12-15")]
    gaps = detect_gaps(Domain.scholarship, "Test scholarship", sources, claims, [], "2026-27")
    by_field = {g.expected_field: g for g in gaps}
    renewal = by_field["renewal_requirements"]
    assert renewal.coverage_status == CoverageStatus.not_found
    assert NOT_FOUND in renewal.explanation and "does not mean" in renewal.explanation
    assert renewal.sources_checked == ["S1", "S2"] and "2026-27" in renewal.suggested_search
    # deadline is critical and only in 1 of 2 sources -> single-source partial gap
    assert by_field["deadline"].coverage_status == CoverageStatus.partially_found
    assert by_field["income_criteria"].priority == Priority.critical


def test_news_gaps_and_conflicting_status(make_claim, make_source):
    sources = [make_source("S1"), make_source("S2")]
    a = make_claim(source_id="S1", claim_category="statistics", value_type="number", normalized_value="8", unit="deaths")
    b = make_claim(source_id="S2", claim_category="statistics", value_type="number", normalized_value="12", unit="deaths")
    conflicts, _, _ = detect_conflicts([a, b], NEWS)
    gaps = detect_gaps(Domain.news, "Bridge collapse", sources, [a, b], conflicts)
    by_field = {g.expected_field: g for g in gaps}
    assert by_field["statistics"].coverage_status == CoverageStatus.conflicting
    assert by_field["official_response"].coverage_status == CoverageStatus.not_found
    matrix = build_coverage_matrix(Domain.news, sources, [a, b], conflicts)
    stats_row = next(r for r in matrix.rows if r.field == "statistics")
    assert [c.status for c in stats_row.cells] == ["conflict", "conflict"]
    assert stats_row.overall_label == "Needs review"


def test_uncertain_claim_is_partial_not_found(make_claim, make_source):
    c = make_claim(source_id="S1", claim_category="renewal_requirements", is_uncertain=True)
    gaps = detect_gaps(Domain.scholarship, "x", [make_source("S1")], [c], [])
    g = next(g for g in gaps if g.expected_field == "renewal_requirements")
    assert g.coverage_status == CoverageStatus.partially_found and "unclear" in g.explanation


def test_coverage_matrix_marks_failed_and_missing(make_claim, make_source):
    sources = [make_source("S1"), make_source("S2", extraction_status=ExtractionStatus.failed)]
    claims = [make_claim(source_id="S1", claim_category="eligibility")]
    matrix = build_coverage_matrix(Domain.scholarship, sources, claims, [])
    row = next(r for r in matrix.rows if r.field == "eligibility")
    assert [c.status for c in row.cells] == ["found", "failed"]
    row = next(r for r in matrix.rows if r.field == "deadline")
    assert [c.status for c in row.cells] == ["missing", "failed"] and row.overall_label == "Gap"


def test_no_usable_sources_unable_to_determine(make_source):
    gaps = detect_gaps(Domain.news, "x", [make_source("S1", extraction_status=ExtractionStatus.failed)], [], [])
    assert all(g.coverage_status == CoverageStatus.unable_to_determine for g in gaps)


# --- freshness -----------------------------------------------------------------------------

def test_scholarship_freshness_by_cycle(make_source, make_claim):
    old = make_source("S1", academic_cycle="2024-25", publication_date="2024-08-01")
    cur = make_source("S2", academic_cycle="2026-27", publication_date="2026-10-01")
    undated = make_source("S3", date_status=DateStatus.not_stated)
    per = {f.source_id: f for f in source_freshness([old, cur, undated], Domain.scholarship, TODAY)}
    assert per["S1"].status == FreshnessStatus.potentially_outdated and "2024-25" in per["S1"].reason
    assert per["S2"].status == FreshnessStatus.current
    assert per["S3"].status == FreshnessStatus.undated
    deadline = make_claim(source_id="S1", claim_category="deadline", value_type="date", normalized_value="2025-01-31")
    warnings = freshness_warnings([old, cur, undated], [deadline], list(per.values()), Domain.scholarship, TODAY)
    reasons = " ".join(w.reason for w in warnings)
    assert "has already passed" in reasons and "different academic cycles" in reasons


def test_news_freshness_old_article_not_outdated_without_newer_reporting(make_source):
    a = make_source("S1", publication_date="2019-05-01")
    per = source_freshness([a], Domain.news, TODAY)
    assert per[0].status == FreshnessStatus.current
    b = make_source("S2", publication_date="2019-05-10")
    per = {f.source_id: f for f in source_freshness([a, b], Domain.news, TODAY)}
    assert per["S1"].status == FreshnessStatus.potentially_outdated and "S2" in per["S1"].reason


def test_unknown_vs_undated(make_source):
    unknown = make_source("S1", date_status=DateStatus.unavailable)
    per = source_freshness([unknown], Domain.news, TODAY)
    assert per[0].status == FreshnessStatus.unknown


# --- scoring, graph, checklist, completeness -------------------------------------------------

def test_evidence_scoring_is_deterministic_and_explained(make_claim, make_source):
    s1 = make_source("S1", source_type=SourceType.official_primary)
    s2 = make_source("S2", source_type=SourceType.secondary_reporting)
    a = make_claim(source_id="S1", claim_category="deadline", value_type="date", normalized_value="2026-12-15")
    b = make_claim(source_id="S2", claim_category="deadline", value_type="date", normalized_value="2026-12-15")
    c = make_claim(source_id="S2", claim_category="eligibility", quote_match=QuoteMatch.not_found)
    per = source_freshness([s1, s2], Domain.scholarship, TODAY)
    assessment, updated = assess_claims([a, b, c], [s1, s2], [], per, "scholarship deadline", "")
    by_id = {x.claim_id: x for x in assessment.claims}
    ca = by_id[a.claim_id]
    assert ca.evidence_status == EvidenceStatus.corroborated
    assert abs(ca.score - sum(x.value * x.weight for x in ca.components)) < 1e-3
    assert {x.name for x in ca.components} == set(CLAIM_WEIGHTS)
    assert by_id[c.claim_id].evidence_status == EvidenceStatus.unsupported
    assert "Verbatim supporting quotation" in by_id[c.claim_id].missing_evidence
    assert {u.claim_id: u.evidence_status for u in updated}[a.claim_id] == EvidenceStatus.corroborated
    # Official source does not automatically mean "corroborated"
    assessment2, _ = assess_claims([a], [s1], [], per, "x", "")
    assert assessment2.claims[0].evidence_status == EvidenceStatus.directly_supported


def test_graph_contains_relationships(make_claim, make_source):
    s = [make_source("S1"), make_source("S2"), make_source("S3")]
    a = make_claim(source_id="S1", claim_category="statistics", value_type="number", normalized_value="12", unit="deaths")
    b = make_claim(source_id="S2", claim_category="statistics", value_type="number", normalized_value="12", unit="deaths")
    c = make_claim(source_id="S3", claim_category="statistics", value_type="number", normalized_value="15", unit="deaths")
    conflicts, _, _ = detect_conflicts([a, b, c], NEWS)
    gaps = detect_gaps(Domain.news, "x", s, [a, b, c], conflicts)
    graph = build_graph(s, [a, b, c], conflicts, gaps)
    relations = {e.relation for e in graph.edges}
    assert {"states", "corroborates", "conflicts_with"} <= relations
    assert any(n.type == "gap" for n in graph.nodes)
    ids = {n.id for n in graph.nodes}
    assert all(e.source in ids and e.target in ids for e in graph.edges)


def test_checklist_from_real_findings(make_claim, make_source):
    s = [make_source("S1"), make_source("S2")]
    a = make_claim(source_id="S1", value_type="money", normalized_value="250000")
    b = make_claim(source_id="S2", value_type="money", normalized_value="300000")
    conflicts, _, _ = detect_conflicts([a, b], SCH)
    gaps = detect_gaps(Domain.scholarship, "x", s, [a, b], conflicts)
    items = build_checklist(Domain.scholarship, s, [a, b], conflicts, gaps, [])
    assert items[0].priority == Priority.critical and items[0].related_conflict_id == "K1"
    assert any(i.task == "Verify the current scholarship application deadline" for i in items)
    assert [i.task_id for i in items] == [f"T{n}" for n in range(1, len(items) + 1)]
    assert all(i.status == "pending" for i in items)


def test_completeness_formula(make_claim, make_source):
    s = [make_source("S1")]
    statuses = {k: CoverageStatus.found for k in SCH}
    result = compute_completeness(Domain.scholarship, s, [], [], [], statuses, None)
    comp = {c.name: c for c in result.components}
    assert comp["field_coverage"].value == 1.0 and comp["critical_fields"].value == 1.0
    expected = round(100 * sum(c.value * c.weight for c in result.components), 1)
    assert result.score == expected
    assert "not a measure of factual accuracy" in result.disclaimer
    empty = compute_completeness(Domain.scholarship, [], [], [], [], {}, None)
    assert empty.score == 0.0 and empty.label == "Low coverage"
