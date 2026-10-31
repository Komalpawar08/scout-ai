import { Badge, Card, EmptyState, Expandable, FRESHNESS_META, SOURCE_TYPE_META, SourceLink } from "../../components/ui";
import { useResearch } from "../../context/ResearchContext";

const EXTRACTION_TONE = { success: "green", partial: "amber", failed: "red", blocked: "red", empty: "slate" } as const;

export function Sources() {
  const { result: r } = useResearch();
  if (!r) return null;
  if (!r.sources.length) return <EmptyState title="No sources were collected" />;
  const fresh = Object.fromEntries(r.source_freshness.map((f) => [f.source_id, f]));
  return (
    <div className="space-y-4">
      {r.search_queries.length > 0 && (
        <Card title="Search queries used">
          <div className="flex flex-wrap gap-2">{r.search_queries.map((q) => <Badge key={q}>{q}</Badge>)}</div>
        </Card>
      )}
      {r.sources.map((s) => {
        const f = fresh[s.source_id];
        const claims = r.claims.filter((c) => c.source_id === s.source_id).length;
        return (
          <Expandable key={s.source_id} summary={
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-ink-2">{s.source_id}</span>
              <span className="font-medium text-ink">{s.title}</span>
              <Badge tone={SOURCE_TYPE_META[s.source_type].tone}>{SOURCE_TYPE_META[s.source_type].label}</Badge>
              <Badge tone={EXTRACTION_TONE[s.extraction_status]}>{s.extraction_status}</Badge>
              {f && <Badge tone={FRESHNESS_META[f.status].tone}>{FRESHNESS_META[f.status].label}</Badge>}
              {s.is_demo && <Badge tone="violet">DEMO fixture</Badge>}
              <span className="text-xs text-ink-3">{claims} claim(s)</span>
            </div>
          }>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Row k="Location"><SourceLink source={s} /></Row>
              <Row k="Publisher">{s.publisher ?? "Not stated"}</Row>
              <Row k="Publication date">
                {s.publication_date ? <>{s.publication_date} <span className="text-xs text-ink-3">({s.publication_date_origin})</span></>
                  : s.date_status === "not_stated" ? "Not stated in source (undated)" : "Unavailable"}
              </Row>
              <Row k="Updated date">{s.updated_date ?? "Not stated"}</Row>
              <Row k="Retrieved at">{s.retrieved_at}</Row>
              {s.academic_cycle && <Row k="Academic cycle">{s.academic_cycle}</Row>}
              <Row k="Source type reason">{s.source_type_reason}</Row>
              <Row k="Freshness">{f?.reason ?? "—"}</Row>
              <Row k="Extracted text">{s.extracted_text.length.toLocaleString()} characters{s.text_truncated ? " (truncated to limit)" : ""}; {s.spans.length} page/section reference(s)</Row>
              {s.extraction_error && <Row k="Extraction issue"><span className="text-amber-800">{s.extraction_error}</span></Row>}
            </dl>
            {s.extracted_text && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-signal">View extracted text (held in this tab only)</summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs text-ink-2">{s.extracted_text}</pre>
              </details>
            )}
          </Expandable>
        );
      })}
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">{k}</dt>
      <dd className="break-words text-ink">{children}</dd>
    </div>
  );
}
