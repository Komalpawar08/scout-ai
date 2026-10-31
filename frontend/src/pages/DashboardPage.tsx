import { type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
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
  overview: <Overview />,
  sources: <Sources />,
  claims: <Claims />,
  conflicts: <Conflicts />,
  gaps: <Gaps />,
  freshness: <Freshness />,
  coverage: <CoverageMatrix />,
  graph: <ClaimGraph />,
  evidence: <EvidenceBreakdown />,
  checklist: <Checklist />,
  export: <ExportReport />,
};

export function DashboardPage() {
  const { result: r, section, setSection, reset } = useResearch();
  const { t } = useLang();
  if (!r) return null;
  const NAV = useNavItems();
  const index = NAV.findIndex((n) => n.id === section);
  const current = NAV[index];

  return (
    <div className="flex flex-col gap-8 lg:flex-row items-start">
      {/* Sidebar Navigation */}
      <aside className="w-full rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-card backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/90 dark:shadow-card-dark lg:sticky lg:top-6 lg:h-fit lg:w-72 lg:shrink-0">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-slate-800/80">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t.contents}
          </p>
          <span className="font-mono text-[10px] text-blue-600 dark:text-cyan-400 font-semibold">
            ScoutAi Radar
          </span>
        </div>

        <nav aria-label="Dashboard sections" className="mt-3 flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:pb-0">
          {NAV.map(({ id, label, count, alert }, i) => {
            const isActive = section === id;
            return (
              <button
                key={id}
                onClick={() => setSection(id)}
                aria-current={isActive ? "page" : undefined}
                className={cx(
                  "group flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm transition-all lg:w-full",
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 font-bold"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
                )}
              >
                <span
                  aria-hidden
                  className={cx(
                    "w-5 font-mono text-[11px] transition-colors",
                    isActive ? "text-cyan-200" : "text-slate-400 dark:text-slate-500"
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 whitespace-nowrap">{label}</span>
                {count && (
                  <span
                    className={cx(
                      "rounded-full px-2 py-0.5 font-mono text-[11px] tabular-nums transition-colors",
                      isActive
                        ? "bg-white/20 text-white font-bold"
                        : alert?.(r)
                        ? "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 font-bold"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    )}
                  >
                    {count(r)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <button
          onClick={reset}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-100 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-cyan-400 transition-all"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{t.backToInput}</span>
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="min-w-0 flex-1 w-full">
        <header className="mb-8 rounded-2xl border border-slate-200/80 bg-white/90 p-6 sm:p-8 shadow-card backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/90 dark:shadow-card-dark">
          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">{r.domain === "news" ? t.newsDesk : t.scholarshipDesk}</Badge>
            <Badge tone={r.status === "success" ? "green" : r.status === "partial" ? "amber" : "red"}>
              {r.status === "success" ? t.complete : r.status === "partial" ? t.partialResults : t.failed}
            </Badge>
            <Badge tone={r.mode === "live" ? "green" : "violet"}>{r.mode.toUpperCase()}</Badge>
            <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              ID: {r.research_id}
            </span>
          </div>

          {/* Research Topic */}
          <h1 className="mt-4 font-sans text-[clamp(1.85rem,3.5vw,3rem)] font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">
            {r.topic}
          </h1>

          {r.mode !== "live" && (
            <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/10 p-3.5 text-xs text-violet-900 dark:text-violet-300">
              <span className="font-bold">Mode Notice:</span> {r.mode_explanation}
            </div>
          )}

          {r.status === "failed" && (
            <div role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-semibold text-rose-700 dark:text-rose-300">
              No source content could be analysed. {r.errors.map((e) => e.message).join(" ")}
            </div>
          )}

          {/* Active Module Header */}
          <div className="mt-8 flex items-baseline gap-3 border-t border-slate-200/80 pt-6 dark:border-slate-800/80">
            <span className="font-mono text-sm font-bold text-blue-600 dark:text-cyan-400">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {current.label}
            </h2>
          </div>
        </header>

        {/* Section View with smooth fade-in */}
        <div key={section} className="section-reveal">
          {VIEWS[section]}
        </div>
      </main>
    </div>
  );
}
