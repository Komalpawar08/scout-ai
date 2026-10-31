"""PDF and JSON report export. Files are generated in memory and streamed back; nothing is saved."""

from __future__ import annotations

import io
import json
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.schemas.research import ResearchResponse


def export_json(report: ResearchResponse) -> bytes:
    data = report.model_dump(mode="json")
    for s in data.get("sources", []):
        s.pop("extracted_text", None)  # keep the export focused; quotes and offsets are retained
    return json.dumps(data, indent=2, ensure_ascii=False).encode("utf-8")


def _p(text: str | None, style) -> Paragraph:
    # ReportLab's base fonts lack the rupee glyph.
    return Paragraph(escape(str(text or "—")).replace("₹", "Rs ").replace("\n", "<br/>"), style)


def _table(rows: list[list], widths: list[float], header_bg=colors.HexColor("#1e293b")) -> Table:
    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def export_pdf(r: ResearchResponse) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=15 * mm,
                            bottomMargin=15 * mm, title=r.final_report.title)
    ss = getSampleStyleSheet()
    h1, h2, body = ss["Title"], ss["Heading2"], ss["BodyText"]
    small = ParagraphStyle("small", parent=body, fontSize=8, leading=10)
    hdr = ParagraphStyle("hdr", parent=small, textColor=colors.white, fontName="Helvetica-Bold")
    warn = ParagraphStyle("warn", parent=body, textColor=colors.HexColor("#b45309"))
    story: list = []
    W = doc.width

    def H(cells):
        return [_p(c, hdr) for c in cells]

    story += [_p(r.final_report.title, h1)]
    if r.mode != "live":
        story.append(_p(r.mode_explanation, warn))
    story += [
        _p(f"Research ID: {r.research_id} · Generated: {r.created_at} · Domain: {r.domain.value} · Status: {r.status}", small),
        _p(f"Research question: {r.research_question or '(not provided)'}", body),
        Spacer(1, 6), _p("Executive summary", h2), _p(r.summary, body),
    ]
    if r.final_report.key_findings:
        story.append(_p("Key findings", h2))
        story += [_p(f"• {f}", body) for f in r.final_report.key_findings]

    rc = r.research_completeness
    story += [_p("Research completeness", h2), _p(f"{rc.score}/100 — {rc.label}", body), _p(rc.formula, small)]
    story.append(_table([H(["Component", "Value", "Weight", "Explanation"])] + [
        [_p(c.name, small), _p(f"{c.value:.2f}", small), _p(f"{c.weight:.2f}", small), _p(c.explanation, small)]
        for c in rc.components], [W * .2, W * .1, W * .1, W * .6]))
    story.append(_p(rc.disclaimer, small))

    story += [_p("Source inventory", h2)]
    story.append(_table([H(["ID", "Title / location", "Type", "Published", "Extraction"])] + [
        [_p(s.source_id, small), _p(f"{s.title}\n{s.url or s.filename or ''}", small), _p(s.source_type.value, small),
         _p(f"{s.publication_date or 'not stated'}" + (f"\n({s.publication_date_origin})" if s.publication_date_origin else ""), small),
         _p(s.extraction_status.value + (f": {s.extraction_error}" if s.extraction_error else ""), small)]
        for s in r.sources], [W * .07, W * .43, W * .17, W * .16, W * .17]))

    story += [PageBreak(), _p("Verification checklist", h2)]
    story.append(_table([H(["ID", "Priority", "Task", "Reason / action"])] + [
        [_p(t.task_id, small), _p(t.priority.value, small), _p(t.task, small),
         _p(f"{t.reason}\nAction: {t.suggested_action}\nWhere: {t.suggested_source}", small)]
        for t in r.verification_checklist], [W * .07, W * .1, W * .3, W * .53]))

    story += [_p("Possible conflicts", h2)]
    if not r.conflicts:
        story.append(_p("No possible conflicts were detected among the sources reviewed.", body))
    for k in r.conflicts:
        story += [_p(f"{k.conflict_id} · {k.label} · {k.field} · confidence {k.confidence:.2f}", ss["Heading4"]),
                  _p(k.explanation, body),
                  _p(f"[{k.source_a}] \"{k.quotation_a}\"", small), _p(f"[{k.source_b}] \"{k.quotation_b}\"", small),
                  _p("Scope checks: " + "; ".join(f"{a}: {b}" for a, b in k.scope_checks.items()), small),
                  _p(f"Recommended verification: {k.recommended_verification}", small)]
    if r.scope_notes:
        story.append(_p("Differences explained by scope (not flagged as conflicts)", ss["Heading4"]))
        story += [_p(f"{n.claim_a} vs {n.claim_b} ({n.field}): {n.note}", small) for n in r.scope_notes]

    story += [_p("Potential information gaps", h2)]
    story.append(_table([H(["ID", "Field", "Status", "Priority", "Explanation / suggested search"])] + [
        [_p(g.gap_id, small), _p(g.field_label, small), _p(g.coverage_status.value, small), _p(g.priority.value, small),
         _p(f"{g.explanation}\nWhy it matters: {g.why_it_matters}\nSearch: {g.suggested_search}", small)]
        for g in r.information_gaps], [W * .07, W * .16, W * .14, W * .1, W * .53]))

    story += [_p("Information coverage matrix", h2)]
    cm = r.coverage_matrix
    col_w = (W * .62) / max(1, len(cm.sources))
    story.append(_table([H(["Field"] + cm.sources + ["Coverage"])] + [
        [_p(row.label + (" *" if row.critical else ""), small)] + [_p(c.status, small) for c in row.cells]
        + [_p(row.overall_label, small)] for row in cm.rows], [W * .22] + [col_w] * len(cm.sources) + [W * .16]))
    story.append(_p("* critical field", small))

    story += [_p("Freshness analysis", h2)]
    story += [_p(f"{f.source_id}: {f.status.value} — {f.reason}", small) for f in r.source_freshness]
    story += [_p(f"{w.warning_id} ({w.status.value}): {w.reason}", small) for w in r.freshness_warnings]

    story += [PageBreak(), _p("Claims, quotations and evidence assessment", h2),
              _p(r.evidence_assessment.method + " Weights: " +
                 ", ".join(f"{k} {v}" for k, v in r.evidence_assessment.weights.items()), small)]
    assess = {a.claim_id: a for a in r.evidence_assessment.claims}
    rows = [H(["Claim", "Category", "Quotation & reference", "Evidence"])]
    for c in r.claims:
        a = assess.get(c.claim_id)
        ref = f"{c.source_id}" + (f", page {c.page_number}" if c.page_number else "") + (f", {c.section}" if c.section else "")
        comps = ", ".join(f"{x.name[:5]} {x.value:.2f}" for x in a.components) if a else ""
        rows.append([_p(f"{c.claim_id}: {c.claim_text}", small), _p(c.claim_category, small),
                     _p(f"\"{c.supporting_quote}\"\n[{ref}; quote {c.quote_match.value}]", small),
                     _p(f"{c.evidence_status.value}\nscore {a.score:.2f}\n{comps}" if a else c.evidence_status.value, small)])
    story.append(_table(rows, [W * .27, W * .13, W * .38, W * .22]))

    story += [_p("Unanswered questions", h2)] + [_p(f"• {q}", body) for q in r.final_report.unanswered_questions]
    story += [_p("Uncertainty and limitations", h2)] + [_p(f"• {lim}", body) for lim in r.limitations]
    if r.errors:
        story += [_p("Processing warnings", h2)] + [_p(f"[{e.stage}] {e.message}", small) for e in r.errors]
    doc.build(story)
    return buf.getvalue()
