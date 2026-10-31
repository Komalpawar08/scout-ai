import { Card, EVIDENCE_META, EVIDENCE_ORDER, ScoreBar, cx } from "../../components/ui";
import { useResearch, type Section } from "../../context/ResearchContext";
import type { ResearchResponse } from "../../types/research";

function Stat({ label, value, alert, onClick }: { label: string; value: number; alert?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="group border-b border-ink/15 py-3 text-left">
      <div className={cx("font-serif text-6xl leading-none tabular-nums", alert ? "text-signal" : "text-ink")}>{value}</div>
      <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2 group-hover:text-ink group-hover:underline">{label}</div>
    </button>
  );
}

export function CompletenessCard({ r }: { r: ResearchResponse }) {
  const c = r.research_completeness;
  return (
    <Card title="Research completeness">
      <div className="flex items-end gap-3">
        <span className="font-serif text-[7rem] leading-[0.8] tracking-tight" data-testid="completeness-score">{c.score}</span>
        <span className="pb-1 font-mono text-xs text-ink-2">/ 100 · {c.label}</span>
      </div>
      <p className="mt-3 text-xs text-ink-2">{c.disclaimer}</p>
      <ul className="mt-5 space-y-3">
        {c.components.map((comp) => (
          <li key={comp.name}>
            <div className="flex justify-between text-xs">
              <span className="font-medium capitalize text-ink">{comp.name.replace(/_/g, " ")} <span className="font-mono text-ink-3">× {comp.weight}</span></span>
              <span className="font-mono text-ink">{comp.value.toFixed(2)}</span>
            </div>
            <ScoreBar value={comp.value} />
            <p className="mt-1 text-xs text-ink-3">{comp.explanation}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-dashed border-ink/25 pt-2 font-mono text-[11px] text-ink-2">{c.formula}</p>
    </Card>
  );
}

function EvidenceDistribution({ r }: { r: ResearchResponse }) {
  const counts = EVIDENCE_ORDER.map((s) => ({
    status: s, label: EVIDENCE_META[s].label, count: r.claims.filter((c) => c.evidence_status === s).length,
  })).filter((d) => d.count > 0);
  if (!counts.length) return <p className="text-sm text-ink-2">No claims were extracted.</p>;
  const max = Math.max(...counts.map((d) => d.count));
  const total = counts.reduce((s, d) => s + d.count, 0);
  // Single series: each bar is direct-labelled with its status name and count, so color is never the only cue.
  return (
    <ul className="space-y-2.5" aria-label="Claims by evidence status">
      {counts.map((d) => (
        <li key={d.status} className="group grid grid-cols-[140px_1fr_64px] items-center gap-3 text-sm"
          title={`${d.label}: ${d.count} of ${total} claims (${Math.round((d.count / total) * 100)}%)`}>
          <span className="text-right text-ink-2">{d.label}</span>
          <span className="h-4 bg-ink/[0.05]">
            <span className="block h-full rounded-r transition-opacity group-hover:opacity-80"
              style={{ width: `${(d.count / max) * 100}%`, background: EVIDENCE_META[d.status].color }} />
          </span>
          <span className="font-mono tabular-nums text-ink">{d.count} <span className="text-xs text-ink-3">({Math.round((d.count / total) * 100)}%)</span></span>
        </li>
      ))}
    </ul>
  );
}

export function Overview() {
  const { result: r, setSection } = useResearch();
  if (!r) return null;
  const go = (s: Section) => () => setSection(s);
  const notFound = r.information_gaps.filter((g) => g.coverage_status === "not_found").length;
  return (
    <div className="space-y-12">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">
            Summary · {r.final_report.generated_by === "llm" ? "written by Grok from structured findings" : "generated deterministically from findings"}
          </p>
          <p className="mt-3 font-serif text-2xl leading-snug first-letter:float-left first-letter:mr-2 first-letter:font-serif first-letter:text-[4.2rem] first-letter:leading-[0.8] first-letter:text-signal">
            {r.summary}
          </p>
          {r.research_question && <p className="mt-4 text-sm text-ink-2"><span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink">Question —</span> {r.research_question}</p>}
        </section>
        <div className="grid content-start grid-cols-2 gap-x-6 sm:grid-cols-5 lg:grid-cols-2 lg:border-l lg:border-ink lg:pl-6">
          <Stat label="Sources" value={r.sources.length} onClick={go("sources")} />
          <Stat label="Claims" value={r.claims.length} onClick={go("claims")} />
          <Stat label="Possible conflicts" value={r.conflicts.length} alert={r.conflicts.length > 0} onClick={go("conflicts")} />
          <Stat label="Fields not found" value={notFound} alert={notFound > 0} onClick={go("gaps")} />
          <Stat label="Freshness warnings" value={r.freshness_warnings.length} onClick={go("freshness")} />
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <CompletenessCard r={r} />
        <div className="space-y-10">
          <Card title="Evidence status of claims">
            <EvidenceDistribution r={r} />
          </Card>
          {r.final_report.key_findings.length > 0 && (
            <Card title="Key findings">
              <ol className="space-y-2 text-[15px]">
                {r.final_report.key_findings.map((f, i) => (
                  <li key={i} className="grid grid-cols-[1.75rem_1fr]"><span className="font-mono text-xs text-signal">{String(i + 1).padStart(2, "0")}</span>{f}</li>
                ))}
              </ol>
            </Card>
          )}
          {r.final_report.unanswered_questions.length > 0 && (
            <Card title="Unanswered questions">
              <ul className="space-y-2 text-[15px]">
                {r.final_report.unanswered_questions.map((q, i) => <li key={i} className="border-l-2 border-amber-600 pl-3">{q}</li>)}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <Card title="Uncertainty & limitations">
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2 marker:text-ink-3">
          {r.limitations.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
        {r.errors.length > 0 && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-amber-800">{r.errors.length} processing warning(s)</summary>
            <ul className="mt-2 space-y-1 text-xs text-ink-2">
              {r.errors.map((e, i) => <li key={i}><span className="font-mono text-ink-3">[{e.stage}]</span> {e.message}</li>)}
            </ul>
          </details>
        )}
      </Card>
    </div>
  );
}
