"""Rule-based conflict detection with explicit scope checks.

Pairs of claims from different sources in the same expected field are compared only
after scope checks (subject, period/academic cycle, category scope, unit/definition).
Scope mismatches are recorded as ScopeNotes, never as conflicts. Free-text pairs that
rules cannot decide are returned as candidates for optional LLM adjudication.
"""

from __future__ import annotations

from itertools import combinations

from app.agents.templates import ExpectedField
from app.schemas.research import Claim, Conflict, ScopeNote
from app.services.analysis.values import (
    comparable_kind, date_value, jaccard, list_items, numeric_value, normalize_unit, units_compatible, values_agree,
)
from app.services.metadata import detect_academic_cycles

CONFLICT_TYPES = {
    "numeric": "numeric_mismatch",
    "date": "date_mismatch",
    "list": "different_requirements",
    "text": "statement_mismatch",
}


def _scope_checks(a: Claim, b: Claim, field: ExpectedField) -> tuple[dict[str, str], str | None]:
    """Return (checks, blocking_reason). blocking_reason set => not the same scope."""
    checks: dict[str, str] = {}
    subj_sim = jaccard(a.subject, b.subject)
    if field.multi_valued and subj_sim < 0.3 and comparable_kind(a) != "list":
        checks["subject"] = f"different subjects ('{a.subject}' vs '{b.subject}')"
        return checks, f"Different subjects: '{a.subject}' vs '{b.subject}'."
    checks["subject"] = "same field" + (" and similar subject" if subj_sim >= 0.3 else "")

    if not units_compatible(a, b):
        checks["definition"] = f"different units ({a.unit} vs {b.unit})"
        return checks, f"Different measurements: {a.unit} vs {b.unit}."
    checks["definition"] = "compatible units" if (a.unit or b.unit) else "no unit stated"

    cyc_a = set(detect_academic_cycles(a.relevant_period or "")) or set(detect_academic_cycles(a.claim_text))
    cyc_b = set(detect_academic_cycles(b.relevant_period or "")) or set(detect_academic_cycles(b.claim_text))
    if cyc_a and cyc_b and not (cyc_a & cyc_b):
        checks["period"] = f"different academic cycles ({', '.join(sorted(cyc_a))} vs {', '.join(sorted(cyc_b))})"
        return checks, f"Claims refer to different academic cycles ({', '.join(sorted(cyc_a))} vs {', '.join(sorted(cyc_b))})."
    if a.relevant_period and b.relevant_period and comparable_kind(a) == "numeric" and not (cyc_a or cyc_b):
        if jaccard(a.relevant_period, b.relevant_period) < 0.5:
            checks["period"] = "reported for different times"
            return checks, (f"Figures are reported for different times ('{a.relevant_period}' vs "
                            f"'{b.relevant_period}') and may reflect an update rather than a contradiction.")
    checks["period"] = "same period" if (cyc_a & cyc_b) else "period not stated by at least one source"

    if a.scope and b.scope and jaccard(a.scope, b.scope) < 0.5:
        checks["scope"] = f"different scope ('{a.scope}' vs '{b.scope}')"
        return checks, f"Different scope or category: '{a.scope}' vs '{b.scope}'."
    checks["scope"] = "same scope" if (a.scope and b.scope) else "scope not stated by at least one source"
    return checks, None


def _explain(a: Claim, b: Claim, kind: str) -> tuple[str, float]:
    if kind == "numeric":
        va, vb = numeric_value(a), numeric_value(b)
        unit = normalize_unit(a.unit) or normalize_unit(b.unit) or ""
        return f"{a.source_id} reports {a.value} while {b.source_id} reports {b.value} ({va:g} vs {vb:g} {unit}).".strip(), 0.75
    if kind == "date":
        return f"{a.source_id} gives {date_value(a)} while {b.source_id} gives {date_value(b)}.", 0.75
    if kind == "list":
        ia, ib = list_items(a), list_items(b)
        only_a, only_b = sorted(ia - ib), sorted(ib - ia)
        parts = []
        if only_a:
            parts.append(f"only {a.source_id} lists: {', '.join(only_a)}")
        if only_b:
            parts.append(f"only {b.source_id} lists: {', '.join(only_b)}")
        return "Requirement lists differ — " + "; ".join(parts) + ".", 0.55
    return f"{a.source_id} and {b.source_id} make different statements about {a.subject}.", 0.5


