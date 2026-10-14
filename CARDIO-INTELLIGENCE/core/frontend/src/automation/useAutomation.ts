import { useCallback, useEffect, useRef, useState } from "react";

export type AutomationPhase = "idle" | "running" | "paused" | "completed" | "failed" | "cancelled";
export interface AutomationControl { shouldStop: () => boolean; isCurrent: () => boolean }
export interface AutomationTask { id: string; label: string; run: (control: AutomationControl) => Promise<void | { pause: string }> }
export interface AutomationStep { id: string; label: string; status: "pending" | "running" | "complete" | "paused" | "failed" }
export interface AutomationState {
  phase: AutomationPhase; steps: AutomationStep[]; message: string;
  startedAt: number | null; finishedAt: number | null;
}
const initial = (): AutomationState => ({ phase: "idle", steps: [], message: "", startedAt: null, finishedAt: null });

/** User-initiated orchestration. Never retries a write or stores patient data. */
export function useAutomation() {
  const [state, setState] = useState<AutomationState>(initial);
  const active = useRef(false);
  const stopping = useRef(false);
  const epoch = useRef(0);
  useEffect(() => () => { epoch.current++; stopping.current = true; active.current = false; }, []);
  const run = useCallback(async (tasks: AutomationTask[]) => {
    if (active.current) return false;
    active.current = true;
    stopping.current = false;
    const current = ++epoch.current;
    const update = (fn: (previous: AutomationState) => AutomationState) => {
      if (current === epoch.current) setState(fn);
    };
    update(() => ({ phase: "running", steps: tasks.map(({ id, label }) => ({ id, label, status: "pending" })), message: "Preparing your work…", startedAt: Date.now(), finishedAt: null }));
    const finish = (phase: AutomationPhase, message: string) => update(previous => ({ ...previous, phase, message, finishedAt: Date.now() }));
    try {
      for (const task of tasks) {
        if (current !== epoch.current) return false;
        if (stopping.current) { finish("cancelled", "Stopped. Completed work is retained; no further steps were started."); return false; }
        update(previous => ({ ...previous, message: task.label, steps: previous.steps.map(step => step.id === task.id ? { ...step, status: "running" } : step) }));
        try {
          const result = await task.run({ shouldStop: () => stopping.current || current !== epoch.current, isCurrent: () => current === epoch.current });
          if (current !== epoch.current) return false;
          update(previous => ({ ...previous, steps: previous.steps.map(step => step.id === task.id ? { ...step, status: result?.pause ? "paused" : "complete" } : step) }));
          if (result?.pause) { finish("paused", result.pause); return false; }
        } catch (error) {
          update(previous => ({ ...previous, steps: previous.steps.map(step => step.id === task.id ? { ...step, status: "failed" } : step) }));
          finish("failed", error instanceof Error ? error.message : "This step could not be completed. Review the input and try again.");
          return false;
        }
      }
      if (stopping.current) { finish("cancelled", "Stopped after the current step. Completed work is retained."); return false; }
      finish("completed", "Preparation complete. Your results are ready.");
      return true;
    } finally { if (current === epoch.current) active.current = false; }
  }, []);
  const cancel = useCallback(() => {
    if (!active.current) return;
    stopping.current = true;
    setState(previous => ({ ...previous, message: "Stopping after the current step…" }));
  }, []);
  const reset = useCallback(() => {
    if (active.current) return;
    epoch.current++;
    setState(initial());
  }, []);
  return { state, running: state.phase === "running", run, cancel, reset };
}

export type AutomationController = ReturnType<typeof useAutomation>;
