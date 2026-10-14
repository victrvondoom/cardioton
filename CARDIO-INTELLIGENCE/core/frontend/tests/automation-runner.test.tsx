import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAutomation } from "../src/automation/useAutomation";

afterEach(cleanup);
const pending = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };

describe("user initiated automation", () => {
  it("rejects double starts and stops after the outstanding operation settles", async () => {
    const first = pending();
    const write = vi.fn(() => first.promise);
    const next = vi.fn(async () => {});
    const { result } = renderHook(useAutomation);
    let running!: Promise<boolean>;
    act(() => { running = result.current.run([{ id: "one", label: "One", run: write }, { id: "two", label: "Two", run: next }]); });
    expect(await result.current.run([{ id: "duplicate", label: "Duplicate", run: write }])).toBe(false);
    act(() => result.current.cancel());
    await act(async () => { first.resolve(); await running; });
    expect(write).toHaveBeenCalledOnce(); expect(next).not.toHaveBeenCalled();
    expect(result.current.state.phase).toBe("cancelled");
    expect(result.current.state.steps[0].status).toBe("complete");
  });
  it("pauses before later actions and never retries an uncertain failure", async () => {
    const forbidden = vi.fn(async () => {});
    const { result } = renderHook(useAutomation);
    await act(async () => { await result.current.run([{ id: "review", label: "Review", run: async () => ({ pause: "Confirm the source meaning." }) }, { id: "send", label: "Send", run: forbidden }]); });
    expect(result.current.state.phase).toBe("paused"); expect(forbidden).not.toHaveBeenCalled();
    const failed = vi.fn(async () => { throw new Error("Connection interrupted; inspect saved work."); });
    await act(async () => { await result.current.run([{ id: "write", label: "Write", run: failed }]); });
    expect(failed).toHaveBeenCalledOnce(); expect(result.current.state.phase).toBe("failed");
  });
  it("does not start further steps after navigating away", async () => {
    const first = pending(), next = vi.fn(async () => {});
    const { result, unmount } = renderHook(useAutomation);
    let running!: Promise<boolean>;
    act(() => { running = result.current.run([{ id: "read", label: "Read", run: () => first.promise }, { id: "send", label: "Send", run: next }]); });
    unmount(); first.resolve(); await running;
    expect(next).not.toHaveBeenCalled();
  });
});
