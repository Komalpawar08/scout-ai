"""Shared helpers for LangGraph nodes: progress emission and state accessors."""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from langchain_core.runnables import RunnableConfig

from app.agents.state import ResearchState
from app.schemas.research import ProgressEvent

log = logging.getLogger("scout.graph")

STAGE_LABELS = {
    "planning": "Planning research",
    "queries": "Generating search queries",
    "collecting": "Collecting sources",
    "extracting_web": "Extracting website content",
    "processing_pdfs": "Processing PDFs",
    "metadata": "Extracting metadata",
    "claims": "Extracting claims and evidence",
    "conflicts": "Detecting conflicts",
    "gaps": "Identifying information gaps",
    "freshness": "Checking freshness",
    "evidence": "Evaluating evidence",
    "coverage": "Building information coverage matrix",
    "graph": "Building claim relationship graph",
    "checklist": "Generating verification checklist",
    "completeness": "Calculating research completeness",
    "report": "Preparing final report",
}


async def emit(config: RunnableConfig | None, stage: str, status: str, message: str = "",
               **detail: Any) -> ProgressEvent:
    event = ProgressEvent(stage=stage, label=STAGE_LABELS.get(stage, stage), status=status, message=message,
                          detail=detail)
    callback = ((config or {}).get("configurable") or {}).get("emit")
    if callback is not None:
        try:
            await callback(event)
        except Exception:  # noqa: BLE001 - a disconnected client must not break the research run
            log.debug("progress callback failed", exc_info=True)
    return event


def today(state: ResearchState) -> date:
    ref = state.get("reference_date")
    return date.fromisoformat(ref) if ref else date.today()
