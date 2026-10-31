"""Claim Relationship Graph built only from extracted claims and detected relationships."""

from __future__ import annotations

from app.schemas.research import (
    Claim, ClaimRelationships, Conflict, CoverageStatus, GraphEdge, GraphNode, InformationGap, QuoteMatch, Source,
)
from app.services.analysis.scoring import agreement_pairs


def build_graph(sources: list[Source], claims: list[Claim], conflicts: list[Conflict],
                gaps: list[InformationGap]) -> ClaimRelationships:
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    by_id = {s.source_id: s for s in sources}

    for s in sources:
        nodes.append(GraphNode(id=s.source_id, type="source", label=s.title[:80], data={
            "url": s.url, "filename": s.filename, "publisher": s.publisher, "source_type": s.source_type.value,
            "publication_date": s.publication_date, "extraction_status": s.extraction_status.value,
        }))
    for c in claims:
        nodes.append(GraphNode(id=c.claim_id, type="claim", label=c.claim_text[:120], data={
            "category": c.claim_category, "value": c.value, "source_id": c.source_id,
            "supporting_quote": c.supporting_quote, "evidence_status": c.evidence_status.value,
            "quote_match": c.quote_match.value, "page_number": c.page_number, "section": c.section,
            "source_title": by_id[c.source_id].title if c.source_id in by_id else None,
            "source_url": by_id[c.source_id].url if c.source_id in by_id else None,
        }))
        edges.append(GraphEdge(id=f"e-{c.source_id}-{c.claim_id}", source=c.source_id, target=c.claim_id,
                               relation="states", explanation=f"{c.source_id} states this claim."))

    for a, b in agreement_pairs(claims, by_id):
        edges.append(GraphEdge(id=f"c-{a.claim_id}-{b.claim_id}", source=b.claim_id, target=a.claim_id,
                               relation="corroborates",
                               explanation=f"{b.source_id} reports the same {a.claim_category.replace('_', ' ')} value."))
    for k in conflicts:
        edges.append(GraphEdge(id=f"x-{k.conflict_id}", source=k.claim_b, target=k.claim_a, relation="conflicts_with",
                               explanation=f"{k.label} ({k.conflict_id}): {k.explanation}"))

    for g in gaps:
        if g.coverage_status not in (CoverageStatus.not_found, CoverageStatus.partially_found):
            continue
        gid = f"GAP-{g.gap_id}"
        nodes.append(GraphNode(id=gid, type="gap", label=f"{g.field_label}: {g.coverage_status.value.replace('_', ' ')}",
                               data={"gap_id": g.gap_id, "explanation": g.explanation, "priority": g.priority.value}))
        for cid in g.related_claims:
            edges.append(GraphEdge(id=f"m-{cid}-{gid}", source=cid, target=gid, relation="missing_evidence",
                                   explanation=g.explanation))

    unsupported = [c for c in claims if c.quote_match == QuoteMatch.not_found or c.is_inferred]
    if unsupported:
        nodes.append(GraphNode(id="GAP-UNSUPPORTED", type="gap", label="Quotation not located in source",
                               data={"explanation": "These claims could not be matched to a verbatim quotation."}))
        for c in unsupported:
            edges.append(GraphEdge(id=f"u-{c.claim_id}", source=c.claim_id, target="GAP-UNSUPPORTED",
                                   relation="missing_evidence", explanation="Supporting quotation not found verbatim."))
    return ClaimRelationships(nodes=nodes, edges=edges)
