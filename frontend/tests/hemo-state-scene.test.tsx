import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HemoStateScene from "../src/cardiotwin/HemoStateScene";
import { HEMO_AXES, type HemoAxis, type HemoSnapshot } from "../src/cardiotwin/hemoTypes";

afterEach(cleanup);

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
});
