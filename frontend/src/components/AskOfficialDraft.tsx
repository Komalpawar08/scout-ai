/**
 * AskOfficialDraft — generates a ready-to-send question for Critical/High
 * gaps or conflicts. Labelled "AI-suggested, verify" as required.
 * Follows the selected language (en / hi).
 */
import { Check, Copy, Mail } from "lucide-react";
import { useState } from "react";
import { useLang } from "../context/LangContext";
import type { Conflict, InformationGap, Priority } from "../types/research";

interface GapDraftProps {
  gap: InformationGap;
  topic: string;
}

interface ConflictDraftProps {
  conflict: Conflict;
  topic: string;
}

const HIGH_PRIORITIES: Priority[] = ["critical", "high"];

function CopyButton({ text }: { text: string }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      title={t.copyDraft}
      className="flex items-center gap-1.5 rounded border border-ink/20 dark:border-paper/20 px-2.5 py-1 font-mono text-[11px] text-ink-2 dark:text-paper/60 hover:border-signal hover:text-signal transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      {copied ? t.copied : t.copyDraft}
    </button>
  );
}

export function GapAskDraft({ gap, topic }: GapDraftProps) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  if (!HIGH_PRIORITIES.includes(gap.priority)) return null;

  const subject = t.gapSubject(gap.field_label, topic);
  const intro = t.gapIntro(topic);
  const req = t.gapRequest(gap.field_label, gap.recommended_verification);
  const draft = `${subject}\n\n${intro}\n\n• ${t.gapFieldLabel}: ${gap.field_label}\n• ${t.gapWhatFound}: ${gap.explanation}\n• ${t.gapWhyMatters}: ${gap.why_it_matters}\n\n${req}\n\n${t.gapSignoff}`;

  return (
    <div className="mt-3 rounded-md border border-amber-600/30 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-500/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs"
      >
        <Mail className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
        <span className="font-medium text-amber-900 dark:text-amber-300">{t.askOfficialTitle}</span>
        <span className="ml-auto rounded border border-amber-600/30 px-1.5 py-px font-mono text-[10px] text-amber-700 dark:text-amber-400">
          {t.askOfficialDraftLabel}
        </span>
        <span className="text-amber-600 dark:text-amber-500">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-amber-600/20 dark:border-amber-500/15 px-3 py-3">
          <p className="mb-2 text-[11px] text-amber-800 dark:text-amber-400">{t.draftPreamble}</p>
          <pre
            data-testid="gap-draft-text"
            className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-white/60 dark:bg-black/20 p-3 font-sans text-xs leading-relaxed text-ink dark:text-paper/80 selection:bg-signal/20"
          >
            {draft}
          </pre>
          <div className="mt-2 flex justify-end">
            <CopyButton text={draft} />
          </div>
        </div>
      )}
    </div>
  );
}

export function ConflictAskDraft({ conflict, topic }: ConflictDraftProps) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  const field = conflict.field.replace(/_/g, " ");
  const subject = t.conflictSubject(field, topic);
  const intro = t.conflictIntro(topic);
  const req = t.conflictRequest(conflict.recommended_verification);
  const draft = `${subject}\n\n${intro}\n\n• ${t.conflictFieldLabel}: ${field}\n• ${t.conflictSource1}: "${conflict.quotation_a}"\n• ${t.conflictSource2}: "${conflict.quotation_b}"\n• ${conflict.explanation}\n\n${req}\n\n${t.conflictSignoff}`;

  return (
    <div className="mt-3 rounded-md border border-signal/30 bg-signal/[0.04] dark:bg-signal/10 dark:border-signal/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs"
      >
        <Mail className="h-3.5 w-3.5 shrink-0 text-signal" />
        <span className="font-medium text-signal-dark dark:text-signal">{t.askOfficialTitle}</span>
        <span className="ml-auto rounded border border-signal/30 px-1.5 py-px font-mono text-[10px] text-signal-dark dark:text-signal">
          {t.askOfficialDraftLabel}
        </span>
        <span className="text-signal">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-signal/20 dark:border-signal/15 px-3 py-3">
          <p className="mb-2 text-[11px] text-signal-dark dark:text-signal/80">{t.draftPreamble}</p>
          <pre
            data-testid="conflict-draft-text"
            className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-white/60 dark:bg-black/20 p-3 font-sans text-xs leading-relaxed text-ink dark:text-paper/80 selection:bg-signal/20"
          >
            {draft}
          </pre>
          <div className="mt-2 flex justify-end">
            <CopyButton text={draft} />
          </div>
        </div>
      )}
    </div>
  );
}
