import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/lib/api";
import { fetchMetrics } from "../src/lib/agentsApi";
import { requestLiveRefresh } from "../src/lib/liveUpdates";
import { CaseStorageUnavailableError, resetServiceHealthCache } from "../src/lib/serviceHealth";

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
beforeEach(() => { resetServiceHealthCache(); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

describe("case storage readiness", () => {
  it("shares readiness checks and reports unknown records/metrics without sending known failing reads", async () => {
    const transport = vi.fn(async () => json({ status: "ok", db: "not_checked", case_storage_configured: false }));
    vi.stubGlobal("fetch", transport);
    const results = await Promise.allSettled([api.listCases(), fetchMetrics(), api.getReviewQueue(), api.getCohorts(), api.getProviderAbrasion()]);
    for (const result of results) {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected") expect(result.reason).toBeInstanceOf(CaseStorageUnavailableError);
    }
    expect(transport).toHaveBeenCalledOnce();
    expect(transport.mock.calls[0][0]).toBe("/api/v1/healthz");
    await expect(api.listCases()).rejects.toThrow(/not connected/);
    expect(transport).toHaveBeenCalledOnce();
  });

  it.each([undefined, true])("keeps the endpoint's failure signal when pool configuration is %s", async configured => {
    const transport = vi.fn(async (url: string) => url.endsWith("/healthz")
      ? json({ status: "ok", db: "not_checked", case_storage_configured: configured })
      : json({ detail: "Case database timed out" }, 503));
    vi.stubGlobal("fetch", transport);
    await expect(api.listCases()).rejects.toThrow("HTTP 503: Case database timed out");
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("still tries case reads if liveness itself cannot be checked", async () => {
    const transport = vi.fn(async (url: string) => url.endsWith("/healthz")
      ? json({ detail: "not supported" }, 404)
      : json({ cases: [], total: 0 }));
    vi.stubGlobal("fetch", transport);
    expect(await api.listCases()).toEqual({ cases: [], total: 0 });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("bounds a stalled health check and lets the case endpoint answer", async () => {
    vi.useFakeTimers();
    try {
      const transport = vi.fn(async (url: string, _init?: RequestInit) => url.endsWith("/healthz")
        ? new Promise<Response>(() => {})
        : json({ cases: [], total: 0 }));
      vi.stubGlobal("fetch", transport);
      const pending = api.listCases();
      expect(transport).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(3_000);
      expect(await pending).toEqual({ cases: [], total: 0 });
      expect(transport).toHaveBeenCalledTimes(2);
      expect(transport.mock.calls[0][1]?.signal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rechecks readiness after its TTL and immediately on manual refresh", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    let configured = false;
    const transport = vi.fn(async (url: string) => url.endsWith("/healthz")
      ? json({ status: "ok", db: "not_checked", case_storage_configured: configured })
      : json({ cases: [], total: 0 }));
    vi.stubGlobal("fetch", transport);
    await expect(api.listCases()).rejects.toBeInstanceOf(CaseStorageUnavailableError);
    configured = true;
    now.mockReturnValue(31_001);
    expect(await api.listCases()).toEqual({ cases: [], total: 0 });
    configured = false;
    requestLiveRefresh("manual");
    await expect(api.listCases()).rejects.toBeInstanceOf(CaseStorageUnavailableError);
    expect(transport.mock.calls.filter(([url]) => url.endsWith("/healthz"))).toHaveLength(3);
  });

  it("keeps deferred reads bound to their starting identity", async () => {
    let resolveHealth!: (response: Response) => void;
    const health = new Promise<Response>(resolve => { resolveHealth = resolve; });
    const transport = vi.fn(async (url: string, _init?: RequestInit) => url.endsWith("/healthz") ? health : json({ cases: [], total: 0 }));
    vi.stubGlobal("fetch", transport);
    localStorage.setItem("clincase-jwt", "first");
    const pending = api.listCases();
    localStorage.setItem("clincase-jwt", "second");
    resolveHealth(json({ status: "ok", db: "not_checked", case_storage_configured: true }));
    await pending;
    const call = transport.mock.calls.find(([url]) => url.includes("/cases"));
    expect(new Headers(call?.[1]?.headers).get("Authorization")).toBe("Bearer first");
    expect(new Headers(transport.mock.calls[0][1]?.headers).get("Authorization")).toBeNull();
  });

  it("does not intercept writes when the read-only readiness check says storage is disconnected", async () => {
    const transport = vi.fn(async (url: string) => url.endsWith("/healthz")
      ? json({ status: "ok", db: "not_checked", case_storage_configured: false })
      : json({ detail: "Case write unavailable" }, 503));
    vi.stubGlobal("fetch", transport);
    await expect(api.listCases()).rejects.toBeInstanceOf(CaseStorageUnavailableError);
    await expect(api.runFull("case-one")).rejects.toThrow("HTTP 503: Case write unavailable");
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[1][0]).toBe("/api/v1/cases/case-one/run");
  });
});
