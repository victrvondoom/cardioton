import { useEffect, useRef } from "react";
import { getLiveUpdateState, REFRESH_EVENT } from "./liveUpdates";

/** Revalidates read-only loaders; does not call on mount or reset form state. */
export function useAutoRefresh(load: () => unknown, intervalMs = 30_000, enabled = true): void {
  const loader = useRef(load);
  loader.current = load;
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let running = false;
    let lastRun = 0;
    const refresh = async (manual = false) => {
      const policy = getLiveUpdateState();
      if (!active || running || !policy.online || document.visibilityState !== "visible" || (!manual && !policy.enabled)) return;
      if (!manual && Date.now() - lastRun < 1000) return;
      running = true;
      lastRun = Date.now();
      try { await loader.current(); } catch { /* Loader owns its visible error state. */ }
      finally { running = false; }
    };
    const onRefresh = (event: Event) => { void refresh((event as CustomEvent<{ reason: string }>).detail?.reason === "manual"); };
    const onFocus = () => { void refresh(); };
    const timer = intervalMs > 0 ? window.setInterval(onFocus, intervalMs) : undefined;
    window.addEventListener(REFRESH_EVENT, onRefresh);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      active = false;
      if (timer !== undefined) window.clearInterval(timer);
      window.removeEventListener(REFRESH_EVENT, onRefresh);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [intervalMs, enabled]);
}
