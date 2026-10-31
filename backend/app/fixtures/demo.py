"""DEMO FIXTURES — fictional, clearly labelled sources for reproducible demonstrations.

These are NOT real organisations, scholarships or events. Every fixture uses the
reserved `.example` TLD, titles start with "[DEMO]", and sources are flagged
`is_demo=True`. Dates are generated relative to the reference date so the scenario
stays reproducible: the official notice is always for the current academic cycle,
while the PDF notice is always for the previous cycle.
"""

from __future__ import annotations

from datetime import date, timedelta

import pymupdf

from app.services.metadata import current_academic_cycle


def _fmt(d: date) -> str:
    return f"{d.day} {d.strftime('%B %Y')}"


def _html(title: str, published: date, body: str, site: str) -> str:
    return f"""<!doctype html><html><head><title>{title}</title>
<meta property="og:site_name" content="{site}">
<meta property="article:published_time" content="{published.isoformat()}T09:00:00+05:30">
</head><body><article><h1>{title}</h1>{body}</article></body></html>"""


def _pdf(title: str, lines: list[str]) -> bytes:
    doc = pymupdf.open()
    doc.set_metadata({"title": title, "author": "[DEMO] Fictional Scholarship Board"})
    page = doc.new_page()
    y = 60
    for line in lines:
        rect = pymupdf.Rect(50, y, 545, y + 60)
        page.insert_textbox(rect, line, fontsize=10.5, fontname="helv")
        y += 22 if len(line) < 85 else 36
        if y > 760:
            page = doc.new_page()
            y = 60
    data = doc.tobytes()
    doc.close()
    return data


def scholarship_fixtures(today: date) -> list[dict]:
    cycle = current_academic_cycle(today)
    start = int(cycle[:4])
    prev = f"{start - 1}-{str(start)[2:]}"
    deadline = today + timedelta(days=45)
    prev_deadline = date(start - 1, 10, 31)

    official = _html(
        f"[DEMO] Aarohan State Merit Scholarship {cycle} — Official Notice",
        today - timedelta(days=20),
        f"""<h2>About</h2><p>This official notice applies to the academic year {cycle}.</p>
<h2>Eligibility</h2>
<p>Students who have passed Class 12 from a recognised board and are enrolled in an undergraduate programme in the state are eligible to apply.</p>
<p>Applicants must have scored a minimum of 60% marks in the Class 12 board examination.</p>
<p>The annual family income of the applicant must not exceed ₹2.5 lakh from all sources.</p>
<h2>Required documents</h2>
<p>Applicants must upload the following documents: Aadhaar card, income certificate, Class 12 mark sheet, bank passbook and domicile certificate.</p>
<h2>Important dates</h2>
<p>The last date to submit the online application is {_fmt(deadline)}.</p>
<h2>How to apply</h2>
<p>Register on the official portal at https://scholarships.aarohan.example/apply and submit the application form online.</p>
<p>Applications are verified by the institution before the merit list is published.</p>
<h2>Selection</h2>
<p>Selection is based on a merit list prepared from Class 12 marks.</p>""",
        "[DEMO] Aarohan Scholarship Board",
    )
    secondary = _html(
        f"[DEMO] Aarohan Scholarship {cycle}: last date, eligibility and documents explained",
        today - timedelta(days=10),
        f"""<p>The Aarohan State Merit Scholarship is open to undergraduate students in the state for the academic year {cycle}.</p>
<p>Students need at least 60% marks in Class 12 to apply.</p>
<p>According to our reporters, the family income limit is ₹3 lakh per year.</p>
<p>The last date to apply is {_fmt(deadline)}.</p>
<p>Documents required include the Aadhaar card, income certificate, Class 12 mark sheet, bank passbook and caste certificate.</p>
<p>It remains unclear whether the scholarship can be renewed in the second year of study.</p>""",
        "[DEMO] EduNews Daily",
    )
    pdf = _pdf(
        f"[DEMO] Aarohan Scholarship Notice {prev}",
        [
            f"[DEMO] AAROHAN STATE MERIT SCHOLARSHIP — NOTICE FOR ACADEMIC YEAR {prev}",
            "This is a fictional demonstration document.",
            "Eligibility: Students enrolled in an undergraduate programme in the state are eligible to apply.",
            "Minimum marks: Students must have scored at least 55% marks in the Class 12 examination.",
            "Income: The annual family income must not exceed ₹2.5 lakh.".replace("₹", "Rs "),
            "Documents to be submitted: Aadhaar card, income certificate, mark sheet and bank passbook.",
            f"The last date for submission of applications was {_fmt(prev_deadline)}.",
            "Selection is based on merit.",
        ],
    )
    return [
        {"title": f"[DEMO] Aarohan State Merit Scholarship {cycle} — Official Notice",
         "url": "https://scholarships.aarohan.example/notice", "html": official,
         "source_type": "official_primary",
         "source_type_reason": "DEMO fixture representing the official scholarship board notice."},
        {"title": f"[DEMO] Aarohan Scholarship {cycle} explained", "url": "https://edunews.example/aarohan-scholarship",
         "html": secondary, "source_type": "secondary_reporting",
         "source_type_reason": "DEMO fixture representing secondary education news coverage."},
        {"title": f"[DEMO] Aarohan Scholarship Notice {prev} (PDF)", "filename": f"aarohan_notice_{prev}.pdf",
         "url": None, "pdf_bytes": pdf, "publication_date": prev_deadline.replace(month=8, day=1).isoformat(),
         "publisher": "[DEMO] Aarohan Scholarship Board", "source_type": "research_document",
         "source_type_reason": "DEMO fixture representing an older PDF notice shared by a student."},
    ]


