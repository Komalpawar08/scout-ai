import os

# Tests never call real external services: force heuristic LLM mode and disable search.
os.environ["LLM_MODE"] = "heuristic"
os.environ["GROK_API_KEY"] = ""
os.environ["SEARCH_PROVIDER"] = "none"
os.environ["SEARCH_API_KEY"] = ""

import pytest  # noqa: E402

from app.core.config import reset_settings_cache  # noqa: E402

reset_settings_cache()


@pytest.fixture
def make_claim():
    from app.schemas.research import Claim, QuoteMatch

    counter = {"n": 0}

    def _make(**kw):
        counter["n"] += 1
        base = dict(
            claim_id=f"C{counter['n']}", claim_text="text", claim_category="income_criteria", subject="Income",
            value="x", value_type="text", source_id="S1", supporting_quote="quote here",
            quote_match=QuoteMatch.exact,
        )
        base.update(kw)
        return Claim(**base)

    return _make


@pytest.fixture
def make_source():
    from app.schemas.research import ExtractionStatus, Source, SourceOrigin, SourceType

    def _make(sid="S1", **kw):
        base = dict(
            source_id=sid, title=f"Source {sid}", url=f"https://{sid.lower()}.example/page", origin=SourceOrigin.user_url,
            source_type=SourceType.secondary_reporting, retrieved_at="2026-01-01T00:00:00+00:00",
            extraction_status=ExtractionStatus.success, extracted_text="Some text " * 30, publisher=f"pub-{sid}",
        )
        base.update(kw)
        return Source(**base)

    return _make
