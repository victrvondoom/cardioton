import { getRefreshRevision } from "./liveUpdates";

// Share only an outstanding JSON read. Completed responses are never cached, and
// each caller receives its own body so parsing one response cannot consume another.
const pendingByFetch = new WeakMap<typeof fetch, Map<string, Promise<Response>>>();

export function readFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const transport = fetch;
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  const accept = headers.get("Accept");
  const url = String(input);
  if (method !== "GET" || init?.signal || init?.body != null || headers.has("Range") ||
      (accept != null && !accept.includes("json")) || /\/(?:stream|events)(?:[/?]|$)/.test(url)) {
    return transport(input, init);
  }
  if (!accept) headers.set("Accept", "application/json");
  const options = { ...init, headers };
  const key = JSON.stringify([
    url, [...headers.entries()], getRefreshRevision(), init?.credentials, init?.cache,
    init?.mode, init?.redirect, init?.referrer, init?.referrerPolicy, init?.integrity, init?.keepalive,
  ]);
  let pending = pendingByFetch.get(transport);
  if (!pending) {
    pending = new Map();
    pendingByFetch.set(transport, pending);
  }
  let request = pending.get(key);
  if (!request) {
    request = transport(input, options);
    pending.set(key, request);
    const forget = () => { if (pending.get(key) === request) pending.delete(key); };
    void request.then(forget, forget);
  }
  return request.then(response => response.clone());
}
