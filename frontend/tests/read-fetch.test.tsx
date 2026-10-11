import { StrictMode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/lib/api";
import { requestLiveRefresh } from "../src/lib/liveUpdates";
import { readFetch } from "../src/lib/readFetch";
import { useLive } from "../src/lib/useLive";

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

function deferredResponse() {
  let resolve!: (value: Response) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Response>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("concurrent JSON reads", () => {
  it("shares an outstanding read, gives each caller a separate body, and fetches again after completion", async () => {
    const deferred = deferredResponse();
    const transport = vi.fn().mockReturnValueOnce(deferred.promise).mockResolvedValueOnce(new Response('{"version":2}'));
    vi.stubGlobal("fetch", transport);
    const first = readFetch("/api/v1/demo-fixtures");
    const second = readFetch("/api/v1/demo-fixtures", { headers: { accept: "application/json" } });
    expect(transport).toHaveBeenCalledOnce();
    deferred.resolve(new Response('{"version":1}'));
    const [a, b] = await Promise.all([first, second]);
    expect(a).not.toBe(b);
    expect(await a.json()).toEqual({ version: 1 });
    expect(await b.json()).toEqual({ version: 1 });
    expect(await (await readFetch("/api/v1/demo-fixtures")).json()).toEqual({ version: 2 });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("isolates identities, query parameters, representation headers, and credential modes", async () => {
    const deferred = deferredResponse();
    const transport = vi.fn().mockReturnValue(deferred.promise);
    vi.stubGlobal("fetch", transport);
    const reads = [
      readFetch("/api/v1/cases?limit=6", { headers: { Authorization: "Bearer first" } }),
      readFetch("/api/v1/cases?limit=6", { headers: { Authorization: "Bearer second" } }),
      readFetch("/api/v1/cases?limit=200", { headers: { Authorization: "Bearer first" } }),
      readFetch("/api/v1/cases?limit=6", { headers: { Authorization: "Bearer first", "Accept-Language": "en" } }),
      readFetch("/api/v1/cases?limit=6", { headers: { Authorization: "Bearer first" }, credentials: "omit" }),
    ];
    expect(transport).toHaveBeenCalledTimes(5);
    deferred.resolve(new Response("{}"));
    await Promise.all(reads);
  });

  it("leaves writes, abortable reads, range reads, and streaming reads independent", async () => {
    const transport = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", transport);
    for (const options of [
      { method: "POST", body: "{}" },
      { signal: new AbortController().signal },
      { headers: { Range: "bytes=0-99" } },
      { headers: { Accept: "text/event-stream" } },
    ]) await Promise.all([readFetch("/api/v1/read", options), readFetch("/api/v1/read", options)]);
    await Promise.all([readFetch("/api/v1/jobs/one/stream"), readFetch("/api/v1/jobs/one/stream")]);
    expect(transport).toHaveBeenCalledTimes(10);
  });

  it("does not reuse a request after the underlying transport changes", async () => {
    const deferred = deferredResponse();
    const oldTransport = vi.fn().mockReturnValue(deferred.promise);
    vi.stubGlobal("fetch", oldTransport);
    const oldRead = readFetch("/api/v1/overview");
    const newTransport = vi.fn(async () => new Response('{"current":true}'));
    vi.stubGlobal("fetch", newTransport);
    expect(await (await readFetch("/api/v1/overview")).json()).toEqual({ current: true });
    expect(newTransport).toHaveBeenCalledOnce();
    deferred.resolve(new Response('{"current":false}'));
    expect(await (await oldRead).json()).toEqual({ current: false });
  });

  it("retries rejected reads and honours refresh while an older read is still pending", async () => {
    const failed = deferredResponse();
    const transport = vi.fn().mockReturnValueOnce(failed.promise).mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", transport);
    const first = readFetch("/api/v1/overview");
    const second = readFetch("/api/v1/overview");
    failed.reject(new Error("offline"));
    expect(await Promise.allSettled([first, second])).toEqual([
      expect.objectContaining({ status: "rejected" }), expect.objectContaining({ status: "rejected" }),
    ]);
    await readFetch("/api/v1/overview");
    expect(transport).toHaveBeenCalledTimes(2);
    const older = deferredResponse();
    transport.mockReturnValue(older.promise);
    const pending = readFetch("/api/v1/overview");
    requestLiveRefresh("manual");
    const refreshed = readFetch("/api/v1/overview");
    expect(transport).toHaveBeenCalledTimes(4);
    older.resolve(new Response("{}"));
    await Promise.all([pending, refreshed]);
  });

  it("avoids duplicate network work during React StrictMode's mount replay", async () => {
    const deferred = deferredResponse();
    const transport = vi.fn().mockReturnValue(deferred.promise);
    vi.stubGlobal("fetch", transport);
    function Probe() {
      const fixtures = useLive(() => api.listFixtures(), [], 0);
      return <p>{fixtures.data ? `${fixtures.data.length} fixtures` : "Loading"}</p>;
    }
    render(<StrictMode><Probe /></StrictMode>);
    expect(transport).toHaveBeenCalledOnce();
    deferred.resolve(new Response('{"fixtures":[]}'));
    expect(await screen.findByText("0 fixtures")).toBeTruthy();
    expect(transport).toHaveBeenCalledOnce();
  });
});
