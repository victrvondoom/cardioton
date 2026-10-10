import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { atlas } from "../src/cardiotwin/atlas/api";
import type { AtlasResult } from "../src/cardiotwin/atlas/types";
import { HEMO_AXES, type HemoSnapshot } from "../src/cardiotwin/hemoTypes";
import CardioTwinAtlas from "../src/routes/CardioTwinAtlas";
import CardioEvidenceGraph from "../src/cardiotwin/atlas/CardioEvidenceGraph";
import TwinSandbox from "../src/cardiotwin/atlas/TwinSandbox";
import CardioCopilot from "../src/cardiotwin/atlas/CardioCopilot";
import CardioFusion from "../src/cardiotwin/atlas/CardioFusion";
import { WearableTimeline } from "../src/cardiotwin/atlas/AtlasPanels";
import mainSource from "../src/main.tsx?raw";

vi.mock("../src/cardiotwin/atlas/api",async original=>({...await original<typeof import("../src/cardiotwin/atlas/api")>(),atlas:{demo:vi.fn(),reconstruct:vi.fn(),scenarios:vi.fn(),explain:vi.fn(),passport:vi.fn()}}));
vi.mock("../src/cardiotwin/atlas/AtlasHeart3D",()=>({default:()=> <div>Evidence-linked schematic heart</div>}));
vi.mock("../src/cardiotwin/atlas/SpatialTwinMap",()=>({default:({spatial}:{spatial:AtlasResult["spatial"]})=><div>{spatial.events.map(e=><p key={String(e.id)}>{String(e.label)}</p>)}</div>}));
const at=(day:number)=>`2026-08-${String(day).padStart(2,"0")}T23:59:59Z`;
function fixture(day=21):AtlasResult{
  const observed={id:"weight",patient_ref:"Patient/synthetic-atlas",kind:"weight",value:72.0,unit:"kg",event_at:at(1),available_at:at(1),source_ref:"Observation/weight",original_record:{resourceType:"Observation",synthetic:true},provenance:{transformation:"Explicit source normalization"},classification:"OBSERVED" as const};
  const unknown={level:"UNKNOWN" as const,classification:"UNKNOWN" as const,confidence:"LOW" as const,evidence_refs:[],explanation:"No recent echo.",uncertainties:["Current pump function unknown."]};
  const snapshot={...Object.fromEntries(HEMO_AXES.map(([k])=>[k,{...unknown}])),volume_status:{...unknown,level:"ELEVATED",classification:"INFERRED",evidence_refs:["weight"]},timestamp:at(day),confidence:"LOW",evidence_refs:["weight"],uncertainties:["Limited confidence due to sparse recent evidence."],congestion:{stage:"MILD_SIGNAL",confidence:"LOW",evidence_refs:["weight"],explanation:"Possible congestion signal."}} as HemoSnapshot;
  return {as_of:at(day),twin:{as_of:at(day),patient_ref:observed.patient_ref,engine_version:"research-test",safety_notice:"Research only",research_label:"Research / clinical-support inference",snapshot,timeline:[snapshot],transitions:[],evidence:[observed],derived_measures:[],intervention_responses:[],issues:[],review:{status:"REQUIRED",clinical_approval:false}},evidence_graph:{nodes:[{id:"evidence:weight",type:"Observation",label:"Weight",classification:"OBSERVED",modality:"wearables",evidence_refs:["weight"],value:72.0,source_ref:observed.source_ref,source_record:observed.original_record,event_at:at(1),available_at:at(1),transformation:"normalized source"},{id:"state:pump_function",type:"TwinState",label:"Pump function",classification:"UNKNOWN",modality:"twin_states",evidence_refs:[],value:"UNKNOWN",uncertainties:["No recent echo."],review_status:"REQUIRED"},...(day>=15?[{id:"future-encounter",type:"SpatialContext",label:"Later encounter",classification:"OBSERVED" as const,modality:"environment",evidence_refs:[]}]:[])],edges:[]},modalities:[{id:"ecg",label:"ECG",status:"UNAVAILABLE",provider_mode:"UNAVAILABLE",provider:"No ECG classifier",version:"1",evidence_refs:[],uncertainties:["No waveform classification model."]}],spatial:{location:null,events:day>=15?[{id:"future-map",label:"Later spatial encounter"}]:[],environment:[],facilities:[],context_only:true,synthetic:true},review:{status:"REQUIRED",clinical_approval:false},demo:{label:"Synthetic story",replay_dates:[at(10),at(12),at(21)]}};
}
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
const mount=(tab="command",strict=false)=>{const route=<MemoryRouter initialEntries={[`/cardiotwin/atlas/${tab}`]}><Routes><Route path="/cardiotwin/atlas/:tab?" element={<CardioTwinAtlas/>}/></Routes></MemoryRouter>;return render(strict?<StrictMode>{route}</StrictMode>:route);};
beforeEach(()=>{vi.mocked(atlas.demo).mockResolvedValue(fixture());vi.mocked(atlas.reconstruct).mockResolvedValue(fixture());});
afterEach(()=>{cleanup();vi.resetAllMocks();});

