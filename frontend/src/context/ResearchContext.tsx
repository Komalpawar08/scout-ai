import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { runResearchStream } from "../services/api";
import type { EvidencePanelItem } from "../features/evidence/EvidencePanel";
import type { ProgressEvent, ResearchInput, ResearchResponse } from "../types/research";

/**
 * Temporary, in-memory research state. Deliberately NOT persisted (no localStorage,
 * sessionStorage or IndexedDB): refreshing or closing the tab clears every result.
 */

export type Phase = "idle" | "running" | "done" | "error";
export type Section =
  | "overview"
  | "sources"
  | "claims"
  | "conflicts"
  | "gaps"
  | "freshness"
  | "coverage"
  | "graph"
  | "evidence"
  | "checklist"
  | "export";

interface ResearchContextValue {
  phase: Phase;
  input: ResearchInput | null;
  progress: ProgressEvent[];
  result: ResearchResponse | null;
  error: string | null;
  section: Section;
  checklistDone: Record<string, boolean>;
  focusedClaim: string | null;
  evidencePanelItem: EvidencePanelItem | null;
  start: (input: ResearchInput, files: File[]) => Promise<void>;
  cancel: () => void;
  reset: () => void;
  setSection: (s: Section) => void;
  toggleTask: (taskId: string) => void;
  focusClaim: (claimId: string | null) => void;
  openEvidencePanel: (item: EvidencePanelItem) => void;
  closeEvidencePanel: () => void;
  /** Result with the session's checklist statuses applied (used for exports). */
  resultForExport: () => ResearchResponse | null;
}

const ResearchContext = createContext<ResearchContextValue | null>(null);

export function ResearchProvider({ children, runner = runResearchStream }: { children: ReactNode; runner?: typeof runResearchStream }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [input, setInput] = useState<ResearchInput | null>(null);
  const [progress, setProgress] = useState<ProgressEvent[]>([]);
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSectionState] = useState<Section>("overview");
  const [checklistDone, setChecklistDone] = useState<Record<string, boolean>>({});
  const [focusedClaim, setFocusedClaim] = useState<string | null>(null);
  const [evidencePanelItem, setEvidencePanelItem] = useState<EvidencePanelItem | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (next: ResearchInput, files: File[]) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setInput(next);
      setProgress([]);
      setResult(null);
      setError(null);
      setChecklistDone({});
      setSectionState("overview");
      setPhase("running");
      try {
        const res = await runner(next, files, {
          onProgress: (e) => setProgress((p) => [...p, e]),
          signal: controller.signal,
        });
        setResult(res);
        setPhase("done");
      } catch (e) {
        if (controller.signal.aborted) {
          setPhase("idle");
          return;
        }
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    },
    [runner],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setPhase("idle");
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPhase("idle");
    setResult(null);
    setProgress([]);
    setError(null);
    setChecklistDone({});
  }, []);

  const toggleTask = useCallback((id: string) => setChecklistDone((d) => ({ ...d, [id]: !d[id] })), []);

  const openEvidencePanel = useCallback((item: EvidencePanelItem) => setEvidencePanelItem(item), []);
  const closeEvidencePanel = useCallback(() => setEvidencePanelItem(null), []);

  const resultForExport = useCallback(() => {
    if (!result) return null;
    return {
      ...result,
      verification_checklist: result.verification_checklist.map((t) => ({
        ...t,
        status: checklistDone[t.task_id] ? ("done" as const) : ("pending" as const),
      })),
    };
  }, [result, checklistDone]);

  const value = useMemo<ResearchContextValue>(
    () => ({
      phase, input, progress, result, error, section, checklistDone, focusedClaim, evidencePanelItem,
      start, cancel, reset, setSection: setSectionState, toggleTask, focusClaim: setFocusedClaim,
      openEvidencePanel, closeEvidencePanel, resultForExport,
    }),
    [phase, input, progress, result, error, section, checklistDone, focusedClaim, evidencePanelItem, start, cancel, reset, toggleTask, openEvidencePanel, closeEvidencePanel, resultForExport],
  );
  return <ResearchContext.Provider value={value}>{children}</ResearchContext.Provider>;
}

export function useResearch(): ResearchContextValue {
  const ctx = useContext(ResearchContext);
  if (!ctx) throw new Error("useResearch must be used inside ResearchProvider");
  return ctx;
}
