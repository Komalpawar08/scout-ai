import { Moon, Sun, Languages } from "lucide-react";
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
    <div className="flex items-center gap-1">
      <button
        onClick={toggleLang}
        title={lang === "en" ? "Switch to Hindi" : "अंग्रेज़ी में बदलें"}
        aria-label={lang === "en" ? "Switch to Hindi" : "Switch to English"}
        className="flex items-center gap-1 rounded px-2 py-1 font-mono text-[11px] text-ink-2 dark:text-paper/60 hover:text-ink dark:hover:text-paper hover:bg-ink/[0.06] dark:hover:bg-paper/[0.06] transition-colors"
      >
        <Languages className="h-3.5 w-3.5" />
        {lang === "en" ? "हिं" : "EN"}
      </button>
      <button
        onClick={toggleTheme}
        title={dark ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        className="rounded p-1.5 text-ink-2 dark:text-paper/60 hover:text-ink dark:hover:text-paper hover:bg-ink/[0.06] dark:hover:bg-paper/[0.06] transition-colors"
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Shell() {
  const { phase, reset, evidencePanelItem, closeEvidencePanel } = useResearch();
  const { health, error } = useHealth();
  const { t } = useLang();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="mx-auto max-w-[1440px] px-4 pb-16 sm:px-8">
        <header className="mb-10 pt-5">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-xs text-slate-500 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
            <span>{EDITION}</span>
            <span className="hidden sm:block">News &amp; scholarship desk</span>
            <div className="flex items-center gap-3">
              <span className="hidden md:block">
                {health ? (health.llm.configured ? `Grok · ${health.llm.model}` : "Heuristic mode") : error ? "Backend offline" : "…"}
              </span>
              <ThemeLangToggles />
            </div>
          </div>
          <div className="flex items-center justify-between gap-6 py-6">
            <button onClick={reset} aria-label="Scout AI home" className="text-left group">
              <span className="block text-3xl font-bold leading-none tracking-tight text-slate-900 dark:text-white sm:text-4xl transition-opacity group-hover:opacity-80">
                TruthLens<span className="text-blue-600">.</span>
              </span>
            </button>
            <p className="hidden max-w-xs text-right text-sm leading-snug text-slate-500 dark:text-slate-400 md:block">
              {t.appTagline}
            </p>
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
