import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SlicerHeartPanel } from "../src/cardiotwin/slicerheart/SlicerHeartPanel";

const OVERVIEW = {
  upstream_repository: "https://github.com/SlicerHeart/SlicerHeart",
  snapshot: "master branch snapshot (zip download; no VCS metadata included)",
  citation: "Lasso et al. 2022, Frontiers in Cardiovascular Medicine",
  license: "BSD 3-Clause License (SlicerHeart Contributors)",
  snapshot_source_fingerprint: "f".repeat(64),
  notice: "SlicerHeart components are integrated as attributed adaptations and runtime bridges.",
  vendor_present: true,
  catalog: {
    modules_classified: 3,
    by_classification: { adapt: 1, bridge: 1, exclude: 1 },
    wired_into_cardioton: ["ValveBatchExport/HeartValveBatchAnalysis"],
    runtime_requirements: {},
  },
  bridge: {
    configured: false,
    available: false,
    slicer_home: null,
    bridge_dir: "/tmp/jobs",
    reason: "SLICER_HOME is not set; no 3D Slicer runtime is configured.",
    setup_instructions: "Install 3D Slicer and the SlicerHeart extension…",
  },
};

const CATALOG = {
  summary: OVERVIEW.catalog,
  matrix: [
    {
      module: "ValveBatchExport/HeartValveBatchAnalysis",
      upstream_capability: "Population-wise annulus shape statistics.",
      classification: "adapt",
      classification_speed: "Runs in the CardioTon backend process.",
      runtime: "fastapi_python",
      status: "wired",
      cardiotwin_touchpoints: ["research/annulus-shape API"],
      notes: "Pure numpy/csv core ported with attribution.",
    },
    {
      module: "EchoVolumeRender",
      upstream_capability: "3D/4D echo volume rendering.",
      classification: "bridge",
      classification_speed: "Requires a 3D Slicer runtime.",
      runtime: "slicer_cpp_build",
      status: "documented_only",
      cardiotwin_touchpoints: [],
      notes: "C++ VTK rendering plugin.",
    },
  ],
};

const METRICS = {
  notice: "Definitions adapted from SlicerHeart. Each metric requires segmented patient imaging… CardioTon serves the terminology only.",
  valve_types: { mitral: { shortname: "MV", annulus_labels: ["A", "P", "AL", "PM"] } },
  probe_positions: [{ id: "TTE_APICAL", name: "TTE apical", description: "Apical view." }],
  metrics_by_valve: {
    mitral: [{ id: "annulus_circumference", name: "Annulus circumference", unit: "mm", definition: "Length of the closed annulus contour curve." }],
  },
  all_metric_ids: ["annulus_circumference"],
};

function annulusResponse() {
  return {
    notice: "Research statistics computed on user-supplied SlicerHeart ValveBatchExport contour data.",
    provenance: { upstream: "https://github.com/SlicerHeart/SlicerHeart", adapted_from: "…/annulus_shape_analysis.py", license: "BSD 3-Clause" },
    cases_requested: 2,
    result: {
      valve_type: "mitral",
      label_order: ["S", "A", "L", "P"],
      points_per_segment: 10,
      size_normalized: false,
      scale_factors: null,
      phases: [
        {
          phase: "ED",
          cases: 2,
          skipped_cases: [],
          mean_contour_points: Array.from({ length: 40 }, (_, i) => [Math.cos(i / 6), Math.sin(i / 6), 0]),
          std_contour_points: Array.from({ length: 40 }, () => [0.1, 0.1, 0.1]),
          landmark_positions: [{ label: "S", position: [1, 0, 0] }],
          mean_contour_centroid_mm: [0, 0, 0],
        },
      ],
      skipped_cases: [],
      units: "mm",
    },
  };
}

