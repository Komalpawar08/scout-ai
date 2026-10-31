"""Explainable evidence scoring and research completeness.

All numbers are deterministic functions of documented component rules (see README,
"Scoring rules"). Scores describe evidence quality against the sources reviewed; they
are NOT probabilities that a claim is true.
"""

from __future__ import annotations

from itertools import combinations

from app.agents.templates import get_template
from app.schemas.research import (
    Claim, ClaimAssessment, CompletenessComponent, Conflict, CoverageStatus, Domain, EvidenceAssessment,
    EvidenceStatus, FreshnessStatus, InformationGap, QuoteMatch, ResearchCompleteness, ScoreComponent, Source,
    SourceAssessment, SourceFreshness, SourceType,
)
from app.services.analysis.values import tokens, values_agree

CLAIM_WEIGHTS = {"authority": 0.25, "relevance": 0.15, "freshness": 0.20, "directness": 0.25, "corroboration": 0.15}

AUTHORITY = {
    SourceType.official_primary: (0.9, "Official/primary source (government or institution domain)."),
    SourceType.research_document: (0.75, "Research or institutional document."),
    SourceType.secondary_reporting: (0.65, "Secondary reporting by a news publisher."),
    SourceType.user_provided: (0.5, "User-provided document; authority not independently established."),
    SourceType.other_web: (0.4, "Website not recognised as official or established news."),
}
FRESHNESS = {
    FreshnessStatus.current: 1.0,
    FreshnessStatus.undated: 0.5,
    FreshnessStatus.unknown: 0.5,
    FreshnessStatus.conflicting_dates: 0.4,
    FreshnessStatus.potentially_outdated: 0.3,
}
DIRECTNESS = {QuoteMatch.exact: 1.0, QuoteMatch.normalized: 0.85, QuoteMatch.not_found: 0.2}

COMPLETENESS_WEIGHTS = {
    "field_coverage": 0.40,
    "evidence_availability": 0.20,
    "source_diversity": 0.15,
    "conflict_resolution": 0.10,
    "critical_fields": 0.15,
}


def _publisher_key(s: Source | None) -> str:
    if s is None:
        return ""
    return (s.publisher or s.domain or s.filename or s.source_id).lower()


def agreement_pairs(claims: list[Claim], sources: dict[str, Source]) -> list[tuple[Claim, Claim]]:
    """Pairs of claims from independent sources (different publishers) whose values agree."""
    pairs = []
    for a, b in combinations(claims, 2):
        if a.source_id == b.source_id or a.claim_category != b.claim_category:
            continue
        if a.is_inferred or b.is_inferred or a.is_uncertain or b.is_uncertain:
            continue
        if _publisher_key(sources.get(a.source_id)) == _publisher_key(sources.get(b.source_id)):
            continue
        if values_agree(a, b) is True:
            pairs.append((a, b))
    return pairs


def relevance(claim: Claim, topic: str, question: str) -> tuple[float, str]:
    topic_tokens = tokens(topic) | tokens(question)
    overlap = len(tokens(claim.claim_text) & topic_tokens)
    value = round(min(1.0, 0.6 + 0.1 * overlap), 2)
    return value, (f"Claim belongs to expected field '{claim.claim_category}' and shares {overlap} keyword(s) "
                   "with the topic/question.")


