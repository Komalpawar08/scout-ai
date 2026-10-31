import { Eye } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge, EVIDENCE_META, EVIDENCE_ORDER, EmptyState, EvidenceBadge, Quote, SourceLink,
  cx, fieldLabel, locationRef,
} from "../../components/ui";
import { useResearch } from "../../context/ResearchContext";
import { claimToEvidenceItem } from "../evidence/EvidencePanel";
import type { EvidenceStatus } from "../../types/research";

export function Claims() {
  const { result: r, focusedClaim, focusClaim, openEvidencePanel } = useResearch();
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<EvidenceStatus | "all">("all");
  const focusRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (focusedClaim) {
      setCategory("all");
      setStatus("all");
      focusRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [focusedClaim]);

  const sources = useMemo(() => Object.fromEntries((r?.sources ?? []).map((s) => [s.source_id, s])), [r]);
  if (!r) return null;
  if (!r.claims.length)
    return <EmptyState title="No claims extracted">No traceable claims could be extracted from the sources reviewed.</EmptyState>;

  const categories = Array.from(new Set(r.claims.map((c) => c.claim_category)));
  const shown = r.claims.filter(
    (c) => (category === "all" || c.claim_category === category) && (status === "all" || c.evidence_status === status)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by field"
          className="rounded-lg border border-ink/10 dark:border-paper/10 bg-paper-3 dark:bg-ink px-3 py-1.5 text-sm text-ink dark:text-paper"
        >
          <option value="all">All fields</option>
          {categories.map((c) => <option key={c} value={c}>{fieldLabel(c)}</option>)}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as EvidenceStatus | "all")}
          aria-label="Filter by evidence status"
          className="rounded-lg border border-ink/10 dark:border-paper/10 bg-paper-3 dark:bg-ink px-3 py-1.5 text-sm text-ink dark:text-paper"
        >
          <option value="all">All evidence statuses</option>
          {EVIDENCE_ORDER.map((s) => <option key={s} value={s}>{EVIDENCE_META[s].label}</option>)}
        </select>
        <span className="text-sm text-ink-2 dark:text-paper/50">{shown.length} of {r.claims.length} claims</span>
      </div>

      <ul className="space-y-3">
        {shown.map((c) => {
          const srcObj = sources[c.source_id];
          return (
            <li
              key={c.claim_id}
              ref={c.claim_id === focusedClaim ? focusRef : undefined}
              id={`claim-${c.claim_id}`}
              onClick={() => focusClaim(c.claim_id)}
              className={cx(
                "rounded-xl border bg-paper-3 dark:bg-ink/50 p-4 cursor-pointer hover-lift transition-all",
                c.claim_id === focusedClaim
                  ? "border-signal ring-1 ring-signal/50"
                  : "border-ink/10 dark:border-paper/10"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-ink-3 dark:text-paper/30">{c.claim_id}</span>
                <Badge tone="slate">{fieldLabel(c.claim_category)}</Badge>
                <EvidenceBadge s={c.evidence_status} />
                {c.is_uncertain && <Badge tone="amber">Source says unclear</Badge>}
                {c.extraction_method === "heuristic" && (
                  <Badge tone="slate" title="Rule-based sentence extraction (no LLM)">heuristic</Badge>
                )}
                <span className="ml-auto text-xs text-ink-3 dark:text-paper/30">
                  extraction confidence {Math.round(c.extraction_confidence * 100)}%
                </span>
                {/* Evidence viewer button */}
                {srcObj && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEvidencePanel(claimToEvidenceItem(c, srcObj));
                    }}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-ink-3 dark:text-paper/40 hover:text-signal dark:hover:text-signal transition-colors"
                    title="View verbatim quote in source text"
                  >
                    <Eye className="h-3 w-3" /> Source
                  </button>
                )}
              </div>
              <p className="mt-2 text-ink dark:text-paper/90">{c.claim_text}</p>
              <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-ink-2 dark:text-paper/50">
                <span>Subject: {c.subject}</span>
                <span>Value: <span className="text-ink dark:text-paper/80">{c.value}</span>{c.unit ? ` (${c.unit})` : ""}</span>
                {c.relevant_period && <span>Period: {c.relevant_period}</span>}
                {c.scope && <span>Scope: {c.scope}</span>}
              </div>
              <div className="mt-3">
                <Quote
                  text={c.supporting_quote}
                  reference={
                    <span className="flex flex-wrap items-center gap-2">
                      <SourceLink source={srcObj} />
                      <span>{locationRef(c)}</span>
                      {c.start_offset != null && <span>chars {c.start_offset}–{c.end_offset}</span>}
                      <Badge tone={c.quote_match === "not_found" ? "amber" : "green"}>
                        {c.quote_match === "exact" ? "Exact quote verified" : c.quote_match === "normalized" ? "Quote verified (normalised)" : "Quote NOT found in source"}
                      </Badge>
                    </span>
                  }
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
