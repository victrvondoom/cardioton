import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Cross5Studio from "../src/routes/Cross5Studio";
import { cross5Api } from "../src/cross5/api";

vi.mock("../src/cross5/api", async (orig) => {
  const real = await orig<typeof import("../src/cross5/api")>();
  return {
    ...real,
    cross5Api: {
      frames: vi.fn(),
      intersections: vi.fn(),
      flowVessels: vi.fn(),
      flowSimulate: vi.fn(),
      flowCompare: vi.fn(),
      chronosTimeline: vi.fn(),
      chronosReplay: vi.fn(),
      earthCountries: vi.fn(),
      earthEnvironment: vi.fn(),
      city: vi.fn(),
      cityAccess: vi.fn(),
      experiments: vi.fn(),
      runExperiment: vi.fn(),
    },
  };
});

// jsdom: no WebGL — stub the immersive viewports, keep their props contracts.
vi.mock("../src/cardiotwin/HeartViewer", () => ({
  default: (p: {
    viz: Record<string, { probability: number }> | null;
    onSelect: (id: "LAD" | "LCX" | "RCA") => void;
  }) => (
    <div data-testid="heart-stub" data-lad={p.viz ? p.viz.LAD.probability : ""}>
      {(["LAD", "LCX", "RCA"] as const).map((id) => (
        <button key={id} data-testid={`3d-${id}`} onClick={() => p.onSelect(id)}>{id}</button>
      ))}
    </div>
  ),
  webglAvailable: () => false,
}));
vi.mock("../src/cross5/CardioFlowView", () => ({
  default: (p: { simulation: { steady_state: { ffr_index: number } } | null }) => (
    <div data-testid="flow-stub" data-ffr={p.simulation ? p.simulation.steady_state.ffr_index : ""} />
  ),
}));
vi.mock("../src/cross5/EarthGlobeView", () => ({
  EarthGlobeView: (p: { countries: { iso: string; country: string }[]; selectedIso: string | null }) => (
    <div data-testid="globe-stub" data-selected={p.selectedIso ?? ""} data-count={p.countries.length} />
  ),
}));

const FRAMES = ["cardiotwin", "cardioearth", "cardioflow", "cardiochronos", "cardiocity"].map((id, i) => ({
  id,
  number: i + 1,
  name: id,
  title: id,
  scale: "test",
  coordinate_reference: "test",
  primary_data: [],
  claims_policy: "test",
}));

const FLOW_SIM = {
  vessel_id: "LAD",
  stenosis_pct: 70,
  steady_state: {
    ffr_index: 0.26,
    flow_rate_ml_min: 492.1,
    translesional_dp_mmhg: 69.1,
    reynolds_number: 100,
    wall_shear_stress_pa: 50,
    flow_regime: "test",
    ischemic_threshold_flag: true,
  },
  waveform: {
    cycle_seconds: 0.8,
    time_series: Array.from({ length: 8 }, (_, i) => ({
      t_s: i * 0.1, p_aortic_mmhg: 100, p_distal_mmhg: 80, q_ml_min: 300, translesional_dp_mmhg: 20,
    })),
    model: "test model",
  },
  centreline: {
    samples: Array.from({ length: 8 }, (_, i) => ({ x_mm: i * 10, diameter_mm: 3, area_mm2: 7 })),
    min_diameter_mm: 1.97,
    min_area_mm2: 3,
  },
  notice: "Hypothetical reduced-order simulation on nominal reference coronary geometry. Not patient-specific.",
};

const TIMELINE = {
  hours: 48,
  bands: {
    ecg_excerpt: { sampling_rate_hz: 500, n_samples: 5000, duration_s: 10, label: "simulated" },
    hrv_windows: [{ timestamp: "2026-03-02T00:00:00Z", mean_heart_rate_bpm: 60, sdnn_ms: 50, rmssd_ms: 60, n_beats: 6 }],
    hourly_wearable: Array.from({ length: 48 }, (_, i) => ({
      timestamp: `2026-03-02T${String(i).padStart(2, "0")}:00:00Z`,
      heart_rate_bpm: 60 + (i % 6),
      spo2_pct: 97,
      activity: 0.3,
      sleep_stage: null,
    })),
    daily_aggregates: [{ date: "2026-03-02", mean_heart_rate_bpm: 62, sleep_samples: 4, label: "simulated" }],
    monthly_history: [{ month: "2026-03-02", ldl_mg_dl: 130, systolic_bp_mmhg: 124, label: "simulated" }],
  },
  alignment: { hourly_coverage_samples: 48, gaps: [], missing_data_policy: "Gaps are reported, never interpolated." },
  notice: "synthetic",
};

