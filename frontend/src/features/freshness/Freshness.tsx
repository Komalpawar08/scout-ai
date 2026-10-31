import { Badge, Card, EmptyState, FRESHNESS_META, SourceLink } from "../../components/ui";
import { useResearch } from "../../context/ResearchContext";

export function Freshness() {
  const { result: r } = useResearch();
  if (!r) return null;
  const sources = Object.fromEntries(r.sources.map((s) => [s.source_id, s]));
  return (
    <div className="space-y-6">
      <Card title="Source freshness">
        <p className="mb-3 text-sm text-ink-2">
          {r.domain === "scholarship"
            ? "Scholarship freshness is judged by the academic cycle each source states and by deadlines relative to today."
            : "News is not marked outdated for age alone — only when newer reporting on the same topic exists."}
          {" "}Publication dates are never inferred.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              <tr><th className="py-2 pr-3">Source</th><th className="pr-3">Published</th><th className="pr-3">Cycle</th><th className="pr-3">Status</th><th>Reason</th></tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {r.source_freshness.map((f) => {
                const s = sources[f.source_id];
                return (
                  <tr key={f.source_id} className="align-top">
                    <td className="py-2 pr-3"><SourceLink source={s} compact /></td>
                    <td className="pr-3 text-ink-2">{s?.publication_date ?? (s?.date_status === "not_stated" ? "Undated" : "Unknown")}</td>
                    <td className="pr-3 text-ink-2">{s?.academic_cycle ?? "—"}</td>
                    <td className="pr-3"><Badge tone={FRESHNESS_META[f.status].tone}>{FRESHNESS_META[f.status].label}</Badge></td>
                    <td className="text-ink-2">{f.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title={`Freshness warnings (${r.freshness_warnings.length})`}>
        {r.freshness_warnings.length === 0 ? (
          <EmptyState title="No freshness warnings">The available date evidence did not indicate outdated information.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {r.freshness_warnings.map((w) => (
              <li key={w.warning_id} className="rounded-xl border border-ink/10 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-ink-3">{w.warning_id}</span>
                  <Badge tone={FRESHNESS_META[w.status].tone}>{FRESHNESS_META[w.status].label}</Badge>
                  {w.source_id && <SourceLink source={sources[w.source_id]} compact />}
                  {w.claim_id && <Badge>{w.claim_id}</Badge>}
                </div>
                <p className="mt-2 text-sm text-ink">{w.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