describe("Atlas integration",()=>{
  it("adds Atlas without removing coronary, hemodynamic and interoperability routes",()=>{
    for(const path of ["/cardiotwin/atlas/:tab?","/cardiotwin/hemo","/cardiotwin/evaluation","/cardiotwin","/interop","/twin"])expect(mainSource).toContain(`path="${path}"`);
  });
  it("clears all current views during replay and uses the returned historical graph/map",async()=>{
    mount("graph");await screen.findByRole("button",{name:"Inspect Later encounter, OBSERVED"});
    const pending=deferred<AtlasResult>();vi.mocked(atlas.demo).mockReturnValueOnce(pending.promise);
    fireEvent.change(screen.getByLabelText("As-of date · end of day UTC"),{target:{value:"2026-08-10"}});
    fireEvent.click(screen.getByRole("button",{name:"Reconstruct Cardio Twin"}));
    expect(screen.queryByRole("button",{name:"Inspect Later encounter, OBSERVED"})).toBeNull();
    expect(atlas.demo).toHaveBeenLastCalledWith("2026-08-10T23:59:59.999999Z");
    pending.resolve(fixture(10));await screen.findByRole("button",{name:"Inspect Weight, OBSERVED"});
    expect(screen.queryByText("Later encounter")).toBeNull();expect(screen.getByText(at(10))).toBeTruthy();
    fireEvent.click(screen.getByRole("link",{name:"Spatial Twin"}));await screen.findByRole("navigation",{name:"CardioTwin Atlas workspaces"});
    expect(screen.queryByText("Later spatial encounter")).toBeNull();
  });
  it("ignores an obsolete StrictMode request response",async()=>{
    const old=deferred<AtlasResult>();vi.mocked(atlas.demo).mockReturnValueOnce(old.promise).mockResolvedValueOnce(fixture(10));
    mount("graph",true);await screen.findByText(at(10));old.resolve(fixture(21));await waitFor(()=>expect(screen.queryByText("Later encounter")).toBeNull());
  });
  it("supports UNKNOWN WHY and source tracing without clinical approval",async()=>{
    mount();await screen.findByRole("heading",{name:"Cardiovascular state"});
    fireEvent.click(screen.getByRole("button",{name:/Pump function UNKNOWN/}));await screen.findByTestId("hemo-why");expect(screen.getByText("No recent echo.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:/Volume status ELEVATED/}));fireEvent.click(screen.getByRole("button",{name:/Weight.*72/}));
    expect(screen.getByRole("heading",{name:"Original evidence & provenance"})).toBeTruthy();expect(screen.queryByRole("button",{name:/approve|prescribe/i})).toBeNull();
  });
  it("renders a recoverable backend error without a stale snapshot",async()=>{
    vi.mocked(atlas.demo).mockRejectedValueOnce(new Error("Provider unavailable"));mount();await screen.findByRole("alert");expect(screen.getByText("Provider unavailable")).toBeTruthy();expect(screen.queryByRole("heading",{name:"Cardiovascular state"})).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Retry reconstruction"}));await screen.findByRole("heading",{name:"Cardiovascular state"});
  });
  it("exports the displayed boundary rather than a subsequently edited date",async()=>{
    vi.mocked(atlas.passport).mockResolvedValue('{"clinical_approval":false}');vi.stubGlobal("URL",Object.assign(URL,{createObjectURL:vi.fn(()=>"blob:synthetic"),revokeObjectURL:vi.fn()}));const click=vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
    mount("passport");await screen.findByRole("heading",{name:"Atlas Evidence Passport"});fireEvent.change(screen.getByLabelText("As-of date · end of day UTC"),{target:{value:"2026-08-10"}});fireEvent.click(screen.getByRole("button",{name:"Export Evidence Passport"}));await waitFor(()=>expect(atlas.passport).toHaveBeenCalledWith({demo:true,as_of:at(21)}));click.mockRestore();
  });
});

it("graph filters preserve UNKNOWN details and links to source records",()=>{
  const trace=vi.fn();render(<CardioEvidenceGraph result={fixture()} onEvidence={trace}/>);fireEvent.click(screen.getByRole("button",{name:"unknowns",exact:true}));fireEvent.click(screen.getByRole("button",{name:"Inspect Pump function, UNKNOWN"}));expect(screen.getByText("No recent echo.")).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"wearables",exact:true}));fireEvent.click(screen.getByRole("button",{name:"Inspect Weight, OBSERVED"}));fireEvent.click(screen.getByRole("button",{name:"Open source: weight"}));expect(trace).toHaveBeenCalledWith("weight");
});
it("CardioFusion truthfully labels unavailable models and preserves structured input",()=>{
  const imported=vi.fn();render(<CardioFusion result={fixture()} input={{demo:true,as_of:at(21)}} onImport={imported} onEvidence={vi.fn()}/>);expect(screen.getByTestId("atlas-modality-ecg").textContent).toContain("UNAVAILABLE");fireEvent.change(screen.getByLabelText("Atlas input JSON or a FHIR Bundle"),{target:{value:'{"resourceType":"Bundle","entry":[]}'}});fireEvent.click(screen.getByRole("button",{name:"Reconstruct imported sources"}));expect(imported.mock.calls[0][0].bundle.resourceType).toBe("Bundle");expect(imported.mock.calls[0][0].as_of).toBe(imported.mock.calls[0][0].received_at);expect(new Date(imported.mock.calls[0][0].as_of).getTime()).toBeGreaterThan(new Date(at(21)).getTime());
});

