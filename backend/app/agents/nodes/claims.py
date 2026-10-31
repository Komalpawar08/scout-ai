"""claim_evidence_extractor node: Grok structured extraction (or heuristic fallback),
followed by verbatim quote verification and page/section provenance mapping."""

from __future__ import annotations

import asyncio

from langchain_core.runnables import RunnableConfig

from app.agents.nodes.common import emit
from app.agents.prompts.schemas import ClaimExtractionOutput, ExtractedClaim
from app.agents.prompts.templates import extraction_prompt
from app.agents.state import ResearchState
from app.agents.templates import field_map
from app.core.config import get_settings
from app.schemas.research import Claim, Domain, ExtractionStatus, QuoteMatch, Source, StageError
from app.services.analysis.evidence import chunk_text, locate_quote, span_for_offset
from app.services.analysis.heuristic_extractor import heuristic_extract
from app.services.llm.grok_client import LLMError, get_llm_client

MAX_CLAIMS_PER_SOURCE = 25


async def _extract_source(source: Source, state: ResearchState) -> tuple[list[ExtractedClaim], list[StageError], str]:
    settings = get_settings()
    domain: Domain = state["domain"]
    client = get_llm_client()
    if client is None:
        return heuristic_extract(domain, source.extracted_text), [], "heuristic"
    chunks = chunk_text(source.extracted_text, settings.chunk_chars, settings.max_chunks_per_source)
    results: list[ExtractedClaim] = []
    errors: list[StageError] = []

    async def run(chunk: str):
        system, user = extraction_prompt(domain, state["topic"], state.get("research_question", ""), source.title, chunk)
        return await client.structured(system, user, ClaimExtractionOutput, max_tokens=5000)

    outputs = await asyncio.gather(*(run(c) for _, c in chunks), return_exceptions=True)
    for out in outputs:
        if isinstance(out, LLMError):
            errors.append(StageError(stage="claims", source_id=source.source_id, message=str(out)))
        elif isinstance(out, Exception):
            errors.append(StageError(stage="claims", source_id=source.source_id,
                                     message=f"Extraction error: {out.__class__.__name__}"))
        else:
            results.extend(out.claims)
    if errors and not results:
        # Grok failed for this source (e.g. rate limit): fall back to heuristic extraction, clearly labelled.
        return heuristic_extract(domain, source.extracted_text), errors, "heuristic"
    return results, errors, "llm"


def to_claims(source: Source, extracted: list[ExtractedClaim], method: str, domain: Domain,
              start_index: int) -> list[Claim]:
    fields = field_map(domain)
    claims: list[Claim] = []
    seen: set[tuple[str, str]] = set()
    for ex in extracted:
        category = ex.category if ex.category in fields else None
        if category is None:
            continue  # off-template categories are dropped rather than guessed
        match, start, end = locate_quote(source.extracted_text, ex.supporting_quote)
        sig = (category, (ex.normalized_value or ex.value).lower()[:120])
        if sig in seen:
            continue
        seen.add(sig)
        span = span_for_offset(source.spans, start)
        period = ex.relevant_period
        if not period and domain == Domain.scholarship and source.academic_cycle:
            period = source.academic_cycle  # the source states this cycle explicitly
        quote = source.extracted_text[start:end] if match != QuoteMatch.not_found and start is not None else ex.supporting_quote
        claims.append(Claim(
            claim_id=f"C{start_index + len(claims) + 1}", claim_text=ex.claim_text.strip(), claim_category=category,
            subject=ex.subject.strip() or fields[category].label, value=ex.value.strip(), value_type=ex.value_type,
            normalized_value=ex.normalized_value, unit=ex.unit, relevant_period=period, scope=ex.scope,
            source_id=source.source_id, supporting_quote=quote.strip(), quote_match=match,
            page_number=span.page_number if span else None, section=span.section if span else None,
            start_offset=start, end_offset=end, extraction_confidence=round(ex.confidence, 2),
            extraction_method=method, is_inferred=ex.is_inferred, is_uncertain=ex.is_uncertain,
        ))
        if len(claims) >= MAX_CLAIMS_PER_SOURCE:
            break
    return claims


async def claim_evidence_extractor(state: ResearchState, config: RunnableConfig) -> dict:
    usable = [s for s in state.get("sources", [])
              if s.extraction_status in (ExtractionStatus.success, ExtractionStatus.partial) and s.extracted_text]
    mode = "Grok structured extraction" if get_llm_client() else "heuristic extraction (no Grok API key configured)"
    events = [await emit(config, "claims", "started", f"Extracting claims from {len(usable)} source(s) using {mode}")]
    results = await asyncio.gather(*(_extract_source(s, state) for s in usable))

    claims: list[Claim] = []
    errors: list[StageError] = []
    limitations: list[str] = []
    for source, (extracted, errs, method) in zip(usable, results):
        errors.extend(errs)
        if method == "heuristic" and get_llm_client() is not None:
            limitations.append(f"{source.source_id}: Grok extraction failed; heuristic extraction was used instead.")
        claims.extend(to_claims(source, extracted, method, state["domain"], len(claims)))

    unverified = sum(1 for c in claims if c.quote_match == QuoteMatch.not_found)
    msg = f"{len(claims)} claim(s) extracted; {len(claims) - unverified} quotation(s) verified in source text"
    if unverified:
        msg += f", {unverified} not located (marked unsupported)"
    events.append(await emit(config, "claims", "completed" if claims else "warning", msg))
    return {"claims": claims, "progress": events, "errors": errors, "limitations": limitations}
