import { Moon, Sun, Languages, Compass, ShieldCheck } from "lucide-react";
import { LangProvider, useLang } from "./context/LangContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { ResearchProvider, useResearch } from "./context/ResearchContext";
import { EvidencePanel } from "./features/evidence/EvidencePanel";
import { ResearchProgress } from "./features/research/ResearchProgress";
import { useHealth } from "./hooks/useHealth";
import { DashboardPage } from "./pages/DashboardPage";
import { LandingPage } from "./pages/LandingPage";

const EDITION = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

function ThemeLangToggles() {
  const { dark, toggle: toggleTheme } = useTheme();
  const { lang, toggle: toggleLang } = useLang();
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-100/80 p-1 dark:border-slate-800/80 dark:bg-slate-800/60 shadow-inner">
      <button
        onClick={toggleLang}
        title={lang === "en" ? "Switch to Hindi" : "अंग्रेज़ी में बदलें"}
        aria-label={lang === "en" ? "Switch to Hindi" : "Switch to English"}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/80 shadow-sm transition-all"
      >
        <Languages className="h-3.5 w-3.5 text-blue-500" />
        <span>{lang === "en" ? "हिन्दी" : "EN"}</span>
      </button>
      <button
        onClick={toggleTheme}
        title={dark ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        className="rounded-full p-1.5 text-slate-600 dark:text-slate-300 hover:text-amber-500 dark:hover:text-yellow-400 hover:bg-white dark:hover:bg-slate-700/80 shadow-sm transition-all"
      >
        {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function Shell() {
  const { phase, reset, evidencePanelItem, closeEvidencePanel } = useResearch();
  const { health, error } = useHealth();
  const { t } = useLang();

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 transition-colors duration-300 overflow-x-hidden">
      {/* Background Ambient Glows & Tech Grid */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-40 dark:opacity-30 bg-grid-light dark:bg-grid-dark" />
      <div className="pointer-events-none fixed -top-40 -left-40 h-96 w-96 rounded-full bg-cyan-400/15 dark:bg-cyan-500/10 blur-[100px]" />
      <div className="pointer-events-none fixed top-1/4 -right-40 h-[30rem] w-[30rem] rounded-full bg-blue-600/15 dark:bg-indigo-600/10 blur-[120px]" />
      <div className="pointer-events-none fixed -bottom-40 left-1/3 h-96 w-96 rounded-full bg-violet-600/10 dark:bg-violet-500/10 blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-[1480px] px-4 pb-20 sm:px-8">
        <header className="mb-10 pt-5">
          {/* Top Status Bar */}
          <div className="glass-header flex items-center justify-between gap-4 rounded-2xl px-4 py-2.5 text-xs text-slate-500 shadow-sm dark:text-slate-400">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] font-medium tracking-wide text-slate-700 dark:text-slate-300">{EDITION}</span>
              <span className="hidden sm:inline-block h-3.5 w-px bg-slate-200 dark:bg-slate-800" />
              <span className="hidden sm:flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-400">
                <Compass className="h-3.5 w-3.5 text-blue-500" />
                Evidence &amp; Gap Intelligence Desk
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 font-mono text-[11px]">
                {health ? (
                  health.llm.configured ? (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      xAI Grok {health.llm.model}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Heuristic Engine
                    </span>
                  )
                ) : error ? (
                  <span className="text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">Backend Offline</span>
                ) : (
                  <span className="text-slate-400 animate-pulse">Connecting...</span>
                )}
              </div>
              <ThemeLangToggles />
            </div>
          </div>

          {/* Main Brand Logo & Tagline */}
          <div className="flex items-center justify-between gap-6 py-6 sm:py-8 border-b border-slate-200/80 dark:border-slate-800/80">
            <button onClick={reset} aria-label="Scout AI home" className="group flex items-center gap-3.5 text-left transition-all">
              <div className="relative flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 p-0.5 shadow-lg shadow-blue-500/25 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-blue-500/35">
                <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950/90 backdrop-blur-sm">
                  {/* Scout Radar Compass Icon */}
                  <svg className="h-7 w-7 text-cyan-400 transition-transform duration-500 group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" className="stroke-cyan-400/30" />
                    <circle cx="12" cy="12" r="5" className="stroke-cyan-400/70" strokeDasharray="2 2" />
                    <circle cx="12" cy="12" r="2" className="fill-cyan-400 stroke-none" />
                    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" className="stroke-cyan-400" />
                    <path d="M12 12l4-4" className="stroke-sky-300" strokeWidth="2.5" />
                  </svg>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Scout<span className="text-gradient">Ai</span>
                  </span>
                  <span className="rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-white shadow-sm uppercase">
                    PRO
                  </span>
                </div>
                <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
                  Autonomous Verification &amp; Gap Intelligence
                </p>
              </div>
            </button>

            <div className="hidden max-w-sm text-right md:block">
              <p data-testid="app-tagline" className="text-sm font-medium leading-snug text-slate-600 dark:text-slate-300">
                {t.appTagline}
              </p>
              <div className="mt-1 flex items-center justify-end gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Deterministic &amp; Verifiable Quotes</span>
              </div>
            </div>
          </div>
        </header>

        {phase === "idle" && <LandingPage health={health} healthError={error} />}
        {(phase === "running" || phase === "error") && <ResearchProgress />}
        {phase === "done" && <DashboardPage />}
      </div>

      {/* Evidence side panel — rendered at app level so it overlays everything */}
      <EvidencePanel item={evidencePanelItem} onClose={closeEvidencePanel} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <ResearchProvider>
          <Shell />
        </ResearchProvider>
      </LangProvider>
    </ThemeProvider>
  );
}