const CITY = {
  nodes: [{ id: "n01", x: 0, y: 0, residents: 100 }, { id: "n02", x: 1400, y: 200, residents: 200 }],
  edges: [{ a: "n01", b: "n02", length_m: 1420, speed_mps: 11, travel_minutes: 2.15 }],
  facilities: [{ id: "h1", name: "Central Cardiac Centre", category: "hospital", node: "n02" }],
  baseline_access: {
    hospital: { facilities: 1, population_weighted_mean_minutes: 2.2, residents_within_20min: 300, share_within_20min: 1, worst_served_node: "n01", worst_travel_minutes: 2.2 },
  },
  notice: "synthetic city",
};

function mockApi() {
  vi.mocked(cross5Api.frames).mockResolvedValue({ frames: FRAMES, notice: "n" });
  vi.mocked(cross5Api.experiments).mockResolvedValue({
    experiments: [
      { id: "earth_to_heart", title: "Experiment A — Earth to Heart", frames: ["cardioearth", "cardiochronos", "cardiotwin"], description: "d" },
      { id: "artery_to_time", title: "Experiment B — Artery to Time", frames: ["cardiotwin", "cardioflow"], description: "d" },
      { id: "planet_to_city_to_heart", title: "Experiment C — Planet to City to Heart", frames: ["a", "b", "c", "d", "e"], description: "d" },
    ],
    notice: "n",
  });
  vi.mocked(cross5Api.earthCountries).mockResolvedValue({
    countries: [
      { iso: "IN", country: "India", region: "South-East Asia", cvd_mortality_per_100k: 272, year: 2019, status: "observed", population_level: true, unit: "per 100k", source: "WHO GHO", source_url: "https://x", uncertainty: "rounded" },
      { iso: "US", country: "United States", region: "Americas", cvd_mortality_per_100k: 128, year: 2019, status: "observed", population_level: true, unit: "per 100k", source: "WHO GHO", source_url: "https://x", uncertainty: "rounded" },
    ],
    notice: "snapshot",
  });
  vi.mocked(cross5Api.city).mockResolvedValue(CITY as never);
  vi.mocked(cross5Api.chronosTimeline).mockResolvedValue(TIMELINE as never);
  vi.mocked(cross5Api.intersections).mockResolvedValue({
    selected_frames: ["cardiotwin", "cardioflow", "cardiochronos"],
    supported: [{ frames: ["cardioflow", "cardiotwin"], link: "anatomical", description: "shared vessel ids", mechanism: "identity" }],
    unsupported: [{ frames: ["cardiochronos", "cardioflow"], reason: "CardioFlow's time axis is simulated cardiac-cycle model time, not wall-clock time." }],
    notice: "n",
  });
  vi.mocked(cross5Api.flowSimulate).mockResolvedValue(FLOW_SIM as never);
  vi.mocked(cross5Api.flowCompare).mockResolvedValue({
    vessel_id: "LAD",
    scenarios: [
      { stenosis_pct: 0, ffr_index: 0.83, flow_rate_ml_min: 1570, translesional_dp_mmhg: 15, ischemic_threshold_flag: false },
      { stenosis_pct: 70, ffr_index: 0.26, flow_rate_ml_min: 492, translesional_dp_mmhg: 69, ischemic_threshold_flag: true },
    ],
    notice: "n",
  } as never);
  vi.mocked(cross5Api.cityAccess).mockResolvedValue({
    from_node: "n01",
    facilities: [{ facility: CITY.facilities[0], travel_minutes: 2.15 }],
    nearest: { facility: CITY.facilities[0], travel_minutes: 2.15 },
    notice: CITY.notice,
  } as never);
  vi.mocked(cross5Api.chronosReplay).mockResolvedValue({
    as_of: "2026-03-02T12:00:00Z",
    available: { hourly_wearable: 13 },
    available_rows: {},
    excluded_future: { hourly_wearable: [] },
    notice: "leakage-safe",
  } as never);
}

