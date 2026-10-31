"""xAI Grok client with Pydantic-validated structured output.

Grok exposes an OpenAI-compatible Chat Completions API. We request JSON-schema
structured output generated from the Pydantic model, validate the response with
Pydantic and retry on rate limits, transient errors and invalid output.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
import re
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.core.config import Settings, get_settings

log = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)


class LLMError(Exception):
    pass


class LLMRateLimitError(LLMError):
    pass


def _strip_json_fences(text: str) -> str:
    text = text.strip()
    m = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.S)
    return m.group(1) if m else text


class GrokClient:
    def __init__(self, settings: Settings | None = None, transport: httpx.AsyncBaseTransport | None = None):
        self.settings = settings or get_settings()
        self._semaphore = asyncio.Semaphore(self.settings.llm_max_concurrency)
        self._transport = transport
        self._json_schema_supported = True

    async def _post(self, payload: dict) -> dict:
        headers = {"Authorization": f"Bearer {self.settings.grok_api_key}", "Content-Type": "application/json"}
        url = self.settings.grok_base_url.rstrip("/") + "/chat/completions"
        async with httpx.AsyncClient(timeout=self.settings.llm_timeout_seconds, transport=self._transport) as client:
            resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code == 429:
            raise LLMRateLimitError("Grok rate limit reached (HTTP 429)")
        if resp.status_code >= 500:
            raise LLMError(f"Grok server error (HTTP {resp.status_code})")
        if resp.status_code == 400 and "response_format" in resp.text and self._json_schema_supported:
            # Older models may not support json_schema; fall back to json_object mode.
            self._json_schema_supported = False
            raise LLMError("json_schema unsupported; retrying with json_object")
        if resp.status_code >= 400:
            raise LLMError(f"Grok request failed (HTTP {resp.status_code}): {resp.text[:200]}")
        return resp.json()

    async def structured(self, system: str, user: str, schema: type[T], temperature: float = 0.1,
                         max_tokens: int = 4000) -> T:
        json_schema = schema.model_json_schema()
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
        last_error: Exception | None = None
        for attempt in range(4):
            if self._json_schema_supported:
                response_format = {
                    "type": "json_schema",
                    "json_schema": {"name": schema.__name__, "schema": json_schema, "strict": False},
                }
                msgs = messages
            else:
                response_format = {"type": "json_object"}
                msgs = messages + [{
                    "role": "system",
                    "content": "Respond ONLY with JSON matching this JSON schema:\n" + json.dumps(json_schema),
                }]
            payload = {
                "model": self.settings.grok_model,
                "messages": msgs,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": response_format,
            }
            try:
                async with self._semaphore:
                    data = await self._post(payload)
                content = data["choices"][0]["message"]["content"] or ""
                return schema.model_validate_json(_strip_json_fences(content))
            except LLMRateLimitError as exc:
                last_error = exc
                await asyncio.sleep(min(20, 2 ** (attempt + 1)) + random.random())
            except ValidationError as exc:
                last_error = exc
                log.warning("Grok returned invalid structured output (attempt %s): %s", attempt + 1, exc)
                messages = messages + [{
                    "role": "user",
                    "content": f"Your previous answer did not match the schema: {str(exc)[:800]}. Return corrected JSON only.",
                }]
            except (LLMError, httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError) as exc:
                last_error = exc
                if isinstance(exc, LLMError) and "HTTP 4" in str(exc) and "429" not in str(exc):
                    break  # non-retryable client error (auth, bad request)
                await asyncio.sleep(1.5 * (attempt + 1))
        raise LLMError(f"Grok structured output failed: {last_error}")


_client: GrokClient | None = None


def get_llm_client() -> GrokClient | None:
    """Return a shared client when Grok is configured, otherwise None (heuristic mode)."""
    global _client
    settings = get_settings()
    if not settings.llm_enabled:
        return None
    if _client is None or _client.settings is not settings:
        _client = GrokClient(settings)
    return _client
