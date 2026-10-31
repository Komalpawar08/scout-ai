import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo, useState } from "react";
import { Badge, Card, EVIDENCE_META, EmptyState, Quote, fieldLabel } from "../../components/ui";
import { useResearch } from "../../context/ResearchContext";
import type { EvidenceStatus, GraphEdge, GraphNode, ResearchResponse } from "../../types/research";

type Relation = GraphEdge["relation"];
const RELATIONS: Record<Relation, { label: string; color: string; dash?: string; animated?: boolean }> = {
  states: { label: "Source states claim", color: "#8a8274" },
  corroborates: { label: "Corroborates", color: "#0f7a55" },
  conflicts_with: { label: "Possible conflict", color: "#c8361d", dash: "6 4", animated: true },
  missing_evidence: { label: "Missing evidence", color: "#b5650a", dash: "2 4" },
};

const COL_X = { source: 0, claim: 340, gap: 760 };
const ROW_H = 74;

/** "related" = claims that corroborate, conflict or lack evidence; "all"; or a single field key. */
export type GraphFocus = "related" | "all" | string;

/** Deterministic layered layout: sources | claims grouped by field | gaps. Exported for tests. */
export function layoutGraph(r: ResearchResponse, visible: Set<Relation>, focus: GraphFocus = "all"): { nodes: Node[]; edges: Edge[] } {
  const full = r.claim_relationships;
  const related = new Set(full.edges.filter((e) => e.relation !== "states").flatMap((e) => [e.source, e.target]));
  const keepClaim = (n: GraphNode) =>
    focus === "all" || (focus === "related" ? related.has(n.id) : n.data.category === focus);
  const allClaims = new Set(full.nodes.filter((n) => n.type === "claim").map((n) => n.id));
  const claimIds = new Set(full.nodes.filter((n) => n.type === "claim" && keepClaim(n)).map((n) => n.id));
  const keepEnd = (id: string) => !allClaims.has(id) || claimIds.has(id);
  const g = {
    nodes: full.nodes.filter((n) => n.type !== "claim" || claimIds.has(n.id)),
    edges: full.edges.filter((e) => keepEnd(e.source) && keepEnd(e.target)),
  };
  const linkedGaps = new Set(g.edges.map((e) => e.target));
  const claims = g.nodes.filter((n) => n.type === "claim")
    .sort((a, b) => String(a.data.category).localeCompare(String(b.data.category)) || a.id.localeCompare(b.id, undefined, { numeric: true }));
  const sources = g.nodes.filter((n) => n.type === "source");
  const gaps = g.nodes.filter((n) => n.type === "gap" && (focus === "all" || linkedGaps.has(n.id)));
  const height = Math.max(claims.length, 1) * ROW_H;
  const spread = (list: GraphNode[]) => {
    const step = list.length ? height / list.length : 0;
    return (i: number) => i * step + step / 2 - 30;
  };
  const ys = spread(sources), gy = spread(gaps);

  const style = (bg: string, border: string) => ({
    background: bg, border: `1px solid ${border}`, color: "#16130F", borderRadius: 2, fontSize: 11, fontFamily: "'IBM Plex Sans', sans-serif", padding: 8, width: 240,
  });
  const nodes: Node[] = [
    ...sources.map((n, i) => ({
      id: n.id, position: { x: COL_X.source, y: ys(i) }, data: { label: `${n.id} · ${n.label}` },
      style: style("#EAE4D6", "#16130F"), sourcePosition: "right", targetPosition: "left",
    }) as Node),
    ...claims.map((n, i) => {
      const status = n.data.evidence_status as EvidenceStatus;
      return {
        id: n.id, position: { x: COL_X.claim, y: i * ROW_H }, sourcePosition: "right", targetPosition: "left",
        data: { label: `${n.id} [${fieldLabel(String(n.data.category))}] ${n.label.slice(0, 90)}` },
        style: { ...style("#FBF9F4", "rgba(22,19,15,0.25)"), borderLeft: `4px solid ${EVIDENCE_META[status]?.color ?? "#6F685C"}`, width: 320 },
      } as Node;
    }),
    ...gaps.map((n, i) => ({
      id: n.id, position: { x: COL_X.gap, y: gy(i) }, data: { label: n.label }, targetPosition: "left",
      style: { ...style("#F6E9D6", "#b5650a"), borderStyle: "dashed" },
    }) as Node),
  ];
  const shown = new Set(nodes.map((n) => n.id));
  const edges: Edge[] = g.edges.filter((e) => visible.has(e.relation) && shown.has(e.source) && shown.has(e.target)).map((e) => {
    const meta = RELATIONS[e.relation];
    return {
      id: e.id, source: e.source, target: e.target, animated: meta.animated, label: e.relation === "states" ? undefined : meta.label,
      labelStyle: { fill: meta.color, fontSize: 10 }, labelBgStyle: { fill: "#F3EFE6" },
      style: { stroke: meta.color, strokeWidth: e.relation === "states" ? 1 : 2, strokeDasharray: meta.dash },
      markerEnd: { type: MarkerType.ArrowClosed, color: meta.color },
      type: e.relation === "corroborates" || e.relation === "conflicts_with" ? "smoothstep" : "default",
      data: { explanation: e.explanation },
    };
  });
  return { nodes, edges };
}

