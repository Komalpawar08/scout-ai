import { type ReactNode } from "react";
import { Badge, cx } from "../components/ui";
import { useLang } from "../context/LangContext";
import { useResearch, type Section } from "../context/ResearchContext";
import { Checklist } from "../features/checklist/Checklist";
import { Claims } from "../features/claims/Claims";
import { Conflicts } from "../features/conflicts/Conflicts";
import { CoverageMatrix } from "../features/coverage/CoverageMatrix";
import { EvidenceBreakdown } from "../features/evidence/EvidenceBreakdown";
import { ExportReport } from "../features/export/ExportReport";
import { Freshness } from "../features/freshness/Freshness";
import { Gaps } from "../features/gaps/Gaps";
import { ClaimGraph } from "../features/graph/ClaimGraph";
import { Overview } from "../features/overview/Overview";
import { Sources } from "../features/sources/Sources";

type Result = NonNullable<ReturnType<typeof useResearch>["result"]>;

function useNavItems() {
  const { t } = useLang();
  const NAV: { id: Section; label: string; count?: (r: Result) => number; alert?: (r: Result) => boolean }[] = [
    { id: "overview", label: t.overview },
    { id: "sources", label: t.sources, count: (r) => r.sources.length },
    { id: "claims", label: t.claimsEvidence, count: (r) => r.claims.length },
    { id: "conflicts", label: t.conflicts, count: (r) => r.conflicts.length, alert: (r) => r.conflicts.length > 0 },
    { id: "gaps", label: t.informationGaps, count: (r) => r.information_gaps.length, alert: (r) => r.information_gaps.length > 0 },
    { id: "freshness", label: t.freshnessAnalysis, count: (r) => r.freshness_warnings.length },
    { id: "coverage", label: t.coverageMatrixNav },
    { id: "graph", label: t.claimGraphNav },
    { id: "evidence", label: t.evidenceConfidenceNav },
    { id: "checklist", label: t.checklistNav, count: (r) => r.verification_checklist.length },
    { id: "export", label: t.exportReport },
  ];
  return NAV;
}

const VIEWS: Record<Section, ReactNode> = {
  overview: <Overview />, sources: <Sources />, claims: <Claims />, conflicts: <Conflicts />, gaps: <Gaps />,
  freshness: <Freshness />, coverage: <CoverageMatrix />, graph: <ClaimGraph />, evidence: <EvidenceBreakdown />,
  checklist: <Checklist />, export: <ExportReport />,
};

export function DashboardPage() {
  const { result: r, section, setSection, reset } = useResearch();
  const { t } = useLang();
  if (!r) return null;
  const NAV = useNavItems();
  const index = NAV.findIndex((n) => n.id === section);
  const current = NAV[index];

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-6 lg:h-fit lg:w-64 lg:shrink-0">
        <p className="border-b border-ink dark:border-paper/20 pb-2 font-mono text-[11px] uppercase tracking-[0.14em] dark:text-paper/50">
          {t.contents}
        </p>
        <nav aria-label="Dashboard sections" className="flex gap-1 overflow-x-auto lg:flex-col">
          {NAV.map(({ id, label, count, alert }, i) => (
            <button key={id} onClick={() => setSection(id)} aria-current={section === id ? "page" : undefined}
              className={cx(
                "group flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors lg:pr-3",
                section === id ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              )}>
              <span aria-hidden className={cx("w-5 font-mono text-[11px]", section === id ? "text-signal" : "text-ink-3 dark:text-paper/30")}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className={cx("flex-1 whitespace-nowrap", section === id && "font-semibold")}>
                {label}
              </span>
              {count && <span className={cx("font-mono text-xs tabular-nums", alert?.(r) ? "text-signal" : "text-ink-3 dark:text-paper/30")}>{count(r)}</span>}
            </button>
          ))}
        </nav>
        <button
          onClick={reset}
          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {t.backToInput}
        </button>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">{r.domain === "news" ? t.newsDesk : t.scholarshipDesk}</Badge>
            <Badge tone={r.status === "success" ? "green" : r.status === "partial" ? "amber" : "red"}>
              {r.status === "success" ? t.complete : r.status === "partial" ? t.partialResults : t.failed}
            </Badge>
            <Badge tone={r.mode === "live" ? "green" : "violet"}>{r.mode.toUpperCase()}</Badge>
            <span className="font-mono text-[11px] text-ink-3 dark:text-paper/30">{r.research_id}</span>
          </div>
          <h1 className="mt-3 max-w-4xl font-sans text-[clamp(2rem,4vw,3.25rem)] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">{r.topic}</h1>
          {r.mode !== "live" && (
            <p className="mt-4 max-w-4xl border-l-2 border-violet-700 bg-violet-700/[0.06] dark:bg-violet-700/10 px-3 py-2 text-sm text-violet-900 dark:text-violet-300">
              {r.mode_explanation}
            </p>
          )}
          {r.status === "failed" && (
            <p role="alert" className="mt-4 border-l-2 border-signal bg-signal/[0.06] px-3 py-2 text-sm text-signal-dark">
              No source content could be analysed. {r.errors.map((e) => e.message).join(" ")}
            </p>
          )}
          <h2 className="mt-8 flex items-baseline gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
            <span className="font-mono text-sm text-signal">{String(index + 1).padStart(2, "0")}</span>
            <span className="font-sans text-2xl font-bold text-slate-900 dark:text-white">{current.label}</span>
          </h2>
        </header>
        {/* key forces re-mount = fade-in animation on section change */}
        <div key={section} className="section-reveal">
          {VIEWS[section]}
        </div>
      </main>
    </div>
  );
}
