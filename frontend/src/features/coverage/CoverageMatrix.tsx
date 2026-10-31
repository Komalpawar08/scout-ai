import { AlertTriangle, Check, CircleSlash, Minus, X } from "lucide-react";
import { useState } from "react";
import { Badge, COVERAGE_META, Card, EvidenceBadge, Quote, SourceLink, cx, locationRef } from "../../components/ui";
import { useResearch } from "../../context/ResearchContext";
import type { CoverageCell } from "../../types/research";

// Status cells always carry an icon + text label, so identity never relies on color alone.
const CELL: Record<CoverageCell["status"], { label: string; icon: JSX.Element; cls: string }> = {
  found: { label: "Found", icon: <Check className="h-3.5 w-3.5" />, cls: "bg-emerald-500/15 text-emerald-800 border-emerald-500/30" },
  partial: { label: "Partial", icon: <Minus className="h-3.5 w-3.5" />, cls: "bg-cyan-500/10 text-cyan-800 border-cyan-500/30" },
  conflict: { label: "Conflict", icon: <AlertTriangle className="h-3.5 w-3.5" />, cls: "bg-signal/15 text-signal-dark border-signal/40" },
  missing: { label: "Missing", icon: <X className="h-3.5 w-3.5" />, cls: "bg-ink/[0.02] text-ink-3 border-ink/10" },
  failed: { label: "Not extracted", icon: <CircleSlash className="h-3.5 w-3.5" />, cls: "bg-ink/[0.02] text-ink-3 border-ink/5" },
};

export function CoverageMatrix() {
  const { result: r } = useResearch();
  const [selected, setSelected] = useState<string | null>(null);
  if (!r) return null;
  const m = r.coverage_matrix;
  const sources = Object.fromEntries(r.sources.map((s) => [s.source_id, s]));
  const row = m.rows.find((x) => x.field === selected) ?? null;
  const rowClaims = row ? r.claims.filter((c) => c.claim_category === row.field) : [];
  const rowGap = row ? r.information_gaps.find((g) => g.expected_field === row.field) : undefined;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card title="Information coverage matrix">
        <p className="mb-4 text-sm text-ink-2">
          Expected {r.domain} fields (rows) against every source reviewed (columns), computed from verified claims and
          detected conflicts. Click a field to inspect its evidence. <span className="text-ink-2">*</span> = critical field.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-sm" aria-label="Information coverage matrix">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Expected field</th>
                {m.sources.map((sid) => (
                  <th key={sid} className="px-2 py-1 text-center text-xs font-medium text-ink-2" title={sources[sid]?.title}>
                    <div>{sid}</div>
                    <div className="mx-auto max-w-[110px] truncate font-normal text-ink-3">{sources[sid]?.publisher ?? sources[sid]?.filename ?? ""}</div>
                  </th>
                ))}
                <th className="px-2 py-1 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {m.rows.map((rw) => (
                <tr key={rw.field} onClick={() => setSelected(rw.field)} data-testid={`coverage-row-${rw.field}`}
                  className={cx("cursor-pointer", selected === rw.field && "outline outline-1 outline-signal rounded-lg")}>
                  <td className="whitespace-nowrap rounded-lg bg-ink/[0.03] px-3 py-2 font-medium text-ink">
                    {rw.label}{rw.critical && <span className="text-ink-2"> *</span>}
                  </td>
                  {rw.cells.map((c) => (
                    <td key={c.source_id} className={cx("rounded-lg border px-2 py-2 text-center text-xs", CELL[c.status].cls)}
                      title={`${rw.label} · ${c.source_id}: ${CELL[c.status].label}${c.claim_ids.length ? ` (${c.claim_ids.join(", ")})` : ""}`}>
                      <span className="inline-flex items-center gap-1">{CELL[c.status].icon}{CELL[c.status].label}</span>
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-2"><Badge tone={COVERAGE_META[rw.overall].tone}>{rw.overall_label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-ink-2">
          {Object.entries(CELL).map(([k, v]) => (
            <span key={k} className={cx("inline-flex items-center gap-1 rounded border px-2 py-0.5", v.cls)}>{v.icon}{v.label}</span>
          ))}
        </div>
      </Card>

      <Card title={row ? row.label : "Field details"}>
        {!row ? (
          <p className="text-sm text-ink-2">Select a field in the matrix to see the supporting claims, quotations and gap analysis.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone={COVERAGE_META[row.overall].tone}>{COVERAGE_META[row.overall].label}</Badge>
              {row.critical && <Badge tone="red">Critical field</Badge>}
            </div>
            {rowGap && <p className="text-sm text-ink-2">{rowGap.explanation}</p>}
            {rowClaims.length === 0 && <p className="text-sm text-amber-800">Not found in the sources reviewed.</p>}
            {rowClaims.map((c) => (
              <div key={c.claim_id} className="space-y-2 rounded-xl border border-ink/10 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-ink-3">{c.claim_id}</span>
                  <EvidenceBadge s={c.evidence_status} />
                  <SourceLink source={sources[c.source_id]} compact />
                </div>
                <p className="text-sm text-ink">{c.value}</p>
                <Quote text={c.supporting_quote} reference={locationRef(c)} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
