"""Safe HTTP fetching: manual redirect handling with per-hop SSRF validation,
timeouts and streaming size limits."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urljoin

import httpx

from app.core.config import get_settings
from app.services.url_security import UnsafeURLError, validate_public_url

USER_AGENT = "Mozilla/5.0 (compatible; ScoutAI/1.0; +research-assistant)"


class FetchError(Exception):
    def __init__(self, message: str, blocked: bool = False):
        super().__init__(message)
        self.blocked = blocked


@dataclass
class FetchResult:
    url: str  # final URL after redirects
    status_code: int
    content_type: str
    content: bytes
    truncated: bool


async def fetch_url(url: str, client: httpx.AsyncClient | None = None, resolver=None) -> FetchResult:
    settings = get_settings()
    owns_client = client is None
    if client is None:
        client = httpx.AsyncClient(
            timeout=httpx.Timeout(settings.request_timeout_seconds),
            follow_redirects=False,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5"},
        )
    validate = (lambda u: validate_public_url(u, resolver)) if resolver else validate_public_url
    try:
        current = url
        for _hop in range(settings.max_redirects + 1):
            try:
                await validate(current)
            except UnsafeURLError as exc:
                raise FetchError(f"Blocked unsafe URL: {exc}", blocked=True) from exc
            try:
                async with client.stream("GET", current) as resp:
                    if resp.is_redirect:
                        location = resp.headers.get("location")
                        if not location:
                            raise FetchError("Redirect without location header")
                        current = urljoin(current, location)
                        continue
                    if resp.status_code in (401, 403, 429):
                        raise FetchError(f"Website refused access (HTTP {resp.status_code})", blocked=True)
                    if resp.status_code >= 400:
                        raise FetchError(f"HTTP {resp.status_code}")
                    declared = resp.headers.get("content-length")
                    if declared and declared.isdigit() and int(declared) > settings.max_response_bytes * 2:
                        raise FetchError("Response too large")
                    chunks: list[bytes] = []
                    total = 0
                    truncated = False
                    async for chunk in resp.aiter_bytes():
                        total += len(chunk)
                        if total > settings.max_response_bytes:
                            truncated = True
                            break
                        chunks.append(chunk)
                    return FetchResult(
                        url=str(resp.url),
                        status_code=resp.status_code,
                        content_type=resp.headers.get("content-type", "").lower(),
                        content=b"".join(chunks),
                        truncated=truncated,
                    )
            except httpx.TimeoutException as exc:
                raise FetchError("Request timed out") from exc
            except httpx.HTTPError as exc:
                raise FetchError(f"Network error: {exc.__class__.__name__}") from exc
        raise FetchError("Too many redirects")
    finally:
        if owns_client:
            await client.aclose()