describe("Cross5Studio", () => {
  beforeEach(() => {
    mockApi();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the five frames and launches the flow viewport by default", async () => {
    render(<MemoryRouter><Cross5Studio /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId("cross5-frames").textContent).toContain("cardioflow"));
    expect(screen.getByTestId("cross5-flow-summary").textContent).toContain("model FFR index");
    expect(screen.getByTestId("cross5-flow-summary").textContent).toContain("0.260");
    expect(screen.getByTestId("flow-stub").getAttribute("data-ffr")).toBe("0.26");
  });

  it("shows declared supported and unsupported intersections honestly", async () => {
    render(<MemoryRouter><Cross5Studio /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId("cross5-intersections")).toBeTruthy());
    const panel = screen.getByTestId("cross5-intersections").textContent ?? "";
    expect(panel).toContain("anatomical");
    expect(panel).toContain("unsupported");
    expect(panel).toContain("model time");
  });

  it("runs experiment B and surfaces its output with export", async () => {
    vi.mocked(cross5Api.runExperiment).mockResolvedValue({
      experiment: "artery_to_time",
      vessel_id: "LAD",
      statistical_prediction_kept_separate: { cad_probability: 0.6, label: "kept separate" },
    } as never);
    render(<MemoryRouter><Cross5Studio /></MemoryRouter>);
    await waitFor(() => expect((screen.getByTestId("cross5-experiments").textContent ?? "").includes("Experiment B")).toBe(true));
    fireEvent.click(screen.getByText("Experiment B — Artery to Time"));
    await waitFor(() => expect(screen.getByTestId("cross5-experiment-result")).toBeTruthy());
    expect(vi.mocked(cross5Api.runExperiment)).toHaveBeenCalledWith("artery_to_time", { vessel_id: "LAD", stenosis_pct: 70 });
    expect(screen.getByText("Export result (JSON)")).toBeTruthy();
  });

  it("switches to Earth and City frames with their honest notices", async () => {
    render(<MemoryRouter><Cross5Studio /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId("cross5-frames")).toBeTruthy());
    fireEvent.click(screen.getByText("cardioearth"));
    await waitFor(() => expect(screen.getByTestId("globe-stub")).toBeTruthy());
    expect(screen.getByTestId("globe-stub").getAttribute("data-count")).toBe("2");
    expect(screen.getByText(/not live surveillance/i)).toBeTruthy();
    fireEvent.click(screen.getByText("cardiocity"));
    await waitFor(() => expect(screen.getByText(/within 20 min/i)).toBeTruthy());
    expect(screen.getByText(/synthetic city/i)).toBeTruthy();
  });

  it("computes city access from a clicked node", async () => {
    render(<MemoryRouter><Cross5Studio /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId("cross5-frames")).toBeTruthy());
    fireEvent.click(screen.getByText("cardiocity"));
    await waitFor(() => expect(screen.getByText(/within 20 min/i)).toBeTruthy());
    const nodeLabel = screen.getAllByText("n01", { exact: false })[0];
    fireEvent.click(nodeLabel.closest("g") as unknown as HTMLElement);
    await waitFor(() => expect(screen.getByTestId("cross5-city-access").textContent).toContain("Central Cardiac Centre"));
    expect(vi.mocked(cross5Api.cityAccess)).toHaveBeenCalledWith({ from_node: "n01" });
  });

  it("renders the synchronized multiscale timeline with the gap policy", async () => {
    render(<MemoryRouter><Cross5Studio /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId("cross5-bottom-timeline").textContent).toContain("Gaps are reported, never interpolated."));
    const label = screen.getByTestId("cross5-bottom-timeline").querySelector("svg")?.getAttribute("aria-label") ?? "";
    expect(label).toContain("hourly heart rate");
  });

  it("navigates CardioTwin heart -> CardioFlow when a vessel is selected", async () => {
    vi.mocked(cross5Api.runExperiment).mockResolvedValue({
      experiment: "earth_to_heart",
      patient: { fused_prediction: { lad_probability: 0.7, lcx_probability: 0.4, rca_probability: 0.5, cad_probability: 0.8 } },
    } as never);
    render(<MemoryRouter><Cross5Studio /></MemoryRouter>);
    await waitFor(() => expect((screen.getByTestId("cross5-experiments").textContent ?? "").includes("Experiment A")).toBe(true));
    fireEvent.click(screen.getByText("Experiment A — Earth to Heart"));
    await waitFor(() => expect(screen.getByTestId("cross5-experiment-result")).toBeTruthy());
    fireEvent.click(screen.getByText("cardiotwin"));
    await waitFor(() => expect(screen.getByTestId("heart-stub").getAttribute("data-lad")).toBe("0.7"));
    expect(screen.getAllByTestId("3d-RCA").length).toBeGreaterThan(0);
    vi.mocked(cross5Api.flowSimulate).mockClear();
    fireEvent.click(screen.getAllByTestId("3d-RCA")[0]);
    await waitFor(() =>
      expect(vi.mocked(cross5Api.flowSimulate)).toHaveBeenCalledWith({ vessel_id: "RCA", stenosis_pct: 70 }),
    );
    // The flow viewport becomes active with the selected vessel.
    const select = screen.getByLabelText("Vessel") as HTMLSelectElement;
    expect(select.value).toBe("RCA");
  });

  it("shows API errors without inventing data", async () => {
    vi.mocked(cross5Api.frames).mockRejectedValue(new Error("Request failed (503)"));
    render(<MemoryRouter><Cross5Studio /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId("cross5-error")).toBeTruthy());
    expect(screen.getByTestId("cross5-error").textContent).toContain("Request failed");
  });
});
