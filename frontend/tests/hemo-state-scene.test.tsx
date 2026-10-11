import { useEffect } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HemoStateScene from "../src/cardiotwin/HemoStateScene";
import { HEMO_AXES, type HemoAxis, type HemoEvidence, type HemoSnapshot } from "../src/cardiotwin/hemoTypes";

interface MockCanvasProps {
  animated: boolean; rotate: boolean; cutaway: boolean; vesselsVisible: boolean; flowVisible: boolean;
  view: string; reset: number; selectedStructure: string | null;
  onReady: () => void; onFailure: () => void;
}
const canvasRender = vi.hoisted(() => vi.fn());
vi.mock("../src/cardiotwin/HemoHeartCanvas", () => ({
  default: function MockHemoHeartCanvas(props: MockCanvasProps) {
    canvasRender(props);
    useEffect(() => props.onReady(), [props.onReady]);
    return <div data-testid="mock-heart-canvas" data-animated={String(props.animated)} data-rotate={String(props.rotate)}
      data-cutaway={String(props.cutaway)} data-vessels={String(props.vesselsVisible)} data-flow={String(props.flowVisible)}
      data-view={props.view} data-reset={props.reset} data-selected={props.selectedStructure ?? ""}>
      <button type="button" onClick={props.onFailure}>Simulate renderer failure</button>
    </div>;
  },
}));