it("new transcripts preserve submitted multimodal input, future records and bundle receipt",()=>{
  const imported=vi.fn();const input={as_of:at(21),bundle:{resourceType:"Bundle",entry:[]},received_at:at(1),modalities:[{id:"original",modality:"ecg" as const,event_at:at(1),available_at:at(1),provider_mode:"SYNTHETIC" as const,status:"AVAILABLE" as const,waveform:{samples:[0,1],sampling_rate_hz:2,lead:"II"}}]};
  render(<CardioFusion result={fixture()} input={input} onImport={imported} onEvidence={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText("Enter an available patient-reported transcript"),{target:{value:"I feel breathless."}});fireEvent.click(screen.getByRole("button",{name:"Add patient-reported transcript"}));
  const next=imported.mock.calls[0][0];expect(next.bundle).toBe(input.bundle);expect(next.received_at).toBe(at(1));expect(next.modalities[0]).toBe(input.modalities[0]);expect(next.modalities[1].available_at).toBe(next.as_of);expect(next.modalities[1].event_at).toBe(next.as_of);
});

it("measurement charts use supported units and withhold conflicting time points",()=>{
  const result=fixture();const original=result.twin.evidence[0];
  result.twin.rules={supported_units:{weight:["kg"]},numerical_bounds:{weight:[1,500]}};
  result.twin.evidence=[original,{...original,id:"pounds",value:160,unit:"lb",event_at:at(2)},{...original,id:"conflict-a",value:75,event_at:at(3)},{...original,id:"conflict-b",value:76,event_at:at(3)},{...original,id:"later",value:73,event_at:at(10)}];
  const trace=vi.fn();render(<WearableTimeline result={result} onEvidence={trace}/>);
  expect(screen.getByText("72 → 73 kg")).toBeTruthy();expect(screen.queryByText(/160 →/)).toBeNull();
  expect(screen.getByText(/3 source observations withheld/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:/Latest source/}));expect(trace).toHaveBeenCalledWith("later");
});
it("sandbox keeps hypothetical changes in a separate backend request",async()=>{
  const current=fixture(10),simulated=fixture(10);simulated.twin.snapshot.respiratory_interaction.level="HIGH";vi.mocked(atlas.scenarios).mockResolvedValue({current,simulated,scenario_status:"ISOLATED_HYPOTHETICAL",safety_notice:"RESEARCH / EDUCATIONAL SIMULATION"});const input={demo:true,as_of:at(10)};render(<TwinSandbox input={input}/>);fireEvent.change(screen.getByLabelText("Hypothetical SpO₂"),{target:{value:"88"}});fireEvent.click(screen.getByRole("button",{name:"Compare hypothetical twin"}));await screen.findByText("ISOLATED_HYPOTHETICAL");expect(atlas.scenarios).toHaveBeenCalledWith(input,[{kind:"spo2",value:88,unit:"%"}]);expect(input).toEqual({demo:true,as_of:at(10)});expect(screen.getByText(/NOT A TREATMENT RECOMMENDATION/)).toBeTruthy();
});
it("copilot labels deterministic retrieval and exposes its evidence citations",async()=>{
  const trace=vi.fn();vi.mocked(atlas.explain).mockResolvedValue({answer:"Available evidence supports a possible signal.",evidence_refs:["weight"],mode:"DETERMINISTIC_RETRIEVAL",provider:"No LLM"});render(<CardioCopilot input={{demo:true,as_of:at(10)}} onEvidence={trace}/>);fireEvent.click(screen.getByRole("button",{name:"Ask twin"}));await screen.findByText("Available evidence supports a possible signal.");fireEvent.click(screen.getByRole("button",{name:"Source: weight"}));expect(trace).toHaveBeenCalledWith("weight");
});
