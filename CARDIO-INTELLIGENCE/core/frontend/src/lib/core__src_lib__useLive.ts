/**
 * useLive — fetch on mount / when deps change, optionally poll, and expose loading / error / reload state.
 *
 * Every dashboard module reads real backend data through this hook so pages stay current without a manual
 * refresh. Stale responses (an older request resolving after a newer one) are dropped, polling pauses while
 * the tab is hidden, and the last good data is kept on screen if a refresh fails.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAutoRefresh } from "./useAutoRefresh";

export interface Live<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** last successful load */
  updatedAt: Date | null;
  reload: () => void;
}

export function useLive<T>(load: () => Promise<T>, deps: unknown[] = [], pollMs = 30_000): Live<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const seq = useRef(0);
  const inFlight = useRef<{ id: number; promise: Promise<void> } | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(() => {
    if (inFlight.current?.id === seq.current) return inFlight.current.promise;
    const id = ++seq.current;
    const promise = (async () => {
      setLoading(true);
      try {
        const r = await loadRef.current();
        if (id !== seq.current) return;
        setData(r);
        setError(null);
        setUpdatedAt(new Date());
      } catch (e) {
        if (id !== seq.current) return;
        setError((e as Error)?.message || "Request failed");
      } finally {
        if (id === seq.current) setLoading(false);
      }
    })();
    inFlight.current = { id, promise };
    void promise.finally(() => { if (inFlight.current?.id === id) inFlight.current = null; });
    return promise;
  }, []);

  useEffect(() => {
    void run();
    return () => {
      seq.current++; // invalidate in-flight request on unmount / dep change
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useAutoRefresh(run, pollMs);

  return { data, error, loading, updatedAt, reload: () => void run() };
}