export function ClaimGraph() {
  const { result: r } = useResearch();
  const [visible, setVisible] = useState<Set<Relation>>(new Set(Object.keys(RELATIONS) as Relation[]));
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const hasRelated = !!r?.claim_relationships.edges.some((e) => e.relation !== "states");
  const [focus, setFocus] = useState<GraphFocus>(hasRelated ? "related" : "all");
  const layout = useMemo(() => (r ? layoutGraph(r, visible, focus) : { nodes: [], edges: [] }), [r, visible, focus]);
  if (!r) return null;
  if (!r.claim_relationships.nodes.length) return <EmptyState title="No relationships to show" />;
  const fields = Array.from(new Set(r.claims.map((c) => c.claim_category)));
  const claimIds = new Set(r.claims.map((c) => c.claim_id));
  const claimCount = layout.nodes.filter((n) => claimIds.has(n.id)).length;
  const byId = Object.fromEntries(r.claim_relationships.nodes.map((n) => [n.id, n]));
  const relatedEdges = selected ? r.claim_relationships.edges.filter((e) => e.source === selected.id || e.target === selected.id) : [];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card title="Claim relationship graph"
        actions={
          <div className="flex flex-wrap gap-2">
            {(Object.keys(RELATIONS) as Relation[]).map((rel) => (
              <label key={rel} className="flex items-center gap-1.5 text-xs text-ink-2">
                <input type="checkbox" checked={visible.has(rel)} className="accent-signal"
                  onChange={() => setVisible((v) => { const n = new Set(v); if (n.has(rel)) n.delete(rel); else n.add(rel); return n; })} />
                <span className="inline-block h-0.5 w-4" style={{ background: RELATIONS[rel].color }} />{RELATIONS[rel].label}
              </label>
            ))}
          </div>
        }>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <select value={focus} onChange={(e) => setFocus(e.target.value)} aria-label="Graph focus"
            className="rounded-lg border border-ink/10 bg-paper-3 px-3 py-1.5 text-sm">
            <option value="related">Claims with relationships (corroboration, conflict, missing evidence)</option>
            <option value="all">All claims ({r.claims.length})</option>
            {fields.map((f) => <option key={f} value={f}>Field: {fieldLabel(f)}</option>)}
          </select>
          <span className="text-xs text-ink-2">{claimCount} claim(s) shown</span>
        </div>
        <p className="mb-3 text-xs text-ink-2">Sources (left) → claims grouped by field (middle) → evidence gaps (right). Every node and edge comes from extracted claims and detected relationships. Click a node for details.</p>
        <div className="h-[620px] overflow-hidden border border-ink bg-paper-3" data-testid="claim-graph">
          <ReactFlow key={focus} nodes={layout.nodes} edges={layout.edges} fitView fitViewOptions={{ maxZoom: 1.1 }} minZoom={0.2} nodesConnectable={false}
            onNodeClick={(_, n) => setSelected(byId[n.id] ?? null)} proOptions={{ hideAttribution: true }} colorMode="light">
            <Background color="rgba(22,19,15,0.12)" gap={24} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </Card>

      <Card title="Node details">
        {!selected ? <p className="text-sm text-ink-2">Click a source, claim or gap node.</p> : (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge tone={selected.type === "source" ? "blue" : selected.type === "claim" ? "green" : "amber"}>{selected.type}</Badge>
              <span className="font-mono text-ink-2">{selected.id}</span>
            </div>
            <p className="text-ink">{selected.label}</p>
            {selected.type === "source" && (
              <dl className="space-y-1 text-ink-2">
                {selected.data.url ? <a className="break-all text-signal hover:underline" href={String(selected.data.url)} target="_blank" rel="noopener noreferrer">{String(selected.data.url)}</a> : <p>{String(selected.data.filename ?? "")}</p>}
                <p>Type: {String(selected.data.source_type).replace(/_/g, " ")}</p>
                <p>Published: {String(selected.data.publication_date ?? "not stated")}</p>
              </dl>
            )}
            {selected.type === "claim" && (
              <>
                <p className="text-ink-2">Evidence status: <span className="font-medium">{EVIDENCE_META[selected.data.evidence_status as EvidenceStatus]?.label}</span></p>
                <Quote text={String(selected.data.supporting_quote)} reference={
                  <>{String(selected.data.source_title ?? selected.data.source_id)}{selected.data.page_number ? ` · page ${selected.data.page_number}` : ""}{selected.data.section ? ` · § ${selected.data.section}` : ""}</>} />
                {selected.data.source_url ? <a className="break-all text-xs text-signal hover:underline" href={String(selected.data.source_url)} target="_blank" rel="noopener noreferrer">{String(selected.data.source_url)}</a> : null}
              </>
            )}
            {selected.type === "gap" && <p className="text-ink-2">{String(selected.data.explanation ?? "")}</p>}
            {relatedEdges.length > 0 && (
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Relationships</p>
                <ul className="mt-1 space-y-1">
                  {relatedEdges.map((e) => (
                    <li key={e.id} className="text-xs text-ink-2">
                      <span style={{ color: RELATIONS[e.relation].color }}>{RELATIONS[e.relation].label}</span>: {e.source} → {e.target}
                      {e.relation !== "states" && <span className="block text-ink-3">{e.explanation}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
