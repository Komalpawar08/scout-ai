"""Domain-specific freshness analysis from explicit date metadata only.

- Never infers publication dates.
- Old news is not automatically outdated: it is flagged only when newer reporting exists.
- Scholarship freshness is judged by academic cycle and deadlines relative to today.
"""

from __future__ import annotations

from datetime import date

from app.schemas.research import (
    Claim, DateStatus, Domain, ExtractionStatus, FreshnessStatus, FreshnessWarning, Source, SourceFreshness,
)
from app.services.metadata import current_academic_cycle, cycle_end_date, detect_academic_cycles, parse_iso
from app.services.analysis.values import date_value

NEWS_NEWER_REPORTING_GAP_DAYS = 2
SCHOLARSHIP_MAX_AGE_DAYS = 365


def _usable(s: Source) -> bool:
    return s.extraction_status in (ExtractionStatus.success, ExtractionStatus.partial)


def source_freshness(sources: list[Source], domain: Domain, today: date) -> list[SourceFreshness]:
    results: list[SourceFreshness] = []
    dated = [parse_iso(s.publication_date) for s in sources if _usable(s) and parse_iso(s.publication_date)]
    newest = max(dated) if dated else None
    newest_ids = [s.source_id for s in sources if newest and parse_iso(s.publication_date) == newest]

    for s in sources:
        if not _usable(s):
            results.append(SourceFreshness(source_id=s.source_id, status=FreshnessStatus.unknown,
                                           reason="Source content could not be extracted."))
            continue
        pub = parse_iso(s.publication_date)
        upd = parse_iso(s.updated_date)
        if pub and upd and upd < pub:
            results.append(SourceFreshness(
                source_id=s.source_id, status=FreshnessStatus.conflicting_dates,
                reason=f"Updated date {upd} is earlier than publication date {pub}; date metadata is inconsistent.",
            ))
            continue
        effective = max(d for d in (pub, upd) if d) if (pub or upd) else None
        age = (today - effective).days if effective else None

        if domain == Domain.scholarship and s.academic_cycle:
            end = cycle_end_date(s.academic_cycle)
            current = current_academic_cycle(today)
            if end and end < today:
                results.append(SourceFreshness(
                    source_id=s.source_id, status=FreshnessStatus.potentially_outdated, age_days=age,
                    reason=f"Refers to academic cycle {s.academic_cycle}, which ended before today "
                           f"(current cycle is {current}). Requirements may have changed.",
                ))
                continue
            results.append(SourceFreshness(
                source_id=s.source_id, status=FreshnessStatus.current, age_days=age,
                reason=f"Refers to academic cycle {s.academic_cycle}, which is current or upcoming according to the stated cycle.",
            ))
            continue

        if effective is None:
            status = FreshnessStatus.undated if s.date_status == DateStatus.not_stated else FreshnessStatus.unknown
            reason = ("No publication or update date is stated in the source." if status == FreshnessStatus.undated
                      else "Publication date could not be determined from the available metadata.")
            results.append(SourceFreshness(source_id=s.source_id, status=status, reason=reason))
            continue

        if domain == Domain.scholarship:
            if age is not None and age > SCHOLARSHIP_MAX_AGE_DAYS:
                results.append(SourceFreshness(
                    source_id=s.source_id, status=FreshnessStatus.potentially_outdated, age_days=age,
                    reason=f"Published/updated {effective} ({age} days ago) and states no academic cycle; "
                           "scholarship rules usually change each cycle.",
                ))
            else:
                results.append(SourceFreshness(
                    source_id=s.source_id, status=FreshnessStatus.current, age_days=age,
                    reason=f"Published/updated {effective}, within the last year.",
                ))
            continue

        # News: outdated only relative to newer coverage of the same topic.
        if newest and (newest - effective).days > NEWS_NEWER_REPORTING_GAP_DAYS:
            results.append(SourceFreshness(
                source_id=s.source_id, status=FreshnessStatus.potentially_outdated, age_days=age,
                reason=f"Published {effective}; newer reporting exists ({', '.join(newest_ids)} dated {newest}). "
                       "It may not reflect subsequent developments.",
            ))
        else:
            results.append(SourceFreshness(
                source_id=s.source_id, status=FreshnessStatus.current, age_days=age,
                reason=f"Published {effective}; among the most recent sources reviewed.",
            ))
    return results


def freshness_warnings(
    sources: list[Source], claims: list[Claim], per_source: list[SourceFreshness], domain: Domain, today: date,
) -> list[FreshnessWarning]:
    warnings: list[FreshnessWarning] = []

    def add(status, reason, source_id=None, claim_id=None, ref=None):
        warnings.append(FreshnessWarning(warning_id=f"F{len(warnings) + 1}", source_id=source_id, claim_id=claim_id,
                                         status=status, reason=reason, reference_date=ref))

    for sf in per_source:
        if sf.status in (FreshnessStatus.potentially_outdated, FreshnessStatus.undated, FreshnessStatus.conflicting_dates):
            add(sf.status, sf.reason, source_id=sf.source_id)

    if domain == Domain.scholarship:
        cycles = {s.source_id: s.academic_cycle for s in sources if s.academic_cycle}
        if len(set(cycles.values())) > 1:
            desc = ", ".join(f"{sid}: {c}" for sid, c in sorted(cycles.items()))
            add(FreshnessStatus.conflicting_dates,
                f"Sources refer to different academic cycles ({desc}). Make sure you rely on the current cycle.")
        for c in claims:
            if c.claim_category == "deadline":
                d = parse_iso(date_value(c))
                if d and d < today:
                    add(FreshnessStatus.potentially_outdated,
                        f"Deadline {d} stated in {c.source_id} has already passed; it may belong to an earlier cycle "
                        "or may have been extended.", source_id=c.source_id, claim_id=c.claim_id, ref=d.isoformat())
            cyc = detect_academic_cycles(c.relevant_period or "")
            if c.claim_category == "academic_cycle" and cyc:
                end = cycle_end_date(cyc[0])
                if end and end < today and not any(w.source_id == c.source_id and w.claim_id is None for w in warnings):
                    add(FreshnessStatus.potentially_outdated,
                        f"{c.source_id} states academic cycle {cyc[0]}, which has ended.", source_id=c.source_id,
                        claim_id=c.claim_id)
    else:
        event_dates = {date_value(c) for c in claims if c.claim_category == "date_location" and date_value(c)}
        if len(event_dates) > 1:
            add(FreshnessStatus.conflicting_dates,
                f"Sources give different event dates ({', '.join(sorted(event_dates))}). Confirm the actual event date.")
    return warnings
