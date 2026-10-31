"""REST + SSE endpoints. No job registry: each request runs and returns in-process."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Annotated, AsyncIterator

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.research import ProgressEvent, ResearchRequest, ResearchResponse, UploadedDocument
from app.services.export_service import export_json, export_pdf
from app.services.pdf_extractor import looks_like_pdf
from app.services.research_service import run_research

log = logging.getLogger("scout.api")
router = APIRouter(prefix="/api")
PDF_TYPES = {"application/pdf", "application/x-pdf", "application/octet-stream"}


@router.get("/health")
async def health() -> dict:
    s = get_settings()
    return {
        "status": "ok",
        "llm": {"provider": "xai-grok", "configured": s.llm_enabled, "model": s.grok_model if s.llm_enabled else None},
        "search": {"provider": s.search_provider, "configured": s.search_enabled},
        "mode": "live" if s.llm_enabled else "heuristic",
        "limits": {"max_sources": s.max_source_count, "max_pdf_size_mb": s.max_pdf_size_mb, "max_pdf_files": s.max_pdf_files},
        "storage": "in-memory only; no database, no persistence",
    }


def parse_request(payload: str) -> ResearchRequest:
    try:
        return ResearchRequest.model_validate_json(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=json.loads(exc.json(include_url=False))) from exc


async def read_uploads(files: list[UploadFile] | None) -> list[UploadedDocument]:
    settings = get_settings()
    files = [f for f in (files or []) if f.filename]
    if len(files) > settings.max_pdf_files:
        raise HTTPException(status_code=413, detail=f"At most {settings.max_pdf_files} PDF files are allowed")
    limit = settings.max_pdf_size_mb * 1024 * 1024
    docs: list[UploadedDocument] = []
    for f in files:
        name = (f.filename or "upload.pdf")[:200]
        if (f.content_type or "").lower() not in PDF_TYPES or not name.lower().endswith(".pdf"):
            raise HTTPException(status_code=415, detail=f"{name}: only PDF files are accepted")
        data = await f.read(limit + 1)
        await f.close()
        if len(data) > limit:
            raise HTTPException(status_code=413, detail=f"{name}: exceeds {settings.max_pdf_size_mb} MB limit")
        if not looks_like_pdf(data):
            raise HTTPException(status_code=415, detail=f"{name}: file content is not a valid PDF")
        docs.append(UploadedDocument(filename=name, content_type="application/pdf", size_bytes=len(data), data=data))
    return docs


def _validate_has_inputs(req: ResearchRequest, uploads: list[UploadedDocument]) -> None:
    if not req.demo_scenario and not req.user_urls and not uploads and not req.automatic_search:
        raise HTTPException(status_code=422, detail="Provide URLs, upload PDFs or enable automatic search")


@router.post("/research", response_model=ResearchResponse)
async def research(
    payload: Annotated[str, Form(description="JSON-encoded ResearchRequest")],
    files: Annotated[list[UploadFile] | None, File()] = None,
) -> ResearchResponse:
    req = parse_request(payload)
    uploads = await read_uploads(files)
    _validate_has_inputs(req, uploads)
    return await run_research(req, uploads)


def _sse(event: str, data: dict | str) -> str:
    body = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {body}\n\n"


@router.post("/research/stream")
async def research_stream(
    request: Request,
    payload: Annotated[str, Form(description="JSON-encoded ResearchRequest")],
    files: Annotated[list[UploadFile] | None, File()] = None,
) -> StreamingResponse:
    req = parse_request(payload)
    uploads = await read_uploads(files)
    _validate_has_inputs(req, uploads)
    queue: asyncio.Queue[tuple[str, dict]] = asyncio.Queue()

    async def emit(event: ProgressEvent) -> None:
        await queue.put(("progress", event.model_dump(mode="json")))

    async def runner() -> None:
        try:
            result = await run_research(req, uploads, emit=emit)
            await queue.put(("result", result.model_dump(mode="json")))
        except Exception as exc:  # noqa: BLE001 - report real failure to the client
            log.exception("research run failed")
            await queue.put(("error", {"message": f"Research failed: {exc.__class__.__name__}: {exc}"}))

    async def stream() -> AsyncIterator[str]:
        task = asyncio.create_task(runner())
        try:
            yield _sse("start", {"message": "Research started"})
            while True:
                try:
                    event, data = await asyncio.wait_for(queue.get(), timeout=15)
                except asyncio.TimeoutError:
                    if await request.is_disconnected():
                        break
                    yield ": keep-alive\n\n"
                    continue
                yield _sse(event, data)
                if event in ("result", "error"):
                    break
        finally:
            if not task.done():
                task.cancel()  # client disconnected: stop work, discard state

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/export/json")
async def export_json_endpoint(report: ResearchResponse) -> Response:
    return Response(export_json(report), media_type="application/json",
                    headers={"Content-Disposition": f'attachment; filename="scout-{report.research_id}.json"'})


@router.post("/export/pdf")
async def export_pdf_endpoint(report: ResearchResponse) -> Response:
    data = await asyncio.to_thread(export_pdf, report)
    return Response(data, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="scout-{report.research_id}.pdf"'})
