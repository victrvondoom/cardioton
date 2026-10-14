import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HemoReplayTransport from "../src/cardiotwin/HemoReplayTransport";

const dates = ["2026-08-01T23:59:59Z", "2026-08-07T23:59:59Z", "2026-08-21T23:59:59Z"];
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Authoritative evidence playback", () => {
  it("scrubs and steps through source dates without computing a state in the browser", () => {
    const onReplay = vi.fn();
    render(<HemoReplayTransport dates={dates} asOf={dates[1]} busy={false} failed={false} onReplay={onReplay} />);
    fireEvent.click(screen.getByRole("button", { name: "Previous evidence time" }));
    expect(onReplay).toHaveBeenLastCalledWith(dates[0]);
    fireEvent.change(screen.getByRole("slider", { name: "Scrub evidence time" }), { target: { value: "2" } });
    expect(onReplay).toHaveBeenLastCalledWith(dates[2]);
  });

  it("steps and plays relative to an arbitrary reconstruction between checkpoints", () => {
    vi.useFakeTimers();
    const checkpoints = [1, 7, 10, 12, 15, 17, 19, 21].map(day => `2026-08-${String(day).padStart(2, "0")}T23:59:59Z`);
    const onReplay = vi.fn();
    render(<HemoReplayTransport dates={checkpoints} asOf="2026-08-14T23:59:59Z" busy={false} failed={false} onReplay={onReplay} />);
    expect((screen.getByRole("slider", { name: "Scrub evidence time" }) as HTMLInputElement).value).toBe("3");
    expect(screen.getByRole("status").textContent).toContain("4 / 8 checkpoints reached");
    fireEvent.click(screen.getByRole("button", { name: "Previous evidence time" }));
    expect(onReplay).toHaveBeenLastCalledWith(checkpoints[3]);
    fireEvent.click(screen.getByRole("button", { name: "Next evidence time" }));
    expect(onReplay).toHaveBeenLastCalledWith(checkpoints[4]);
    onReplay.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Play evidence replay" }));
    act(() => vi.advanceTimersByTime(2600));
    expect(onReplay.mock.calls).toEqual([[checkpoints[4]]]);
  });

  it("does not skip a same-day checkpoint that is still in the future", () => {
    const onReplay = vi.fn();
    render(<HemoReplayTransport dates={dates} asOf="2026-08-07T12:00:00Z" busy={false} failed={false} onReplay={onReplay} />);
    fireEvent.click(screen.getByRole("button", { name: "Previous evidence time" }));
    expect(onReplay).toHaveBeenLastCalledWith(dates[0]);
    fireEvent.click(screen.getByRole("button", { name: "Next evidence time" }));
    expect(onReplay).toHaveBeenLastCalledWith(dates[1]);
  });

  it("steps to the first checkpoint from a valid boundary before the timeline", () => {
    vi.useFakeTimers();
    const onReplay = vi.fn();
    render(<HemoReplayTransport dates={dates} asOf="2026-07-31T23:59:59Z" busy={false} failed={false} onReplay={onReplay} />);
    expect((screen.getByRole("button", { name: "Previous evidence time" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("0 / 3 checkpoints reached");
    fireEvent.click(screen.getByRole("button", { name: "Next evidence time" }));
    expect(onReplay).toHaveBeenLastCalledWith(dates[0]);
    onReplay.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Play evidence replay" }));
    act(() => vi.advanceTimersByTime(2600));
    expect(onReplay.mock.calls).toEqual([[dates[0]]]);
  });

  it("steps back to the last checkpoint from a boundary after the timeline and explicitly restarts playback", () => {
    const onReplay = vi.fn();
    render(<HemoReplayTransport dates={dates} asOf="2026-08-22T23:59:59Z" busy={false} failed={false} onReplay={onReplay} />);
    expect((screen.getByRole("button", { name: "Next evidence time" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("slider", { name: "Scrub evidence time" }) as HTMLInputElement).value).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Previous evidence time" }));
    expect(onReplay).toHaveBeenLastCalledWith(dates[2]);
    fireEvent.click(screen.getByRole("button", { name: "Play evidence replay" }));
    expect(onReplay).toHaveBeenLastCalledWith(dates[0]);
  });

  it("keeps an unavailable replay boundary inactive rather than assuming the first checkpoint", () => {
    vi.useFakeTimers();
    const onReplay = vi.fn();
    render(<HemoReplayTransport dates={dates} asOf="unavailable" busy={false} failed={false} onReplay={onReplay} />);
    for (const name of ["Previous evidence time", "Play evidence replay", "Next evidence time"]) {
      const button = screen.getByRole("button", { name }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
    }
    expect((screen.getByRole("slider", { name: "Scrub evidence time" }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Replay time unavailable");
    act(() => vi.advanceTimersByTime(10000));
    expect(onReplay).not.toHaveBeenCalled();
  });

  it("cancels playback if its current reconstruction time becomes unavailable", () => {
    vi.useFakeTimers();
    const onReplay = vi.fn();
    const { rerender } = render(<HemoReplayTransport dates={dates} asOf={dates[0]} busy={false} failed={false} onReplay={onReplay} />);
    fireEvent.click(screen.getByRole("button", { name: "Play evidence replay" }));
    rerender(<HemoReplayTransport dates={dates} asOf="" busy={false} failed={false} onReplay={onReplay} />);
    act(() => vi.advanceTimersByTime(10000));
    expect(onReplay).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Play evidence replay" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("waits for reconstruction completion before advancing to another date", () => {
    vi.useFakeTimers();
    const onReplay = vi.fn();
    const { rerender } = render(<HemoReplayTransport dates={dates} asOf={dates[0]} busy={false} failed={false} onReplay={onReplay} />);
    fireEvent.click(screen.getByRole("button", { name: "Play evidence replay" }));
    act(() => vi.advanceTimersByTime(2600));
    expect(onReplay.mock.calls).toEqual([[dates[1]]]);
    rerender(<HemoReplayTransport dates={dates} asOf={dates[0]} busy failed={false} onReplay={onReplay} />);
    act(() => vi.advanceTimersByTime(10000));
    expect(onReplay).toHaveBeenCalledTimes(1);
    rerender(<HemoReplayTransport dates={dates} asOf={dates[1]} busy={false} failed={false} onReplay={onReplay} />);
    act(() => vi.advanceTimersByTime(2600));
    expect(onReplay).toHaveBeenLastCalledWith(dates[2]);
    rerender(<HemoReplayTransport dates={dates} asOf={dates[2]} busy={false} failed={false} onReplay={onReplay} />);
    expect(screen.getByRole("button", { name: "Play evidence replay" })).toBeTruthy();
  });

  it("pauses after an error and cancels further requests on unmount", () => {
    vi.useFakeTimers();
    const onReplay = vi.fn();
    const { rerender, unmount } = render(<HemoReplayTransport dates={dates} asOf={dates[0]} busy={false} failed={false} onReplay={onReplay} />);
    fireEvent.click(screen.getByRole("button", { name: "Play evidence replay" }));
    rerender(<HemoReplayTransport dates={dates} asOf={dates[0]} busy={false} failed onReplay={onReplay} />);
    act(() => vi.advanceTimersByTime(10000));
    expect(onReplay).not.toHaveBeenCalled();
    rerender(<HemoReplayTransport dates={dates} asOf={dates[0]} busy={false} failed={false} onReplay={onReplay} />);
    fireEvent.click(screen.getByRole("button", { name: "Play evidence replay" }));
    unmount();
    act(() => vi.advanceTimersByTime(10000));
    expect(onReplay).not.toHaveBeenCalled();
  });
});
