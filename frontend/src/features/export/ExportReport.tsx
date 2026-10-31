import { FileJson, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { Card } from "../../components/ui";
import { useResearch } from "../../context/ResearchContext";
import { exportJson, exportPdf } from "../../services/api";

export function ExportReport() {
  const { resultForExport } = useResearch();
  const [busy, setBusy] = useState<"pdf" | "json" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "pdf" | "json") {
    const report = resultForExport();
    if (!report) return;
    setBusy(kind);
    setError(null);
    try {
      await (kind === "pdf" ? exportPdf(report) : exportJson(report));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="Export report">
      <p className="text-sm text-ink-2">
        The report includes the research question, summary, source inventory with URLs and page/section references, claims and
        quotations, possible conflicts, potential gaps, freshness analysis, coverage matrix, evidence assessment, completeness
        calculation, verification checklist (with your completion marks) and limitations.
      </p>
      <p className="mt-2 text-xs text-ink-3">Files are generated on request and streamed to you. Nothing is saved on the server.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={() => run("pdf")} disabled={!!busy}
          className="inline-flex items-center gap-2 bg-ink px-5 py-2.5 font-medium text-paper hover:bg-signal disabled:opacity-60">
          {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Download PDF
        </button>
        <button onClick={() => run("json")} disabled={!!busy}
          className="inline-flex items-center gap-2 border border-ink px-5 py-2.5 font-medium hover:bg-ink hover:text-paper disabled:opacity-60">
          {busy === "json" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />} Download JSON
        </button>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-signal-dark">Export failed: {error}</p>}
    </Card>
  );
}
