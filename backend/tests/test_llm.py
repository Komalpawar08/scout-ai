"""Grok client and LLM-mode claim extraction with a mocked transport (no network)."""

import json

import httpx
import pytest

from app.agents.nodes.claims import to_claims
from app.agents.prompts.schemas import ClaimExtractionOutput, ExtractedClaim, ResearchPlan
from app.core.config import Settings
from app.schemas.research import Domain, QuoteMatch
from app.services.llm.grok_client import GrokClient, LLMError


def completion(content: str) -> dict:
    return {"choices": [{"message": {"content": content}}]}


def settings():
    return Settings(grok_api_key="test-key", grok_model="grok-test", llm_mode="auto")


async def test_structured_output_uses_json_schema_and_validates():
    seen = {}

    def handler(request: httpx.Request):
        body = json.loads(request.content)
        seen["body"] = body
        seen["auth"] = request.headers["authorization"]
        return httpx.Response(200, json=completion('{"search_queries": ["a", "b"], "focus_points": []}'))

    client = GrokClient(settings(), transport=httpx.MockTransport(handler))
    plan = await client.structured("sys", "user", ResearchPlan)
    assert plan.search_queries == ["a", "b"]
    assert seen["body"]["response_format"]["type"] == "json_schema"
    assert seen["body"]["model"] == "grok-test"
    assert seen["auth"] == "Bearer test-key"
    assert str(seen["body"]["messages"][0]["content"]) == "sys"


async def test_invalid_output_is_retried(monkeypatch):
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(200, json=completion('{"wrong": true}'))
        return httpx.Response(200, json=completion('```json\n{"search_queries": ["ok"]}\n```'))

    client = GrokClient(settings(), transport=httpx.MockTransport(handler))
    plan = await client.structured("s", "u", ResearchPlan)
    assert plan.search_queries == ["ok"] and calls["n"] == 2


async def test_rate_limit_retry_then_success(monkeypatch):
    import app.services.llm.grok_client as mod

    async def no_sleep(_):
        return None

    monkeypatch.setattr(mod.asyncio, "sleep", no_sleep)
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        if calls["n"] < 3:
            return httpx.Response(429, json={"error": "rate"})
        return httpx.Response(200, json=completion('{"search_queries": ["x"]}'))

    client = GrokClient(settings(), transport=httpx.MockTransport(handler))
    assert (await client.structured("s", "u", ResearchPlan)).search_queries == ["x"]


async def test_auth_error_not_retried():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(401, json={"error": "bad key"})

    client = GrokClient(settings(), transport=httpx.MockTransport(handler))
    with pytest.raises(LLMError):
        await client.structured("s", "u", ResearchPlan)
    assert calls["n"] == 1


def test_fabricated_quotes_are_marked_unsupported(make_source):
    source = make_source("S1", extracted_text="## Deadline\nThe last date to apply is 15 December 2026.\n")
    from app.services.html_extractor import build_section_spans

    source.spans = build_section_spans(source.extracted_text)
    extracted = [
        ExtractedClaim(claim_text="Deadline is 15 Dec 2026", category="deadline", subject="Deadline",
                       value="15 December 2026", value_type="date", normalized_value="2026-12-15",
                       supporting_quote="The last date to apply is 15 December 2026.", confidence=0.9),
        ExtractedClaim(claim_text="Income limit is 3 lakh", category="income_criteria", subject="Income",
                       value="3 lakh", value_type="money", normalized_value="300000",
                       supporting_quote="Family income must be below 3 lakh.", confidence=0.9),
        ExtractedClaim(claim_text="Off-template", category="weather", subject="x", value="y",
                       supporting_quote="The last date to apply", confidence=0.5),
    ]
    claims = to_claims(source, extracted, "llm", Domain.scholarship, 0)
    assert len(claims) == 2  # unknown category dropped
    ok, fabricated = claims
    assert ok.quote_match == QuoteMatch.exact and ok.section == "Deadline" and ok.start_offset is not None
    assert fabricated.quote_match == QuoteMatch.not_found and fabricated.start_offset is None


def test_extraction_schema_round_trip():
    out = ClaimExtractionOutput.model_validate({"claims": [{
        "claim_text": "t", "category": "deadline", "subject": "s", "value": "v",
        "supporting_quote": "q", "confidence": 0.5}]})
    assert out.claims[0].value_type == "text" and out.claims[0].is_uncertain is False
