import { Eye, Search } from "lucide-react";
import { Badge, COVERAGE_META, Card, EmptyState, PriorityBadge } from "../../components/ui";
import { GapAskDraft } from "../../components/AskOfficialDraft";
import { useLang } from "../../context/LangContext";
import { useResearch } from "../../context/ResearchContext";
import { gapToEvidenceItem } from "../evidence/EvidencePanel";

export function Gaps() {
  const { result: r, focusClaim, setSection, openEvidencePanel } = useResearch();
  const { t } = useLang();
  if (!r) return null;
  const sources = Object.fromEntries(r.sources.map((s) => [s.source_id, s]));

  if (!r.information_gaps.length)
    return (
      <EmptyState title={t.noGaps}>{t.noGapsDesc}</EmptyState>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2 dark:text-paper/50">
        {t.gapsDisclaimer(r.domain === "news" ? "News" : "Scholarship")}
      </p>
      {r.information_gaps.map((g) => {
        // Pick first available source to show in evidence panel for context
        const firstSrc = g.sources_checked.length > 0 ? sources[g.sources_checked[0]] : null;
        return (
          <Card key={g.gap_id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-ink-3 dark:text-paper/30">{g.gap_id}</span>
              <span className="font-semibold text-ink dark:text-paper">{g.field_label}</span>
              <Badge tone={COVERAGE_META[g.coverage_status].tone}>{COVERAGE_META[g.coverage_status].label}</Badge>
              <PriorityBadge p={g.priority} />
              <span className="ml-auto text-xs text-ink-2 dark:text-paper/50">{t.confidence} {Math.round(g.confidence * 100)}%</span>
              {firstSrc && (
                <button
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-ink-3 dark:text-paper/40 hover:text-signal dark:hover:text-signal transition-colors"
                  title="View in source text"
                  onClick={() => openEvidencePanel(gapToEvidenceItem(g, firstSrc))}
                >
                  <Eye className="h-3 w-3" /> View source
                </button>
              )}
            </div>
            <p className="mt-3 text-ink dark:text-paper/90">{g.explanation}</p>
            <p className="mt-2 text-sm text-ink-2 dark:text-paper/50">
              <span className="font-medium text-ink-2 dark:text-paper/60">{t.whyItMatters}</span> {g.why_it_matters}
            </p>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 dark:text-paper/30">{t.recommendedVerification}</p>
                <p className="mt-1 text-ink-2 dark:text-paper/50">{g.recommended_verification}</p>
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 dark:text-paper/30">{t.suggestedSearch}</p>
                <a
                  className="mt-1 inline-flex items-center gap-1 text-signal hover:underline"
                  target="_blank" rel="noopener noreferrer"
                  href={`https://www.google.com/search?q=${encodeURIComponent(g.suggested_search)}`}
                >
                  <Search className="h-3 w-3" />{g.suggested_search}
                </a>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-2 dark:text-paper/50">
              {t.sourcesChecked} {g.sources_checked.length ? g.sources_checked.map((s) => <Badge key={s}>{s}</Badge>) : "none"}
              {g.related_claims.length > 0 && (
                <>
                  · {t.relatedClaims} {g.related_claims.map((c) => (
                    <button key={c} className="font-mono text-signal hover:underline"
                      onClick={() => { focusClaim(c); setSection("claims"); }}>{c}</button>
                  ))}
                </>
              )}
            </div>

            {/* Ask the official source draft — only for Critical/High */}
            <GapAskDraft gap={g} topic={r.topic} />
          </Card>
        );
      })}
    </div>
  );
}
