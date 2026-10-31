import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, MinusCircle, XCircle, Radio, Sparkles } from "lucide-react";
import { cx } from "../../components/ui";
import { useResearch } from "../../context/ResearchContext";
import type { ProgressEvent } from "../../types/research";

export const STAGES: { id: string; label: string }[] = [
  { id: "planning", label: "Planning research" },
  { id: "queries", label: "Generating search queries" },
  { id: "collecting", label: "Collecting sources" },
  { id: "extracting_web", label: "Extracting website content" },
  { id: "processing_pdfs", label: "Processing PDFs" },
  { id: "metadata", label: "Extracting metadata" },
  { id: "claims", label: "Extracting claims and evidence" },
  { id: "conflicts", label: "Detecting conflicts" },
  { id: "gaps", label: "Identifying information gaps" },
  { id: "freshness", label: "Checking freshness" },
  { id: "evidence", label: "Evaluating evidence" },
  { id: "coverage", label: "Building coverage matrix" },
  { id: "graph", label: "Building claim relationship graph" },
  { id: "checklist", label: "Generating verification checklist" },
  { id: "completeness", label: "Calculating research completeness" },
  { id: "report", label: "Preparing final report" },
];

type StageState = "pending" | ProgressEvent["status"];

/** Latest real status per stage, derived only from backend events (nothing simulated). */
export function stageStates(events: ProgressEvent[]): Record<string, { state: StageState; message: string }> {
  const out: Record<string, { state: StageState; message: string }> = {};
  for (const s of STAGES) out[s.id] = { state: "pending", message: "" };
  for (const e of events) {
    const prev = out[e.stage];
    if (!prev) continue;
    out[e.stage] = { state: e.status, message: e.message || prev.message };
  }
  return out;
}

const ICONS: Record<StageState, JSX.Element> = {
  pending: <CircleDashed className="h-4 w-4 text-slate-400 dark:text-slate-600" />,
  started: <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  skipped: <MinusCircle className="h-4 w-4 text-slate-400" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  failed: <XCircle className="h-4 w-4 text-rose-500" />,
};

export function ResearchProgress() {
  const { progress, input, cancel, phase, error, reset } = useResearch();
  const states = stageStates(progress);
  const done = STAGES.filter((s) => ["completed", "skipped", "warning", "failed"].includes(states[s.id].state)).length;
  const pct = Math.round((done / STAGES.length) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      {/* Active Pipeline Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-card backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/90 dark:shadow-card-dark">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-cyan-500 animate-ping" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
                {input?.domain === "news" ? "News Intelligence Pipeline" : "Scholarship Intelligence Pipeline"}
              </p>
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {input?.topic}
            </h2>
            {input?.demo_scenario && (
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400 border border-violet-500/20">
                <Sparkles className="h-3 w-3" /> Fictional Fixture Sources (Demo)
              </span>
            )}
          </div>
          {phase === "running" && (
            <button
              onClick={cancel}
              className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-rose-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Dynamic Glowing Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs font-mono font-medium text-slate-500 dark:text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-cyan-400 font-bold">
              <Radio className="h-3.5 w-3.5 animate-pulse" /> Scanning &amp; Extracting Claims...
            </span>
            <span>{pct}% complete ({done} / {STAGES.length})</span>
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 p-0.5 shadow-inner"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 shadow-sm shadow-blue-500/50 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {phase === "error" && (
        <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 animate-fade-in">
          <p className="flex items-center gap-2 font-bold text-rose-600 dark:text-rose-400">
            <XCircle className="h-5 w-5" /> Research could not be completed
          </p>
          <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">{error}</p>
          <button
            onClick={reset}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors"
          >
            Back to research input
          </button>
        </div>
      )}

      {/* Stages Stepper Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-card backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/90 dark:shadow-card-dark">
        <h3 className="border-b border-slate-200/80 pb-3 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Live Stage Execution
        </h3>
        <ol className="mt-4 space-y-1.5">
          {STAGES.map((s) => {
            const st = states[s.id];
            const isStarted = st.state === "started";
            return (
              <li
                key={s.id}
                data-testid={`stage-${s.id}`}
                data-state={st.state}
                className={cx(
                  "flex items-start gap-3 rounded-xl px-3 py-2 transition-all",
                  isStarted
                    ? "bg-blue-500/10 border border-blue-500/20 shadow-sm"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                )}
              >
                <span className="mt-0.5 shrink-0">{ICONS[st.state]}</span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cx(
                      "text-sm font-medium",
                      st.state === "pending"
                        ? "text-slate-400 dark:text-slate-500"
                        : isStarted
                        ? "text-blue-600 dark:text-cyan-400 font-bold"
                        : "text-slate-800 dark:text-slate-200"
                    )}
                  >
                    {s.label}
                  </p>
                  {st.message && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                      {st.message}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
