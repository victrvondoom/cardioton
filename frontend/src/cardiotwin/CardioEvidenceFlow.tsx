import { useState } from "react";
import { Download, Layers, X } from "lucide-react";
import { globalApi, type EvidenceEdge, type EvidenceFilters, type EvidenceMapResponse, type EvidenceNode } from "./globalApi";
import { DataMode, downloadResearchJson, Loading, RecordsTable, ResearchError, useResearchResource } from "./CardioGlobalResearch";

const COLUMNS = ["source", "area", "modality", "task", "target"];
const LABELS = ["Evidence source", "Clinical area", "Modality", "Clinical task", "Indication"];
interface PlacedNode extends EvidenceNode { x: number; y: number; height: number }
interface PlacedEdge { edge: EvidenceEdge; path: string }

/** One shared linear scale preserves the record counts across nodes and ribbons. */
export function layoutEvidenceFlow(graph: EvidenceMapResponse["graph"]) {
  const columns = COLUMNS.map(category => graph.nodes.filter(node => node.category === category).sort((left, right) => right.count - left.count || left.id.localeCompare(right.id)));
  const maxNodes = Math.max(1, ...columns.map(column => column.length));
  const maxCount = Math.max(1, ...columns.map(column => column.reduce((sum, node) => sum + node.count, 0)));
  const scale = Math.max(2, (Math.max(280, maxNodes * 38) - 40 - (maxNodes - 1) * 8) / maxCount);
  const nodes: PlacedNode[] = [];
  columns.forEach((column, columnIndex) => {
    let y = 40;
    column.forEach(node => { const height = node.count * scale; nodes.push({ ...node, x: columnIndex * 245 + 5, y, height }); y += height + 8; });
  });
  const byId = new Map(nodes.map(node => [node.id, node]));
  const outgoing = new Map<string, number>(), incoming = new Map<string, number>();
  const edges: PlacedEdge[] = [];
  graph.edges.forEach(edge => {
    const source = byId.get(edge.source), target = byId.get(edge.target);
    if (!source || !target || edge.value <= 0) return;
    const sy = source.y + (outgoing.get(source.id) ?? 0), ty = target.y + (incoming.get(target.id) ?? 0), width = edge.value * scale;
    outgoing.set(source.id, (outgoing.get(source.id) ?? 0) + width);
    incoming.set(target.id, (incoming.get(target.id) ?? 0) + width);
    const sx = source.x + 195, tx = target.x, mid = (sx + tx) / 2;
    edges.push({ edge, path: `M${sx},${sy} C${mid},${sy} ${mid},${ty} ${tx},${ty} L${tx},${ty + width} C${mid},${ty + width} ${mid},${sy + width} ${sx},${sy + width} Z` });
  });
  return { nodes, edges, width: 1225, height: Math.max(280, ...nodes.map(node => node.y + node.height + 12)) };
}

