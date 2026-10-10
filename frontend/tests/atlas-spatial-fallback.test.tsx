import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AtlasHeart3D from "../src/cardiotwin/atlas/AtlasHeart3D";
import SpatialTwinMap from "../src/cardiotwin/atlas/SpatialTwinMap";
import type { AtlasSpatial } from "../src/cardiotwin/atlas/types";
import { HEMO_AXES, type HemoSnapshot } from "../src/cardiotwin/hemoTypes";

vi.mock("maplibre-gl", () => { throw new Error("Renderer unavailable"); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const at="2026-08-12T23:59:59Z";
const point={latitude:12.97,longitude:77.59,available_at:at,event_at:at,synthetic:true};
const spatial:AtlasSpatial={location:{...point,id:"location",label:"Synthetic location"},events:[{...point,id:"event",label:"Symptom event",evidence_refs:["symptom-1"]}],environment:[{...point,id:"air",label:"Context PM2.5",kind:"pm25",value:31,unit:"ug/m3"}],facilities:[{...point,id:"facility",label:"Fictitious facility",distance_km:2.4,capabilities:{icu:"UNKNOWN"}}],context_only:true,synthetic:true};

it("retains context labels, layer controls and source tracing when the map renderer fails", async()=>{
  const onEvidence=vi.fn();render(<SpatialTwinMap spatial={spatial} onEvidence={onEvidence}/>);
  await waitFor(()=>expect(screen.getByLabelText("Offline coordinate projection")).toBeTruthy());
  expect(screen.getByText(/straight-line.*live capacity UNKNOWN/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Trace evidence"}));expect(onEvidence).toHaveBeenCalledWith("symptom-1");
  fireEvent.click(screen.getByRole("button",{name:"Care infrastructure"}));expect(screen.queryByRole("heading",{name:"Fictitious facility"})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Environment"}));expect(screen.queryByRole("heading",{name:"Context PM2.5"})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Care infrastructure"}));expect(screen.getByRole("heading",{name:"Fictitious facility"})).toBeTruthy();
});

it("replaces spatial evidence at replay and displays missing consent explicitly",()=>{
  const {rerender}=render(<SpatialTwinMap spatial={spatial} onEvidence={vi.fn()}/>);
  rerender(<SpatialTwinMap spatial={{...spatial,events:[],environment:[]}} onEvidence={vi.fn()}/>);
  expect(screen.queryByRole("heading",{name:"Symptom event"})).toBeNull();
  rerender(<SpatialTwinMap spatial={{...spatial,location:null,events:[],environment:[],facilities:[]}} onEvidence={vi.fn()}/>);
  expect(screen.getByText(/No consented location available/)).toBeTruthy();
  expect(screen.queryByLabelText("Offline coordinate projection")).toBeNull();
});

it("keeps all eight states and WHY controls accessible without WebGL",()=>{
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(null);
  const unknown={level:"UNKNOWN",classification:"UNKNOWN",confidence:"LOW",evidence_refs:[],explanation:"No evidence.",uncertainties:[]};
  const snapshot={...Object.fromEntries(HEMO_AXES.map(([axis])=>[axis,unknown])),timestamp:at,confidence:"LOW",evidence_refs:[],uncertainties:[],congestion:{stage:"UNKNOWN",confidence:"LOW",evidence_refs:[],explanation:"No evidence."}} as HemoSnapshot;
  const onSelect=vi.fn();render(<AtlasHeart3D snapshot={snapshot} onSelect={onSelect}/>);
  expect(screen.getByRole("list",{name:"Spatial cardiovascular state"}).querySelectorAll("button")).toHaveLength(8);
  fireEvent.click(screen.getByRole("button",{name:/Inspect Pump function state: UNKNOWN/}));expect(onSelect).toHaveBeenCalledWith("pump_function");
});