def news_fixtures(today: date) -> list[dict]:
    event = today - timedelta(days=7)
    first = _html(
        "[DEMO] Bridge collapses in Kalinagar district, several feared dead",
        event,
        f"""<p>A section of the Riverside bridge in Kalinagar district collapsed on {_fmt(event)} during the evening rush hour.</p>
<p>At least 8 people were killed in the collapse, according to initial reports from rescue workers.</p>
<p>Rescue teams were still searching the river late into the night.</p>
<p>The cause of the collapse remains unclear.</p>""",
        "[DEMO] Kalinagar Morning Post",
    )
    national = _html(
        "[DEMO] Kalinagar bridge collapse: death toll rises",
        event + timedelta(days=4),
        f"""<p>The Riverside bridge in Kalinagar district collapsed on {_fmt(event)}, sending vehicles into the river.</p>
<p>At least 12 people were killed and 30 were injured, according to district officials.</p>
<p>The bridge was built in 1998 and had been repaired in 2019.</p>
<p>Rescue operations were later called off after all missing persons were accounted for.</p>
<p>It is not yet known whether the contractor responsible for the repairs will face action.</p>""",
        "[DEMO] National Herald Times",
    )
    regional = _html(
        "[DEMO] Residents say Kalinagar bridge showed cracks for months",
        event + timedelta(days=5),
        f"""<p>Residents of Kalinagar said the Riverside bridge, which collapsed on {_fmt(event)}, had shown visible cracks for months.</p>
<p>At least 15 people were killed in the collapse, local residents told our correspondent.</p>
<p>Local residents claimed that complaints to the municipal office had been ignored.</p>
<p>The bridge was built in 1998 and connected two busy markets.</p>
<p>The cause of the collapse is still under investigation.</p>""",
        "[DEMO] Riverside Regional News",
    )
    return [
        {"title": "[DEMO] Bridge collapses in Kalinagar district", "url": "https://morningpost.example/kalinagar-bridge",
         "html": first, "source_type": "secondary_reporting",
         "source_type_reason": "DEMO fixture representing early local news reporting."},
        {"title": "[DEMO] Kalinagar bridge collapse: death toll rises", "url": "https://heraldtimes.example/kalinagar-toll",
         "html": national, "source_type": "secondary_reporting",
         "source_type_reason": "DEMO fixture representing national news follow-up."},
        {"title": "[DEMO] Residents say bridge showed cracks", "url": "https://riversidenews.example/cracks",
         "html": regional, "source_type": "secondary_reporting",
         "source_type_reason": "DEMO fixture representing regional news coverage."},
    ]


def demo_fixtures(scenario: str, today: date) -> list[dict]:
    if scenario == "scholarship":
        return scholarship_fixtures(today)
    if scenario == "news":
        return news_fixtures(today)
    raise ValueError(f"Unknown demo scenario: {scenario}")
