"""Domain-specific expected-information templates.

These templates drive claim categorisation, information-gap detection, the coverage
matrix, completeness weights and checklist priorities. They are the main place where
News and Scholarship research differ.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.schemas.research import Domain, Priority


@dataclass(frozen=True)
class ExpectedField:
    key: str
    label: str
    description: str
    why_it_matters: str
    priority: Priority
    weight: float  # relative weight in completeness scoring
    search_hint: str
    verification: str
    keywords: tuple[str, ...] = field(default_factory=tuple)  # heuristic extraction cues
    # Whether multiple distinct values across sources are expected (lists) rather than a conflict.
    multi_valued: bool = False

    @property
    def critical(self) -> bool:
        return self.priority == Priority.critical


NEWS_FIELDS: tuple[ExpectedField, ...] = (
    ExpectedField(
        "event_description", "Event description",
        "What happened, in plain terms.",
        "Without a clear description it is impossible to tell whether sources describe the same event.",
        Priority.critical, 1.5, "what happened",
        "Compare the event description across at least two independent publishers.",
        ("happened", "occurred", "incident", "collapsed", "struck", "announced", "reported that", "took place"),
    ),
    ExpectedField(
        "main_entities", "Main entities and people",
        "Organisations, officials and people involved.",
        "Misidentified people or organisations are a common source of misinformation.",
        Priority.high, 1.0, "officials involved",
        "Confirm names and roles of the people and organisations involved from an official statement.",
        ("minister", "official", "spokesperson", "company", "authority", "department", "police", "said"),
        multi_valued=True,
    ),
    ExpectedField(
        "date_location", "Date and location",
        "When and where the event happened.",
        "Date and location anchor every other claim and expose recycled or misattributed stories.",
        Priority.critical, 1.5, "date location",
        "Confirm the event date and location from a primary or official source.",
        ("on monday", "on tuesday", "on wednesday", "on thursday", "on friday", "on saturday", "on sunday",
         "located", "district", "city", "village", " in ", "at around"),
    ),
    ExpectedField(
        "key_claims", "Important claims",
        "The central assertions made about the event.",
        "Key claims should be supported by direct evidence or attributed statements.",
        Priority.high, 1.0, "claims",
        "Trace each important claim to an attributed statement or document.",
        ("claimed", "alleged", "according to", "stated", "blamed", "caused by"),
        multi_valued=True,
    ),
    ExpectedField(
        "statistics", "Statistics",
        "Casualty counts, amounts, percentages and other figures.",
        "Figures frequently differ between publishers and change as events develop.",
        Priority.critical, 1.5, "number figures official toll",
        "Verify the latest figures against the most recent official update.",
        ("killed", "dead", "deaths", "injured", "people", "percent", "%", "crore", "million", "billion", "toll"),
    ),
    ExpectedField(
        "context", "Context",
        "Information needed to interpret the event correctly.",
        "Missing context can make accurate facts misleading.",
        Priority.medium, 0.8, "context why",
        "Look for explanatory or analytical coverage that provides context.",
        ("because", "amid", "following", "context", "comes after", "due to"),
    ),
    ExpectedField(
        "background", "Background",
        "Relevant history leading up to the event.",
        "Background helps judge whether the event is new, recurring or part of a pattern.",
        Priority.low, 0.6, "background history",
        "Search for earlier reporting on related incidents.",
        ("previously", "earlier", "history", "last year", "in the past", "built in", "since"),
    ),
    ExpectedField(
        "official_response", "Official response",
        "Statements or actions from authorities or responsible organisations.",
        "Without an official response, many claims remain unconfirmed allegations.",
        Priority.critical, 1.3, "official statement response",
        "Check government, police or organisation press releases for an official statement.",
        ("official statement", "press release", "ordered", "government said", "announced compensation",
         "ministry", "spokesperson said", "inquiry", "probe"),
    ),
    ExpectedField(
        "subsequent_developments", "Subsequent developments",
        "What happened after the initial reports.",
        "Early reports are often superseded; later developments may change the facts.",
        Priority.high, 1.0, "latest update",
        "Search for the most recent follow-up coverage.",
        ("later", "update", "since then", "subsequently", "arrested", "resumed", "revised", "updated"),
    ),
    ExpectedField(
        "unanswered_questions", "Unanswered questions",
        "Questions sources explicitly say are unresolved.",
        "Explicitly open questions tell the reader what is still unknown.",
        Priority.medium, 0.8, "unanswered questions investigation",
        "Monitor follow-up reporting for answers to open questions.",
        ("unclear", "not yet known", "under investigation", "remains to be seen", "not confirmed",
         "unknown", "yet to"),
        multi_valued=True,
    ),
)


SCHOLARSHIP_FIELDS: tuple[ExpectedField, ...] = (
    ExpectedField(
        "eligibility", "Eligibility",
        "Who can apply (nationality, level of study, category, institution).",
        "Applying while ineligible wastes effort and may lead to rejection or recovery of funds.",
        Priority.critical, 1.5, "eligibility criteria",
        "Confirm eligibility conditions on the official scholarship portal or notice.",
        ("eligible", "eligibility", "students who", "applicants must", "open to", "can apply"),
        multi_valued=True,
    ),
    ExpectedField(
        "minimum_marks", "Minimum marks",
        "Minimum academic score required.",
        "Mark thresholds are hard cut-offs; a wrong figure can exclude or mislead applicants.",
        Priority.critical, 1.3, "minimum marks percentage",
        "Confirm the minimum percentage/CGPA in the latest official notice.",
        ("marks", "percentage", "cgpa", "%", "grade", "scored"),
    ),
    ExpectedField(
        "income_criteria", "Income criteria",
        "Maximum family income or other financial conditions.",
        "Income limits determine eligibility and change between cycles.",
        Priority.critical, 1.3, "family income limit",
        "Verify the annual family income ceiling and the accepted income certificate format.",
        ("income", "lakh", "per annum", "annual family", "earning"),
    ),
    ExpectedField(
        "required_documents", "Required documents",
        "Documents applicants must submit.",
        "A missing document is one of the most common reasons applications are rejected.",
        Priority.critical, 1.2, "required documents list",
        "Confirm the complete official document checklist before applying.",
        ("certificate", "documents", "aadhaar", "mark sheet", "marksheet", "bank passbook", "photograph",
         "bonafide", "domicile", "id proof", "fee receipt"),
        multi_valued=True,
    ),
    ExpectedField(
        "deadline", "Deadline",
        "Last date to apply (and any verification deadlines).",
        "Deadlines change every cycle and missing one usually cannot be undone.",
        Priority.critical, 1.5, "last date application deadline",
        "Verify the current application deadline on the official portal.",
        ("last date", "deadline", "closes on", "apply by", "before", "extended"),
    ),
    ExpectedField(
        "application_process", "Application process",
        "Steps to apply (portal, registration, submission, verification).",
        "Knowing the process avoids incomplete or misdirected applications.",
        Priority.high, 1.0, "how to apply",
        "Follow the step-by-step process published on the official portal.",
        ("apply online", "register", "portal", "submit", "application form", "login", "verification"),
    ),
    ExpectedField(
        "official_link", "Official application link",
        "The official URL where the application is submitted.",
        "Unofficial links can be outdated or fraudulent.",
        Priority.high, 1.0, "official website apply online",
        "Locate the official government/institution portal and check its domain.",
        ("http", "www.", ".gov", ".nic.in", "portal"),
    ),
    ExpectedField(
        "academic_cycle", "Academic cycle",
        "Which academic year/session the information applies to.",
        "Information from a previous cycle may no longer apply.",
        Priority.high, 1.0, "academic year session",
        "Confirm the notice applies to the current academic year.",
        ("academic year", "session", "2023-24", "2024-25", "2025-26", "2026-27", "cycle"),
    ),
    ExpectedField(
        "renewal_requirements", "Renewal requirements",
        "Conditions for continuing the scholarship in later years.",
        "Students can lose funding in later years if renewal conditions are unknown.",
        Priority.medium, 0.8, "renewal conditions",
        "Ask the scholarship authority for written renewal conditions.",
        ("renewal", "renew", "continuation", "subsequent year", "next year"),
    ),
    ExpectedField(
        "selection_process", "Selection process",
        "How recipients are chosen (merit list, interview, lottery).",
        "The selection method affects chances and what applicants should prepare.",
        Priority.medium, 0.8, "selection merit list",
        "Check the official notice for the selection method and merit-list rules.",
        ("selection", "merit list", "merit", "interview", "shortlisted", "selected"),
    ),
)


TEMPLATES: dict[Domain, tuple[ExpectedField, ...]] = {
    Domain.news: NEWS_FIELDS,
    Domain.scholarship: SCHOLARSHIP_FIELDS,
}


def get_template(domain: Domain) -> tuple[ExpectedField, ...]:
    return TEMPLATES[domain]


def field_map(domain: Domain) -> dict[str, ExpectedField]:
    return {f.key: f for f in get_template(domain)}
