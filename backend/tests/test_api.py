import json

import pymupdf
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def payload(**kw):
    base = {"topic": "Aarohan scholarship", "research_question": "What should I verify?", "domain": "scholarship",
            "automatic_search": False, "max_sources": 5}
    base.update(kw)
    return {"payload": json.dumps(base)}


def make_pdf(text: str) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_textbox(pymupdf.Rect(50, 50, 550, 800), text, fontsize=11)
    data = doc.tobytes()
    doc.close()
    return data


def test_health_reports_mode_without_secrets():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok" and body["mode"] == "heuristic"
    assert "api_key" not in json.dumps(body).lower()


@pytest.mark.parametrize("bad", [
    {"topic": "x"},  # too short
    {"domain": "sports"},
    {"max_sources": 99},
])
def test_request_validation(bad):
    r = client.post("/api/research", data=payload(**bad))
    assert r.status_code == 422


def test_requires_some_input():
    r = client.post("/api/research", data=payload())
    assert r.status_code == 422


def test_unsafe_user_url_reported_not_fetched():
    r = client.post("/api/research", data=payload(user_urls=["http://127.0.0.1/admin"]))
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "failed"
    assert any("Rejected URL" in e["message"] for e in body["errors"])
    # Contract still satisfied with explicit "unable to determine" gaps.
    assert all(g["coverage_status"] == "unable_to_determine" for g in body["information_gaps"])


def test_rejects_non_pdf_upload():
    r = client.post("/api/research", data=payload(),
                    files=[("files", ("notes.pdf", b"hello world", "application/pdf"))])
    assert r.status_code == 415


def test_pdf_upload_is_analysed_in_memory():
    pdf = make_pdf("Scholarship notice for academic year 2026-27. The last date to apply is 15 December 2026. "
                   "The annual family income must not exceed Rs 2.5 lakh. Applicants must have scored a minimum of "
                   "60% marks in Class 12.")
    r = client.post("/api/research", data=payload(), files=[("files", ("notice.pdf", pdf, "application/pdf"))])
    assert r.status_code == 200
    body = r.json()
    src = body["sources"][0]
    assert src["origin"] == "uploaded_pdf" and src["source_type"] == "user_provided" and src["filename"] == "notice.pdf"
    assert src["academic_cycle"] == "2026-27"
    cats = {c["claim_category"] for c in body["claims"]}
    assert {"deadline", "income_criteria", "minimum_marks"} <= cats
    assert all(c["page_number"] == 1 and c["quote_match"] != "not_found" for c in body["claims"])


def test_demo_research_full_contract():
    r = client.post("/api/research", data=payload(demo_scenario="scholarship"))
    assert r.status_code == 200
    body = r.json()
    for key in ["research_id", "domain", "summary", "sources", "claims", "conflicts", "information_gaps",
                "freshness_warnings", "coverage_matrix", "claim_relationships", "evidence_assessment",
                "research_completeness", "verification_checklist", "final_report", "limitations"]:
        assert key in body
    assert body["mode"] == "demo" and all(s["is_demo"] for s in body["sources"])
    assert any("DEMO" in lim for lim in body["limitations"])
    fields = {k["field"] for k in body["conflicts"]}
    assert {"income_criteria", "required_documents"} <= fields
    assert any(n["field"] == "minimum_marks" for n in body["scope_notes"])


def test_sse_stream_sends_progress_then_result():
    with client.stream("POST", "/api/research/stream", data=payload(domain="news", topic="Kalinagar bridge",
                                                                   demo_scenario="news")) as r:
        assert r.status_code == 200
        text = "".join(r.iter_text())
    events = [line.split(": ", 1)[1] for line in text.splitlines() if line.startswith("event: ")]
    assert events[0] == "start" and events[-1] == "result"
    assert "progress" in events
    stages = [json.loads(line[6:])["stage"] for line in text.splitlines()
              if line.startswith("data: ") and '"stage"' in line]
    for stage in ["planning", "collecting", "claims", "conflicts", "gaps", "freshness", "evidence", "checklist", "report"]:
        assert stage in stages


def test_exports():
    report = client.post("/api/research", data=payload(demo_scenario="scholarship")).json()
    r = client.post("/api/export/json", json=report)
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
    exported = r.json()
    assert exported["research_id"] == report["research_id"] and "extracted_text" not in exported["sources"][0]
    r = client.post("/api/export/pdf", json=report)
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    doc = pymupdf.open(stream=r.content, filetype="pdf")
    text = "".join(p.get_text() for p in doc)
    assert "Verification checklist" in text and "Information coverage matrix" in text
    assert "https://scholarships.aarohan.example/notice" in text


def test_export_rejects_invalid_report():
    assert client.post("/api/export/json", json={"foo": "bar"}).status_code == 422
