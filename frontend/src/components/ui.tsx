import { ChevronDown, ExternalLink, FileText } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { CoverageStatus, EvidenceStatus, FreshnessStatus, Priority, Source, SourceType } from "../types/research";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ children, className, title, actions }: {
  children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode;
}) {
  return (
    <section className={cx("border-t border-ink dark:border-paper/20 pt-3", className)}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink dark:text-paper/80">
            {title}
          </h3>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Badge({ children, tone = "slate", title }: { children: ReactNode; tone?: Tone; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 py-px font-mono text-[11px]", TONES[tone])}>
      {children}
    </span>
  );
}

export type Tone = "slate" | "green" | "amber" | "red" | "blue" | "violet" | "cyan";
const TONES: Record<Tone, string> = {
  slate: "border-ink/25 dark:border-paper/20 text-ink-2 dark:text-paper/60",
  green: "border-emerald-800/30 bg-emerald-700/[0.07] text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-700/10 dark:text-emerald-300",
  amber: "border-amber-800/30 bg-amber-600/[0.08] text-amber-900 dark:border-amber-500/30 dark:bg-amber-600/10 dark:text-amber-300",
  red: "border-signal/40 bg-signal/[0.07] text-signal-dark dark:border-signal/30 dark:bg-signal/10 dark:text-signal",
  blue: "border-ink/50 dark:border-paper/30 text-ink dark:text-paper/80",
  violet: "border-violet-800/30 bg-violet-700/[0.07] text-violet-900 dark:border-violet-500/30 dark:bg-violet-700/10 dark:text-violet-300",
  cyan: "border-cyan-800/30 bg-cyan-700/[0.07] text-cyan-900 dark:border-cyan-500/30 dark:bg-cyan-700/10 dark:text-cyan-300",
};

export const PRIORITY_TONE: Record<Priority, Tone> = { critical: "red", high: "amber", medium: "blue", low: "slate" };

// Chart colors validated with the dataviz palette validator against the paper surface
// (#F3EFE6): lightness band, chroma, CVD and normal-vision separation all pass in EVIDENCE_ORDER.
export const EVIDENCE_META: Record<EvidenceStatus, { label: string; tone: Tone; color: string }> = {
  corroborated: { label: "Corroborated", tone: "green", color: "#0f7a55" },
  ai_inferred: { label: "AI-inferred", tone: "violet", color: "#7b3fb8" },
  unsupported: { label: "Unsupported", tone: "amber", color: "#b5650a" },
  directly_supported: { label: "Directly supported", tone: "blue", color: "#2f55c9" },
  conflicting: { label: "Conflicting", tone: "red", color: "#c8361d" },
  partially_supported: { label: "Partially supported", tone: "cyan", color: "#0891b2" },
};
export const EVIDENCE_ORDER = Object.keys(EVIDENCE_META) as EvidenceStatus[];

export const COVERAGE_META: Record<CoverageStatus, { label: string; tone: Tone }> = {
  found: { label: "Found", tone: "green" },
  partially_found: { label: "Partially found", tone: "cyan" },
  not_found: { label: "Not found in sources reviewed", tone: "amber" },
  conflicting: { label: "Conflicting", tone: "red" },
  unable_to_determine: { label: "Unable to determine", tone: "slate" },
};

export const FRESHNESS_META: Record<FreshnessStatus, { label: string; tone: Tone }> = {
  current: { label: "Current (per available dates)", tone: "green" },
  potentially_outdated: { label: "Potentially outdated", tone: "amber" },
  undated: { label: "Undated", tone: "slate" },
  unknown: { label: "Freshness unknown", tone: "slate" },
  conflicting_dates: { label: "Conflicting dates", tone: "red" },
};

export const SOURCE_TYPE_META: Record<SourceType, { label: string; tone: Tone }> = {
  official_primary: { label: "Official / primary", tone: "green" },
  secondary_reporting: { label: "Secondary reporting", tone: "blue" },
  research_document: { label: "Research document", tone: "violet" },
  user_provided: { label: "User-provided", tone: "cyan" },
  other_web: { label: "Other web", tone: "slate" },
};

export function PriorityBadge({ p }: { p: Priority }) {
  return <Badge tone={PRIORITY_TONE[p]}>{p[0].toUpperCase() + p.slice(1)}</Badge>;
}

export function EvidenceBadge({ s }: { s: EvidenceStatus }) {
  return <Badge tone={EVIDENCE_META[s].tone}>{EVIDENCE_META[s].label}</Badge>;
}

export function SourceLink({ source, compact = false }: { source?: Source; compact?: boolean }) {
  if (!source) return null;
  const label = compact ? source.source_id : `${source.source_id} · ${source.title}`;
  if (source.url)
    return (
      <a href={source.url} target="_blank" rel="noopener noreferrer" title={source.url}
        className="inline-flex min-w-0 max-w-full items-center gap-1 text-ink dark:text-paper/80 underline decoration-ink/25 dark:decoration-paper/20 underline-offset-2 hover:decoration-signal">
        <span className="truncate">{label}</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
    );
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-ink-2 dark:text-paper/50" title={source.filename ?? undefined}>
      <FileText className="h-3 w-3" />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function Quote({ text, reference }: { text: string; reference?: ReactNode }) {
  return (
    <figure className="border-l-2 border-signal pl-3">
      <blockquote className="font-serif text-[17px] leading-snug text-ink dark:text-paper/90">"{text}"</blockquote>
      {reference && <figcaption className="mt-1 font-mono text-[11px] text-ink-3 dark:text-paper/30">{reference}</figcaption>}
    </figure>
  );
}

export function Expandable({ summary, children, defaultOpen = false }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-ink/15 dark:border-paper/10 transition-all">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-ink/[0.02] dark:hover:bg-paper/[0.02] transition-colors">
        <div className="min-w-0 flex-1">{summary}</div>
        <ChevronDown className={cx("h-4 w-4 shrink-0 text-ink-2 dark:text-paper/40 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-ink/10 dark:border-paper/10 px-4 py-3">{children}</div>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-ink/25 dark:border-paper/15 px-6 py-10 text-center">
      <p className="font-serif text-xl text-ink dark:text-paper">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-ink-2 dark:text-paper/50">{children}</div>}
    </div>
  );
}

export function ScoreBar({ value, color = "#16130F" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden bg-ink/10 dark:bg-paper/10">
      <div className="h-full transition-all duration-700" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  );
}

export function fieldLabel(key: string) {
  return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function locationRef(c: { source_id: string; page_number: number | null; section: string | null }) {
  return [c.source_id, c.page_number ? `page ${c.page_number}` : null, c.section ? `§ ${c.section}` : null].filter(Boolean).join(" · ");
}
