import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, MinusCircle, XCircle } from "lucide-react";
import { Card, cx } from "../../components/ui";
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
  pending: <CircleDashed className="h-4 w-4 text-ink-3 dark:text-paper/30" />,
  started: <Loader2 className="h-4 w-4 animate-spin text-signal" />,
  completed: <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />,
  skipped: <MinusCircle className="h-4 w-4 text-ink-3 dark:text-paper/30" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" />,
  failed: <XCircle className="h-4 w-4 text-signal" />,
};

export function ResearchProgress() {
  const { progress, input, cancel, phase, error, reset } = useResearch();
  const states = stageStates(progress);
  const done = STAGES.filter((s) => ["completed", "skipped", "warning", "failed"].includes(states[s.id].state)).length;
  const pct = Math.round((done / STAGES.length) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2 dark:text-paper/50">
              {input?.domain === "news" ? "News Intelligence" : "Scholarship Intelligence"}
            </p>
            <h2 className="mt-1 font-serif text-4xl leading-tight dark:text-paper">{input?.topic}</h2>
            {input?.demo_scenario && (
              <p className="mt-1 text-xs text-violet-800 dark:text-violet-300">Demo scenario — fictional, labelled fixture sources</p>
            )}
          </div>
          {phase === "running" && (
            <button
              onClick={cancel}
              className="rounded-lg border border-ink/10 dark:border-paper/10 px-3 py-1.5 text-sm text-ink dark:text-paper hover:bg-ink/5 dark:hover:bg-paper/5 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
        <div
          className="mt-5 h-1.5 overflow-hidden bg-ink/10 dark:bg-paper/10 rounded-full"
          role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
        >
          <div
            className="h-full bg-signal transition-all duration-500 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-right text-xs text-ink-2 dark:text-paper/50">{done} / {STAGES.length} stages</p>
      </Card>

      {phase === "error" && (
        <div role="alert" className="border-l-2 border-signal bg-signal/[0.06] p-5 animate-fade-in">
          <p className="flex items-center gap-2 font-semibold text-signal-dark dark:text-signal">
            <XCircle className="h-5 w-5" /> Research could not be completed
          </p>
          <p className="mt-2 text-sm text-signal-dark/90 dark:text-signal/80">{error}</p>
          <button
            onClick={reset}
            className="mt-4 border border-ink dark:border-paper/30 px-4 py-2 text-sm text-ink dark:text-paper hover:bg-ink hover:text-paper dark:hover:bg-paper/10 transition-colors"
          >
            Back to research input
          </button>
        </div>
      )}

      <Card title="Live research progress">
        <ol className="space-y-1">
          {STAGES.map((s) => {
            const st = states[s.id];
            return (
              <li
                key={s.id}
                data-testid={`stage-${s.id}`}
                data-state={st.state}
                className={cx(
                  "flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors",
                  st.state === "started" && "bg-signal/[0.06] dark:bg-signal/10"
                )}
              >
                <span className="mt-0.5">{ICONS[st.state]}</span>
                <div className="min-w-0">
                  <p className={cx("text-sm", st.state === "pending" ? "text-ink-3 dark:text-paper/30" : "text-ink dark:text-paper/80")}>
                    {s.label}
                  </p>
                  {st.message && <p className="text-xs text-ink-2 dark:text-paper/50">{st.message}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
