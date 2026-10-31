import { CheckSquare, Square, ShieldCheck } from "lucide-react";
import { Badge, EmptyState, PriorityBadge, cx } from "../../components/ui";
import { useLang } from "../../context/LangContext";
import { useResearch } from "../../context/ResearchContext";
import type { Priority } from "../../types/research";

const ORDER: Priority[] = ["critical", "high", "medium", "low"];

export function Checklist() {
  const { result: r, checklistDone, toggleTask } = useResearch();
  const { t } = useLang();
  if (!r) return null;
  const items = r.verification_checklist;
  if (!items.length)
    return <EmptyState title={t.nothingToVerify}>{t.nothingToVerifyDesc}</EmptyState>;
  const done = items.filter((i) => checklistDone[i.task_id]).length;
  const pct = Math.round((done / items.length) * 100);

  return (
    <div className="space-y-6">
      {/* Progress Header Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 sm:p-6 shadow-card backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/90 dark:shadow-card-dark">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Session Action Board
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              {t.checklistDesc}
            </p>
          </div>
          <div className="text-right">
            <span
              className="font-mono text-sm font-bold text-blue-600 dark:text-cyan-400"
              data-testid="checklist-progress"
            >
              {done} / {items.length} {t.done}
            </span>
            <div className="mt-1.5 h-2 w-32 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Priority Groups */}
      {ORDER.map((p) => {
        const group = items.filter((i) => i.priority === p);
        if (!group.length) return null;
        return (
          <section key={p} className="space-y-3">
            <div className="flex items-center gap-2.5">
              <PriorityBadge p={p} />
              <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {group.length} {t.tasks}
              </span>
            </div>

            <div className="space-y-2.5">
              {group.map((task) => {
                const isDone = !!checklistDone[task.task_id];
                return (
                  <div
                    key={task.task_id}
                    className={cx(
                      "flex items-start gap-3.5 rounded-2xl border p-4 sm:p-5 transition-all hover-lift",
                      isDone
                        ? "border-slate-200/50 bg-slate-50/50 dark:border-slate-800/40 dark:bg-slate-900/30 opacity-60"
                        : "border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/80"
                    )}
                  >
                    <button
                      onClick={() => toggleTask(task.task_id)}
                      aria-pressed={isDone}
                      aria-label={`Mark ${task.task_id} ${isDone ? "not done" : "done"}`}
                      className="mt-0.5 text-blue-600 dark:text-cyan-400 transition-transform hover:scale-110 active:scale-95"
                    >
                      {isDone ? (
                        <CheckSquare className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Square className="h-5 w-5 text-slate-400 hover:text-blue-500" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {task.task_id}
                        </span>
                        <span
                          className={cx(
                            "font-bold text-sm text-slate-900 dark:text-white leading-snug",
                            isDone && "line-through text-slate-400 dark:text-slate-500"
                          )}
                        >
                          {task.task}
                        </span>
                        {task.related_conflict_id && <Badge tone="red">{task.related_conflict_id}</Badge>}
                        {task.related_gap_id && <Badge tone="amber">{task.related_gap_id}</Badge>}
                        {task.related_claim_id && <Badge>{task.related_claim_id}</Badge>}
                      </div>

                      <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        {task.reason}
                      </p>

                      <div className="mt-3 grid gap-1 border-t border-slate-100 pt-2.5 dark:border-slate-800/60 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
                        <p>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {t.action}:
                          </span>{" "}
                          {task.suggested_action}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {t.where}:
                          </span>{" "}
                          {task.suggested_source}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
