import { afterEach, expect, it, vi } from "vitest";
import { atlas, downloadAtlasPassport } from "../src/cardiotwin/atlas/api";

afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it("downloads the original sealed JSON without JavaScript number reserialization",async()=>{
  const raw='{"content":{"measurement":1e-07,"observed":72.0},"clinical_approval":false}';
  const json=vi.fn();vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,status:200,text:async()=>raw,json})));
  const payload=await atlas.passport({as_of:"2026-08-12T23:59:59Z",demo:true});
  expect(payload).toBe(raw);expect(json).not.toHaveBeenCalled();
  const blobs:unknown[][]=[];
  vi.stubGlobal("Blob",class { constructor(parts:unknown[]){blobs.push(parts);} });
  vi.stubGlobal("URL",{createObjectURL:vi.fn(()=>"blob:sealed"),revokeObjectURL:vi.fn()});vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
  downloadAtlasPassport(payload,"sealed.json");expect(blobs).toEqual([[raw]]);
});
