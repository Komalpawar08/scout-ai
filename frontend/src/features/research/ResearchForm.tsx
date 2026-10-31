import { ArrowRight, Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { cx } from "../../components/ui";
import { useLang } from "../../context/LangContext";
import { useResearch } from "../../context/ResearchContext";
import type { Domain, HealthInfo, ResearchInput } from "../../types/research";

const DOMAINS: { id: Domain; label: string; blurb: string; question: string }[] = [
  {
    id: "news", label: "News event",
    blurb: "Dates, casualty figures, official responses and later developments, compared across publishers.",
    question: "What are the key verified details, conflicting claims and missing context about this event?",
  },
  {
    id: "scholarship", label: "Scholarship",
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
      topic: topic.trim(), research_question: question.trim(), domain, user_urls: allUrls,
      automatic_search: useSearch, max_sources: maxSources,
    };
    void start(input, files);
  }

  function runDemo(d: Domain) {
    const input: ResearchInput = d === "scholarship"
      ? { topic: "Aarohan State Merit Scholarship (fictional demo)", research_question: DOMAINS[1].question, domain: d,
          user_urls: [], automatic_search: false, max_sources: 3, demo_scenario: d }
      : { topic: "Kalinagar bridge collapse (fictional demo)", research_question: DOMAINS[0].question, domain: d,
          user_urls: [], automatic_search: false, max_sources: 3, demo_scenario: d };
    void start(input, []);
  }

  return (
    <form onSubmit={submit} className="space-y-6" aria-label="Research input">
      <fieldset>
        <legend className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2 dark:text-paper/50">{t.desk}</legend>
        <div className="mt-2 grid grid-cols-2 border border-ink dark:border-paper/30">
          {DOMAINS.map(({ id, label, blurb }) => (
            <button key={id} type="button" onClick={() => chooseDomain(id)} aria-pressed={domain === id}
              className={cx(
                "p-3 text-left transition first:border-r first:border-ink dark:first:border-paper/30",
                domain === id
                  ? "bg-ink dark:bg-paper text-paper dark:text-ink"
                  : "hover:bg-ink/[0.04] dark:hover:bg-paper/[0.04] dark:text-paper"
              )}>
              <span className="block font-serif text-2xl leading-none">{label}</span>
              <span className={cx("mt-2 block text-xs leading-snug", domain === id ? "text-paper/75 dark:text-ink/75" : "text-ink-2 dark:text-paper/50")}>
                {blurb}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5">
        <label className="block">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2 dark:text-paper/50">{t.researchTopic}</span>
          <input
            value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={300}
            placeholder={domain === "news" ? "e.g. Mumbai coastal road tunnel leak" : "e.g. Post-Matric Scholarship for SC students Maharashtra"}
            className="mt-1 w-full border-0 border-b border-ink/40 dark:border-paper/30 bg-transparent px-0 py-2 text-[15px] text-ink dark:text-paper outline-none placeholder:text-ink-3 dark:placeholder:text-paper/30 focus:border-signal focus:ring-0"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2 dark:text-paper/50">{t.researchQuestion}</span>
          <textarea
            value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} maxLength={600}
            className="mt-1 resize-none w-full border-0 border-b border-ink/40 dark:border-paper/30 bg-transparent px-0 py-2 text-[15px] text-ink dark:text-paper outline-none placeholder:text-ink-3 dark:placeholder:text-paper/30 focus:border-signal focus:ring-0"
          />
        </label>

        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2 dark:text-paper/50">{t.sourceUrls}</span>
          <div className="mt-1 flex items-end gap-2">
            <div className="flex-1">
              <input
                value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (urlDraft.trim()) addUrls(urlDraft); } }}
                placeholder={t.urlPlaceholder} aria-label="Source URL"
                className="w-full border-0 border-b border-ink/40 dark:border-paper/30 bg-transparent px-0 py-2 text-[15px] text-ink dark:text-paper outline-none placeholder:text-ink-3 dark:placeholder:text-paper/30 focus:border-signal focus:ring-0"
              />
            </div>
            <button
              type="button" onClick={() => urlDraft.trim() && addUrls(urlDraft)}
              className="border border-ink dark:border-paper/30 px-2 py-1.5 text-ink dark:text-paper hover:bg-ink hover:text-paper dark:hover:bg-paper/10 transition-colors"
              aria-label="Add URL"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {urls.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {urls.map((u) => (
                <li key={u} className="flex max-w-full items-center gap-1 border border-ink/25 dark:border-paper/20 px-2 py-0.5 font-mono text-[11px] text-ink dark:text-paper">
                  <span className="truncate">{u}</span>
                  <button type="button" onClick={() => setUrls((x) => x.filter((y) => y !== u))} aria-label={`Remove ${u}`}>
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2 dark:text-paper/50">{t.pdfDocuments}</span>
          <label className="mt-2 flex cursor-pointer items-baseline justify-between gap-3 border border-dashed border-ink/40 dark:border-paper/30 px-3 py-3 text-sm text-ink-2 dark:text-paper/50 hover:border-signal transition-colors">
            <span>{t.addPdfText} <span className="text-ink dark:text-paper underline decoration-signal underline-offset-2">{t.choosePdf}</span></span>
            <span className="shrink-0 font-mono text-[11px] text-ink-3 dark:text-paper/30">≤ {maxPdfMb} MB · in memory</span>
            <input type="file" accept="application/pdf,.pdf" multiple className="sr-only" aria-label="Upload PDF"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
          {files.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-1 border border-ink/25 dark:border-paper/20 px-2 py-0.5 font-mono text-[11px] text-ink dark:text-paper">
                  {f.name} ({(f.size / 1024).toFixed(0)} KB)
                  <button type="button" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}>
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <label className={cx("flex items-center gap-2 text-sm text-ink dark:text-paper", !searchAvailable && "opacity-60")}>
            <input
              type="checkbox" checked={autoSearch && searchAvailable} disabled={!searchAvailable}
              onChange={(e) => setAutoSearch(e.target.checked)} className="h-4 w-4 accent-signal"
            />
            {t.automaticWebSearch}
            {!searchAvailable && <span className="text-xs text-amber-800 dark:text-amber-400">{t.noSearchProvider}</span>}
          </label>
          <label className="flex items-center gap-2 text-sm text-ink dark:text-paper">
            {t.maxSources}
            <input
              type="range" min={1} max={health?.limits.max_sources ?? 10} value={maxSources}
              onChange={(e) => setMaxSources(Number(e.target.value))} className="accent-signal" aria-label="Maximum sources"
            />
            <span className="w-6 text-center font-mono">{maxSources}</span>
          </label>
        </div>
      </div>

      {formError && (
        <p role="alert" className="border-l-2 border-signal bg-signal/[0.06] px-3 py-2 text-sm text-signal-dark">
          {formError}
        </p>
      )}

      <button type="submit" className="group flex w-full items-center justify-between bg-ink dark:bg-paper px-4 py-3.5 text-left text-paper dark:text-ink hover:bg-signal dark:hover:bg-signal dark:hover:text-paper transition-colors">
        <span className="font-serif text-2xl leading-none">{t.startResearch}</span>
        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
      </button>

      {/* Demo section — anchor target */}
      <div id="demo-section" className="border-t border-ink/20 dark:border-paper/10 pt-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3 dark:text-paper/30">{t.demoIntro}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <button
            type="button" onClick={() => runDemo("scholarship")}
            className="border border-ink/40 dark:border-paper/20 px-3 py-2 text-left text-sm hover:border-ink dark:hover:border-paper hover:bg-ink/[0.04] dark:hover:bg-paper/[0.04] transition-colors"
          >
            <span className="font-mono text-[11px] text-signal">{t.demoA}</span>
            <span className="block text-ink-2 dark:text-paper/50">{t.demoAText}</span>
          </button>
          <button
            type="button" onClick={() => runDemo("news")}
            className="border border-ink/40 dark:border-paper/20 px-3 py-2 text-left text-sm hover:border-ink dark:hover:border-paper hover:bg-ink/[0.04] dark:hover:bg-paper/[0.04] transition-colors"
          >
            <span className="font-mono text-[11px] text-signal">{t.demoB}</span>
            <span className="block text-ink-2 dark:text-paper/50">{t.demoBText}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
