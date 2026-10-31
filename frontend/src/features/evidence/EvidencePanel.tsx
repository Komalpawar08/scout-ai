/**
 * EvidencePanel — side panel showing verbatim quote highlighted in source text.
 * Opens when the user clicks any finding (conflict, gap, claim).
 */
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLang } from "../../context/LangContext";
import type { Claim, Conflict, InformationGap, Source } from "../../types/research";

export interface EvidencePanelItem {
  type: "claim" | "conflict_a" | "conflict_b" | "gap";
  source: Source;
  quote: string;
  location: string;
  dateOrigin: string | null;
}

interface Props {
  item: EvidencePanelItem | null;
  onClose: () => void;
}

function highlightQuote(text: string, quote: string): React.ReactNode {
  if (!quote || !text) return <span>{text}</span>;
  // Try exact match first
  const idx = text.indexOf(quote);
  if (idx !== -1) {
    return (
      <>
        <span className="text-ink dark:text-paper/80">{text.slice(0, idx)}</span>
        <mark className="rounded-sm bg-signal/25 px-0.5 font-medium text-signal-dark dark:bg-signal/40 dark:text-signal">
          {text.slice(idx, idx + quote.length)}
        </mark>
        <span className="text-ink dark:text-paper/80">{text.slice(idx + quote.length)}</span>
      </>
    );
  }
  // Try normalised match (lowercase, collapse whitespace)
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const normText = norm(text);
  const normQuote = norm(quote);
  const normIdx = normText.indexOf(normQuote);
  if (normIdx !== -1) {
    return (
      <>
        <span className="text-ink dark:text-paper/80">{text.slice(0, normIdx)}</span>
        <mark className="rounded-sm bg-signal/20 px-0.5 font-medium text-signal-dark dark:bg-signal/35 dark:text-signal">
          {text.slice(normIdx, normIdx + normQuote.length)}
        </mark>
        <span className="text-ink dark:text-paper/80">{text.slice(normIdx + normQuote.length)}</span>
      </>
    );
  }
  // No match — show quote separately
  return <span className="text-ink dark:text-paper/80">{text}</span>;
}

export function EvidencePanel({ item, onClose }: Props) {
  const { t } = useLang();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  // Scroll quote into view when panel opens
  useEffect(() => {
    if (item) {
      setTimeout(() => {
        panelRef.current?.querySelector("mark")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }
  }, [item]);

  if (!item) return null;

  const quoteFound = item.source.extracted_text.includes(item.quote) ||
    item.source.extracted_text.toLowerCase().includes(item.quote.toLowerCase().replace(/\s+/g, " ").trim());

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-label={t.evidencePanel}
        aria-modal
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[520px] flex-col bg-paper dark:bg-ink shadow-2xl ring-1 ring-ink/10 dark:ring-paper/10 transition-transform duration-300"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-ink/15 dark:border-paper/10 px-5 py-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3 dark:text-paper/40">
              {t.evidencePanel}
            </p>
            <p className="mt-0.5 font-medium text-ink dark:text-paper truncate max-w-xs">
              {item.source.title}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t.close}
            className="rounded-md p-1.5 text-ink-3 hover:bg-ink/5 dark:text-paper/50 dark:hover:bg-paper/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Metadata strip */}
        <div className="border-b border-ink/10 dark:border-paper/10 px-5 py-3 text-xs text-ink-2 dark:text-paper/50 grid grid-cols-2 gap-2">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-paper/30">
              {t.pageSection}
            </span>
            <p className="mt-0.5 text-ink dark:text-paper/70">{item.location || "—"}</p>
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-paper/30">
              {t.dateOrigin}
            </span>
            <p className="mt-0.5 text-ink dark:text-paper/70">
              {item.source.publication_date
                ? `${item.source.publication_date}${item.dateOrigin ? ` (${item.dateOrigin})` : ""}`
                : "—"}
            </p>
          </div>
        </div>

        {/* Quote highlight */}
        <div className="border-b border-ink/10 dark:border-paper/10 px-5 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 dark:text-paper/30">
            {t.highlightedQuote}
          </p>
          <blockquote className="mt-2 border-l-2 border-signal pl-3 font-serif text-[16px] leading-snug text-ink dark:text-paper/90">
            "{item.quote}"
          </blockquote>
          {!quoteFound && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{t.noQuoteFound}</p>
          )}
        </div>

        {/* Source text with highlight */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 dark:text-paper/30 mb-2">
            {t.sourceText}
          </p>
          {item.source.extracted_text ? (
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink dark:text-paper/70 selection:bg-signal/20">
              {highlightQuote(item.source.extracted_text, item.quote)}
            </pre>
          ) : (
            <p className="text-xs text-ink-3 dark:text-paper/30 italic">No extracted text available.</p>
          )}
        </div>
      </aside>
    </>
  );
}

// ── Helpers to build EvidencePanelItem from different finding types ──────────

export function claimToEvidenceItem(claim: Claim, source: Source): EvidencePanelItem {
  const locationParts = [
    claim.page_number ? `page ${claim.page_number}` : null,
    claim.section ? `§ ${claim.section}` : null,
  ].filter(Boolean);
  return {
    type: "claim",
    source,
    quote: claim.supporting_quote,
    location: locationParts.join(" · ") || source.source_id,
    dateOrigin: source.publication_date_origin,
  };
}

export function conflictToEvidenceItems(
  conflict: Conflict,
  sources: Record<string, Source>,
  claims: Record<string, import("../../types/research").Claim>,
  side: "a" | "b"
): EvidencePanelItem {
  const cid = side === "a" ? conflict.claim_a : conflict.claim_b;
  const sid = side === "a" ? conflict.source_a : conflict.source_b;
  const quote = side === "a" ? conflict.quotation_a : conflict.quotation_b;
  const source = sources[sid];
  const claim = claims[cid];
  const locationParts = claim
    ? [
        claim.page_number ? `page ${claim.page_number}` : null,
        claim.section ? `§ ${claim.section}` : null,
      ].filter(Boolean)
    : [];
  return {
    type: side === "a" ? "conflict_a" : "conflict_b",
    source,
    quote,
    location: locationParts.join(" · ") || (source?.source_id ?? sid),
    dateOrigin: source?.publication_date_origin ?? null,
  };
}

export function gapToEvidenceItem(
  gap: InformationGap,
  source: Source
): EvidencePanelItem {
  return {
    type: "gap",
    source,
    quote: gap.explanation,
    location: source.source_id,
    dateOrigin: source.publication_date_origin,
  };
}

