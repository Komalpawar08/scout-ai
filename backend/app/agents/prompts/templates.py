"""Domain-specific prompt builders for Grok."""

from __future__ import annotations

from app.agents.templates import get_template
from app.schemas.research import Domain

GROUNDING_RULES = """Rules:
- Use ONLY the text provided. Never use outside knowledge.
- supporting_quote must be copied verbatim from the source text (same words, same order). If you cannot quote it, set is_inferred=true and quote the closest sentence.
- Never invent numbers, dates, names, URLs or quotations.
- If the source does not mention something, do not create a claim for it.
- If the source says something is unclear, unknown, unconfirmed or under investigation, set is_uncertain=true.
- Keep each claim atomic: one value per claim."""

DOMAIN_GUIDANCE = {
    Domain.news: """You analyse NEWS reporting. Focus on: what happened, who was involved, when and where, \
statistics (casualties, amounts, percentages), official responses, later developments, and questions the source says are unresolved. \
Attribute statements ("according to police") in the scope field. For statistics use value_type number and put the plain number \
in normalized_value, with the unit (e.g. 'deaths', 'injured'). For event dates use value_type date with ISO normalized_value.""",
    Domain.scholarship: """You analyse SCHOLARSHIP information. Focus on: eligibility, minimum marks, family income limit, \
required documents, application deadline, application process, official application link, academic cycle (e.g. 2025-26), \
renewal requirements and selection process. Put the scholarship category or level (e.g. 'Post-Matric SC', 'undergraduate') \
in scope and the academic cycle in relevant_period. For marks use value_type percent; income value_type money with the plain \
number in rupees/currency units in normalized_value (convert lakh: 2.5 lakh = 250000); deadlines value_type date (ISO); \
required documents value_type list with semicolon-separated normalized item names (lower case).""",
}


def field_catalogue(domain: Domain) -> str:
    return "\n".join(f"- {f.key}: {f.label} — {f.description}" for f in get_template(domain))


def planner_prompt(domain: Domain, topic: str, question: str) -> tuple[str, str]:
    system = (
        "You plan evidence-gathering web searches for a research verification tool. "
        "Return focused queries likely to surface official/primary sources and independent reporting."
    )
    user = f"""Domain: {domain.value}
Topic: {topic}
Research question: {question or '(not provided)'}

Expected information fields:
{field_catalogue(domain)}

Produce 3-5 search queries. Include at least one query targeting the official/primary source \
and one targeting the most recent update."""
    return system, user


def extraction_prompt(domain: Domain, topic: str, question: str, source_title: str, chunk: str) -> tuple[str, str]:
    system = f"""You extract verifiable claims for Scout AI, an evidence-first research platform.
{DOMAIN_GUIDANCE[domain]}

Allowed category keys:
{field_catalogue(domain)}

{GROUNDING_RULES}"""
    user = f"""Research topic: {topic}
Research question: {question or '(not provided)'}
Source title: {source_title}

SOURCE TEXT (between markers):
<<<SOURCE
{chunk}
SOURCE>>>

Extract up to 15 of the most important claims relevant to the topic, across as many categories as the text supports."""
    return system, user


def conflict_prompt(domain: Domain, pairs_text: str) -> tuple[str, str]:
    system = f"""You check whether pairs of claims from different sources genuinely conflict.
{DOMAIN_GUIDANCE[domain]}
A pair is a conflict ONLY if both claims refer to the same entity, subject, time period, geography, category, \
academic cycle and definition, AND they cannot both be true. Different scholarship categories, academic cycles, \
or measurement definitions are NOT conflicts (set same_scope=false). Never decide which source is correct."""
    user = f"Assess each pair:\n{pairs_text}"
    return system, user


def report_prompt(domain: Domain, topic: str, question: str, digest: str) -> tuple[str, str]:
    system = """You write the executive summary for an evidence-first research report.
Only restate findings provided to you. Use cautious wording: 'Possible conflict', 'Not found in the sources reviewed',
'according to <source id>'. Cite source ids like [S1]. Never declare a source false or guarantee accuracy."""
    user = f"""Domain: {domain.value}
Topic: {topic}
Research question: {question or '(not provided)'}

Structured findings:
{digest}

Write a 4-6 sentence executive summary, up to 6 key findings with source ids, and up to 6 unanswered questions \
the user should investigate."""
    return system, user
