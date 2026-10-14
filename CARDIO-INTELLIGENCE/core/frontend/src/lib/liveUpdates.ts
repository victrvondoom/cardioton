/** Shared refresh policy and request metadata. Never stores response bodies. */
export const REFRESH_EVENT = "cardioton:refresh";
const POLICY_EVENT = "cardioton:refresh-policy";
const STORAGE_KEY = "cardioton.live-updates.v1";
export interface LiveUpdateState {
  enabled: boolean;
  online: boolean;
  pending: number;
  lastResponseAt: number | null;
  unavailable: number;
}
let state: LiveUpdateState = {
  enabled: true,
  online: typeof navigator === "undefined" || navigator.onLine,
  pending: 0, lastResponseAt: null, unavailable: 0,
};
try { state.enabled = localStorage.getItem(STORAGE_KEY) !== "paused"; } catch { /* session only */ }
const listeners = new Set<() => void>();
let revision = 0;
let installed = false;
let mutationTimer: ReturnType<typeof setTimeout> | undefined;
const responses = new Map<string, boolean>();
function update(next: Partial<LiveUpdateState>) {
  state = { ...state, ...next };
  listeners.forEach(listener => listener());
}
export const getLiveUpdateState = () => state;
export const getRefreshRevision = () => revision;
export function subscribeLiveUpdates(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setAutomaticUpdates(enabled: boolean) {
  update({ enabled });
  try { localStorage.setItem(STORAGE_KEY, enabled ? "live" : "paused"); } catch { /* session only */ }
  window.dispatchEvent(new Event(POLICY_EVENT));
  if (enabled) requestLiveRefresh("resume");
}
export function requestLiveRefresh(reason: "manual" | "mutation" | "resume" = "manual") {
  revision++;
  window.dispatchEvent(new CustomEvent(REFRESH_EVENT, { detail: { reason } }));
}
export function installLiveRequestTracking() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("online", () => update({ online: true }));
  window.addEventListener("offline", () => update({ online: false }));
  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) update({ enabled: event.newValue !== "paused" });
  });
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    const tracked = /^\/(api\/|mcp(?:\/|$))/.test(url.pathname);
    if (!tracked) return original(input, init);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const key = `${method} ${url.pathname}`;
    update({ pending: state.pending + 1 });
    const finish = (ok: boolean) => {
      responses.set(key, ok);
      if (responses.size > 150) responses.delete(responses.keys().next().value!);
      update({ pending: Math.max(0, state.pending - 1), lastResponseAt: Date.now(), unavailable: [...responses.values()].filter(value => !value).length });
    };
    try {
      const response = await original(input, init);
      finish(response.ok);
      if (response.ok && !["GET", "HEAD", "OPTIONS"].includes(method) && !url.pathname.includes("/auth/")) {
        clearTimeout(mutationTimer);
        mutationTimer = setTimeout(() => {
          if (state.enabled) requestLiveRefresh("mutation");
        }, 750);
      }
      return response;
    } catch (error) {
      finish(false);
      throw error;
    }
  };
}