function mediaPreference(reduced = false) {
  const media = {
    matches: reduced, media: "(prefers-reduced-motion: reduce)", onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
  vi.stubGlobal("matchMedia", vi.fn(() => media));
}
function enableWebGL() {
  vi.stubGlobal("WebGLRenderingContext", class FakeWebGLRenderingContext {});
  const context = { getExtension: vi.fn(() => null) } as unknown as ReturnType<HTMLCanvasElement["getContext"]>;
  return vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
}
beforeEach(() => {
  canvasRender.mockClear();
  mediaPreference();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const unknown: HemoAxis = { level: "UNKNOWN", classification: "UNKNOWN", confidence: "LOW", evidence_refs: [], explanation: "No recent evidence.", uncertainties: ["Sparse recent evidence."] };
const snapshot = {
  ...Object.fromEntries(HEMO_AXES.map(([key]) => [key, unknown])),
  volume_status: { ...unknown, level: "ELEVATED", classification: "INFERRED", confidence: "MODERATE", evidence_refs: ["weight-1", "edema-1"] },
  timestamp: "2026-08-12T23:59:59Z", confidence: "LOW", evidence_refs: ["weight-1", "edema-1"], uncertainties: [],
  congestion: { stage: "INCREASING_CONCERN", confidence: "MODERATE", evidence_refs: ["weight-1", "edema-1"], explanation: "Possible congestion signal." },
} as HemoSnapshot;

describe("Spatial hemodynamic state", () => {
  it("shows all eight source states without turning unknown evidence into a measurement", () => {
    render(<HemoStateScene snapshot={snapshot} onSelect={vi.fn()} />);
    const states = screen.getByRole("list", { name: "Spatial cardiovascular state" });
    expect(within(states).getAllByRole("button")).toHaveLength(8);
    expect(screen.getByRole("button", { name: "Inspect Pump function state: UNKNOWN. UNKNOWN. LOW confidence." }).textContent).toContain("UNKNOWN");
    expect(screen.getByRole("button", { name: "Inspect Volume status state: ELEVATED. INFERRED. MODERATE confidence." }).textContent).toContain("INFERRED");
    expect(screen.getByText(/Spatial position is schematic/)).toBeTruthy();
  });

  it("opens existing evidence selection for known and unknown dimensions", () => {
    const onSelect = vi.fn();
    render(<HemoStateScene snapshot={snapshot} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Inspect Pump function state/ }));
    fireEvent.click(screen.getByRole("button", { name: /Inspect Volume status state/ }));
    expect(onSelect.mock.calls).toEqual([["pump_function"], ["volume_status"]]);
  });

  it("pauses and resumes illustrative heartbeat independently of auto rotation", async () => {
    enableWebGL();
    render(<HemoStateScene snapshot={snapshot} onSelect={vi.fn()} />);
    const canvas = await screen.findByTestId("mock-heart-canvas");
    expect(canvas.getAttribute("data-animated")).toBe("true");
    expect(canvas.getAttribute("data-rotate")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Auto rotate" }));
    expect(canvas.getAttribute("data-rotate")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Pause illustrative heartbeat" }));
    expect(canvas.getAttribute("data-animated")).toBe("false");
    expect(canvas.getAttribute("data-rotate")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Play illustrative heartbeat" }));
    expect(canvas.getAttribute("data-animated")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Auto rotate" }));
    expect(canvas.getAttribute("data-rotate")).toBe("false");
  });

  it("suspends animation when the actual anatomy viewport is offscreen and retains user preferences", async () => {
    enableWebGL();
    let notify: (visible: boolean) => void = () => {};
    const observer = { observe: vi.fn(), disconnect: vi.fn() };
    const createObserver = vi.fn(function(callback: IntersectionObserverCallback) {
      notify = visible => callback([{ isIntersecting: visible, intersectionRatio: visible ? 1 : 0 } as IntersectionObserverEntry], observer as unknown as IntersectionObserver);
      return observer;
    });
    vi.stubGlobal("IntersectionObserver", createObserver);
    const view = render(<HemoStateScene snapshot={snapshot} onSelect={vi.fn()} />);
    const canvas = await screen.findByTestId("mock-heart-canvas");
    expect(observer.observe).toHaveBeenCalledWith(screen.getByRole("region", { name: "Interactive 3D reference heart" }));
    expect(createObserver).toHaveBeenCalledWith(expect.any(Function), { threshold: .01 });
    const rotateButton = screen.getByRole("button", { name: "Auto rotate" });
    fireEvent.click(rotateButton);
    act(() => notify(false));
    expect(canvas.getAttribute("data-animated")).toBe("false");
    expect(canvas.getAttribute("data-rotate")).toBe("false");
    expect(rotateButton.getAttribute("aria-pressed")).toBe("true");
    act(() => notify(true));
    expect(canvas.getAttribute("data-animated")).toBe("true");
    expect(canvas.getAttribute("data-rotate")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Pause illustrative heartbeat" }));
    act(() => notify(false));
    act(() => notify(true));
    expect(canvas.getAttribute("data-animated")).toBe("false");
    expect(canvas.getAttribute("data-rotate")).toBe("true");
    view.unmount();
    expect(observer.disconnect).toHaveBeenCalledOnce();
  });

  it("toggles cutaway, vessel visibility, and illustrative flow without changing evidence state", async () => {
    enableWebGL();
    render(<HemoStateScene snapshot={snapshot} onSelect={vi.fn()} />);
    const canvas = await screen.findByTestId("mock-heart-canvas");
    expect(canvas.getAttribute("data-cutaway")).toBe("false");
    expect(canvas.getAttribute("data-vessels")).toBe("true");
    expect(canvas.getAttribute("data-flow")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Cutaway" }));
    expect(canvas.getAttribute("data-cutaway")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Illustrative flow" }));
    expect(canvas.getAttribute("data-flow")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Vessels" }));
    expect(canvas.getAttribute("data-vessels")).toBe("false");
    expect(canvas.getAttribute("data-flow")).toBe("false");
    expect((screen.getByRole("button", { name: "Illustrative flow" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Vessels" }));
    expect(canvas.getAttribute("data-vessels")).toBe("true");
    expect(canvas.getAttribute("data-flow")).toBe("true");
    expect(screen.getByRole("button", { name: /Inspect Volume status state: ELEVATED/ }).textContent).toContain("INFERRED");
  });

  it("changes camera presets and resets the camera and selected anatomy", async () => {
    enableWebGL();
    render(<HemoStateScene snapshot={snapshot} onSelect={vi.fn()} />);
    const canvas = await screen.findByTestId("mock-heart-canvas");
    expect(canvas.getAttribute("data-view")).toBe("anterior");
    expect(canvas.getAttribute("data-reset")).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Posterior" }));
    expect(canvas.getAttribute("data-view")).toBe("posterior");
    expect(canvas.getAttribute("data-reset")).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Left lateral" }));
    expect(canvas.getAttribute("data-view")).toBe("left");
    expect(canvas.getAttribute("data-reset")).toBe("2");
    fireEvent.change(screen.getByRole("combobox", { name: "Inspect reference anatomy" }), { target: { value: "LEFT_VENTRICLE" } });
    expect(canvas.getAttribute("data-selected")).toBe("LEFT_VENTRICLE");
    fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
    expect(canvas.getAttribute("data-view")).toBe("anterior");
    expect(canvas.getAttribute("data-reset")).toBe("3");
    expect(canvas.getAttribute("data-selected")).toBe("");
  });

  it("starts with pulse, rotation, and flow paused when reduced motion is requested", async () => {
    enableWebGL();
    mediaPreference(true);
    render(<HemoStateScene snapshot={snapshot} onSelect={vi.fn()} />);
    const canvas = await screen.findByTestId("mock-heart-canvas");
    expect(canvas.getAttribute("data-animated")).toBe("false");
    expect(canvas.getAttribute("data-rotate")).toBe("false");
    expect(canvas.getAttribute("data-flow")).toBe("false");
    for (const name of ["Play illustrative heartbeat", "Auto rotate", "Illustrative flow"]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    fireEvent.click(screen.getByRole("button", { name: "Cutaway" }));
    expect(canvas.getAttribute("data-cutaway")).toBe("true");
  });

  it("keeps the reference preview and all evidence dimensions accessible without WebGL", () => {
    enableWebGL().mockReturnValue(null);
    const onSelect = vi.fn();
    render(<HemoStateScene snapshot={snapshot} onSelect={onSelect} />);
    expect(screen.queryByTestId("mock-heart-canvas")).toBeNull();
    expect(screen.getByRole("img", { name: /Detailed human heart reference anatomy/ })).toBeTruthy();
    const states = screen.getByRole("list", { name: "Spatial cardiovascular state" });
    expect(within(states).getAllByRole("button")).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: /Inspect Pump function state/ }));
    expect(onSelect).toHaveBeenCalledWith("pump_function");
    expect((screen.getByRole("button", { name: "Cutaway" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("restores the preview after renderer failure while retaining source inspection", async () => {
    enableWebGL();
    const onSelect = vi.fn();
    render(<HemoStateScene snapshot={snapshot} onSelect={onSelect} />);
    await screen.findByTestId("mock-heart-canvas");
    fireEvent.click(screen.getByRole("button", { name: "Simulate renderer failure" }));
    expect(screen.queryByTestId("mock-heart-canvas")).toBeNull();
    expect(screen.getByRole("img", { name: /Detailed human heart reference anatomy/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Inspect Volume status state/ }));
    expect(onSelect).toHaveBeenCalledWith("volume_status");
  });

  it("updates dated rate evidence across replay and source changes without using it to drive pulse", async () => {
    enableWebGL();
    const rate = (id: string, day: number, value: number): HemoEvidence => ({
      id, patient_ref: "Patient/synthetic-scene", kind: "heart_rate", value, unit: "bpm",
      event_at: `2026-08-${day}T08:00:00Z`, available_at: `2026-08-${day}T10:00:00Z`, source_ref: `Observation/${id}`,
      original_record: { resourceType: "Observation", id }, provenance: { synthetic: true }, classification: "OBSERVED",
    });
    const evidence = [rate("earlier", 12, 86), rate("later", 15, 104)];
    const onSelect = vi.fn();
    const view = render(<HemoStateScene snapshot={snapshot} evidence={evidence} asOf={snapshot.timestamp} onSelect={onSelect} />);
    const canvas = await screen.findByTestId("mock-heart-canvas");
    const context = screen.getByLabelText("Current reconstruction context");
    expect(screen.getByText("86 bpm")).toBeTruthy();
    expect(screen.queryByText("104 bpm")).toBeNull();
    expect(canvas.getAttribute("data-animated")).toBe("true");
    view.rerender(<HemoStateScene snapshot={snapshot} evidence={evidence} asOf="2026-08-15T23:59:59Z" onSelect={onSelect} />);
    expect(screen.getByText("104 bpm")).toBeTruthy();
    expect(screen.queryByText("86 bpm")).toBeNull();
    expect(canvas.getAttribute("data-animated")).toBe("true");
    view.rerender(<HemoStateScene snapshot={snapshot} evidence={[rate("replacement", 15, 80)]} asOf="2026-08-15T23:59:59Z" onSelect={onSelect} />);
    expect(screen.getByText("80 bpm")).toBeTruthy();
    view.rerender(<HemoStateScene snapshot={snapshot} evidence={evidence} asOf="2026-08-11T23:59:59Z" onSelect={onSelect} />);
    expect(screen.queryByText(/\d+ bpm/)).toBeNull();
    expect(context?.textContent).toContain("UNKNOWN");
    expect(canvas.getAttribute("data-animated")).toBe("true");
    expect(canvasRender.mock.lastCall?.[0]).not.toHaveProperty("heartRate");
  });

  it("explains unknown conflicting rate sources without labeling them observed telemetry", () => {
    const rate: HemoEvidence = {
      id: "a", patient_ref: "Patient/synthetic-scene", kind: "heart_rate", value: 80, unit: "bpm",
      event_at: "2026-08-12T08:00:00Z", available_at: "2026-08-12T10:00:00Z", source_ref: "Observation/a",
      original_record: {}, provenance: { synthetic: true }, classification: "OBSERVED",
    };
    render(<HemoStateScene snapshot={snapshot} evidence={[rate, { ...rate, id: "b", value: 104 }]} onSelect={vi.fn()} />);
    const context = screen.getByLabelText("Current reconstruction context");
    expect(context.textContent).toContain("UNKNOWN");
    expect(context.textContent).toContain("conflicting values");
    expect(context.textContent).not.toContain("OBSERVED source");
    expect(within(context).queryByText(/\d+ bpm/)).toBeNull();
  });

  it("withholds old states and source readouts during replay while preserving the canvas and presentation controls", async () => {
    enableWebGL();
    const rate: HemoEvidence = {
      id: "rate", patient_ref: "Patient/synthetic-scene", kind: "heart_rate", value: 80, unit: "bpm",
      event_at: "2026-08-12T08:00:00Z", available_at: "2026-08-12T10:00:00Z", source_ref: "Observation/rate",
      original_record: {}, provenance: { synthetic: true }, classification: "OBSERVED",
    };
    const onSelect = vi.fn();
    const view = render(<HemoStateScene snapshot={snapshot} evidence={[rate]} onSelect={onSelect} />);
    const canvas = await screen.findByTestId("mock-heart-canvas");
    expect(screen.getByText("80 bpm")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pause illustrative heartbeat" }));
    fireEvent.click(screen.getByRole("button", { name: "Auto rotate" }));
    fireEvent.click(screen.getByRole("button", { name: "Cutaway" }));
    fireEvent.click(screen.getByRole("button", { name: "Left lateral" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Inspect reference anatomy" }), { target: { value: "LEFT_VENTRICLE" } });
    view.rerender(<HemoStateScene snapshot={snapshot} evidence={[rate]} pending onSelect={onSelect} />);
    expect(screen.getByTestId("mock-heart-canvas")).toBe(canvas);
    expect(canvas.getAttribute("data-animated")).toBe("false");
    expect(canvas.getAttribute("data-rotate")).toBe("true");
    expect(canvas.getAttribute("data-cutaway")).toBe("true");
    expect(canvas.getAttribute("data-view")).toBe("left");
    expect(canvas.getAttribute("data-selected")).toBe("LEFT_VENTRICLE");
    expect(within(screen.getByRole("list", { name: "Spatial cardiovascular state" })).queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByLabelText("Current reconstruction context")).toBeNull();
    expect(screen.queryByText("80 bpm")).toBeNull();
    expect(screen.queryByText("ELEVATED")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("source readouts are withheld");
    fireEvent.click(screen.getByRole("button", { name: "Vessels" }));
    expect(canvas.getAttribute("data-vessels")).toBe("false");
    expect(onSelect).not.toHaveBeenCalled();
    view.rerender(<HemoStateScene snapshot={snapshot} evidence={[rate]} asOf="2026-08-15T23:59:59Z" onSelect={onSelect} />);
    expect(screen.getByTestId("mock-heart-canvas")).toBe(canvas);
    expect(screen.getByText("80 bpm")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Spatial cardiovascular state" })).getAllByRole("button")).toHaveLength(8);
    expect(canvas.getAttribute("data-animated")).toBe("false");
    expect(canvas.getAttribute("data-vessels")).toBe("false");
  });

  it("expands into an accessible dialog and returns after native Escape cancellation with focus restored", async () => {
    enableWebGL();
    render(<HemoStateScene snapshot={snapshot} onSelect={vi.fn()} />);
    await screen.findByTestId("mock-heart-canvas");
    const originalOverflow = document.body.style.overflow;
    fireEvent.click(screen.getByRole("button", { name: "Expand heart viewer" }));
    const modal = screen.getByRole("dialog", { name: "Expanded heart viewer" });
    expect(modal.getAttribute("open")).not.toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    expect(within(modal).getByRole("group", { name: "Heart presentation controls" })).toBeTruthy();
    expect(within(modal).getByRole("list", { name: "Spatial cardiovascular state" }).querySelectorAll("button")).toHaveLength(8);
    // Browsers dispatch native dialog cancel for Escape; jsdom does not implement that key default.
    fireEvent(modal, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog", { name: "Expanded heart viewer" })).toBeNull();
    expect(document.body.style.overflow).toBe(originalOverflow);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Expand heart viewer" })));
    fireEvent.click(screen.getByRole("button", { name: "Expand heart viewer" }));
    fireEvent.click(screen.getByRole("button", { name: "Reduce heart viewer" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe(originalOverflow);
  });

  it("closes the expanded dialog when a dimension opens its existing evidence selection", async () => {
    enableWebGL();
    const onSelect = vi.fn();
    render(<HemoStateScene snapshot={snapshot} onSelect={onSelect} />);
    await screen.findByTestId("mock-heart-canvas");
    const originalOverflow = document.body.style.overflow;
    fireEvent.click(screen.getByRole("button", { name: "Expand heart viewer" }));
    const modal = screen.getByRole("dialog", { name: "Expanded heart viewer" });
    fireEvent.click(within(modal).getByRole("button", { name: /Inspect Volume status state/ }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("volume_status");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe(originalOverflow);
    expect(screen.getByRole("list", { name: "Spatial cardiovascular state" })).toBeTruthy();
  });

  it("offers each reference anatomy structure and passes its selected ID to the renderer", async () => {
    enableWebGL();
    render(<HemoStateScene snapshot={snapshot} onSelect={vi.fn()} />);
    const canvas = await screen.findByTestId("mock-heart-canvas");
    const select = screen.getByRole("combobox", { name: "Inspect reference anatomy" }) as HTMLSelectElement;
    const expected = [
      "LEFT_VENTRICLE", "RIGHT_VENTRICLE", "LEFT_ATRIUM", "RIGHT_ATRIUM", "AORTA", "PULMONARY_ARTERY",
      "LAD", "RCA", "LCX", "VENA_CAVA", "PULMONARY_VEINS", "CORONARY_VEINS",
      "INTERVENTRICULAR_SEPTUM", "PAPILLARY_MUSCLE", "MITRAL_VALVE", "TRICUSPID_VALVE", "AORTIC_VALVE", "PULMONARY_VALVE",
    ];
    expect(Array.from(select.options, option => option.value)).toEqual(["", ...expected]);
    for (const id of expected) {
      fireEvent.change(select, { target: { value: id } });
      expect(canvas.getAttribute("data-selected")).toBe(id);
    }
    fireEvent.change(select, { target: { value: "" } });
    expect(canvas.getAttribute("data-selected")).toBe("");
  });
});
