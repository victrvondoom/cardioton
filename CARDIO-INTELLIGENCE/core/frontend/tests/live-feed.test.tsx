import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActivityTicker } from "../src/components/core__src_components__ActivityTicker";
import { EMPTY_SNAPSHOT, buildNavChips, buildNotifications, buildTickerItems, fetchSnapshot, isHealthDegraded, resetSnapshotCache, type FeedSnapshot } from "../src/lib/liveFeed";

const snap = (over: Partial<FeedSnapshot> = {}): FeedSnapshot => ({ ...EMPTY_SNAPSHOT, ...over });
beforeEach(() => { resetSnapshotCache(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

describe("ticker wording comes from data", () => {
  it("emits nothing when nothing is known — no filler claims", () => {
    expect(buildTickerItems(EMPTY_SNAPSHOT)).toEqual([]);
  });

  it("reports real counts and flags problems", () => {
    const items = buildTickerItems(snap({
      health: { status: "ok", db: "not_checked" }, cases: { total: 12, awaiting: 3 }, agents: { invocations: 40, errors: 2, hours: 24 },
      onco: { open_alerts: 5, patients: 8, ledger_valid: false }, cardio: { integrity: true, version: "1.0.0", cad_auc: 0.9127 }, policies: { n: 22, with_change: 2 } }));
    const text = items.map((i) => i.text);
    expect(text).toContain("API healthy · database not checked");
    expect(text).toContain("12 cases in your organisation · 3 awaiting human review");
    expect(text).toContain("40 agent runs in the last 24 h · 2 errors");
    expect(text.find((t) => t.startsWith("OncoTwin"))).toMatch(/8 twin patients · 5 open alerts · audit ledger FAILED verification/);
    expect(text.find((t) => t.startsWith("CardioTwin"))).toMatch(/v1\.0\.0 integrity verified · held-out CAD AUC 0\.91/);
    expect(items.find((i) => i.text.startsWith("OncoTwin"))?.tone).toBe("red");
    expect(items.find((i) => i.text.includes("awaiting"))?.tone).toBe("amber");
  });

  it("singular / plural and quiet agents", () => {
    const t = buildTickerItems(snap({ cases: { total: 1, awaiting: 0 }, agents: { invocations: 0, errors: 0, hours: 24 } })).map((i) => i.text);
    expect(t).toEqual(["1 case in your organisation · 0 awaiting human review"]); // zero agent runs → no agent line
  });

  it("marks an unhealthy API in red", () => {
    expect(buildTickerItems(snap({ health: { status: "degraded", db: "down" } }))[0].tone).toBe("red");
  });

  it("keeps a live process with disconnected case storage visibly degraded", () => {
    const health = { status: "ok", db: "not_checked", case_storage_configured: false };
    expect(isHealthDegraded(health)).toBe(true);
    expect(isHealthDegraded({ ...health, case_storage_configured: true })).toBe(false);
    expect(isHealthDegraded(null)).toBe(false);
    const state = snap({ health });
    expect(buildTickerItems(state)[0]).toMatchObject({ tone: "red", icon: "alert" });
    expect(buildTickerItems(state)[0].text).toMatch(/case storage is not connected.*counts and agent metrics unknown/);
    expect(buildNotifications(state)).toEqual([expect.objectContaining({
      key: "health", tone: "red", title: "Case storage is not connected", body: expect.stringContaining("unknown"),
    })]);
    expect(buildTickerItems(state).some((item) => /0 cases|API healthy/.test(item.text))).toBe(false);
  });
});

describe("sidebar chips are metrics or nothing", () => {
  it("formats live values and hides unknown ones", () => {
    expect(buildNavChips(snap({ evalF1: 0.9034, roiAnnualUsd: 1_260_000_000, archLayers: 5 }))).toEqual({ "/eval": "F1 .90", "/roi": "$1.26B", "/architecture": "5-LAYER" });
    expect(buildNavChips(EMPTY_SNAPSHOT)).toEqual({ "/eval": null, "/roi": null, "/architecture": null });
    expect(buildNavChips(snap({ roiAnnualUsd: 0, evalF1: 0 }))["/roi"]).toBeNull(); // zero savings is not a "$0" badge
    expect(buildNavChips(snap({ roiAnnualUsd: 42_500 }))["/roi"]).toBe("$42.5K");
  });
});

function stubBackend(handlers: Record<string, unknown>) {
  const fn = vi.fn(async (url: string) => {
    const key = Object.keys(handlers).find((k) => url.includes(k));
    if (!key || handlers[key] === null) return new Response("nope", { status: 503 });
    return new Response(JSON.stringify(handlers[key]), { status: 200 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("snapshot fetching", () => {
  it("fails soft per source and de-duplicates concurrent callers", async () => {
    const f = stubBackend({
      "/healthz": { status: "ok", db: "connected" }, "status=awaiting_review": { total: 2 }, "/cases?limit=1": { total: 9 },
      "/oncotwin/overview": null, "/cardiotwin/overview": null, "/agents/metrics": null, "/policy-catalog": { n: 22, n_with_recent_change: 2 },
      "/eval/cohort": { macro_f1: 0.91 }, "/business-value/org": { direct_savings_annual_projection_usd: 5000, db_unavailable: true }, "/architecture/layers": { layers: [1, 2, 3] } });
    const [a, b] = await Promise.all([fetchSnapshot(), fetchSnapshot()]);
    expect(a).toBe(b);
    expect(f.mock.calls.length).toBe(10); // one round for both callers
    expect(a.cases).toEqual({ total: 9, awaiting: 2 });
    expect(a.onco).toBeNull();
    expect(a.policies).toEqual({ n: 22, with_change: 2 });
    expect(a.roiAnnualUsd).toBeNull(); // db_unavailable is never shown as a number
    expect(a.archLayers).toBe(3);
  });

  it("skips only case-backed shell requests when the pool is explicitly not configured", async () => {
    const f = stubBackend({
      "/healthz": { status: "ok", db: "not_checked", case_storage_configured: false },
      "/policy-catalog": { n: 22, n_with_recent_change: 2 },
      "/architecture/layers": { layers: [1, 2, 3] },
    });
    const result = await fetchSnapshot();
    expect(f.mock.calls.length).toBe(7);
    expect(f.mock.calls.some(([url]) => url.includes("/cases?") || url.includes("/agents/metrics"))).toBe(false);
    expect(result.cases).toBeNull();
    expect(result.agents).toBeNull();
    expect(result.health?.status).toBe("ok"); // process liveness remains the server's signal
    expect(result.policies?.n).toBe(22);
    expect(result.archLayers).toBe(3);
  });

  it("does not suppress case-storage failures when a pool exists", async () => {
    const f = stubBackend({ "/healthz": { status: "ok", db: "not_checked", case_storage_configured: true } });
    const result = await fetchSnapshot();
    expect(f.mock.calls.length).toBe(10);
    expect(f.mock.calls.filter(([url]) => url.includes("/cases?") || url.includes("/agents/metrics"))).toHaveLength(3);
    expect(result.cases).toBeNull();
    expect(result.agents).toBeNull();
  });

  it("rechecks pool configuration after the shared cache expires and resumes polling", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(0);
    try {
      stubBackend({ "/healthz": { status: "ok", db: "not_checked", case_storage_configured: false } });
      expect((await fetchSnapshot()).cases).toBeNull();
      const f = stubBackend({
        "/healthz": { status: "ok", db: "not_checked", case_storage_configured: true },
        "status=awaiting_review": { total: 2 }, "/cases?limit=1": { total: 9 },
      });
      now.mockReturnValue(30_001);
      const recovered = await fetchSnapshot();
      expect(f.mock.calls.length).toBe(10);
      expect(recovered.cases).toEqual({ total: 9, awaiting: 2 });
      expect(buildNotifications(recovered).some((notification) => notification.key === "health")).toBe(false);
    } finally {
      now.mockRestore();
    }
  });

  it("never reuses a cached organisation snapshot after sign-in identity changes", async () => {
    const f = stubBackend({ "/healthz": { status: "ok", db: "not_checked" }, "/cases?limit=1": { total: 9 } });
    localStorage.setItem("clincase-jwt", "first-session");
    const first = await fetchSnapshot();
    localStorage.setItem("clincase-jwt", "second-session");
    const second = await fetchSnapshot();
    expect(first).not.toBe(second);
    expect(f).toHaveBeenCalledTimes(20);
    localStorage.removeItem("clincase-jwt");
    expect(await fetchSnapshot()).not.toBe(second);
    expect(f).toHaveBeenCalledTimes(30);
  });

  it("keeps delayed case requests bound to the identity captured before the health response", async () => {
    let resolveHealth!: (response: Response) => void;
    const health = new Promise<Response>((resolve) => { resolveHealth = resolve; });
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/healthz")) return health;
      return url.includes("/cases?") ? new Response(JSON.stringify({ total: 1 })) : new Response("unavailable", { status: 503 });
    });
    vi.stubGlobal("fetch", f);
    localStorage.setItem("clincase-jwt", "first-session");
    const inFlight = fetchSnapshot();
    localStorage.setItem("clincase-jwt", "second-session");
    resolveHealth(new Response(JSON.stringify({ status: "ok", db: "not_checked", case_storage_configured: true })));
    await inFlight;
    for (const [url, init] of f.mock.calls) {
      expect(new Headers(init?.headers).get("Authorization")).toBe(url.includes("/healthz") ? null : "Bearer first-session");
    }
    expect(f.mock.calls.filter(([url]) => url.includes("/cases?") || url.includes("/agents/metrics"))).toHaveLength(3);
  });
});

describe("ActivityTicker", () => {
  it("renders live items from the backend", async () => {
    stubBackend({ "/healthz": { status: "ok", db: "connected" }, "status=awaiting_review": { total: 1 }, "/cases?limit=1": { total: 4 } });
    render(<ActivityTicker />);
    await waitFor(() => expect(screen.getAllByTestId("ticker-item").length).toBeGreaterThan(0));
    expect(screen.getAllByText("4 cases in your organisation · 1 awaiting human review").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Deterministic demo fixtures/)).toBeNull(); // the old static marketing lines are gone
  });

  it("says so when live status is unavailable instead of showing filler", async () => {
    stubBackend({});
    render(<ActivityTicker />);
    expect((await screen.findByTestId("ticker")).textContent).toMatch(/No live status reported|Live status unavailable/);
  });
});
