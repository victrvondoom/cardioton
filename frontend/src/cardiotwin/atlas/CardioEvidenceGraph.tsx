import { useMemo, useState } from "react";
import type { AtlasGraphNode, AtlasResult } from "./types";
import { hemoValue, hemoDate } from "../HemoPanels";

const FILTERS=["all","ecg","imaging","labs","symptoms","wearables","fhir","environment","interventions","clinical_text","voice","twin_states","unknowns"];
export default function CardioEvidenceGraph({result,onEvidence}:{result:AtlasResult;onEvidence:(id:string)=>void}) {
  const [filter,setFilter]=useState("all");
  const [selected,setSelected]=useState<AtlasGraphNode|null>(null);
  const [page,setPage]=useState(0);
  const nodes=useMemo(()=>result.evidence_graph.nodes.filter(n=>filter==="all" || (filter==="unknowns"?n.classification==="UNKNOWN":filter==="fhir"?Boolean((n.source_record as Record<string,unknown>|undefined)?.resourceType)||n.modality==="fhir":n.modality===filter)),[result,filter]);
  const priority=(n:AtlasGraphNode)=>n.type==="TwinState"||n.type==="ClinicalReview"?0:n.classification==="DERIVED"?1:n.type==="ModalitySource"?2:n.type==="TwinTransition"?4:3;
  const ordered=[...nodes].sort((a,b)=>priority(a)-priority(b)||(Date.parse(b.available_at??"1970-01-01")-Date.parse(a.available_at??"1970-01-01")));
  const shown=ordered.slice(page*40,page*40+40);
  const locations=new Map<string,{x:number;y:number}>();
  const cols=[0,0,0,0];
  shown.forEach(n=>{const column=n.type==="TwinState"?2:n.type==="TwinTransition"||n.type==="ClinicalReview"?3:n.classification==="DERIVED"?1:0;locations.set(n.id,{x:120+column*230,y:45+cols[column]++*48});});
  const height=Math.max(230,...cols.map(n=>n*48+40));
  return <section className="atlas-panel" aria-label="Cardio Evidence Graph">
    <div className="atlas-panel-head"><div><p className="atlas-kicker">Source → derivation → state → review</p><h2>Cardio Evidence Graph</h2></div><span className="atlas-badge">{nodes.length} nodes / {result.evidence_graph.edges.length} total relationships</span></div>
    <p className="atlas-muted">Edges describe evidence support and temporal association. Every visible node belongs to {result.as_of}.</p>
    <div className="atlas-filter" aria-label="Graph filters">{FILTERS.map(f=><button type="button" key={f} aria-pressed={f===filter} onClick={()=>{setFilter(f);setPage(0);setSelected(null);}}>{f.replace(/_/g," ")}</button>)}</div>
    <div className="atlas-graph-scroll"><svg viewBox={`0 0 930 ${height}`} style={{minHeight:height}} aria-label="Interactive evidence relationships" role="group">
      {result.evidence_graph.edges.map(e=>{const a=locations.get(e.source),b=locations.get(e.target);return a&&b?<path key={e.id??`${e.source}-${e.target}`} d={`M${a.x+92},${a.y} C${(a.x+b.x)/2},${a.y} ${(a.x+b.x)/2},${b.y} ${b.x-92},${b.y}`} fill="none" stroke="var(--color-surface-border,#607080)" opacity={selected&&(e.source===selected.id||e.target===selected.id)?1:.25}><title>{e.relationship}</title></path>:null;})}
      {shown.map(n=>{const p=locations.get(n.id)!;return <g key={n.id} role="button" tabIndex={0} aria-label={`Inspect ${n.label}, ${n.classification}`} onClick={()=>setSelected(n)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelected(n);}}} className={`atlas-graph-node ${selected?.id===n.id?"selected":""}`} transform={`translate(${p.x},${p.y})`}><rect x="-92" y="-18" width="184" height="36" rx="8"/><text x="-81" y="-2">{n.label.length>25?n.label.slice(0,24)+"…":n.label}</text><text x="-81" y="11" className="atlas-graph-class">{n.classification} · {n.modality.replace(/_/g," ")}</text><title>{n.label}</title></g>;})}
    </svg></div>
    <div className="atlas-toolbar"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous nodes</button><span className="atlas-muted">Page {page+1} · {shown.length} of {nodes.length} nodes</span><button disabled={(page+1)*40>=nodes.length} onClick={()=>setPage(p=>p+1)}>Next nodes</button></div>
    {!nodes.length&&<p className="atlas-empty">No evidence in this category was available at the replay boundary.</p>}
    {selected&&<article className="atlas-source" aria-label="Graph node details"><div className="atlas-panel-head"><h3>{selected.label}</h3><button onClick={()=>setSelected(null)}>Close node</button></div><span className="atlas-badge">{selected.classification} · {selected.review_status??"REQUIRED"}</span><dl className="atlas-detail-grid">{Object.entries({Type:selected.type,Modality:selected.modality,Value:hemoValue(selected.value),Unit:selected.unit,Source:selected.source_ref,"Collection time":selected.event_at&&hemoDate(selected.event_at,true),"Availability time":selected.available_at&&hemoDate(selected.available_at,true),Confidence:selected.confidence,Transformation:selected.transformation}).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v??"UNKNOWN"}</dd></div>)}</dl><div className="atlas-citations">{selected.evidence_refs?.map(id=><button key={id} onClick={()=>onEvidence(id)}>Open source: {id}</button>)}</div>{selected.uncertainties?.map(u=><p key={u} className="atlas-muted">{u}</p>)}<details><summary>Original record, provenance and dependencies</summary><pre>{JSON.stringify({source_record:selected.source_record,provenance:selected.provenance,dependencies:selected.dependencies,associated_states:result.evidence_graph.edges.filter(e=>e.source===selected.id||e.target===selected.id)},null,2)}</pre></details></article>}
  </section>;
}
