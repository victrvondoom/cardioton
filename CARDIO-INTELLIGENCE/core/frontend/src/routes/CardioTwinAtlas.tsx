import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { Download, History, Loader2, ShieldCheck } from "lucide-react";
import { atlas, downloadAtlasPassport } from "../cardiotwin/atlas/core__cardiotwin_atlas__api";
import type { AtlasInput, AtlasResult } from "../cardiotwin/atlas/core__cardiotwin_atlas__types";
import CardioEvidenceGraph from "../cardiotwin/atlas/CardioEvidenceGraph";
import CardioFusion from "../cardiotwin/atlas/CardioFusion";
import TwinSandbox from "../cardiotwin/atlas/TwinSandbox";
import CardioCopilot from "../cardiotwin/atlas/CardioCopilot";
import AtlasTransitionDelta from "../cardiotwin/atlas/AtlasTransitionDelta";
import { AtlasAblation, AtlasDimensions, SystemTwins, WearableTimeline } from "../cardiotwin/atlas/AtlasPanels";
import { KnowledgeFrontier } from "../cardiotwin/EvidenceSensitivity";
import { axisWhy, EvidenceRecord, GovernanceNote, HemoSection, InteractionPanels, InterventionResponses, TrajectoryPanel, TransitionList, WhyPanel, type WhySelection } from "../cardiotwin/HemoPanels";
import type { HemoAxisKey } from "../cardiotwin/hemoTypes";
import { downloadHemoJson } from "../cardiotwin/downloadHemoJson";
import "../cardiotwin/atlas/atlas.css";

const AtlasHeart3D=lazy(()=>import("../cardiotwin/atlas/AtlasHeart3D"));
const SpatialTwinMap=lazy(()=>import("../cardiotwin/atlas/SpatialTwinMap"));
const TABS=[["command","Command Center"],["fusion","CardioFusion"],["graph","Evidence Graph"],["heart","3D Heart"],["replay","Replay"],["spatial","Spatial Twin"],["sandbox","Twin Sandbox"],["copilot","Copilot"],["passport","Evidence Passport"]] as const;
const END="2026-08-21T23:59:59.999999Z";
const endOfDay=(date:string)=>`${date}T23:59:59.999999Z`;
const skeleton=<div className="atlas-empty" role="status">Loading evidence-linked view…</div>;

