import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cardio } from "../src/cardiotwin/api";
import { HEMO_AXES, type HemoAxis, type HemoEvidence, type HemoResult, type HemoSnapshot } from "../src/cardiotwin/hemoTypes";
import CardioHemoTwin from "../src/routes/CardioHemoTwin";
import mainSource from "../src/main.tsx?raw";

vi.mock("../src/cardiotwin/api", async (original) => {
  const real = await original<typeof import("../src/cardiotwin/api")>();
  return { ...real, cardio: { ...real.cardio, hemoDemo: vi.fn(), hemoFhir: vi.fn(), hemoPassport: vi.fn(), hemoFhirPassport: vi.fn(), hemoDemoPassport: vi.fn(), predict: vi.fn(), model: vi.fn() } };
});

const at = (day: number) => `2026-08-${String(day).padStart(2, "0")}T23:59:59Z`;
const endAt = (day: number) => `2026-08-${String(day).padStart(2, "0")}T23:59:59.999999Z`;
const axis = (level: HemoAxis["level"] = "UNKNOWN"): HemoAxis => ({ level, classification: level === "UNKNOWN" ? "UNKNOWN" : "INFERRED", confidence: "LOW", evidence_refs: level === "UNKNOWN" ? [] : ["weight-3", "edema-3"], explanation: level === "UNKNOWN" ? "No recent echocardiogram." : "Available weight and edema records are compatible with a possible congestion signal.", uncertainties: level === "UNKNOWN" ? ["Sparse recent evidence."] : [] });
const evidence = (id: string, day: number, kind: string, value: unknown, source: string): HemoEvidence => ({ id, patient_ref: "Patient/synthetic-hemo", kind, value, unit: kind === "weight" ? "kg" : null, event_at: at(day), available_at: at(day), source_ref: source, original_record: { resourceType: "Observation", id, valueString: value }, provenance: { source_system: "Synthetic generator", transformation: "Explicit source mapping", synthetic: true }, classification: "OBSERVED" });
function fixture(day = 21): HemoResult {
  const snapshot = {
    ...Object.fromEntries(HEMO_AXES.map(([key]) => [key, axis()])), volume_status: axis("ELEVATED"), timestamp: at(day), confidence: "LOW", evidence_refs: ["weight-3", "edema-3"], uncertainties: ["Limited confidence due to sparse recent evidence.", "Rhythm status uncertain.", "Evidence window contains conflicting observations."], congestion: { stage: "INCREASING_CONCERN", confidence: "LOW", evidence_refs: ["weight-3", "edema-3"], explanation: "Evidence is consistent with a possible worsening congestion trajectory." },
  } as HemoSnapshot;
  const records = [evidence("weight-3", 3, "weight", 83.2, "Observation/weight-3"), evidence("edema-3", 3, "edema", "Newly documented", "Observation/edema-3")];
  if (day >= 20) records.push(evidence("hospital-20", 20, "hospitalization", "Emergency encounter", "Encounter/hospital-20"));
  return { engine_version: "hemo-test-1", as_of: at(day), patient_ref: "Patient/synthetic-hemo", safety_notice: "This is not a medical diagnosis or autonomous treatment recommendation.", research_label: "Research / clinical-support inference", review: { status: "REQUIRED", clinical_approval: false }, snapshot, timeline: [snapshot], transitions: [{ id: "volume-transition", timestamp: at(3), axis: "volume_status", from_level: "NORMAL", to_level: "ELEVATED", evidence_refs: ["weight-3", "edema-3"], explanation: "Weight +3.2 kg and newly documented edema support this possible congestion signal.", confidence: "LOW", review_required: true }], evidence: records, issues: [{ code: "CONFLICT", message: "Conflicting rhythm observations remain UNKNOWN." }], derived_measures: [{ id: "weight-delta", kind: "weight_change", value: 3.2, unit: "kg", evidence_refs: ["weight-3"], classification: "DERIVED", percent_change: 4, timestamp: at(day), baseline: 80, latest: 83.2, window_days: 7, transformation: "latest minus baseline" }], intervention_responses: [], demo: { label: "Synthetic longitudinal scenario", start_at: at(1), end_at: at(21), replay_dates: [at(3), at(12), at(21)], guide: ["Replay a date", "Inspect WHY", "Trace source"] } };
}
const mount = () => render(<MemoryRouter><CardioHemoTwin /></MemoryRouter>);
const openPanel = (name: string) => fireEvent.click(screen.getByRole("tab", { name }));
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: Error) => void; const promise = new Promise<T>((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; }

beforeEach(() => {
  vi.mocked(cardio.hemoDemo).mockResolvedValue(fixture());
  vi.mocked(cardio.hemoFhir).mockResolvedValue({ ...fixture(), demo: undefined });
  vi.mocked(cardio.hemoDemoPassport).mockResolvedValue({ review: { status: "REQUIRED" }, evidence: [] });
  vi.mocked(cardio.hemoPassport).mockResolvedValue({ review: { status: "REQUIRED" }, evidence: [] });
  vi.mocked(cardio.hemoFhirPassport).mockResolvedValue({ review: { status: "REQUIRED" }, evidence: [] });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("CARDIO-HEMO TWIN", () => {
  it("adds a protected route and preserves both coronary routes", () => {
    expect(mainSource).toContain('path="/cardiotwin/hemo"');
    expect(mainSource).toContain('path="/cardiotwin"');
    expect(mainSource).toContain('path="/cardiotwin/evaluation"');
  });

  it("works without an LLM, labels inference and uncertainty, and offers no autonomous approval", async () => {
    mount();
    await screen.findByTestId("hemo-as-of");
    expect(screen.getByRole("heading", { name: "CARDIO-HEMO TWIN" })).toBeTruthy();
    expect(screen.getByTestId("hemo-axis-pump_function").textContent).toContain("UNKNOWN");
    expect(screen.getByTestId("hemo-axis-volume_status").textContent).toContain("INFERRED");
    openPanel("Uncertainty");
    expect(screen.getByText("Limited confidence due to sparse recent evidence.")).toBeTruthy();
    expect(screen.getByText("Rhythm status uncertain.")).toBeTruthy();
    fireEvent.click(screen.getByText(/Research \/ clinical-support inference.*human review required/));
    expect(screen.getByRole("note", { name: "Cardio-hemo clinical safety boundary" }).textContent).toContain("not a medical diagnosis");
    expect(screen.queryByRole("button", { name: /approve|prescribe/i })).toBeNull();
    openPanel("Import & export");
    expect(screen.getByRole("link", { name: /Existing review/ }).getAttribute("href")).toBe("/interop");
    expect(cardio.predict).not.toHaveBeenCalled();
    expect(cardio.model).not.toHaveBeenCalled();
  });

  it("WHY links contributing evidence to original records and transformation provenance", async () => {
    mount();
    await screen.findByTestId("hemo-as-of");
    openPanel("Evidence & WHY");
    const why = await screen.findByTestId("hemo-why");
    expect(why.textContent).toContain("Weight +3.2 kg");
    expect(why.textContent).toContain("Human review REQUIRED");
    fireEvent.click(within(why).getByRole("button", { name: /Weight.*83.2/ }));
    const recordPanel = screen.getByRole("heading", { name: "Twin state → evidence → original record" }).closest("section")!;
    expect(recordPanel.textContent).toContain("Observation/weight-3");
    expect(recordPanel.textContent).toContain("Explicit source mapping");
    expect(recordPanel.textContent).toContain('"resourceType": "Observation"');
    expect(recordPanel.textContent).toContain("Available to twin");
    fireEvent.click(within(recordPanel).getByRole("button", { name: "Back to explanation" }));
    expect(screen.queryByRole("heading", { name: "Twin state → evidence → original record" })).toBeNull();
  });

  it("clears current evidence while replay loads and never displays later hospital evidence in the historical result", async () => {
    const pending = deferred<HemoResult>();
    mount();
    await screen.findByTestId("hemo-as-of");
    openPanel("Evidence & WHY");
    await screen.findByTestId("hemo-evidence-hospital-20");
    const anatomyViewer = screen.getByTestId("hemo-realistic-scene");
    vi.mocked(cardio.hemoDemo).mockReturnValueOnce(pending.promise);
    fireEvent.change(screen.getByLabelText("As-of date · end of day UTC"), { target: { value: "2026-08-03" } });
    fireEvent.click(screen.getByRole("button", { name: "Reconstruct as of date" }));
    expect(cardio.hemoDemo).toHaveBeenLastCalledWith(endAt(3));
    expect(screen.queryByTestId("hemo-evidence-hospital-20")).toBeNull();
    expect(screen.queryByTestId("hemo-axis-volume_status")).toBeNull();
    expect(screen.getByTestId("hemo-realistic-scene")).toBe(anatomyViewer);
    expect(screen.queryByLabelText("Current reconstruction context")).toBeNull();
    pending.resolve(fixture(3));
    await screen.findByTestId("hemo-as-of");
    expect(screen.getByTestId("hemo-as-of").textContent).toContain(at(3));
    expect(screen.queryByTestId("hemo-evidence-hospital-20")).toBeNull();
    expect(screen.getByTestId("hemo-realistic-scene")).toBe(anatomyViewer);
  });

  it("ignores an obsolete reconstruction response under StrictMode", async () => {
    const old = deferred<HemoResult>();
    const current = deferred<HemoResult>();
    vi.mocked(cardio.hemoDemo).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    render(<StrictMode><MemoryRouter><CardioHemoTwin /></MemoryRouter></StrictMode>);
    await waitFor(() => expect(cardio.hemoDemo).toHaveBeenCalledTimes(2));
    current.resolve(fixture(3));
    await screen.findByTestId("hemo-as-of");
    old.resolve(fixture(21));
    await waitFor(() => expect(screen.getByTestId("hemo-as-of").textContent).toContain(at(3)));
    expect(screen.queryByTestId("hemo-evidence-hospital-20")).toBeNull();
  });

  it("keeps sparse or conflicting state UNKNOWN and exposes structured issues", async () => {
    mount();
    await screen.findByTestId("hemo-as-of");
    expect(screen.getByTestId("hemo-axis-rhythm_stability").textContent).toContain("UNKNOWN");
    openPanel("Uncertainty");
    expect(screen.getByText("Evidence window contains conflicting observations.")).toBeTruthy();
    expect(screen.getByText(/Conflicting rhythm observations remain UNKNOWN/)).toBeTruthy();
    openPanel("Clinical patterns");
    expect(screen.getByText(/No evaluable intervention response/)).toBeTruthy();
  });

  it("rejects invalid or non-Bundle input locally and calls the existing API for a valid Bundle", async () => {
    mount();
    await screen.findByTestId("hemo-as-of");
    openPanel("Import & export");
    const input = screen.getByLabelText("FHIR Bundle JSON");
    fireEvent.change(input, { target: { value: "invalid" } });
    fireEvent.click(screen.getByRole("button", { name: /Reconstruct FHIR evidence/ }));
    expect(screen.getByTestId("cardiohemo-error").textContent).toContain("valid JSON FHIR Bundle");
    expect(cardio.hemoFhir).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '{"resourceType":"Patient"}' } });
    fireEvent.click(screen.getByRole("button", { name: /Reconstruct FHIR evidence/ }));
    expect(screen.getByTestId("cardiohemo-error").textContent).toContain("FHIR R4 Bundle object");
    const bundle = { resourceType: "Bundle", type: "collection", entry: [] };
    fireEvent.change(input, { target: { value: JSON.stringify(bundle) } });
    fireEvent.change(screen.getByLabelText(/Patient reference/), { target: { value: "Patient/synthetic-hemo" } });
    fireEvent.change(screen.getByLabelText("Reconstruction date · UTC"), { target: { value: "2026-08-21" } });
    fireEvent.click(screen.getByRole("button", { name: /Reconstruct FHIR evidence/ }));
    await waitFor(() => expect(cardio.hemoFhir).toHaveBeenCalledWith(expect.objectContaining({ bundle, patient_ref: "Patient/synthetic-hemo", as_of: endAt(21), received_at: expect.any(String) })));
    await screen.findByText("FHIR EVIDENCE RECONSTRUCTION");
  });

  it("shows backend failures without leaving an obsolete state visible", async () => {
    mount();
    await screen.findByTestId("hemo-as-of");
    vi.mocked(cardio.hemoDemo).mockRejectedValueOnce(new Error("FHIR evidence has conflicting timestamps"));
    fireEvent.click(screen.getByRole("button", { name: "Reconstruct as of date" }));
    expect((await screen.findByTestId("cardiohemo-error")).textContent).toContain("conflicting timestamps");
    expect(screen.queryByTestId("hemo-axis-volume_status")).toBeNull();
  });

  it("exports the Evidence Passport for exactly the currently selected as-of timestamp", async () => {
    const create = vi.fn(() => "blob:test");
    const revoke = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.mocked(cardio.hemoDemo).mockResolvedValueOnce(fixture(3));
    mount();
    await screen.findByTestId("hemo-as-of");
    openPanel("Import & export");
    fireEvent.click(screen.getByRole("button", { name: "Export Evidence Passport" }));
    await waitFor(() => expect(cardio.hemoDemoPassport).toHaveBeenCalledWith(at(3)));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(revoke).toHaveBeenCalledWith("blob:test");
    click.mockRestore();
  });

  it("includes fractional observations throughout the last second of a replay date", async () => {
    mount();
    await screen.findByTestId("hemo-as-of");
    fireEvent.change(screen.getByLabelText("As-of date · end of day UTC"), { target: { value: "2026-08-03" } });
    fireEvent.click(screen.getByRole("button", { name: "Reconstruct as of date" }));
    expect(cardio.hemoDemo).toHaveBeenLastCalledWith("2026-08-03T23:59:59.999999Z");
    await screen.findByTestId("hemo-as-of");
  });

  it("names the exported snapshot after its actual reconstruction, not an unapplied date edit", async () => {
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    let filename = "";
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { filename = this.download; });
    mount();
    await screen.findByTestId("hemo-as-of");
    fireEvent.change(screen.getByLabelText("As-of date · end of day UTC"), { target: { value: "2026-08-03" } });
    openPanel("Import & export");
    fireEvent.click(screen.getByRole("button", { name: "Export snapshot" }));
    expect(filename).toBe("cardio-hemo-snapshot-2026-08-21.json");
    expect(cardio.hemoDemo).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it("rebuilds a FHIR passport from the original Bundle, preserving intake context and receipt time", async () => {
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    mount();
    await screen.findByTestId("hemo-as-of");
    const bundle = { resourceType: "Bundle", type: "collection", entry: [{ resource: { resourceType: "Patient", id: "synthetic-hemo" } }] };
    openPanel("Import & export");
    fireEvent.change(screen.getByLabelText("FHIR Bundle JSON"), { target: { value: JSON.stringify(bundle) } });
    fireEvent.change(screen.getByLabelText(/Patient reference/), { target: { value: "Patient/synthetic-hemo" } });
    fireEvent.change(screen.getByLabelText("Reconstruction date · UTC"), { target: { value: "2026-08-21" } });
    fireEvent.click(screen.getByRole("button", { name: /Reconstruct FHIR evidence/ }));
    await screen.findByText("FHIR EVIDENCE RECONSTRUCTION");
    const original = vi.mocked(cardio.hemoFhir).mock.calls[0][0];
    openPanel("Import & export");
    fireEvent.click(screen.getByRole("button", { name: "Export Evidence Passport" }));
    await waitFor(() => expect(cardio.hemoFhirPassport).toHaveBeenCalledWith({ ...original, as_of: at(21) }));
    expect(cardio.hemoPassport).not.toHaveBeenCalled();
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    click.mockRestore();
  });

  it("does not attach a failed older passport export to a newer replay", async () => {
    const pending = deferred<unknown>();
    vi.mocked(cardio.hemoDemoPassport).mockReturnValueOnce(pending.promise);
    mount();
    await screen.findByTestId("hemo-as-of");
    openPanel("Import & export");
    fireEvent.click(screen.getByRole("button", { name: "Export Evidence Passport" }));
    vi.mocked(cardio.hemoDemo).mockResolvedValueOnce(fixture(3));
    fireEvent.change(screen.getByLabelText("As-of date · end of day UTC"), { target: { value: "2026-08-03" } });
    fireEvent.click(screen.getByRole("button", { name: "Reconstruct as of date" }));
    await screen.findByTestId("hemo-as-of");
    expect(screen.getByTestId("hemo-as-of").textContent).toContain(at(3));
    pending.reject(new Error("Old export failed"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Export Evidence Passport" }).hasAttribute("disabled")).toBe(false));
    expect(screen.queryByTestId("cardiohemo-error")).toBeNull();
  });

  it("keeps every detail area in one keyboard-accessible workspace while retaining import edits and anatomy", async () => {
    mount();
    await screen.findByTestId("hemo-as-of");
    const anatomy = screen.getByTestId("hemo-realistic-scene");
    const overview = screen.getByRole("tab", { name: "Overview" });
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(overview.id);
    expect(screen.getAllByRole("tabpanel", { hidden: true })).toHaveLength(5);
    // Expensive evidence/JSON detail trees mount on first use, then retain
    // their DOM so drafts and native disclosures survive tab switches.
    expect(screen.queryByLabelText("FHIR Bundle JSON")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Patient cardiovascular timeline", hidden: true })).toBeNull();
    fireEvent.keyDown(overview, { key: "End" });
    const exchange = screen.getByRole("tab", { name: "Import & export" });
    expect(exchange.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(exchange);
    const input = screen.getByLabelText("FHIR Bundle JSON") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '{"resourceType":"Bundle","entry":[]}' } });
    fireEvent.keyDown(exchange, { key: "ArrowRight" });
    expect(overview.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("hemo-realistic-scene")).toBe(anatomy);
    openPanel("Import & export");
    expect(screen.getByLabelText("FHIR Bundle JSON")).toBe(input);
    expect(input.value).toBe('{"resourceType":"Bundle","entry":[]}');
    expect(screen.getByRole("button", { name: "Export Evidence Passport" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Reconstruct FHIR evidence/ })).toBeTruthy();
    fireEvent.keyDown(exchange, { key: "Home" });
    expect(document.activeElement).toBe(overview);
    fireEvent.keyDown(overview, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(exchange);
  });

  it("opens retained evidence from a compact state and keeps provenance disclosures across panel changes", async () => {
    mount();
    await screen.findByTestId("hemo-as-of");
    fireEvent.click(screen.getByText(/Detailed state vector/));
    fireEvent.click(screen.getByTestId("hemo-axis-volume_status"));
    expect(screen.getByRole("tab", { name: "Evidence & WHY" }).getAttribute("aria-selected")).toBe("true");
    const why = screen.getByTestId("hemo-why");
    fireEvent.click(within(why).getByRole("button", { name: /Weight.*83.2/ }));
    const source = screen.getByRole("heading", { name: /Twin state.*original record/ }).closest("section")!;
    const disclosure = within(source).getByText("Original record & provenance").closest("details")!;
    fireEvent.click(within(source).getByText("Original record & provenance"));
    expect(disclosure.open).toBe(true);
    openPanel("Clinical patterns");
    expect(screen.getByRole("heading", { name: "Derived measures" })).toBeTruthy();
    openPanel("Uncertainty");
    expect(screen.getByRole("heading", { name: "Uncertainty is part of the twin" })).toBeTruthy();
    openPanel("Evidence & WHY");
    expect(disclosure.open).toBe(true);
    expect(screen.getByRole("heading", { name: "Patient cardiovascular timeline" })).toBeTruthy();
    expect(within(source).getByTestId("hemo-evidence-weight-3").textContent).toContain("Explicit source mapping");
  });

});
