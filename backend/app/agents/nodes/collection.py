"""Planning, source collection, content extraction and metadata nodes."""

from __future__ import annotations

from langchain_core.runnables import RunnableConfig

from app.agents.nodes.common import emit, today
from app.agents.prompts.schemas import ResearchPlan
from app.agents.prompts.templates import planner_prompt
from app.agents.state import ResearchState
from app.agents.templates import get_template
from app.core.config import get_settings
from app.fixtures.demo import demo_fixtures
from app.schemas.research import ExtractionStatus, SourceOrigin, StageError
from app.services.llm.grok_client import LLMError, get_llm_client
from app.services.metadata import current_academic_cycle
from app.services.search.providers import SearchError, get_search_provider
from app.services.source_collector import enrich_metadata, extract_all
from app.services.url_security import UnsafeURLError, check_url_syntax


def deterministic_queries(state: ResearchState) -> list[str]:
    topic = state["topic"]
    domain = state["domain"]
    crit = [f for f in get_template(domain) if f.critical][:3]
    if domain.value == "scholarship":
        cycle = current_academic_cycle(today(state))
        queries = [f"{topic} official notification {cycle}", f"{topic} eligibility documents last date"]
    else:
        queries = [f"{topic} latest news", f"{topic} official statement"]
    queries += [f"{topic} {f.search_hint}" for f in crit]
    return list(dict.fromkeys(queries))[:5]


async def research_planner(state: ResearchState, config: RunnableConfig) -> dict:
    events = [await emit(config, "planning", "started", "Building a domain-specific research plan")]
    errors: list[StageError] = []
    template = get_template(state["domain"])
    events.append(await emit(config, "planning", "completed",
                             f"{len(template)} expected information fields for {state['domain'].value} research",
                             fields=[f.label for f in template]))

    events.append(await emit(config, "queries", "started"))
    if state.get("demo_scenario"):
        queries: list[str] = []
        events.append(await emit(config, "queries", "skipped", "Demo scenario uses labelled fixture sources; no web search"))
    elif not state.get("automatic_search"):
        queries = []
        events.append(await emit(config, "queries", "skipped", "Automatic web search disabled by user"))
    else:
        queries = deterministic_queries(state)
        client = get_llm_client()
        if client is not None:
            try:
                system, user = planner_prompt(state["domain"], state["topic"], state.get("research_question", ""))
                plan = await client.structured(system, user, ResearchPlan, max_tokens=800)
                if plan.search_queries:
                    queries = [q.strip() for q in plan.search_queries if q.strip()][:5]
            except LLMError as exc:
                errors.append(StageError(stage="queries", message=f"Grok planning failed, using template queries: {exc}"))
        events.append(await emit(config, "queries", "completed", f"{len(queries)} search queries", queries=queries))
    return {"search_queries": queries, "progress": events, "errors": errors}


async def source_collector(state: ResearchState, config: RunnableConfig) -> dict:
    settings = get_settings()
    events = [await emit(config, "collecting", "started")]
    errors: list[StageError] = []
    limitations: list[str] = []
    candidates: list[dict] = []
    max_web = min(state.get("max_sources", 6), settings.max_source_count)

    def next_id() -> str:
        return f"S{len(candidates) + 1}"

    if state.get("demo_scenario"):
        for fx in demo_fixtures(state["demo_scenario"], today(state)):
            candidates.append({"source_id": next_id(), "origin": SourceOrigin.demo_fixture.value, "fixture": fx,
                               "url": fx.get("url"), "title": fx["title"]})
        limitations.append("DEMO MODE: sources are fictional, clearly labelled fixtures — not live research.")
    else:
        for url in state.get("user_urls", [])[:max_web]:
            try:
                check_url_syntax(url)
            except UnsafeURLError as exc:
                errors.append(StageError(stage="collecting", message=f"Rejected URL {url}: {exc}"))
                continue
            candidates.append({"source_id": next_id(), "origin": SourceOrigin.user_url.value, "url": url})

        for doc in state.get("uploaded_documents", []):
            candidates.append({"source_id": next_id(), "origin": SourceOrigin.uploaded_pdf.value, "document": doc,
                               "title": doc.filename})

        remaining = max_web - sum(1 for c in candidates if c["origin"] == SourceOrigin.user_url.value)
        queries = state.get("search_queries", [])
        if state.get("automatic_search") and remaining > 0 and queries:
            provider = get_search_provider()
            seen = {c.get("url") for c in candidates}
            per_query = max(2, min(5, remaining))
            for q in queries:
                if remaining <= 0:
                    break
                try:
                    results = await provider.search(q, per_query)
                except SearchError as exc:
                    errors.append(StageError(stage="collecting", message=str(exc)))
                    limitations.append(f"Automatic search unavailable: {exc}")
                    break
                for r in results:
                    if remaining <= 0 or r.url in seen:
                        continue
                    try:
                        check_url_syntax(r.url)
                    except UnsafeURLError:
                        continue
                    seen.add(r.url)
                    candidates.append({"source_id": next_id(), "origin": SourceOrigin.search.value, "url": r.url,
                                       "title": r.title, "snippet": r.snippet})
                    remaining -= 1

    if not candidates:
        events.append(await emit(config, "collecting", "failed", "No sources to analyse"))
        errors.append(StageError(stage="collecting", message="No sources were collected. Provide URLs, upload a PDF "
                                 "or configure a search provider.", recoverable=False))
    else:
        events.append(await emit(config, "collecting", "completed", f"{len(candidates)} source(s) queued",
                                 sources=[{"id": c["source_id"], "label": c.get("title") or c.get("url")} for c in candidates]))
    return {"candidates": candidates, "progress": events, "errors": errors, "limitations": limitations}


