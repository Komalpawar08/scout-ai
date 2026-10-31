import { Sparkles, ArrowRight } from "lucide-react";
import { Card, EVIDENCE_META, EVIDENCE_ORDER, ScoreBar, cx } from "../../components/ui";
import { useResearch, type Section } from "../../context/ResearchContext";
import type { ResearchResponse } from "../../types/research";

function Stat({
  label,
  value,
  alert,
  onClick,
}: {
  label: string;
  value: number;
  alert?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover-lift",
        alert
          ? "border-rose-500/30 bg-rose-50/40 dark:border-rose-500/20 dark:bg-rose-950/20"
          : "border-slate-200/80 bg-white/70 dark:border-slate-800/80 dark:bg-slate-900/60"
      )}
    >
      <div className="flex items-center justify-between w-full">
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
          {label}
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
      </div>
      <div
        className={cx(
          "mt-3 font-mono text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums",
          alert ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"
        )}
      >
        {value}
      </div>
    </button>
  );
}

export function CompletenessCard({ r }: { r: ResearchResponse }) {
  const c = r.research_completeness;
  return (
    <Card title="Research completeness">
      <div className="flex items-baseline gap-3">
        <span
          className="font-mono text-6xl sm:text-7xl font-extrabold tracking-tight text-gradient"
          data-testid="completeness-score"
        >
          {c.score}
        </span>
        <span className="font-mono text-sm text-slate-500 dark:text-slate-400 font-bold">
          / 100 · <span className="text-slate-800 dark:text-slate-200">{c.label}</span>
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{c.disclaimer}</p>

      <ul className="mt-6 space-y-4">
        {c.components.map((comp) => (
          <li key={comp.name} className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span className="capitalize text-slate-800 dark:text-slate-200">
                {comp.name.replace(/_/g, " ")}{" "}
                <span className="font-mono text-slate-400 font-normal">× {comp.weight}</span>
              </span>
              <span className="font-mono font-bold text-blue-600 dark:text-cyan-400">
                {comp.value.toFixed(2)}
              </span>
            </div>
            <ScoreBar value={comp.value} color="#3b82f6" />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{comp.explanation}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 border-t border-dashed border-slate-200 pt-3 font-mono text-[11px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
        {c.formula}
      </p>
    </Card>
  );
}

function EvidenceDistribution({ r }: { r: ResearchResponse }) {
  const counts = EVIDENCE_ORDER.map((s) => ({
    status: s,
    label: EVIDENCE_META[s].label,
    count: r.claims.filter((c) => c.evidence_status === s).length,
  })).filter((d) => d.count > 0);

  if (!counts.length) return <p className="text-sm text-slate-500">No claims were extracted.</p>;
  const max = Math.max(...counts.map((d) => d.count));
  const total = counts.reduce((s, d) => s + d.count, 0);

  return (
    <ul className="space-y-3" aria-label="Claims by evidence status">
      {counts.map((d) => (
        <li
          key={d.status}
          className="group grid grid-cols-[130px_1fr_60px] items-center gap-3 text-xs sm:text-sm"
          title={`${d.label}: ${d.count} of ${total} claims (${Math.round((d.count / total) * 100)}%)`}
        >
          <span className="text-right font-medium text-slate-600 dark:text-slate-400 truncate">
            {d.label}
          </span>
          <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden p-0.5">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(d.count / max) * 100}%`,
                background: EVIDENCE_META[d.status].color,
              }}
            />
          </div>
          <span className="font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300 font-bold text-right">
            {d.count}
          </span>
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
    <div className="space-y-10">
      {/* Top Hero Summary & Stats Matrix */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-start">
        {/* Executive Summary */}
        <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 sm:p-8 shadow-card backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/90 dark:shadow-card-dark">
          <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              Executive Intelligence Summary ·{" "}
              {r.final_report.generated_by === "llm" ? "xAI Grok" : "Deterministic Engine"}
            </span>
          </div>

          <p className="mt-4 font-sans text-lg sm:text-xl font-medium leading-relaxed text-slate-800 dark:text-slate-200">
            {r.summary}
          </p>

          {r.research_question && (
            <div className="mt-5 rounded-xl border border-blue-500/10 bg-blue-50/50 p-3.5 dark:border-blue-500/20 dark:bg-blue-950/20 text-xs text-slate-700 dark:text-slate-300">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400 block mb-1">
                Objective Query
              </span>
              {r.research_question}
            </div>
          )}
        </section>

        {/* 5 Key Metric Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <Stat label="Sources" value={r.sources.length} onClick={go("sources")} />
          <Stat label="Claims" value={r.claims.length} onClick={go("claims")} />
          <Stat
            label="Possible conflicts"
            value={r.conflicts.length}
            alert={r.conflicts.length > 0}
            onClick={go("conflicts")}
          />
          <Stat
            label="Fields not found"
            value={notFound}
            alert={notFound > 0}
            onClick={go("gaps")}
          />
          <div className="col-span-2">
            <Stat
              label="Freshness warnings"
              value={r.freshness_warnings.length}
              onClick={go("freshness")}
            />
          </div>
        </div>
      </div>

      {/* Two Column Deep Dive */}
      <div className="grid gap-8 lg:grid-cols-2">
        <CompletenessCard r={r} />

        <div className="space-y-8">
          <Card title="Evidence status of claims">
            <EvidenceDistribution r={r} />
          </Card>

          {r.final_report.key_findings.length > 0 && (
            <Card title="Key findings">
              <ol className="space-y-2.5 text-xs sm:text-sm">
                {r.final_report.key_findings.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-xl border border-slate-200/60 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/10 font-mono text-[10px] font-bold text-blue-600 dark:text-cyan-400">
                      {i + 1}
                    </span>
                    <span className="text-slate-800 dark:text-slate-200 leading-relaxed">{f}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {r.final_report.unanswered_questions.length > 0 && (
            <Card title="Unanswered questions">
              <ul className="space-y-2 text-xs sm:text-sm">
                {r.final_report.unanswered_questions.map((q, i) => (
                  <li
                    key={i}
                    className="rounded-xl border-l-4 border-amber-500 bg-amber-50/40 p-3 text-slate-800 dark:bg-amber-950/20 dark:text-slate-200"
                  >
                    {q}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {/* Uncertainty & Limitations */}
      <Card title="Uncertainty & limitations">
        <ul className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          {r.limitations.map((l, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              <span>{l}</span>
            </li>
          ))}
        </ul>

        {r.errors.length > 0 && (
          <details className="mt-4 rounded-xl border border-amber-500/20 bg-amber-50/30 p-3 text-xs dark:bg-amber-950/20">
            <summary className="cursor-pointer font-bold text-amber-700 dark:text-amber-400">
              {r.errors.length} processing warning(s)
            </summary>
            <ul className="mt-2 space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
              {r.errors.map((e, i) => (
                <li key={i}>
                  <span className="text-blue-500">[{e.stage}]</span> {e.message}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>
    </div>
  );
}
