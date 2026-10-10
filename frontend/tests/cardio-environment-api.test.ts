import { afterEach, describe, expect, it, vi } from "vitest";
import { environmentApi, type ContextLocation } from "../src/cardiotwin/intelligence/environmentApi";
import { setToken } from "../src/lib/auth";

const city: ContextLocation = { id: "context-only", name: "Chennai", country: "India", region: "Tamil Nadu", latitude: 13.0827, longitude: 80.2707 };
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

describe("environmental transport", () => {
  it("uses authenticated transport, abort signal, coordinates and date only", async () => {
    setToken("synthetic-session");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ context_only: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    await environmentApi.observations(city, "2026-08-10", controller.signal);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/cardiotwin/environment/observations?lat=13.0827&lon=80.2707&date=2026-08-10");
    expect(init.headers.Authorization).toBe("Bearer synthetic-session");
    expect(init.signal).toBe(controller.signal);
    expect(init.body).toBeUndefined();
    expect(url).not.toContain("context-only");
  });

  it("escapes city queries and returns a readable provider failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ detail: "Location provider unavailable" }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(environmentApi.locations("Chennai & India")).rejects.toThrow("Location provider unavailable");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/cardiotwin/environment/locations?q=Chennai+%26+India");
  });
});