def assess_claims(
    claims: list[Claim], sources: list[Source], conflicts: list[Conflict], freshness: list[SourceFreshness],
    topic: str, question: str,
) -> tuple[EvidenceAssessment, list[Claim]]:
    by_id = {s.source_id: s for s in sources}
    fresh = {f.source_id: f for f in freshness}
    pairs = agreement_pairs(claims, by_id)
    corroborators: dict[str, set[str]] = {}
    for a, b in pairs:
        corroborators.setdefault(a.claim_id, set()).add(b.source_id)
        corroborators.setdefault(b.claim_id, set()).add(a.source_id)
    conflicting: dict[str, set[str]] = {}
    for k in conflicts:
        conflicting.setdefault(k.claim_a, set()).add(k.claim_b)
        conflicting.setdefault(k.claim_b, set()).add(k.claim_a)

    assessments: list[ClaimAssessment] = []
    updated: list[Claim] = []
    for c in claims:
        src = by_id.get(c.source_id)
        auth, auth_reason = AUTHORITY.get(src.source_type if src else SourceType.other_web)
        rel, rel_reason = relevance(c, topic, question)
        f = fresh.get(c.source_id)
        fr = FRESHNESS.get(f.status if f else FreshnessStatus.unknown, 0.5)
        fr_reason = f.reason if f else "No freshness information."
        direct = DIRECTNESS[c.quote_match]
        direct_reason = {
            QuoteMatch.exact: "Supporting quotation found verbatim in the source text.",
            QuoteMatch.normalized: "Supporting quotation found after whitespace/punctuation normalisation.",
            QuoteMatch.not_found: "Supporting quotation could NOT be located in the source text.",
        }[c.quote_match]
        if c.is_inferred:
            direct = min(direct, 0.3)
            direct_reason = "Claim is an interpretation, not a direct statement in the source."
        k = len(corroborators.get(c.claim_id, set()))
        corr = round(min(1.0, 0.3 + 0.35 * k), 2)
        corr_reason = (f"Independently corroborated by {k} other source(s): {', '.join(sorted(corroborators[c.claim_id]))}."
                       if k else "No independent source reports the same value.")
        components = [
            ScoreComponent(name="authority", value=auth, weight=CLAIM_WEIGHTS["authority"], reason=auth_reason),
            ScoreComponent(name="relevance", value=rel, weight=CLAIM_WEIGHTS["relevance"], reason=rel_reason),
            ScoreComponent(name="freshness", value=fr, weight=CLAIM_WEIGHTS["freshness"], reason=fr_reason),
            ScoreComponent(name="directness", value=direct, weight=CLAIM_WEIGHTS["directness"], reason=direct_reason),
            ScoreComponent(name="corroboration", value=corr, weight=CLAIM_WEIGHTS["corroboration"], reason=corr_reason),
        ]
        score = round(sum(x.value * x.weight for x in components), 3)

        missing: list[str] = []
        if c.quote_match == QuoteMatch.not_found:
            missing.append("Verbatim supporting quotation")
        if not k:
            missing.append("Independent corroboration")
        if src and src.source_type != SourceType.official_primary:
            missing.append("Confirmation from an official/primary source")

        if c.claim_id in conflicting:
            status = EvidenceStatus.conflicting
            reason = f"Possible conflict with {', '.join(sorted(conflicting[c.claim_id]))}; neither source is assumed correct."
        elif c.is_inferred:
            status = EvidenceStatus.ai_inferred
            reason = "AI-inferred interpretation; not a direct statement in the source."
        elif c.quote_match == QuoteMatch.not_found:
            status = EvidenceStatus.unsupported
            reason = "The quotation could not be located in the source, so the claim is treated as unsupported."
        elif k:
            status = EvidenceStatus.corroborated
            reason = f"Directly quoted and corroborated by {k} independent source(s)."
        elif auth >= 0.65:
            status = EvidenceStatus.directly_supported
            reason = "Directly quoted from a single source; not independently corroborated."
        else:
            status = EvidenceStatus.partially_supported
            reason = "Quoted from a source of limited or unestablished authority with no corroboration."

        assessments.append(ClaimAssessment(
            claim_id=c.claim_id, components=components, score=score, evidence_status=status,
            supporting_sources=sorted({c.source_id} | corroborators.get(c.claim_id, set())),
            conflicting_claims=sorted(conflicting.get(c.claim_id, set())), missing_evidence=missing, reason=reason,
        ))
        updated.append(c.model_copy(update={"evidence_status": status}))

    source_assessments = []
    for s in sources:
        auth, auth_reason = AUTHORITY[s.source_type]
        f = fresh.get(s.source_id)
        sc = [c for c in claims if c.source_id == s.source_id]
        rel = round(sum(relevance(c, topic, question)[0] for c in sc) / len(sc), 2) if sc else 0.0
        source_assessments.append(SourceAssessment(
            source_id=s.source_id, source_type=s.source_type, authority=auth,
            authority_reason=s.source_type_reason or auth_reason,
            freshness=FRESHNESS.get(f.status if f else FreshnessStatus.unknown, 0.5),
            freshness_reason=f.reason if f else "No freshness information.",
            relevance=rel, relevance_reason=(f"Average relevance of {len(sc)} extracted claim(s)." if sc
                                             else "No relevant claims were extracted from this source."),
            claim_count=len(sc),
        ))
    return EvidenceAssessment(
        method="Weighted sum of five documented component scores (0-1). Not a probability of truth.",
        weights=CLAIM_WEIGHTS, claims=assessments, sources=source_assessments,
    ), updated


