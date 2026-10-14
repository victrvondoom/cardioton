/**
 * Supermemory client — long-term patient memory for Memento.
 * SERVER-ONLY. The API key must never reach the browser.
 *
 * Everything here is gated behind the SUPERMEMORY_ENABLED feature flag. While
 * the flag is off (the default for now), every call is a safe no-op so the rest
 * of the app can call these freely without branching.
 *
 * Docs: https://supermemory.ai/docs
 *   - Add:    POST https://api.supermemory.ai/v3/documents
 *   - Search: POST https://api.supermemory.ai/v4/search
 */

const BASE_URL = "https://api.supermemory.ai";

/** True only when the flag is on AND a key is present. */
export function isMemoryEnabled(): boolean {
  return (
    process.env.SUPERMEMORY_ENABLED === "true" &&
    Boolean(process.env.SUPERMEMORY_API_KEY)
  );
}

/**
 * Container tag isolates one patient's memories from everyone else's.
 * Keep it stable per patient (e.g. a DB user id). Supermemory only allows
 * [a-zA-Z0-9_:-] in tags, so we strip anything else (e.g. "+" in phone numbers).
 */
export function patientContainerTag(patientId: string): string {
  const safe = patientId.replace(/[^a-zA-Z0-9_:-]/g, "");
  return `patient_${safe}`;
}

export type MemoryHit = {
  memory: string;
  similarity: number;
  updatedAt?: string;
};

/**
 * Remember a fact/highlight about a patient. No-op when memory is disabled.
 * `content` is plain text — supermemory extracts memories from it.
 */
export async function rememberAboutPatient(
  patientId: string,
  content: string,
  metadata?: Record<string, unknown>,
): Promise<{ stored: boolean; id?: string }> {
  if (!isMemoryEnabled()) return { stored: false };

  const res = await fetch(`${BASE_URL}/v3/documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPERMEMORY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      containerTag: patientContainerTag(patientId),
      metadata,
    }),
  });

  if (!res.ok) {
    console.error("[supermemory] add failed:", res.status, await res.text());
    return { stored: false };
  }
  const data = (await res.json()) as { id?: string };
  return { stored: true, id: data.id };
}

/**
 * Recall what we know about a patient relevant to `query`. Returns [] when
 * memory is disabled. Use this to personalize a call ("last time you mentioned…").
 *
 * `threshold` controls precision (0–1, higher = stricter):
 *  - ~0.3 for a WIDE context dump at call start (cast a net for anything useful)
 *  - ~0.55 for a TARGETED live lookup ("do you remember X?") so unrelated
 *    queries correctly return nothing and the agent can admit it doesn't know.
 */
export async function recallAboutPatient(
  patientId: string,
  query: string,
  limit = 5,
  threshold = 0.3,
): Promise<MemoryHit[]> {
  if (!isMemoryEnabled()) return [];

  const res = await fetch(`${BASE_URL}/v4/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPERMEMORY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      containerTag: patientContainerTag(patientId),
      limit,
      threshold,
    }),
  });

  if (!res.ok) {
    console.error("[supermemory] search failed:", res.status, await res.text());
    return [];
  }

  const data = (await res.json()) as {
    results?: Array<{
      memory?: string;
      similarity?: number;
      updatedAt?: string;
    }>;
  };
  return (data.results ?? [])
    .filter(
      (r): r is { memory: string; similarity: number; updatedAt?: string } =>
        Boolean(r.memory),
    )
    .map((r) => ({
      memory: r.memory,
      similarity: r.similarity ?? 0,
      updatedAt: r.updatedAt,
    }));
}

/**
 * Whether we've ever stored anything for this patient — i.e. have they done a
 * call with the AI before. Used to decide between the first-time intro call and
 * the normal daily check-in. Returns false when memory is disabled (so a fresh
 * install always starts with the intro).
 *
 * Note: a document added moments ago may still be processing; this checks for
 * any document in the container regardless of status.
 */
export async function patientHasHistory(patientId: string): Promise<boolean> {
  if (!isMemoryEnabled()) return false;

  const res = await fetch(`${BASE_URL}/v3/documents/list`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPERMEMORY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      containerTags: [patientContainerTag(patientId)],
      limit: 1,
    }),
  });

  if (!res.ok) {
    console.error("[supermemory] list failed:", res.status, await res.text());
    // Fail safe: treat as "has history" so a transient error doesn't make a
    // returning patient sit through the intro again.
    return true;
  }

  const data = (await res.json()) as {
    pagination?: { totalItems?: number };
    memories?: unknown[];
  };
  const total =
    data.pagination?.totalItems ?? (data.memories ? data.memories.length : 0);
  return total > 0;
}
