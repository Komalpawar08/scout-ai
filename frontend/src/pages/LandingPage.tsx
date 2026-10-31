import { ArrowRight, Sparkles, CheckCircle2, ShieldAlert, Layers, Compass, FileCheck, Network, Zap } from "lucide-react";
import { useLang } from "../context/LangContext";
import { ResearchForm } from "../features/research/ResearchForm";
import type { HealthInfo } from "../types/research";

const INDEX_KEYS = [
  { key: "coverageMatrix" as const, textKey: "coverageMatrixText" as const, icon: Layers },
  { key: "possibleConflicts" as const, textKey: "possibleConflictsText" as const, icon: ShieldAlert },
  { key: "freshness" as const, textKey: "freshnessText" as const, icon: Zap },
  { key: "evidenceConfidence" as const, textKey: "evidenceConfidenceText" as const, icon: CheckCircle2 },
  { key: "claimGraph" as const, textKey: "claimGraphText" as const, icon: Network },
  { key: "verificationChecklist" as const, textKey: "verificationChecklistText" as const, icon: FileCheck },
];

/** Modern high-tech specimen preview showing conflict detection */
function Specimen() {
  const { t } = useLang();
  return (
    <figure className="mt-10 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-5 sm:p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-3 dark:border-slate-800/70 font-mono text-[11px] uppercase tracking-wider">
        <span className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-cyan-400">
          <span className="h-2 w-2 rounded-full bg-cyan-500 animate-ping" />
          Evidence Specimen · Conflict Detection Engine
        </span>
        <span className="rounded bg-slate-200/70 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          From Demo A · Fictional Sources
        </span>
      </figcaption>

      {/* Discrepancy Display */}
      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 sm:gap-x-6 text-center sm:text-left">
        <div className="rounded-xl border border-blue-500/20 bg-blue-50/50 p-4 dark:border-blue-500/20 dark:bg-blue-950/30">
          <p className="font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400">
            S1 · Scholarship Board Notice
          </p>
          <p className="mt-1 font-mono text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            ₹2.5<span className="text-sm font-semibold text-blue-600 dark:text-blue-400"> lakh</span>
          </p>
        </div>

        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 font-mono text-2xl font-bold shadow-inner">
          ≠
        </div>

        <div className="rounded-xl border border-indigo-500/20 bg-indigo-50/50 p-4 dark:border-indigo-950/30">
          <p className="font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400">
            S2 · EduNews Daily Explainer
          </p>
          <p className="mt-1 font-mono text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            ₹3<span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400"> lakh</span>
          </p>
        </div>
      </div>

      {/* Verbatim quotes */}
      <div className="mt-5 grid gap-4 border-t border-slate-200/70 pt-4 dark:border-slate-800/70 sm:grid-cols-2 text-left">
        <blockquote className="rounded-lg border-l-2 border-blue-500 bg-white/70 p-3 text-xs sm:text-sm italic leading-relaxed text-slate-700 shadow-sm dark:bg-slate-800/50 dark:text-slate-300">
          "The annual family income of the applicant must not exceed ₹2.5 lakh from all sources."
        </blockquote>
        <blockquote className="rounded-lg border-l-2 border-indigo-500 bg-white/70 p-3 text-xs sm:text-sm italic leading-relaxed text-slate-700 shadow-sm dark:bg-slate-800/50 dark:text-slate-300">
          "According to our reporters, the family income limit is ₹3 lakh per year."
        </blockquote>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {t.specimenNote}
      </p>
    </figure>
  );
}

export function LandingPage({ health, healthError }: { health: HealthInfo | null; healthError: string | null }) {
  const { t } = useLang();

  return (
    <div className="grid gap-8 lg:grid-cols-12 items-start">
      {/* Left Column: Hero & Product Presentation */}
      <div className="min-w-0 rounded-3xl border border-slate-200/80 bg-white/80 p-6 sm:p-10 shadow-card backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/80 dark:shadow-card-dark lg:col-span-7">
        {/* Category Pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-3.5 py-1 text-xs font-semibold text-blue-600 dark:text-cyan-400 animate-fade-in">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{t.heroLabel}</span>
        </div>

        {/* Hero Title */}
        <h1 className="mt-5 text-[clamp(2.4rem,5vw,4.25rem)] font-extrabold leading-[1.05] tracking-tight text-slate-900 dark:text-white animate-fade-in [animation-delay:0.05s]">
          {t.heroH1Part1}{" "}
          <span className="text-gradient underline decoration-blue-500/30 decoration-wavy underline-offset-8">
            {t.heroH1Italic}
          </span>
        </h1>

        {/* Hero Lead */}
        <p className="mt-5 max-w-[36rem] text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300 animate-fade-in [animation-delay:0.1s]">
          {t.heroLead}
        </p>

        {/* Hero Quick CTA */}
        <div className="mt-8 flex flex-wrap items-center gap-3 animate-fade-in [animation-delay:0.15s]">
          <a
            href="#research-form"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 px-6 py-3.5 font-semibold text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <span>{t.getStarted}</span>
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#demo-section"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80 transition-all"
          >
            <Compass className="h-4 w-4 text-cyan-500" />
            <span>{t.tryDemo}</span>
          </a>
        </div>

        {/* Specimen Card */}
        <Specimen />

        {/* 6 Features Index */}
        <section aria-label="What the report contains" className="mt-14 animate-fade-in [animation-delay:0.2s]">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-slate-800/80">
            <h2 className="font-mono text-[12px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {t.inEveryReport}
            </h2>
            <span className="font-mono text-xs text-blue-600 dark:text-cyan-400">6 Analysis Modules</span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {INDEX_KEYS.map(({ key, textKey, icon: Icon }, i) => (
              <div
                key={key}
                className="group relative rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 transition-all hover:border-blue-500/40 hover:bg-white hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900/40 dark:hover:border-blue-500/40 dark:hover:bg-slate-800/60"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-cyan-500/10 dark:text-cyan-400 group-hover:scale-110 transition-transform">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-400 group-hover:text-blue-500 transition-colors">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                  {t[key]}
                </h3>
                <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {t[textKey]}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Right Column: Research Input Form (Sticky) */}
      <aside
        id="research-form"
        className="min-w-0 rounded-3xl border border-slate-200/80 bg-white/90 p-6 sm:p-8 shadow-card backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/90 dark:shadow-card-dark lg:col-span-5 lg:sticky lg:top-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
            {t.newResearch}
          </h2>

          {health ? (
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {health.llm.configured ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Grok {health.llm.model}</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">heuristic mode</span>
              )}
              {" · "}
              {health.search.configured ? (
                <span className="text-blue-600 dark:text-cyan-400">{health.search.provider}</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">offline</span>
              )}
            </span>
          ) : healthError ? (
            <span className="font-mono text-[11px] text-rose-500">Backend offline</span>
          ) : (
            <span className="font-mono text-[11px] text-slate-400 animate-pulse">Checking status…</span>
          )}
        </div>

        <div className="mt-6">
          <ResearchForm health={health} />
        </div>

        <p className="mt-6 border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-400 dark:border-slate-800 dark:text-slate-500">
          {t.disclaimerFooter}
        </p>
      </aside>
    </div>
  );
}
