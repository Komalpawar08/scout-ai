import { Eye } from "lucide-react";
import { Badge, Card, EmptyState, Quote, SourceLink, fieldLabel } from "../../components/ui";
import { ConflictAskDraft } from "../../components/AskOfficialDraft";
import { useLang } from "../../context/LangContext";
import { useResearch } from "../../context/ResearchContext";
import { conflictToEvidenceItems } from "../evidence/EvidencePanel";

export function Conflicts() {
  const { result: r, setSection, focusClaim, openEvidencePanel } = useResearch();
  const { t } = useLang();
  if (!r) return null;
  const sources = Object.fromEntries(r.sources.map((s) => [s.source_id, s]));
  const claims = Object.fromEntries(r.claims.map((c) => [c.claim_id, c]));
  const open = (id: string) => { focusClaim(id); setSection("claims"); };

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2 dark:text-paper/50">
        {t.conflictsDisclaimer}
      </p>
      {r.conflicts.length === 0 && (
        <EmptyState title={t.noConflicts}>
          {t.noConflictsDesc}
        </EmptyState>
      )}
      {r.conflicts.map((k) => (
        <Card key={k.conflict_id}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-serif text-2xl leading-none text-signal">{k.label}</span>
            <span className="font-mono text-xs text-ink-3 dark:text-paper/30">{k.conflict_id}</span>
            <Badge>{fieldLabel(k.field)}</Badge>
            <Badge tone="slate">{k.conflict_type.replace(/_/g, " ")}</Badge>
            <Badge tone={k.detection_method === "llm" ? "violet" : "blue"}>
              {k.detection_method === "llm" ? "LLM-adjudicated" : "rule-based"}
            </Badge>
            <span className="ml-auto text-xs text-ink-2 dark:text-paper/50">{t.confidence} {Math.round(k.confidence * 100)}%</span>
          </div>
          <p className="mt-3 text-ink dark:text-paper/90">{k.explanation}</p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {([["a", k.claim_a, k.source_a, k.quotation_a], ["b", k.claim_b, k.source_b, k.quotation_b]] as const).map(([side, cid, sid, quote]) => {
              const srcObj = sources[sid];
              return (
                <div key={cid} className="min-w-0 space-y-2 rounded-xl border border-ink/10 dark:border-paper/10 p-3 hover-lift transition-all">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0 flex-1"><SourceLink source={srcObj} /></div>
                    <div className="flex shrink-0 gap-1">
                      {srcObj && (
                        <button
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-xs text-ink-3 dark:text-paper/40 hover:text-signal dark:hover:text-signal transition-colors"
                          title="View in source text"
                          onClick={() => {
                            if (srcObj) openEvidencePanel(conflictToEvidenceItems(k, sources, claims, side as "a" | "b"));
                          }}
                        >
                          <Eye className="h-3 w-3" /> Source
                        </button>
                      )}
                      <button className="shrink-0 whitespace-nowrap text-xs text-signal hover:underline" onClick={() => open(cid)}>
                        {cid} →
                      </button>
                    </div>
                  </div>
                  <Quote
                    text={quote}
                    reference={
                      claims[cid] &&
                      [claims[cid].page_number && `page ${claims[cid].page_number}`, claims[cid].section && `§ ${claims[cid].section}`]
                        .filter(Boolean)
                        .join(" · ")
                    }
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 dark:text-paper/30">{t.scopeChecks}</p>
              <ul className="mt-1 space-y-0.5 text-ink-2 dark:text-paper/50">
                {Object.entries(k.scope_checks).map(([a, b]) => (
                  <li key={a}><span className="capitalize text-ink-2 dark:text-paper/60">{a}:</span> {b}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 dark:text-paper/30">{t.recommendedVerification}</p>
              <p className="mt-1 text-ink-2 dark:text-paper/50">{k.recommended_verification}</p>
            </div>
          </div>

          {/* Ask the official source draft — for all conflicts */}
          <ConflictAskDraft conflict={k} topic={r.topic} />
        </Card>
      ))}

      {r.scope_notes.length > 0 && (
        <Card title={t.scopeNotTitle}>
          <ul className="space-y-2 text-sm">
            {r.scope_notes.map((n, i) => (
              <li key={i} className="flex flex-wrap gap-2 text-ink-2 dark:text-paper/50">
                <Badge>{fieldLabel(n.field)}</Badge>
                <button className="font-mono text-xs text-signal" onClick={() => open(n.claim_a)}>{n.claim_a}</button>
                <span className="text-ink-3 dark:text-paper/30">vs</span>
                <button className="font-mono text-xs text-signal" onClick={() => open(n.claim_b)}>{n.claim_b}</button>
                <span>{n.note}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
