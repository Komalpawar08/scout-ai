import { ArrowRight } from "lucide-react";
import { useLang } from "../context/LangContext";
import { ResearchForm } from "../features/research/ResearchForm";
import type { HealthInfo } from "../types/research";

const INDEX_KEYS = [
  { key: "coverageMatrix" as const, textKey: "coverageMatrixText" as const },
  { key: "possibleConflicts" as const, textKey: "possibleConflictsText" as const },
  { key: "freshness" as const, textKey: "freshnessText" as const },
  { key: "evidenceConfidence" as const, textKey: "evidenceConfidenceText" as const },
  { key: "claimGraph" as const, textKey: "claimGraphText" as const },
  { key: "verificationChecklist" as const, textKey: "verificationChecklistText" as const },
];

/** Hand-drawn pen stroke under the key phrase of the headline. */
function PenUnderline() {
  return (
    <svg aria-hidden viewBox="0 0 300 18" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-[0.28em] w-full">
      <path d="M3 11 C 60 4, 120 15, 180 8 S 270 6, 297 10" fill="none" stroke="#C8361D" strokeWidth="4" strokeLinecap="round" />
      <path d="M40 15 C 110 10, 200 16, 280 13" fill="none" stroke="#C8361D" strokeWidth="2" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

/** Real finding from Demo A (fictional, labelled sources) — the product's output, shown at headline size. */
function Specimen() {
  return (
    <figure className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5 animate-fade-in dark:border-slate-700 dark:bg-slate-800/60">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
        <span className="text-ink dark:text-paper/80">Fig. 1 — Possible conflict · Family income limit · 2026–27</span>
        <span className="text-ink-3 dark:text-paper/30">From Demo A · fictional sources</span>
      </figcaption>
      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-end gap-x-4 sm:gap-x-8">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-ink-2 dark:text-paper/50">S1 · Scholarship Board, official notice</p>
          <p className="mt-1 whitespace-nowrap font-serif text-[clamp(3.25rem,9vw,8.5rem)] leading-[0.85] tracking-tight dark:text-paper">₹2.5<span className="text-[0.45em]"> lakh</span></p>
        </div>
        <span aria-label="does not match" className="pb-2 font-serif text-[clamp(2.5rem,6vw,5.5rem)] leading-none text-signal">≠</span>
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-ink-2 dark:text-paper/50">S2 · EduNews Daily, explainer</p>
          <p className="mt-1 whitespace-nowrap font-serif text-[clamp(3.25rem,9vw,8.5rem)] leading-[0.85] tracking-tight dark:text-paper">₹3<span className="text-[0.45em]"> lakh</span></p>
        </div>
      </div>
      <div className="mt-6 grid gap-6 border-t border-ink/20 dark:border-paper/10 pt-4 sm:grid-cols-2">
        <blockquote className="font-serif text-lg leading-snug dark:text-paper/90">"The annual family income of the applicant must not exceed ₹2.5 lakh from all sources."</blockquote>
        <blockquote className="font-serif text-lg leading-snug dark:text-paper/90">"According to our reporters, the family income limit is ₹3 lakh per year."</blockquote>
      </div>
      <p className="mt-4 max-w-xl text-sm text-ink-2 dark:text-paper/50">
        Same field, same unit, same academic year — so it is flagged. Scout does not decide which figure is right; it
        tells you to confirm it against the board's current notice before applying.
      </p>
    </figure>
  );
}

export function LandingPage({ health, healthError }: { health: HealthInfo | null; healthError: string | null }) {
  const { t } = useLang();
  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-9 lg:col-span-7">
        {/* Hero */}
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-signal animate-fade-in">
          {t.heroLabel}
        </p>
        <h1 className="mt-4 font-sans text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold leading-[1.02] tracking-tight text-slate-900 dark:text-white animate-fade-in [animation-delay:0.05s]">
          {t.heroH1Part1}{" "}
          <span className="relative inline-block whitespace-nowrap italic">{t.heroH1Italic}<PenUnderline /></span>
        </h1>
        <p className="mt-6 max-w-[34rem] text-base leading-7 text-slate-600 dark:text-slate-300 animate-fade-in [animation-delay:0.1s]">
          {t.heroLead}
        </p>

        {/* Hero CTA — two demo buttons prominently at the top */}
        <div className="mt-8 flex flex-wrap gap-3 animate-fade-in [animation-delay:0.15s]">
          <a
            href="#research-form"
            className="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            Get started
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </a>
          <a
            href="#demo-section"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Try demo
          </a>
        </div>

        <Specimen />

        <section aria-label="What the report contains" className="mt-14 animate-fade-in [animation-delay:0.2s]">
          <h2 className="border-b border-ink dark:border-paper/20 pb-2 font-mono text-[11px] uppercase tracking-[0.14em] dark:text-paper/50">
            {t.inEveryReport}
          </h2>
          <ol className="grid sm:grid-cols-2">
            {INDEX_KEYS.map(({ key, textKey }, i) => (
              <li key={key} className="grid grid-cols-[2.5rem_1fr] gap-2 border-b border-ink/15 dark:border-paper/10 py-4 sm:odd:pr-6 sm:even:border-l sm:even:pl-6">
                <span className="font-mono text-xs text-signal">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <p className="font-serif text-xl leading-tight dark:text-paper">{t[key]}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2 dark:text-paper/50">{t[textKey]}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <aside id="research-form" className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8 lg:col-span-5">
        <div className="lg:sticky lg:top-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-4 dark:border-slate-700">
            <h2 className="font-sans text-2xl font-bold text-slate-900 dark:text-white">{t.newResearch}</h2>
            {health ? (
              <span className="font-mono text-[11px] text-ink-2 dark:text-paper/40">
                {health.llm.configured ? `Grok ${health.llm.model}` : <span className="text-amber-800 dark:text-amber-400">heuristic — no Grok key</span>}
                {" · "}
                {health.search.configured ? `search: ${health.search.provider}` : <span className="text-amber-800 dark:text-amber-400">no web search</span>}
              </span>
            ) : healthError ? (
              <span className="font-mono text-[11px] text-signal">Backend unreachable: {healthError}</span>
            ) : <span className="font-mono text-[11px] text-ink-3 dark:text-paper/30">Checking backend…</span>}
          </div>
          <div className="mt-6"><ResearchForm health={health} /></div>
          <p className="mt-8 border-t border-ink/20 dark:border-paper/10 pt-3 text-xs leading-relaxed text-ink-3 dark:text-paper/30">
            {t.disclaimerFooter}
          </p>
        </div>
      </aside>
    </div>
  );
}
