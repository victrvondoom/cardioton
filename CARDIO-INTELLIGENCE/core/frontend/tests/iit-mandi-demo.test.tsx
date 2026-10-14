import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import IitMandiDemo from "../src/routes/IitMandiDemo";
import { iitMandiApi } from "../src/cardiotwin/iitMandiApi";

vi.mock("../src/cardiotwin/iitMandiApi", () => ({
  iitMandiApi: {
    scenarios: vi.fn(),
    demonstration: vi.fn(),
    evaluation: vi.fn(),
  },
}));

// jsdom has no WebGL: replace the R3F viewer with a stub exposing the props contract.
vi.mock("../src/cardiotwin/core__src_cardiotwin__HeartViewer", () => ({
  default: (p: { viz: Record<string, { probability: number }> | null; selected: string | null }) => (
    <div
      data-testid="heart-stub"
      data-selected={p.selected ?? ""}
      data-lad={p.viz ? p.viz.LAD.probability : ""}
      data-rca={p.viz ? p.viz.RCA.probability : ""}
    />
  ),
}));

const scenario = (id: string, name: string, cad: number, vessels: { LAD: number; LCX: number; RCA: number }) => ({
  id,
  name,
  description: `${name} synthetic scenario`,
  metadata: { age: 65, sex: "M" },
  ehr_data: { Age: 65, LDL: 160, BP: 145 },
  ecg: { scenario: "normal", heart_rate: 72 },
  wearable: { scenario: "normal", duration: 300 },
  expected_outcomes: { cad_probability: cad, afib_probability: 0.1 },
  focus_areas: ["cad"],
  visualization: {},
});

function demonstration(id: string, name: string, fused: { cad: number; lad: number; lcx: number; rca: number; afib: number }) {
  const modal = (modality: "ehr" | "ecg" | "wearable") => ({
    modality,
    cad_probability: fused.cad,
    lad_probability: fused.lad,
    lcx_probability: fused.lcx,
    rca_probability: fused.rca,
    afib_probability: fused.afib,
    vtach_probability: 0.02,
    confidence: "moderate",
    data_present: true,
    contributing_features: { LDL: 160, Age: 65 },
    uncertainty: 0.2,
  });
  return {
    scenario: scenario(id, name, fused.cad, { LAD: fused.lad, LCX: fused.lcx, RCA: fused.rca }),
    prediction: {
      individual_predictions: { ehr: modal("ehr"), ecg: modal("ecg"), wearable: modal("wearable") },
      fused_predictions: {
        cad_probability: fused.cad,
        lad_probability: fused.lad,
        lcx_probability: fused.lcx,
        rca_probability: fused.rca,
        afib_probability: fused.afib,
        vtach_probability: 0.02,
      },
      confidence: "moderate",
      uncertainty: { fused: 0.18, modality_disagreement: 0.07 },
      available_modalities: ["ehr", "ecg", "wearable"],
      missing_modalities: [],
    },
    visualization: { cad_probability: fused.cad, vessels: { LAD: fused.lad, LCX: fused.lcx, RCA: fused.rca }, afib_probability: fused.afib, confidence: "moderate" },
    demonstration_complete: true,
  };
}

const HIGH = demonstration("high_risk_65m", "High-risk 65M", { cad: 0.72, lad: 0.68, lcx: 0.41, rca: 0.55, afib: 0.09 });
const LOW = demonstration("low_risk_30f", "Low-risk 30F", { cad: 0.12, lad: 0.1, lcx: 0.05, rca: 0.08, afib: 0.01 });

describe("IIT Mandi Track A demonstration page", () => {
  beforeEach(() => {
    vi.mocked(iitMandiApi.scenarios).mockResolvedValue({
      scenarios: [HIGH.scenario, LOW.scenario],
      total: 2,
    });
    vi.mocked(iitMandiApi.demonstration).mockImplementation(async (id: string) => (id === "low_risk_30f" ? LOW : HIGH));
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads scenarios and runs the real demonstration end to end", async () => {
    render(<IitMandiDemo />);
    await waitFor(() => expect(screen.getByTestId("mandi-prediction")).toBeTruthy());
    expect(iitMandiApi.demonstration).toHaveBeenCalledWith("high_risk_65m");
    expect(screen.getByTestId("mandi-prediction").textContent).toContain("72%");
    expect(screen.getByTestId("mandi-limitations").textContent).toContain("does not localise");
    expect(screen.getByTestId("mandi-patient").textContent).toContain("65");
  });

  it("maps fused vessel probabilities into the 3D viewer", async () => {
    render(<IitMandiDemo />);
    await waitFor(() => expect(screen.getByTestId("heart-stub")).toBeTruthy());
    expect(screen.getByTestId("heart-stub").getAttribute("data-lad")).toBe("0.68");
    expect(screen.getByTestId("heart-stub").getAttribute("data-rca")).toBe("0.55");
    expect(screen.getByTestId("heart-stub").getAttribute("data-selected")).toBe("LAD");
  });

  it("switches patients and re-runs the prediction", async () => {
    render(<IitMandiDemo />);
    await waitFor(() => expect(screen.getByTestId("mandi-prediction")).toBeTruthy());
    fireEvent.click(within(screen.getByTestId("mandi-scenarios")).getByText("Low-risk 30F"));
    fireEvent.click(screen.getByTestId("mandi-run"));
    await waitFor(() => expect(iitMandiApi.demonstration).toHaveBeenLastCalledWith("low_risk_30f"));
  });

  it("inspects per-modality evidence", async () => {
    render(<IitMandiDemo />);
    await waitFor(() => expect(screen.getByTestId("mandi-modalities")).toBeTruthy());
    const modalityText = screen.getByTestId("mandi-modalities").textContent ?? "";
    expect(modalityText).toContain("ehr");
    expect(modalityText).toContain("ecg");
    expect(modalityText).toContain("wearable");
    expect(modalityText).toContain("LDL");
  });

  it("compares documented vs hypothetical scenarios with deltas", async () => {
    render(<IitMandiDemo />);
    await waitFor(() => expect(screen.getByTestId("mandi-prediction")).toBeTruthy());
    fireEvent.click(screen.getByTestId("mandi-compare-run"));
    await waitFor(() => expect(screen.getByTestId("mandi-comparison")).toBeTruthy());
    const table = screen.getByTestId("mandi-comparison").textContent ?? "";
    expect(table).toContain("High-risk 65M");
    expect(table).toContain("Low-risk 30F");
    expect(table).toContain("-");
  });

  it("generates a reproducible JSON research report", async () => {
    const revoke = vi.fn();
    const createObjectURL = vi.fn(() => "blob:report");
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revoke, configurable: true });
    render(<IitMandiDemo />);
    await waitFor(() => expect(screen.getByTestId("mandi-report")).toBeTruthy());
    fireEvent.click(screen.getByTestId("mandi-report"));
    await waitFor(() => expect(screen.getByRole("link", { name: /Download iit-mandi-track-a/ })).toBeTruthy());
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });
});
