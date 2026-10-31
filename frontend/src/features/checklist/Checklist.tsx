import { CheckSquare, Square } from "lucide-react";
import { Badge, Card, EmptyState, PriorityBadge, cx } from "../../components/ui";
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

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-2 dark:text-paper/50">{t.checklistDesc}</p>
          <span className="text-sm font-semibold text-ink dark:text-paper" data-testid="checklist-progress">
            {done} / {items.length} {t.done}
          </span>
        </div>
      </Card>
      {ORDER.map((p) => {
        const group = items.filter((i) => i.priority === p);
        if (!group.length) return null;
        return (
          <section key={p} className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-2 dark:text-paper/50">
              <PriorityBadge p={p} /> {group.length} {t.tasks}
            </h3>
            {group.map((task) => {
              const isDone = !!checklistDone[task.task_id];
              return (
                <div
                  key={task.task_id}
                  className={cx(
                    "flex gap-3 rounded-xl border border-ink/10 dark:border-paper/10 bg-paper-3 dark:bg-ink/50 p-4 transition-all hover-lift",
                    isDone && "opacity-60"
                  )}
                >
                  <button
                    onClick={() => toggleTask(task.task_id)}
                    aria-pressed={isDone}
                    aria-label={`Mark ${task.task_id} ${isDone ? "not done" : "done"}`}
                    className="mt-0.5 text-signal transition-transform hover:scale-110"
                  >
                    {isDone ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-ink-3 dark:text-paper/30">{task.task_id}</span>
                      <span className={cx("font-medium text-ink dark:text-paper", isDone && "line-through")}>
                        {task.task}
                      </span>
                      {task.related_conflict_id && <Badge tone="red">{task.related_conflict_id}</Badge>}
                      {task.related_gap_id && <Badge tone="amber">{task.related_gap_id}</Badge>}
                      {task.related_claim_id && <Badge>{task.related_claim_id}</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-ink-2 dark:text-paper/50">{task.reason}</p>
                    <p className="mt-2 text-sm text-ink-2 dark:text-paper/50">
                      <span className="text-ink-2 dark:text-paper/60">{t.action}:</span> {task.suggested_action}
                    </p>
                    <p className="text-sm text-ink-2 dark:text-paper/50">
                      <span className="text-ink-2 dark:text-paper/60">{t.where}:</span> {task.suggested_source}
                    </p>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
