import { ArrowRight, Plus, X, UploadCloud, Newspaper, GraduationCap, Sparkles, Zap, Globe, Sliders } from "lucide-react";
import { useState, type FormEvent } from "react";
import { cx } from "../../components/ui";
import { useLang } from "../../context/LangContext";
import { useResearch } from "../../context/ResearchContext";
import type { Domain, HealthInfo, ResearchInput } from "../../types/research";

const DOMAINS: { id: Domain; label: string; blurb: string; question: string }[] = [
  {
    id: "news",
    label: "News event",
    blurb: "Dates, casualty figures, official responses and later developments, compared across publishers.",
    question: "What are the key verified details, conflicting claims and missing context about this event?",
  },
  {
    id: "scholarship",
    label: "Scholarship",
    blurb: "Eligibility, marks, income limit, documents, deadline, academic cycle and renewal rules.",
    question: "What should a student verify before applying for this scholarship?",
  },
];

const URL_RE = /^https?:\/\/[^\s]+$/i;

export function ResearchForm({ health }: { health: HealthInfo | null }) {
  const { start } = useResearch();
  const { t } = useLang();
  const [domain, setDomain] = useState<Domain>("scholarship");
  const [topic, setTopic] = useState("");
  const [question, setQuestion] = useState(DOMAINS[1].question);
  const [urlDraft, setUrlDraft] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [autoSearch, setAutoSearch] = useState(true);
  const [maxSources, setMaxSources] = useState(6);
  const [formError, setFormError] = useState<string | null>(null);

  const maxPdfMb = health?.limits.max_pdf_size_mb ?? 15;
  const searchAvailable = health?.search.configured ?? false;

  function chooseDomain(d: Domain) {
    const prev = DOMAINS.find((x) => x.id === domain)!;
    setDomain(d);
    if (!question || question === prev.question) setQuestion(DOMAINS.find((x) => x.id === d)!.question);
  }

  function addUrls(raw: string) {
    const parts = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    const bad = parts.filter((p) => !URL_RE.test(p));
    if (bad.length) {
      setFormError(`Not a valid http(s) URL: ${bad.join(", ")}`);
      return;
    }
    setFormError(null);
    setUrls((u) => Array.from(new Set([...u, ...parts])).slice(0, 15));
    setUrlDraft("");
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: File[] = [];
    for (const f of Array.from(list)) {
      if (!f.name.toLowerCase().endsWith(".pdf") || (f.type && f.type !== "application/pdf")) {
        setFormError(`${f.name} is not a PDF`);
        return;
      }
      if (f.size > maxPdfMb * 1024 * 1024) {
        setFormError(`${f.name} exceeds the ${maxPdfMb} MB limit`);
        return;
      }
      next.push(f);
    }
    setFormError(null);
    setFiles((cur) => [...cur, ...next].slice(0, health?.limits.max_pdf_files ?? 5));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const pending = urlDraft.trim() ? urlDraft.split(/[\s,]+/).filter(Boolean) : [];
    if (pending.some((p) => !URL_RE.test(p))) {
      setFormError("Please fix the URL field before starting.");
      return;
    }
    const allUrls = Array.from(new Set([...urls, ...pending]));
    if (topic.trim().length < 3) {
      setFormError("Enter a research topic (at least 3 characters).");
      return;
    }
    const useSearch = autoSearch && searchAvailable;
    if (!allUrls.length && !files.length && !useSearch) {
      setFormError("Add at least one URL or PDF, or enable automatic web search (requires a configured search provider).");
      return;
    }
    setFormError(null);
    const input: ResearchInput = {
      topic: topic.trim(),
      research_question: question.trim(),
      domain,
      user_urls: allUrls,
      automatic_search: useSearch,
      max_sources: maxSources,
    };
    void start(input, files);
  }

  function runDemo(d: Domain) {
    const input: ResearchInput = d === "scholarship"
      ? {
          topic: "Aarohan State Merit Scholarship (fictional demo)",
          research_question: DOMAINS[1].question,
          domain: d,
          user_urls: [],
          automatic_search: false,
          max_sources: 3,
          demo_scenario: d,
        }
      : {
          topic: "Kalinagar bridge collapse (fictional demo)",
          research_question: DOMAINS[0].question,
          domain: d,
          user_urls: [],
          automatic_search: false,
          max_sources: 3,
          demo_scenario: d,
        };
    void start(input, []);
  }

  return (
    <form onSubmit={submit} className="space-y-6" aria-label="Research input">
      {/* Domain Switcher */}
      <fieldset>
        <legend className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t.desk}
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-100/70 p-1.5 dark:border-slate-800 dark:bg-slate-950/60">
          {DOMAINS.map(({ id, label, blurb }) => {
            const isSelected = domain === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => chooseDomain(id)}
                aria-pressed={isSelected}
                className={cx(
                  "rounded-xl p-3 text-left transition-all",
                  isSelected
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white ring-1 ring-blue-500/30"
                    : "text-slate-600 hover:bg-white/50 dark:text-slate-400 dark:hover:bg-slate-900/50"
                )}
              >
                <div className="flex items-center gap-2">
                  {id === "news" ? (
                    <Newspaper className={cx("h-4 w-4", isSelected ? "text-blue-600 dark:text-cyan-400" : "text-slate-400")} />
                  ) : (
                    <GraduationCap className={cx("h-4 w-4", isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400")} />
                  )}
                  <span className="font-bold text-sm leading-tight">{label}</span>
                </div>
                <span className="mt-1.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400 line-clamp-2">
                  {blurb}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-4">
        {/* Topic Input */}
        <div>
          <label className="block">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.researchTopic}
            </span>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={300}
              placeholder={domain === "news" ? "e.g. Mumbai coastal road tunnel leak" : "e.g. Post-Matric Scholarship for SC students Maharashtra"}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-white dark:focus:border-cyan-400 dark:focus:bg-slate-800"
            />
          </label>
        </div>

        {/* Question Input */}
        <div>
          <label className="block">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.researchQuestion}
            </span>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              maxLength={600}
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-white dark:focus:border-cyan-400 dark:focus:bg-slate-800"
            />
          </label>
        </div>

        {/* URL Inputs */}
        <div>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t.sourceUrls}
          </span>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (urlDraft.trim()) addUrls(urlDraft);
                }
              }}
              placeholder={t.urlPlaceholder}
              aria-label="Source URL"
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-white dark:focus:border-cyan-400 dark:focus:bg-slate-800"
            />
            <button
              type="button"
              onClick={() => urlDraft.trim() && addUrls(urlDraft)}
              aria-label="Add URL"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {urls.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {urls.map((u) => (
                <li
                  key={u}
                  className="flex max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100/80 px-2.5 py-1 font-mono text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <span className="truncate">{u}</span>
                  <button
                    type="button"
                    onClick={() => setUrls((x) => x.filter((y) => y !== u))}
                    aria-label={`Remove ${u}`}
                    className="text-slate-400 hover:text-rose-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* PDF Uploads */}
        <div>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t.pdfDocuments}
          </span>
          <label className="mt-1.5 flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-3 text-xs text-slate-600 hover:border-blue-500 hover:bg-blue-50/30 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400 dark:hover:border-cyan-400 transition-all">
            <div className="flex items-center gap-2">
              <UploadCloud className="h-4 w-4 text-blue-500" />
              <span>
                {t.addPdfText}{" "}
                <span className="font-semibold text-blue-600 dark:text-cyan-400 underline decoration-blue-500/30">
                  {t.choosePdf}
                </span>
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-400">≤ {maxPdfMb} MB</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="sr-only"
              aria-label="Upload PDF"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          {files.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100/80 px-2.5 py-1 font-mono text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <span className="truncate">{f.name} ({(f.size / 1024).toFixed(0)} KB)</span>
                  <button
                    type="button"
                    onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}
                    aria-label={`Remove ${f.name}`}
                    className="text-slate-400 hover:text-rose-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Runtime toggles */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <label className={cx("flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer", !searchAvailable && "opacity-60")}>
            <input
              type="checkbox"
              checked={autoSearch && searchAvailable}
              disabled={!searchAvailable}
              onChange={(e) => setAutoSearch(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600 accent-blue-600"
            />
            <Globe className="h-3.5 w-3.5 text-blue-500" />
            <span>{t.automaticWebSearch}</span>
            {!searchAvailable && <span className="text-[10px] text-amber-600">{t.noSearchProvider}</span>}
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
            <Sliders className="h-3.5 w-3.5 text-indigo-500" />
            <span>{t.maxSources}</span>
            <input
              type="range"
              min={1}
              max={health?.limits.max_sources ?? 10}
              value={maxSources}
              onChange={(e) => setMaxSources(Number(e.target.value))}
              className="w-16 accent-blue-600"
              aria-label="Maximum sources"
            />
            <span className="w-5 text-right font-mono font-bold text-blue-600 dark:text-cyan-400">{maxSources}</span>
          </label>
        </div>
      </div>

      {formError && (
        <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-medium text-rose-600 dark:text-rose-400 animate-fade-in">
          {formError}
        </div>
      )}

      {/* Main Submit Button */}
      <button
        type="submit"
        className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 p-3.5 text-center font-bold text-white shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 hover:scale-[1.01] active:scale-[0.99] transition-all"
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-base">{t.startResearch}</span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </button>

      {/* Demo Quick Launch Section */}
      <div id="demo-section" className="border-t border-slate-200/80 pt-4 dark:border-slate-800/80">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t.demoIntro}
          </p>
          <span className="flex items-center gap-1 font-mono text-[10px] text-cyan-600 dark:text-cyan-400">
            <Zap className="h-3 w-3" /> 1-Click
          </span>
        </div>

        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => runDemo("scholarship")}
            className="group relative rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-blue-500/50 hover:bg-blue-50/20 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-blue-500/50 dark:hover:bg-slate-800 transition-all"
          >
            <div className="flex items-center gap-1.5 font-bold text-xs text-blue-600 dark:text-cyan-400">
              <GraduationCap className="h-3.5 w-3.5" />
              <span>{t.demoA}</span>
            </div>
            <span className="mt-1 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              {t.demoAText}
            </span>
          </button>

          <button
            type="button"
            onClick={() => runDemo("news")}
            className="group relative rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-indigo-500/50 hover:bg-indigo-50/20 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-indigo-500/50 dark:hover:bg-slate-800 transition-all"
          >
            <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-600 dark:text-indigo-400">
              <Newspaper className="h-3.5 w-3.5" />
              <span>{t.demoB}</span>
            </div>
            <span className="mt-1 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              {t.demoBText}
            </span>
          </button>
        </div>
      </div>
    </form>
  );
}