def _merge_lists_per_source(claims: list[Claim]) -> list[Claim]:
    merged: dict[tuple[str, str], Claim] = {}
    out: list[Claim] = []
    for c in claims:
        if comparable_kind(c) != "list":
            out.append(c)
            continue
        key = (c.source_id, c.claim_category)
        if key not in merged:
            merged[key] = c.model_copy()
            out.append(merged[key])
        else:
            m = merged[key]
            items = sorted(list_items(m) | list_items(c))
            m.normalized_value = "; ".join(items)
            m.value = ", ".join(items)
            if c.supporting_quote not in m.supporting_quote:
                m.supporting_quote = f"{m.supporting_quote} … {c.supporting_quote}"
    return out


def detect_conflicts(
    claims: list[Claim], fields: dict[str, ExpectedField]
) -> tuple[list[Conflict], list[ScopeNote], list[tuple[Claim, Claim]]]:
    conflicts: list[Conflict] = []
    notes: list[ScopeNote] = []
    text_candidates: list[tuple[Claim, Claim]] = []
    seen: set[tuple] = set()
    usable = [c for c in claims if not c.is_inferred and not c.is_uncertain]
    # Requirement lists are often spread over several sentences: compare each source's union.
    usable = _merge_lists_per_source(usable)
    for a, b in combinations(usable, 2):
        if a.source_id == b.source_id or a.claim_category != b.claim_category:
            continue
        field = fields.get(a.claim_category)
        if field is None:
            continue
        kind_a, kind_b = comparable_kind(a), comparable_kind(b)
        if kind_a != kind_b:
            continue
        if kind_a == "list":
            ia, ib = list_items(a), list_items(b)
            if len(ia) < 2 or len(ib) < 2:
                continue  # a single-item mention is not a full requirement list
        sig = (a.claim_category, tuple(sorted((a.source_id, b.source_id))),
               tuple(sorted((a.normalized_value or a.value, b.normalized_value or b.value))))
        if sig in seen:
            continue
        seen.add(sig)
        agree = values_agree(a, b)
        if agree is True:
            continue
        if agree is None:
            if kind_a == "text" and not field.multi_valued:
                text_candidates.append((a, b))
            continue
        checks, blocking = _scope_checks(a, b, field)
        if blocking:
            notes.append(ScopeNote(claim_a=a.claim_id, claim_b=b.claim_id, field=a.claim_category, note=blocking))
            continue
        explanation, confidence = _explain(a, b, kind_a)
        unstated = [name for name, result in checks.items() if "not stated" in result]
        if unstated:
            confidence = round(confidence - 0.1, 2)
            explanation += (f" The {' and '.join(unstated)} is not stated by every source, so the difference may "
                            "reflect a different scope or time and needs verification.")
        label = "Possible conflict" if kind_a in ("numeric", "date") else "Potential inconsistency"
        conflicts.append(Conflict(
            conflict_id=f"K{len(conflicts) + 1}",
            label=label,
            claim_a=a.claim_id, claim_b=b.claim_id, source_a=a.source_id, source_b=b.source_id,
            quotation_a=a.supporting_quote, quotation_b=b.supporting_quote,
            field=a.claim_category, explanation=explanation, conflict_type=CONFLICT_TYPES[kind_a],
            confidence=confidence, scope_checks=checks,
            recommended_verification=field.verification,
        ))
    return conflicts, notes, text_candidates
