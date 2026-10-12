import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, type OrgValueRollup } from "../src/lib/api";
import { resetSnapshotCache } from "../src/lib/liveFeed";
import Dashboard from "../src/routes/Dashboard";

vi.mock("../src/lib/api", () => ({ api: { listFixtures: vi.fn(), getOrgValue: vi.fn(), listCases: vi.fn(), createFromFixture: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

const rollup = (over: Partial<OrgValueRollup> = {}): OrgValueRollup => ({
  organization_id: "o", asof_iso: "x", cases_total: 14, cases_decided: 9, verdict_breakdown: {}, direct_savings_mtd_usd: 12345, direct_savings_annual_projection_usd: 246000,
  avg_decision_seconds: 42.5, avg_speedup_factor: 25.4, citations: [], daily_cases_7d: [0, 1, 2, 0, 3, 4, 4], avg_decision_change_pct: -31.5,
  assumptions: { manual_pa_cost_usd: 1200, manual_pa_minutes: 20 }, ...over });
beforeEach(() => {
  resetSnapshotCache();
  vi.mocked(api.listFixtures).mockResolvedValue([]);
  vi.mocked(api.listCases).mockResolvedValue({ cases: [], total: 0 } as never);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
});
const mount = () => render(<MemoryRouter><Dashboard /></MemoryRouter>);

describe("Dashboard KPI tiles are computed, not typed in", () => {
  it("uses the org's own values, trend and baselines from the API", async () => {
    vi.mocked(api.getOrgValue).mockResolvedValue(rollup());
    mount();
    await waitFor(() => expect(screen.getByText("14")).toBeTruthy());
    expect(screen.getByText("Patient cases · MTD")).toBeTruthy();
    expect(screen.getByText("9 decided MTD")).toBeTruthy();
    expect(screen.getByText("42.5s")).toBeTruthy();
    expect(screen.getByText(/25\.4× faster than the 20-min manual baseline/)).toBeTruthy(); // baseline from the API, not "18"
    expect(screen.getByText(/-31\.5%/)).toBeTruthy(); // real month-over-month change, not a fixed −98
    expect(screen.queryByText(/98/)).toBeNull();
  });

  it("shows no trend or sparkline when there is nothing real to plot", async () => {
    vi.mocked(api.getOrgValue).mockResolvedValue(rollup({ daily_cases_7d: [0, 0, 0, 0, 0, 0, 0], avg_decision_change_pct: null, cases_total: 0, cases_decided: 0, avg_decision_seconds: null, avg_speedup_factor: null }));
    mount();
    await waitFor(() => expect(screen.getByText("0 decided MTD")).toBeTruthy());
    expect(screen.queryByText(/%/)).toBeNull();
  });
});

describe("Dashboard is an operational entry point, not a showcase", () => {
  it("has one plain heading and one primary action", async () => {
    vi.mocked(api.getOrgValue).mockResolvedValue(rollup());
    mount();
    expect(screen.getByRole("heading", { name: "Clinic overview" })).toBeTruthy();
    const cta = screen.getByRole("link", { name: "New patient case" });
    expect(cta.getAttribute("href")).toBe("/intake");
    await waitFor(() => expect(screen.getByText("42.5s")).toBeTruthy());
  });

  it("keeps the agent pipeline console and marketing badges off the dashboard", async () => {
    vi.mocked(api.getOrgValue).mockResolvedValue(rollup());
    mount();
    await waitFor(() => expect(screen.getByText("14")).toBeTruthy());
    expect(screen.queryByTestId("dag-summary")).toBeNull();
    expect(screen.queryByTestId("dag-flow")).toBeNull();
    expect(screen.queryByText(/WORLD CARDIOLOGY CLINIC/i)).toBeNull();
    expect(screen.queryByText("Bedrock-ready")).toBeNull();
    expect(screen.queryByText(/CMS-0057-F/)).toBeNull();
  });

  it("marks unavailable data as unavailable instead of inventing a number", async () => {
    vi.mocked(api.getOrgValue).mockResolvedValue(rollup());
    mount();
    await waitFor(() => expect(screen.getByText("count unavailable")).toBeTruthy()); // awaiting-review tile
    expect(screen.getAllByText("—").length).toBeGreaterThan(0); // every unavailable metric is an explicit dash
    await waitFor(() => expect(screen.getByTestId("attention-count").textContent).toBe("unavailable"));
    expect(screen.getByText(/— status unavailable/)).toBeTruthy();
  });

  it("refreshes metrics on demand and reports failed case creation", async () => {
    vi.mocked(api.getOrgValue).mockResolvedValue(rollup());
    vi.mocked(api.listFixtures).mockResolvedValue([{ name: "example", label: "Example", expected_verdict: "APPROVE" }] as never);
    vi.mocked(api.createFromFixture).mockRejectedValue(new Error("Case storage unavailable"));
    mount();
    await waitFor(() => expect(screen.getByText("14")).toBeTruthy());
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh dashboard" }).hasAttribute("disabled")).toBe(false));
    vi.mocked(api.getOrgValue).mockResolvedValue(rollup({ cases_total: 15 }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh dashboard" }));
    await waitFor(() => expect(screen.getByText("15")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "APPROVE" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Case storage unavailable"));
  });
});