async def content_extractor(state: ResearchState, config: RunnableConfig) -> dict:
    candidates = state.get("candidates", [])
    web = [c for c in candidates if c["origin"] != SourceOrigin.uploaded_pdf.value]
    pdfs = [c for c in candidates if c["origin"] == SourceOrigin.uploaded_pdf.value]
    events = []
    errors: list[StageError] = []

    sources = []
    if web:
        events.append(await emit(config, "extracting_web", "started", f"Fetching {len(web)} source(s)"))
        web_sources = await extract_all(web)
        ok = sum(1 for s in web_sources if s.extraction_status in (ExtractionStatus.success, ExtractionStatus.partial))
        for s in web_sources:
            if s.extraction_error and s.extraction_status in (ExtractionStatus.failed, ExtractionStatus.blocked):
                errors.append(StageError(stage="extracting_web", source_id=s.source_id,
                                         message=f"{s.url}: {s.extraction_error}"))
        events.append(await emit(config, "extracting_web", "completed" if ok else "failed",
                                 f"{ok} of {len(web)} source(s) extracted"))
        sources.extend(web_sources)
    else:
        events.append(await emit(config, "extracting_web", "skipped", "No web sources"))

    if pdfs:
        events.append(await emit(config, "processing_pdfs", "started", f"Processing {len(pdfs)} uploaded PDF(s) in memory"))
        pdf_sources = await extract_all(pdfs)
        ok = 0
        for s in pdf_sources:
            if s.extraction_status in (ExtractionStatus.success, ExtractionStatus.partial):
                ok += 1
            else:
                errors.append(StageError(stage="processing_pdfs", source_id=s.source_id,
                                         message=f"{s.filename}: {s.extraction_error or s.extraction_status.value}"))
        events.append(await emit(config, "processing_pdfs", "completed" if ok else "failed",
                                 f"{ok} of {len(pdfs)} PDF(s) processed"))
        sources.extend(pdf_sources)
    else:
        events.append(await emit(config, "processing_pdfs", "skipped", "No uploaded PDFs"))

    order = {c["source_id"]: i for i, c in enumerate(candidates)}
    sources.sort(key=lambda s: order.get(s.source_id, 0))
    extracted = [{"source_id": s.source_id, "chars": len(s.extracted_text), "status": s.extraction_status.value}
                 for s in sources]
    return {"sources": sources, "extracted_documents": extracted, "progress": events, "errors": errors}


async def metadata_extractor(state: ResearchState, config: RunnableConfig) -> dict:
    events = [await emit(config, "metadata", "started")]
    sources = [enrich_metadata(s) for s in state.get("sources", [])]
    dated = sum(1 for s in sources if s.publication_date)
    cycles = sorted({s.academic_cycle for s in sources if s.academic_cycle})
    msg = f"{dated} of {len(sources)} source(s) have an explicit publication date"
    if cycles:
        msg += f"; academic cycles mentioned: {', '.join(cycles)}"
    events.append(await emit(config, "metadata", "completed", msg))
    return {"sources": sources, "progress": events}


def has_usable_sources(state: ResearchState) -> str:
    usable = [s for s in state.get("sources", [])
              if s.extraction_status in (ExtractionStatus.success, ExtractionStatus.partial) and s.extracted_text]
    return "usable" if usable else "insufficient"