function mockFetch(overrides: Record<string, unknown> = {}) {
  const encoder = new TextEncoder();
  const json = (body: unknown, status = 200) => new Response(encoder.encode(JSON.stringify(body)), { status, headers: { "Content-Type": "application/json" } });
  const calls: string[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/overview")) return json(overrides.overview ?? OVERVIEW);
    if (url.endsWith("/catalog")) return json(overrides.catalog ?? CATALOG);
    if (url.endsWith("/valve-metrics")) return json(overrides.metrics ?? METRICS);
    if (url.endsWith("/research/annulus-shape")) {
      const override = overrides.annulus as { status?: number; body?: unknown } | undefined;
      if (override?.status) return json(override.body ?? {}, override.status);
      return json(overrides.annulus ?? annulusResponse());
    }
    return json({ detail: "not found" }, 404);
  });
  vi.stubGlobal("fetch", impl);
  return { calls };
}

describe("SlicerHeartPanel", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders provenance, classification counts and honest bridge unavailability", async () => {
    mockFetch();
    render(<SlicerHeartPanel />);
    await waitFor(() => expect(screen.getByTestId("slicerheart-panel")).toBeTruthy());
    expect(screen.getByText(/BSD 3-Clause License \(SlicerHeart Contributors\)/)).toBeTruthy();
    expect(screen.getByTestId("slicerheart-summary").textContent).toContain("3 upstream module groups classified");
    expect(screen.getByTestId("slicerheart-bridge-notice").textContent).toContain("Imaging computations unavailable");
    expect(screen.getByTestId("slicerheart-bridge-notice").textContent).toContain("SLICER_HOME is not set");
  });

  it("shows the full integration matrix with classifications", async () => {
    mockFetch();
    render(<SlicerHeartPanel />);
    await waitFor(() => expect(screen.getByTestId("slicerheart-matrix")).toBeTruthy());
    fireEvent.click(screen.getByTestId("slicerheart-matrix").querySelector("summary")!);
    expect(screen.getByText("ValveBatchExport/HeartValveBatchAnalysis")).toBeTruthy();
    expect(screen.getByText("Adapt")).toBeTruthy();
    expect(screen.getByText("documented only")).toBeTruthy();
  });

  it("exposes the valve metric vocabulary with the no-fabrication notice", async () => {
    mockFetch();
    render(<SlicerHeartPanel />);
    await waitFor(() => expect(screen.getByTestId("slicerheart-metrics")).toBeTruthy());
    fireEvent.click(screen.getByTestId("slicerheart-metrics").querySelector("summary")!);
    expect(screen.getByText("Annulus circumference")).toBeTruthy();
    expect(screen.getByText(/CardioTon serves the terminology only/i)).toBeTruthy();
  });

  it("runs the cohort annulus-shape research analysis on an uploaded export", async () => {
    mockFetch();
    render(<SlicerHeartPanel />);
    await waitFor(() => expect(screen.getByTestId("slicerheart-research")).toBeTruthy());
    const file = new File(["Filename,Phase,Valve,AnnulusContourX,AnnulusContourY,AnnulusContourZ,AnnulusContourLabel\ncase.mrb,ED,mitral,1,2,3,S\n"], "AnnulusContourPoints.csv", { type: "text/csv" });
    const input = screen.getByLabelText("Annulus contour CSV export") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /Compute cohort statistics/i }));
    await waitFor(() => expect(screen.getByTestId("slicerheart-research-result")).toBeTruthy());
    expect(screen.getByTestId("slicerheart-research-result").textContent).toContain("Phase");
    expect(screen.getByTestId("slicerheart-research-result").textContent).toContain("2 cases");
  });

  it("surfaces analysis errors without inventing results", async () => {
    mockFetch({ annulus: { status: 422, body: { detail: "Contour export is missing required columns: Filename" } } });
    render(<SlicerHeartPanel />);
    await waitFor(() => expect(screen.getByTestId("slicerheart-research")).toBeTruthy());
    const file = new File(["a,b\n1,2\n"], "bad.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Annulus contour CSV export") as HTMLInputElement, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /Compute cohort statistics/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.queryByTestId("slicerheart-research-result")).toBeNull();
  });
});
