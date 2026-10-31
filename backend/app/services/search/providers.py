"""Replaceable web-search providers.

The LangGraph workflow only depends on `SearchProvider.search`; adding a provider means
implementing that one method and registering it in `get_search_provider`.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx

from app.core.config import Settings, get_settings


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str
    published: str | None = None


class SearchError(Exception):
    pass


class SearchProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def search(self, query: str, max_results: int) -> list[SearchResult]: ...


class TavilyProvider(SearchProvider):
    name = "tavily"
    endpoint = "https://api.tavily.com/search"

    def __init__(self, api_key: str, timeout: float):
        self.api_key = api_key
        self.timeout = timeout

    async def search(self, query: str, max_results: int) -> list[SearchResult]:
        payload = {"query": query, "max_results": max_results, "search_depth": "basic", "include_answer": False}
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    self.endpoint, json=payload, headers={"Authorization": f"Bearer {self.api_key}"}
                )
        except httpx.HTTPError as exc:
            raise SearchError(f"Tavily request failed: {exc.__class__.__name__}") from exc
        if resp.status_code != 200:
            raise SearchError(f"Tavily returned HTTP {resp.status_code}")
        data = resp.json()
        return [
            SearchResult(
                title=r.get("title") or r.get("url", ""), url=r.get("url", ""),
                snippet=r.get("content", "")[:500], published=r.get("published_date"),
            )
            for r in data.get("results", [])
            if r.get("url")
        ]


class BraveProvider(SearchProvider):
    name = "brave"
    endpoint = "https://api.search.brave.com/res/v1/web/search"

    def __init__(self, api_key: str, timeout: float):
        self.api_key = api_key
        self.timeout = timeout

    async def search(self, query: str, max_results: int) -> list[SearchResult]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(
                    self.endpoint,
                    params={"q": query, "count": min(max_results, 20)},
                    headers={"X-Subscription-Token": self.api_key, "Accept": "application/json"},
                )
        except httpx.HTTPError as exc:
            raise SearchError(f"Brave request failed: {exc.__class__.__name__}") from exc
        if resp.status_code != 200:
            raise SearchError(f"Brave returned HTTP {resp.status_code}")
        results = resp.json().get("web", {}).get("results", [])
        return [
            SearchResult(title=r.get("title", ""), url=r.get("url", ""), snippet=r.get("description", "")[:500],
                         published=r.get("page_age"))
            for r in results
            if r.get("url")
        ]


class DisabledProvider(SearchProvider):
    name = "none"

    async def search(self, query: str, max_results: int) -> list[SearchResult]:
        raise SearchError("Automatic search is not configured (set SEARCH_PROVIDER and SEARCH_API_KEY)")


def get_search_provider(settings: Settings | None = None) -> SearchProvider:
    settings = settings or get_settings()
    if not settings.search_enabled:
        return DisabledProvider()
    provider = settings.search_provider.lower()
    if provider == "tavily":
        return TavilyProvider(settings.search_api_key, settings.request_timeout_seconds)
    if provider == "brave":
        return BraveProvider(settings.search_api_key, settings.request_timeout_seconds)
    return DisabledProvider()
