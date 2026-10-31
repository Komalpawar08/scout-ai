// Mirrors backend/app/schemas/research.py

export type Domain = "news" | "scholarship";
export type SourceType = "official_primary" | "secondary_reporting" | "research_document" | "user_provided" | "other_web";
export type ExtractionStatus = "success" | "partial" | "failed" | "blocked" | "empty";
export type EvidenceStatus =
  | "directly_supported"
  | "corroborated"
  | "partially_supported"
  | "conflicting"
  | "unsupported"
  | "ai_inferred";
export type QuoteMatch = "exact" | "normalized" | "not_found";
export type CoverageStatus = "found" | "partially_found" | "not_found" | "conflicting" | "unable_to_determine";
export type Priority = "critical" | "high" | "medium" | "low";
export type FreshnessStatus = "current" | "potentially_outdated" | "undated" | "unknown" | "conflicting_dates";

export interface ResearchInput {
  topic: string;
  research_question: string;
  domain: Domain;
  user_urls: string[];
  automatic_search: boolean;
  max_sources: number;
  demo_scenario?: Domain | null;
}

export interface PageSpan {
  label: string;
  page_number: number | null;
  section: string | null;
  start: number;
  end: number;
}

export interface Source {
  source_id: string;
  title: string;
  url: string | null;
  filename: string | null;
  publisher: string | null;
  domain: string | null;
  origin: "search" | "user_url" | "uploaded_pdf" | "demo_fixture";
  source_type: SourceType;
  source_type_reason: string;
  publication_date: string | null;
  publication_date_origin: string | null;
  updated_date: string | null;
  date_status: "found" | "not_stated" | "unavailable";
  retrieved_at: string;
  academic_cycle: string | null;
  event_date: string | null;
  extraction_status: ExtractionStatus;
  extraction_error: string | null;
  extracted_text: string;
  text_truncated: boolean;
  spans: PageSpan[];
  search_snippet: string | null;
  is_demo: boolean;
}

export interface Claim {
  claim_id: string;
  claim_text: string;
  claim_category: string;
  subject: string;
  value: string;
  value_type: string;
  normalized_value: string | null;
  unit: string | null;
  relevant_period: string | null;
  scope: string | null;
  source_id: string;
  supporting_quote: string;
  quote_match: QuoteMatch;
  page_number: number | null;
  section: string | null;
  start_offset: number | null;
  end_offset: number | null;
  extraction_confidence: number;
  extraction_method: "llm" | "heuristic";
  evidence_status: EvidenceStatus;
  is_inferred: boolean;
  is_uncertain: boolean;
}

export interface Conflict {
  conflict_id: string;
  label: string;
  claim_a: string;
  claim_b: string;
  source_a: string;
  source_b: string;
  quotation_a: string;
  quotation_b: string;
  field: string;
  explanation: string;
  conflict_type: string;
  confidence: number;
  scope_checks: Record<string, string>;
  recommended_verification: string;
  detection_method: "rule" | "llm";
}

export interface ScopeNote {
  claim_a: string;
  claim_b: string;
  field: string;
  note: string;
}

export interface InformationGap {
  gap_id: string;
  expected_field: string;
  field_label: string;
  explanation: string;
  why_it_matters: string;
  coverage_status: CoverageStatus;
  sources_checked: string[];
  related_claims: string[];
  suggested_search: string;
  recommended_verification: string;
  priority: Priority;
  confidence: number;
}

export interface FreshnessWarning {
  warning_id: string;
  source_id: string | null;
  claim_id: string | null;
  status: FreshnessStatus;
  reason: string;
  reference_date: string | null;
}

export interface SourceFreshness {
  source_id: string;
  status: FreshnessStatus;
  reason: string;
  age_days: number | null;
}

export interface CoverageCell {
  source_id: string;
  status: "found" | "partial" | "conflict" | "missing" | "failed";
  claim_ids: string[];
}

export interface CoverageRow {
  field: string;
  label: string;
  critical: boolean;
  cells: CoverageCell[];
  overall: CoverageStatus;
  overall_label: string;
}

export interface CoverageMatrix {
  domain: Domain;
  sources: string[];
  rows: CoverageRow[];
}

export interface GraphNode {
  id: string;
  type: "source" | "claim" | "gap";
  label: string;
  data: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: "states" | "corroborates" | "conflicts_with" | "missing_evidence";
  explanation: string;
}

export interface ScoreComponent {
  name: "authority" | "relevance" | "freshness" | "directness" | "corroboration";
  value: number;
  weight: number;
  reason: string;
}

export interface ClaimAssessment {
  claim_id: string;
  components: ScoreComponent[];
  score: number;
  evidence_status: EvidenceStatus;
  supporting_sources: string[];
  conflicting_claims: string[];
  missing_evidence: string[];
  reason: string;
}

export interface SourceAssessment {
  source_id: string;
  source_type: SourceType;
  authority: number;
  authority_reason: string;
  freshness: number;
  freshness_reason: string;
  relevance: number;
  relevance_reason: string;
  claim_count: number;
}

export interface EvidenceAssessment {
  method: string;
  weights: Record<string, number>;
  claims: ClaimAssessment[];
  sources: SourceAssessment[];
}

export interface CompletenessComponent {
  name: string;
  value: number;
  weight: number;
  explanation: string;
}

export interface ResearchCompleteness {
  score: number;
  label: string;
  components: CompletenessComponent[];
  formula: string;
  disclaimer: string;
}

export interface ChecklistItem {
  task_id: string;
  task: string;
  reason: string;
  priority: Priority;
  related_gap_id: string | null;
  related_conflict_id: string | null;
  related_claim_id: string | null;
  suggested_source: string;
  suggested_action: string;
  status: "pending" | "done";
}

export interface ProgressEvent {
  stage: string;
  label: string;
  status: "started" | "completed" | "failed" | "skipped" | "warning";
  message: string;
  detail: Record<string, unknown>;
}

export interface StageError {
  stage: string;
  message: string;
  source_id: string | null;
  recoverable: boolean;
}

export interface FinalReport {
  title: string;
  executive_summary: string;
  key_findings: string[];
  unanswered_questions: string[];
  generated_by: "llm" | "deterministic";
}

export interface ResearchResponse {
  research_id: string;
  created_at: string;
  domain: Domain;
  topic: string;
  research_question: string;
  mode: "live" | "heuristic" | "demo";
  mode_explanation: string;
  status: "success" | "partial" | "failed";
  summary: string;
  search_queries: string[];
  sources: Source[];
  claims: Claim[];
  conflicts: Conflict[];
  scope_notes: ScopeNote[];
  information_gaps: InformationGap[];
  freshness_warnings: FreshnessWarning[];
  source_freshness: SourceFreshness[];
  coverage_matrix: CoverageMatrix;
  claim_relationships: { nodes: GraphNode[]; edges: GraphEdge[] };
  evidence_assessment: EvidenceAssessment;
  research_completeness: ResearchCompleteness;
  verification_checklist: ChecklistItem[];
  final_report: FinalReport;
  limitations: string[];
  errors: StageError[];
}

export interface HealthInfo {
  status: string;
  llm: { provider: string; configured: boolean; model: string | null };
  search: { provider: string; configured: boolean };
  mode: "live" | "heuristic";
  limits: { max_sources: number; max_pdf_size_mb: number; max_pdf_files: number };
}
