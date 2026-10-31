import { useState } from "react";
import { Badge, Card, EVIDENCE_META, EvidenceBadge, Quote, SOURCE_TYPE_META, ScoreBar, SourceLink, cx, locationRef } from "../../components/ui";
import { useResearch } from "../../context/ResearchContext";

export function EvidenceBreakdown() {
  const { result: r } = useResearch();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!r) return null;
  const ea = r.evidence_assessment;
  const claims = Object.fromEntries(r.claims.map((c) => [c.claim_id, c]));
  const sources = Object.fromEntries(r.sources.map((s) => [s.source_id, s]));
  const sorted = [...ea.claims].sort((a, b) => b.score - a.score);
  const sel = ea.claims.find((a) => a.claim_id === (selectedId ?? sorted[0]?.claim_id));
  const claim = sel ? claims[sel.claim_id] : undefined;

  return (
    <div className="space-y-6">
      <Card title="How evidence is scored">
        <p className="text-sm text-ink-2">{ea.method}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(ea.weights).map(([k, w]) => <Badge key={k} tone="blue">{k} × {w}</Badge>)}
        </div>
        <p className="mt-2 text-xs text-ink-3">An official source does not make a claim true, and a high score is not a guarantee of factual correctness.</p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Card title={`Claims (${sorted.length})`}>
          {sorted.length === 0 ? <p className="text-sm text-ink-2">No claims to assess.</p> : (
            <ul className="max-h-[640px] space-y-1 overflow-y-auto pr-1">
              {sorted.map((a) => (
                <li key={a.claim_id}>
                  <button onClick={() => setSelectedId(a.claim_id)}
                    className={cx("w-full rounded-lg px-3 py-2 text-left hover:bg-ink/5", sel?.claim_id === a.claim_id && "bg-signal/10 ring-1 ring-signal/40")}>
                    <div className="flex items-center gap-3">
                      <span className="w-10 font-mono text-xs text-ink-3">{a.claim_id}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{claims[a.claim_id]?.claim_text}</span>
                      <EvidenceBadge s={a.evidence_status} />
                      <span className="w-10 text-right text-sm font-semibold text-ink">{a.score.toFixed(2)}</span>
                    </div>
                    <div className="mt-1 pl-[52px]"><ScoreBar value={a.score} color={EVIDENCE_META[a.evidence_status].color} /></div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Confidence breakdown">
          {!sel || !claim ? <p className="text-sm text-ink-2">Select a claim.</p> : (
            <div className="space-y-4" data-testid="evidence-breakdown">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-ink-2">{sel.claim_id}</span>
                <EvidenceBadge s={sel.evidence_status} />
                <span className="ml-auto text-2xl font-bold text-ink">{sel.score.toFixed(2)}</span>
              </div>
              <p className="text-sm text-ink">{claim.claim_text}</p>
              <ul className="space-y-3">
                {sel.components.map((c) => (
                  <li key={c.name}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium capitalize text-ink-2">{c.name}</span>
                      <span className="text-ink-2">{c.value.toFixed(2)} × {c.weight} = <span className="text-ink">{(c.value * c.weight).toFixed(3)}</span></span>
                    </div>
                    <ScoreBar value={c.value} />
                    <p className="mt-1 text-xs text-ink-3">{c.reason}</p>
                  </li>
                ))}
              </ul>
              <p className="rounded-lg bg-ink/[0.03] p-2 text-sm text-ink-2">{sel.reason}</p>
              <Quote text={claim.supporting_quote} reference={locationRef(claim)} />
              <div className="text-sm">
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Supporting sources</p>
                <div className="mt-1 flex flex-wrap gap-3">{sel.supporting_sources.map((s) => <SourceLink key={s} source={sources[s]} compact />)}</div>
              </div>
              {sel.conflicting_claims.length > 0 && <p className="text-sm text-signal-dark">Conflicts with: {sel.conflicting_claims.join(", ")}</p>}
              {sel.missing_evidence.length > 0 && (
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Missing evidence</p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-amber-800">{sel.missing_evidence.map((m) => <li key={m}>{m}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <Card title="Source assessment">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              <tr><th className="py-2 pr-3">Source</th><th className="pr-3">Type</th><th className="pr-3">Authority</th><th className="pr-3">Freshness</th><th className="pr-3">Relevance</th><th>Claims</th></tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {ea.sources.map((s) => (
                <tr key={s.source_id} className="align-top">
                  <td className="py-2 pr-3"><SourceLink source={sources[s.source_id]} compact /></td>
                  <td className="pr-3"><Badge tone={SOURCE_TYPE_META[s.source_type].tone}>{SOURCE_TYPE_META[s.source_type].label}</Badge></td>
                  <td className="pr-3" title={s.authority_reason}>{s.authority.toFixed(2)}<p className="text-xs text-ink-3">{s.authority_reason}</p></td>
                  <td className="pr-3" title={s.freshness_reason}>{s.freshness.toFixed(2)}</td>
                  <td className="pr-3" title={s.relevance_reason}>{s.relevance.toFixed(2)}</td>
                  <td>{s.claim_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