def compute_completeness(domain: Domain, sources: list[Source], claims: list[Claim], conflicts: list[Conflict],
                         gaps: list[InformationGap], coverage_status: dict[str, CoverageStatus],
                         evidence: EvidenceAssessment | None) -> ResearchCompleteness:
    template = get_template(domain)
    total_weight = sum(f.weight for f in template)
    credit = {CoverageStatus.found: 1.0, CoverageStatus.partially_found: 0.5, CoverageStatus.conflicting: 0.5}
    coverage = sum(f.weight * credit.get(coverage_status.get(f.key, CoverageStatus.not_found), 0.0)
                   for f in template) / total_weight
    covered = [f.label for f in template if coverage_status.get(f.key) == CoverageStatus.found]

    strong = {EvidenceStatus.directly_supported, EvidenceStatus.corroborated}
    if evidence and evidence.claims:
        n_strong = sum(1 for a in evidence.claims if a.evidence_status in strong)
        evidence_avail = n_strong / len(evidence.claims)
        ev_expl = f"{n_strong} of {len(evidence.claims)} claims are directly supported or corroborated."
    else:
        evidence_avail, ev_expl = 0.0, "No claims were extracted."

    usable = [s for s in sources if s.extraction_status.value in ("success", "partial")]
    publishers = {(s.publisher or s.domain or s.filename or s.source_id).lower() for s in usable}
    types = {s.source_type for s in usable}
    diversity = min(1.0, len(publishers) / 3) * 0.7 + min(1.0, len(types) / 2) * 0.3
    div_expl = f"{len(publishers)} independent publisher(s) and {len(types)} source type(s) among usable sources."

    fields_with_conflict = {k.field for k in conflicts}
    conflict_score = 1 - len(fields_with_conflict) / len(template)
    conf_expl = f"{len(conflicts)} possible conflict(s) across {len(fields_with_conflict)} field(s) remain unresolved."

    critical = [f for f in template if f.critical]
    crit_ok = [f for f in critical if coverage_status.get(f.key) == CoverageStatus.found]
    crit_score = len(crit_ok) / len(critical) if critical else 1.0
    missing_crit = [f.label for f in critical if f not in crit_ok]
    crit_expl = (f"{len(crit_ok)} of {len(critical)} critical fields found without conflict"
                 + (f"; not resolved: {', '.join(missing_crit)}." if missing_crit else "."))

    components = [
        CompletenessComponent(name="field_coverage", value=round(coverage, 3), weight=COMPLETENESS_WEIGHTS["field_coverage"],
                              explanation=f"Weighted coverage of {len(template)} expected fields (found=1, partial/conflicting=0.5). "
                                          f"Found: {', '.join(covered) or 'none'}."),
        CompletenessComponent(name="evidence_availability", value=round(evidence_avail, 3),
                              weight=COMPLETENESS_WEIGHTS["evidence_availability"], explanation=ev_expl),
        CompletenessComponent(name="source_diversity", value=round(diversity, 3),
                              weight=COMPLETENESS_WEIGHTS["source_diversity"], explanation=div_expl),
        CompletenessComponent(name="conflict_resolution", value=round(conflict_score, 3),
                              weight=COMPLETENESS_WEIGHTS["conflict_resolution"], explanation=conf_expl),
        CompletenessComponent(name="critical_fields", value=round(crit_score, 3),
                              weight=COMPLETENESS_WEIGHTS["critical_fields"], explanation=crit_expl),
    ]
    score = round(100 * sum(c.value * c.weight for c in components), 1) if usable else 0.0
    label = "High coverage" if score >= 75 else "Moderate coverage" if score >= 50 else "Low coverage"
    return ResearchCompleteness(
        score=score, label=label, components=components,
        formula="score = 100 × (0.40·field_coverage + 0.20·evidence_availability + 0.15·source_diversity + "
                "0.10·conflict_resolution + 0.15·critical_fields)",
        disclaimer="Measures how well the reviewed sources cover the domain's research criteria. "
                   "It is not a measure of factual accuracy and does not guarantee completeness.",
    )
