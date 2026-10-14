import { authHeader, clearAuth } from "../../lib/core__src_lib__auth";
import { readFetch } from "../../lib/readFetch";
import type { AtlasAnswer, AtlasInput, AtlasObservation, AtlasResult, AtlasScenarioResult } from "./core__cardiotwin_atlas__types";

async function request<T>(path: string, input?: unknown, preserveText=false): Promise<T> {
  const response = await readFetch(`/api/v1/cardiotwin/atlas${path}`, {
    ...(input === undefined ? {} : { method: "POST", body: JSON.stringify(input) }),
    headers: { "Content-Type": "application/json", ...authHeader() },
  });
  if (response.status === 401) {
    clearAuth();
    window.location.href = "/login";
    throw new Error("Session expired.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    const detail = body?.detail;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail ?? body));
  }
  return (preserveText ? response.text() : response.json()) as Promise<T>;
}
export const atlas = {
  demo: (asOf?: string) => request<AtlasResult>(`/demo${asOf ? `?as_of=${encodeURIComponent(asOf)}` : ""}`),
  reconstruct: (input: AtlasInput) => request<AtlasResult>("/reconstruct", input),
  scenarios: (input: AtlasInput, changes: AtlasObservation[]) => request<AtlasScenarioResult>("/scenarios", { input, changes }),
  explain: (input: AtlasInput, question: string, options?: {use_ai?:boolean;compare_as_of?:string}) => request<AtlasAnswer>("/explain", { input, question, ...options }),
  passport: (input: AtlasInput) => request<string>("/passport", input, true),
};

/** Sealed JSON must retain the server's numerical serialization. */
export function downloadAtlasPassport(payload:unknown, filename:string) {
  const raw=typeof payload==="string"?payload:JSON.stringify(payload,null,2);
  const url=URL.createObjectURL(new Blob([raw],{type:"application/json"}));
  const anchor=document.createElement("a");anchor.href=url;anchor.download=filename;
  document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
}