export default function CardioTwinAtlas(){
  const {tab="command"}=useParams();
  const active=TABS.some(([id])=>id===tab)?tab:"command";
  const [result,setResult]=useState<AtlasResult|null>(null);
  const [input,setInput]=useState<AtlasInput>({as_of:END,demo:true});
  const [date,setDate]=useState(END.slice(0,10));
  const [busy,setBusy]=useState(true),[error,setError]=useState("");
  const [why,setWhy]=useState<WhySelection|null>(null),[recordId,setRecordId]=useState<string|null>(null);
  const [exportBusy,setExportBusy]=useState(false);
  const sequence=useRef(0);
  const whyRef=useRef<HTMLDivElement>(null),recordRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(recordId)recordRef.current?.scrollIntoView?.({block:"start",behavior:"auto"});else if(why)whyRef.current?.scrollIntoView?.({block:"start",behavior:"auto"});},[why,recordId]);
  const load=useCallback(async(next:AtlasInput)=>{
    const id=++sequence.current;setInput(next);setBusy(true);setResult(null);setWhy(null);setRecordId(null);setError("");setExportBusy(false);
    try{const data=next.demo?await atlas.demo(next.as_of):await atlas.reconstruct(next);if(id!==sequence.current)return;setResult(data);setDate(data.as_of.slice(0,10));}
    catch(e){if(id===sequence.current)setError((e as Error).message);}
    finally{if(id===sequence.current)setBusy(false);}
  },[]);
  useEffect(()=>{void load({as_of:END,demo:true});return()=>{sequence.current++;};},[load]);
  const replay=(at:string)=>void load({...input,as_of:at.includes("T")?at:endOfDay(at)});
  const selectEvidence=useCallback((id:string)=>{setRecordId(id);},[]);
  const chooseWhy=(selection:WhySelection)=>{setWhy(selection);setRecordId(null);};
  const selectAxis=(axis:HemoAxisKey)=>{if(result)chooseWhy(axisWhy(axis,result.twin.snapshot[axis],result.as_of));};
  const exportPassport=async()=>{if(!result)return;const id=sequence.current,asOf=result.as_of;setExportBusy(true);setError("");try{const data=await atlas.passport({...input,as_of:asOf});if(id===sequence.current)downloadAtlasPassport(data,`cardiotwin-atlas-passport-${asOf.slice(0,10)}.json`);}catch(e){if(id===sequence.current)setError((e as Error).message);}finally{if(id===sequence.current)setExportBusy(false);}};
  const record=result?.twin.evidence.find(e=>e.id===recordId);
  return <div className="atlas-workspace" data-testid="atlas-workspace">
    <header className="atlas-header"><div><Link to="/cardiotwin" className="atlas-back">← Coronary CardioTwin</Link><p className="atlas-kicker">CARDIOTON / cardiovascular research</p><h1>CardioTwin <span>Atlas</span></h1><p>Explore reconstructed cardiovascular state, source evidence and uncertainty at a selected time.</p></div><div className="atlas-header-meta"><span className="atlas-badge">RESEARCH PROTOTYPE</span><span><ShieldCheck size={14} aria-hidden/> Human review REQUIRED</span><span>Deterministic core · no LLM dependency</span></div></header>
    <div className="atlas-safety" role="note">Research / clinical-support inference. Qualitative proxies are not a diagnosis, validated prediction or treatment recommendation. Source facts, derived measures, inferred states and UNKNOWN remain distinct.</div>
    <nav className="atlas-related" aria-label="Related cardiovascular workspaces">
      <span>Continue in</span>
      <Link to="/cardiotwin/intelligence" title="Report review, reference anatomy and environmental time exploration">3D Cardiovascular Intelligence →</Link>
      <Link to="/cardiotwin/global" title="Evidence map, clinical trials, pipeline and safety monitoring">Global Intelligence →</Link>
    </nav>
    <section className="atlas-replay" aria-label="Shared Atlas replay"><div><p className="atlas-kicker">One clock for every view</p><h2><History size={17} aria-hidden/> Replay Twin</h2><p>What did the system know at this exact point?</p></div><form onSubmit={e=>{e.preventDefault();replay(date);}}><label htmlFor="atlas-replay-date">As-of date · end of day UTC<input id="atlas-replay-date" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button disabled={busy||!date} type="submit">Reconstruct Cardio Twin</button></form><button onClick={()=>void load({as_of:END,demo:true})} disabled={busy}>Synthetic patient story</button></section>
    <nav className="atlas-nav" aria-label="CardioTwin Atlas workspaces">{TABS.map(([id,label])=><NavLink key={id} to={`/cardiotwin/atlas/${id}`} aria-current={active===id?"page":undefined} className={active===id?"active":""}>{label}</NavLink>)}</nav>
    {error&&<div role="alert" className="atlas-error">{error}<button onClick={()=>void load(input)}>Retry reconstruction</button></div>}
    {busy&&<div className="atlas-loading" role="status"><Loader2 size={23} aria-hidden className="animate-spin"/><h2>Reconstructing the available evidence</h2><p>Synchronizing supported sources, graph, spatial context and deterministic state at one knowledge boundary.</p><p>ECG/image clinical models and audio transcription remain unavailable.</p></div>}
    {result&&!busy&&<>
      <div className="atlas-boundary"><span><b>{input.demo?"SYNTHETIC DEMO":"SUBMITTED SOURCE ASSERTIONS"}</b> · {result.twin.patient_ref}</span><time>{result.as_of}</time></div>
      {active==="command"&&<div className="atlas-command-grid"><section className="atlas-panel atlas-heart-panel"><Suspense fallback={skeleton}><AtlasHeart3D snapshot={result.twin.snapshot} onSelect={selectAxis}/></Suspense></section><AtlasDimensions result={result} onSelect={selectAxis}/></div>}
      <div className="atlas-metrics">{[["State dimensions",8],["Available evidence",result.twin.evidence.length],["Available groups",result.modalities.filter(m=>m.status==="AVAILABLE").length],["Transitions",result.twin.transitions.length],["Uncertainty flags",result.twin.snapshot.uncertainties.length]].map(([label,value])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
      {result.demo&&<div className="atlas-story" aria-label="Synthetic story replay dates"><p>01 · Replay 10 Aug &nbsp; 02 · Advance to 12 Aug &nbsp; 03 · Ask WHY &nbsp; 04 · Trace the source</p><div>{result.demo.replay_dates?.map(at=><button key={at} onClick={()=>replay(at)} aria-pressed={at.slice(0,10)===result.as_of.slice(0,10)}>{new Date(at).toLocaleDateString("en-GB",{day:"2-digit",month:"short",timeZone:"UTC"})}</button>)}</div></div>}
      {why&&<div ref={whyRef} className="space-y-3 scroll-mt-24"><WhyPanel result={result.twin} selected={why} onEvidence={selectEvidence} onClose={()=>{setWhy(null);setRecordId(null);}}/><AtlasTransitionDelta result={result} selected={why} onEvidence={selectEvidence}/></div>}
      {record&&<div ref={recordRef} className="scroll-mt-24"><HemoSection title="Original evidence & provenance" eyebrow="Twin → evidence → source" right={<button onClick={()=>setRecordId(null)}>Back to twin</button>}><EvidenceRecord evidence={record}/></HemoSection></div>}
      {active==="command"&&<><TrajectoryPanel result={result.twin} busy={busy} onReplay={replay}/><div className="atlas-two-col"><TransitionList result={result.twin} selected={why} onWhy={chooseWhy}/><Suspense fallback={skeleton}><SpatialTwinMap spatial={result.spatial} onEvidence={selectEvidence}/></Suspense></div><SystemTwins result={result} onSelect={selectAxis}/><WearableTimeline result={result} onEvidence={selectEvidence}/><AtlasAblation result={result} onEvidence={selectEvidence}/></>}
      {active==="fusion"&&<><CardioFusion result={result} input={input} onImport={next=>void load(next)} onEvidence={selectEvidence}/><WearableTimeline result={result} onEvidence={selectEvidence}/></>}
      {active==="graph"&&<CardioEvidenceGraph result={result} onEvidence={selectEvidence}/>}
      {active==="heart"&&<><Suspense fallback={skeleton}><AtlasHeart3D snapshot={result.twin.snapshot} onSelect={selectAxis}/></Suspense><AtlasDimensions result={result} onSelect={selectAxis}/><SystemTwins result={result} onSelect={selectAxis}/><InteractionPanels result={result.twin} onWhy={chooseWhy}/></>}
      {active==="replay"&&<><TrajectoryPanel result={result.twin} busy={busy} onReplay={replay}/><TransitionList result={result.twin} selected={why} onWhy={chooseWhy}/><section className="atlas-panel"><p className="atlas-kicker">Event occurred → result available → state updated</p><h2>Knowledge arrival</h2><p className="atlas-muted">A collected sample contributes only after its supplied result/version becomes available. Future sources are absent from this response.</p><KnowledgeFrontier result={result.twin} onWhy={chooseWhy}/></section><HemoSection title="Observations after documented interventions"><InterventionResponses result={result.twin} onWhy={chooseWhy}/></HemoSection><AtlasAblation result={result} onEvidence={selectEvidence}/></>}
      {active==="spatial"&&<Suspense fallback={skeleton}><SpatialTwinMap spatial={result.spatial} onEvidence={selectEvidence}/></Suspense>}
      {active==="sandbox"&&<TwinSandbox key={result.as_of} input={{...input,as_of:result.as_of}}/>}
      {active==="copilot"&&<CardioCopilot key={result.as_of} input={{...input,as_of:result.as_of}} onEvidence={selectEvidence}/>}
      {active==="passport"&&<section className="atlas-panel"><p className="atlas-kicker">Portable integrity / no clinical approval</p><h2>Atlas Evidence Passport</h2><p>Export source evidence, transformations, provider versions, graph, consented context, state reconstruction and review metadata for {result.as_of}.</p><div className="atlas-toolbar"><button disabled={exportBusy} onClick={()=>void exportPassport()}><Download size={14} aria-hidden/>{exportBusy?"Sealing artifact…":"Export Evidence Passport"}</button><button onClick={()=>downloadHemoJson(result,`cardiotwin-atlas-snapshot-${result.as_of.slice(0,10)}.json`)}>Export snapshot</button><Link to="/interop">Open governed review / exchange</Link></div><GovernanceNote/><p className="atlas-muted">Hashes prove recorded-content integrity. They do not verify source truth, clinical correctness or clinician approval. This export does not automatically create an exchange job.</p><details><summary>Inspect current Atlas snapshot</summary><pre>{JSON.stringify(result,null,2)}</pre></details></section>}
      <section className="atlas-panel atlas-uncertainty"><div className="atlas-panel-head"><h2>Uncertainty & human governance</h2><span className="atlas-badge">Clinical approval: FALSE</span></div><ul>{result.twin.snapshot.uncertainties.map((u,i)=><li key={i}>{u}</li>)}</ul>{!result.twin.snapshot.uncertainties.length&&<p>No additional rule flags. Research limitations and human review still apply.</p>}<p className="atlas-muted">Both event time and availability time are gated before inference, graph construction and context projection. Atlas is stateless; source assertions and consent are not independently certified.</p><div className="atlas-toolbar"><Link to="/cardiotwin/hemo">Original Cardio-Hemo workspace</Link><Link to="/clinical-context">All clinical contexts</Link><Link to="/journey">Existing evidence journey</Link></div></section>
    </>}
  </div>;
}
