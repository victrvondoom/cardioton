import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EnvironmentWorkspace from "../src/cardiotwin/intelligence/EnvironmentWorkspace";
import { environmentApi, type ContextLocation, type EnvironmentSnapshot } from "../src/cardiotwin/intelligence/environmentApi";

vi.mock("../src/cardiotwin/intelligence/environmentApi", () => ({ environmentApi: { observations: vi.fn(), locations: vi.fn(), layer: vi.fn() } }));
vi.mock("../src/cardiotwin/intelligence/EnvironmentGlobe", () => ({ default: () => <p>3D map unavailable on this device. Search and readings remain available.</p> }));

const city: ContextLocation = { id: "bengaluru", name: "Bengaluru", country: "India", region: "Karnataka", latitude: 12.9716, longitude: 77.5946 };
function snapshot(location: ContextLocation, date: string, value = 25): EnvironmentSnapshot {
  return { date, requested_location: location, time_basis: "UTC", retrieved_at: "2026-10-09T12:00:00Z", context_only: true, personal_exposure_established: false, warnings: [],
    sources: [{ id: "air", provider: "Open-Meteo / Copernicus CAMS", url: "https://open-meteo.com/en/docs/air-quality-api", endpoint: "https://air-quality-api.open-meteo.com/v1/air-quality", status: "available", ingested_at: "2026-10-09T12:00:00Z", cached: false, original_available_at: null, model_issued_at: null, grid_latitude: 13, grid_longitude: 80.4, resolution: "Native 3-hourly; modeled global grid", error: null }],
    series: [{ variable: "pm2_5", label: "PM2.5", unit: "µg/m³", source_id: "air", ingested_at: "2026-10-09T12:00:00Z", original_available_at: null, original_availability: "UNKNOWN", warnings: [],
      points: Array.from({ length: 24 }, (_, i) => ({ time: `${date}T${String(i).padStart(2, "0")}:00:00Z`, value: i === 2 ? null : value + i, classification: "MODELLED" })),
      summary: { hours_present: 23, hours_expected: 24, complete_past_day: false, mean_24h: null, min: value, max: value + 23, reference: null } }],
  };
}

beforeEach(() => {
  vi.mocked(environmentApi.observations).mockImplementation(async (location, date) => snapshot(location, date));
  vi.mocked(environmentApi.locations).mockResolvedValue({ results: [city] });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("environment context workspace", () => {
  it("keeps accessible readings, missing data and provenance available without WebGL", async () => {
    render(<EnvironmentWorkspace date="2026-08-10" clinicalCount={5} />);
    await screen.findByText("37.0", { selector: ".ce-main-value" });
    expect(await screen.findByText(/3D map unavailable/)).toBeTruthy();
    expect(screen.getByText("23/24")).toBeTruthy();
    expect(screen.getByText(/Original publication \/ historical availability: unknown/)).toBeTruthy();
    expect(screen.queryByText(/5 clinical evidence items available/)).toBeNull();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText(/5 clinical evidence items available/)).toBeTruthy();
    fireEvent.click(screen.getByText("Inspect hourly values and classifications"));
    const rows = screen.getAllByRole("row");
    expect(rows[3].textContent).toContain("02:00UnavailableGap");
    expect(screen.getByText(/Hourly values are never compared with a daily threshold/)).toBeTruthy();
  });

  it("searches and compares manually selected public locations", async () => {
    render(<EnvironmentWorkspace date="2026-08-10" />);
    await screen.findByText("37.0", { selector: ".ce-main-value" });
    fireEvent.click(screen.getByRole("radio", { name: "Compare B" }));
    fireEvent.change(screen.getByLabelText("City or country"), { target: { value: "Bengaluru, India" } });
    fireEvent.click(screen.getByRole("button", { name: "Search", exact: true }));
    fireEvent.click(await screen.findByRole("button", { name: /Bengaluru Karnataka/ }));
    await waitFor(() => expect(environmentApi.observations).toHaveBeenCalledWith(city, "2026-08-10", expect.any(AbortSignal)));
    expect(screen.getByRole("button", { name: "Remove comparison" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove comparison" }));
    expect(screen.queryByRole("button", { name: "Remove comparison" })).toBeNull();
  });

  it("aborts old dates and never displays stale environmental data", async () => {
    let resolveOld!: (data: EnvironmentSnapshot) => void;
    let original!: ContextLocation;
    let oldSignal: AbortSignal | undefined;
    vi.mocked(environmentApi.observations).mockImplementationOnce((location, _date, signal) => {
      original = location; oldSignal = signal;
      return new Promise((resolve) => { resolveOld = resolve; });
    });
    const { rerender } = render(<EnvironmentWorkspace date="2026-08-10" onDateChange={() => {}} />);
    rerender(<EnvironmentWorkspace date="2026-08-11" onDateChange={() => {}} />);
    await screen.findByText("37.0", { selector: ".ce-main-value" });
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => { resolveOld(snapshot(original, "2026-08-10", 999)); });
    expect(screen.queryByText("1011.0")).toBeNull();
    expect(screen.getByText("37.0", { selector: ".ce-main-value" })).toBeTruthy();
  });

  it("changes hour locally and requests a new day using the shared date control", async () => {
    const change = vi.fn();
    render(<EnvironmentWorkspace date="2026-08-10" onDateChange={change} />);
    await screen.findByText("37.0", { selector: ".ce-main-value" });
    const before = vi.mocked(environmentApi.observations).mock.calls.length;
    fireEvent.change(screen.getByRole("slider", { name: "Environmental hour UTC" }), { target: { value: "3" } });
    expect(screen.getByText("28.0", { selector: ".ce-main-value" })).toBeTruthy();
    expect(vi.mocked(environmentApi.observations).mock.calls.length).toBe(before);
    fireEvent.change(screen.getByLabelText("Context date (UTC)"), { target: { value: "2026-08-12" } });
    expect(change).toHaveBeenCalledWith("2026-08-12");
  });

  it("retains provider failures as honest gaps and supports text mode", async () => {
    vi.mocked(environmentApi.observations).mockRejectedValueOnce(new Error("Environmental provider unavailable"));
    render(<EnvironmentWorkspace date="2026-08-10" />);
    expect(await screen.findByText("Environmental provider unavailable")).toBeTruthy();
    expect(screen.getByText("0/24")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use text view" }));
    expect(screen.getByText("ACCESSIBLE GEOGRAPHIC SUMMARY")).toBeTruthy();
    expect(screen.getByText(/Chennai · 13.0827°, 80.2707°/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry source retrieval" }));
    await screen.findByText("37.0", { selector: ".ce-main-value" });
  });
});