export function EvidenceFlowPanel({ revision, onRecord, initialFilters = {} }: { revision: number; onRecord: (id: string) => void; initialFilters?: EvidenceFilters }) {
  const [filters, setFilters] = useState<EvidenceFilters>(initialFilters);
  const [draftQuery, setDraftQuery] = useState(initialFilters.query ?? "");
  const [selection, setSelection] = useState<{ node?: string; edge?: EvidenceEdge } | null>(null);
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const base = useResearchResource(signal => globalApi.getEvidenceMap(undefined, signal), revision);
  const state = useResearchResource(signal => globalApi.getEvidenceMap(filters, signal), `${revision}:${JSON.stringify(filters)}`);
  const data = state.data;
  const graph = data?.graph;
  const records = data?.records ?? [];
  const layout = graph ? layoutEvidenceFlow(graph) : null;
  const selectedEdges = selection?.edge ? [selection.edge] : selection?.node ? graph?.edges.filter(edge => edge.source === selection.node || edge.target === selection.node) ?? [] : [];
  const selectedIds = new Set(selectedEdges.flatMap(edge => edge.evidence_ids));
  const selectedRecords = selection ? records.filter(record => selectedIds.has(record.id)) : records;
  const baseline = base.data?.records ?? records;
  const options = (key: "clinical_area" | "modality" | "intervention_or_device" | "study_design") => [...new Set(baseline.map(record => record[key]).filter((value): value is string => !!value))].sort();
  function update(key: keyof EvidenceFilters, value: string) { setFilters(previous => ({ ...previous, [key]: value || undefined })); setSelection(null); }
  async function exportFiltered() {
    setExporting(true); setExportError("");
    try { downloadResearchJson("cardiotwin-filtered-evidence.json", await globalApi.exportRecords(filters)); }
    catch (caught) { setExportError(caught instanceof Error ? caught.message : "Evidence export failed."); }
    finally { setExporting(false); }
  }
  return <div className="cgi-panel">
    <div className="cgi-panel-header"><span className="cgi-panel-title"><Layers size={14} aria-hidden />Evidence Flow Map</span>{graph && <DataMode mode={graph.data_mode} />}</div>
    <div className="cgi-panel-body cgi-stack">
      <form className="cgi-copilot-form" onSubmit={event => { event.preventDefault(); update("query", draftQuery); }}><input aria-label="Search evidence map" className="cgi-copilot-input" value={draftQuery} onChange={event => setDraftQuery(event.target.value)} placeholder="Search evidence records" /><button className="cgi-copilot-btn">Search map</button></form>
      <div className="cgi-filters" aria-label="Evidence map filters">
        {([
          ["clinical_area", "Clinical area", options("clinical_area")],
          ["modality", "Modality", options("modality")],
          ["intervention", "Intervention", options("intervention_or_device")],
          ["study_type", "Study design", options("study_design")],
        ] as const).map(([key, label, values]) => <label className="cgi-field" key={key}>{label}<select className="cgi-select" value={filters[key] ?? ""} onChange={event => update(key, event.target.value)}><option value="">All</option>{values.map(value => <option key={value}>{value}</option>)}</select></label>)}
        <label className="cgi-field">Source date from<input type="date" className="cgi-select" value={filters.date_from ?? ""} onChange={event => update("date_from", event.target.value)} /></label>
        <label className="cgi-field">Source date to<input type="date" className="cgi-select" value={filters.date_to ?? ""} onChange={event => update("date_to", event.target.value)} /></label>
        <button className="cgi-badge" onClick={() => { setFilters({}); setDraftQuery(""); setSelection(null); }}><X size={11} aria-hidden />Reset filters</button>
        <button className="cgi-badge" disabled={state.loading || !data || exporting} onClick={() => void exportFiltered()}><Download size={12} aria-hidden />Export filtered records JSON</button>
      </div>
      <ResearchError message={state.error || exportError} />{state.loading && <Loading>Loading filtered evidence relationships…</Loading>}
      {graph && layout && <>
        <p className="cgi-notice">{graph.total_records} distinct records. {graph.counting_rule ?? data?.counting_rule ?? "Records are deduplicated by source and stable source identifier. Each record contributes once to each category transition; counts across transitions must not be summed as unique studies."} Select a node or relationship to inspect the contributing records. Mapping status and source reliability are separate.</p>
        {graph.nodes.length > 100 ? <p className="cgi-notice">This map contains more than 100 category nodes. Narrow the filters or use the complete accessible record table below.</p> : <div className="cgi-sankey-wrap">
          <svg className="cgi-flow-svg" viewBox={`0 0 ${layout.width} ${layout.height}`} role="group" aria-label="Evidence flow derived from filtered records">
            {LABELS.map((label, index) => <text key={label} x={index * 245 + 5} y={19} className="cgi-flow-heading">{label}</text>)}
            {layout.edges.map(({ edge, path }) => <path key={`${edge.source}-${edge.target}`} d={path} className={`cgi-flow-edge${selectedEdges.includes(edge) ? " selected" : ""}`} role="button" tabIndex={0} aria-label={`Inspect relationship ${graph.nodes.find(node => node.id === edge.source)?.label} to ${graph.nodes.find(node => node.id === edge.target)?.label}: ${edge.value} records`} onClick={() => setSelection({ edge })} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelection({ edge }); } }}><title>{edge.mapping_rationale ?? edge.flow_category} · {edge.value} records · {edge.verification_status ?? "Unreported mapping status"}</title></path>)}
            {layout.nodes.map(node => <g key={node.id} role="button" tabIndex={0} aria-label={`Inspect ${node.label}: ${node.count} records`} aria-pressed={selection?.node === node.id} className="cgi-flow-node" onClick={() => setSelection({ node: node.id })} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelection({ node: node.id }); } }}>
              <title>{node.label}: {node.count} records. {node.description}</title><rect x={node.x} y={node.y} width={195} height={node.height} rx={4} /><text x={node.x + 8} y={node.y + Math.min(node.height / 2 + 4, 20)}>{node.label.length > 24 ? `${node.label.slice(0, 23)}…` : node.label}<tspan x={node.x + 185} textAnchor="end">{node.count}</tspan></text>
            </g>)}
          </svg>
        </div>}
        {selection && <section className="cgi-notice" aria-label="Selected relationship evidence"><button className="cgi-badge" onClick={() => setSelection(null)}>Show all filtered records</button>{selectedEdges.map(edge => <p key={`${edge.source}-${edge.target}`}><b>{graph.nodes.find(node => node.id === edge.source)?.label} → {graph.nodes.find(node => node.id === edge.target)?.label}</b>: {edge.value} distinct records. {edge.mapping_rationale || "Shared category labels in the normalized records; no causal relationship is implied."} Mapping: {edge.verification_status ?? "Unreported"}.</p>)}</section>}
        <p className="cgi-kicker">Accessible source records ({selectedRecords.length})</p><RecordsTable records={selectedRecords} onRecord={onRecord} label="Evidence flow source records" />
      </>}
    </div>
  </div>;
}
