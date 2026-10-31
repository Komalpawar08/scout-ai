import { ChevronDown, ExternalLink, FileText, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { CoverageStatus, EvidenceStatus, FreshnessStatus, Priority, Source, SourceType } from "../types/research";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
  title,
  actions,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={cx("rounded-2xl border border-slate-200/80 bg-white/90 p-5 sm:p-6 shadow-sm backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/80 dark:shadow-card-dark", className)}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 pb-3 dark:border-slate-800/60">
          <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
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
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide",
        TONES[tone]
      )}
    >
      {children}
    </span>
  );
}

export type Tone = "slate" | "green" | "amber" | "red" | "blue" | "violet" | "cyan";
const TONES: Record<Tone, string> = {
  slate: "border-slate-200 bg-slate-100/70 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/15 dark:text-amber-300",
  red: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-300",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/15 dark:text-blue-300",
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/15 dark:text-violet-300",
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/15 dark:text-cyan-300",
};

export const PRIORITY_TONE: Record<Priority, Tone> = { critical: "red", high: "amber", medium: "blue", low: "slate" };

export const EVIDENCE_META: Record<EvidenceStatus, { label: string; tone: Tone; color: string }> = {
  corroborated: { label: "Corroborated", tone: "green", color: "#10b981" },
  ai_inferred: { label: "AI-inferred", tone: "violet", color: "#8b5cf6" },
  unsupported: { label: "Unsupported", tone: "amber", color: "#f59e0b" },
  directly_supported: { label: "Directly supported", tone: "blue", color: "#3b82f6" },
  conflicting: { label: "Conflicting", tone: "red", color: "#f43f5e" },
  partially_supported: { label: "Partially supported", tone: "cyan", color: "#06b6d4" },
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
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        title={source.url}
        className="inline-flex min-w-0 max-w-full items-center gap-1.5 font-medium text-blue-600 hover:text-blue-700 dark:text-cyan-400 dark:hover:text-cyan-300 underline decoration-blue-500/30 underline-offset-2 transition-colors"
      >
        <span className="truncate">{label}</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
    );
  return (
    <span
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium"
      title={source.filename ?? undefined}
    >
      <FileText className="h-3 w-3 text-indigo-500" />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function Quote({ text, reference }: { text: string; reference?: ReactNode }) {
  return (
    <figure className="relative rounded-xl border-l-4 border-blue-500 bg-blue-50/40 p-3.5 dark:border-cyan-400 dark:bg-slate-800/40">
      <blockquote className="text-[14px] sm:text-[15px] italic leading-relaxed text-slate-800 dark:text-slate-200">
        "{text}"
      </blockquote>
      {reference && (
        <figcaption className="mt-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
          {reference}
        </figcaption>
      )}
    </figure>
  );
}

export function Expandable({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 overflow-hidden dark:border-slate-800 dark:bg-slate-900/50 shadow-sm transition-all">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
      >
        <div className="min-w-0 flex-1">{summary}</div>
        <ChevronDown
          className={cx("h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      {open && <div className="border-t border-slate-200/80 px-4 py-3.5 dark:border-slate-800/80">{children}</div>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 px-6 py-12 text-center dark:border-slate-800">
      <Sparkles className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
      <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{title}</p>
      {children && <div className="mt-1 max-w-md text-xs sm:text-sm text-slate-500 dark:text-slate-400">{children}</div>}
    </div>
  );
}

export function ScoreBar({ value, color = "#2563eb" }: { value: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div
        className="h-full rounded-full transition-all duration-700 shadow-sm"
        style={{ width: `${Math.round(value * 100)}%`, background: color }}
      />
    </div>
  );
}

export function fieldLabel(key: string) {
  return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function locationRef(c: { source_id: string; page_number: number | null; section: string | null }) {
  return [c.source_id, c.page_number ? `page ${c.page_number}` : null, c.section ? `§ ${c.section}` : null]
    .filter(Boolean)
    .join(" · ");
}
