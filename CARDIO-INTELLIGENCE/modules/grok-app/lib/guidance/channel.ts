/**
 * Cross-device caretaker guidance channel, keyed by patient id.
 *
 * A caretaker (on any device) publishes a private note for a patient; the
 * active call client drains them and feeds each into the live session.
 *
 * Backends:
 *  - Upstash Redis (when UPSTASH_REDIS_REST_* are set): works across serverless
 *    instances, so it's what we use in production. Upstash REST has no
 *    persistent SUBSCRIBE, so we model the channel as a per-patient queue (a
 *    Redis list the call client drains by polling) plus a short-lived presence
 *    key so the caretaker can tell whether a call is live.
 *  - In-memory (no Redis configured): a simple process-local pub/sub for local
 *    dev. The publish/drain surface is identical.
 */

import { Redis } from "@upstash/redis";

export type GuidanceNote = {
  id: string;
  patientId: string;
  text: string;
  at: number;
};

const QUEUE_TTL_SECONDS = 120; // notes auto-expire if no call drains them
const PRESENCE_TTL_SECONDS = 30; // refreshed by the active call's stream

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

export function isRedisEnabled(): boolean {
  return redis !== null;
}

const queueKey = (patientId: string) => `guidance:q:${patientId}`;
const presenceKey = (patientId: string) => `guidance:live:${patientId}`;

type Listener = (note: GuidanceNote) => void;

// In-memory fallback state (local dev without Redis).
const memListeners = new Map<string, Set<Listener>>();
const memQueues = new Map<string, GuidanceNote[]>();

function newNote(patientId: string, text: string): GuidanceNote {
  return { id: crypto.randomUUID(), patientId, text, at: Date.now() };
}

/** Publish a guidance note for a patient's live call. */
export async function publishGuidance(
  patientId: string,
  text: string,
): Promise<GuidanceNote> {
  const note = newNote(patientId, text);

  if (redis) {
    const key = queueKey(patientId);
    await redis.lpush(key, JSON.stringify(note));
    await redis.expire(key, QUEUE_TTL_SECONDS);
    return note;
  }

  const subs = memListeners.get(patientId);
  if (subs && subs.size > 0) {
    for (const fn of subs) {
      try {
        fn(note);
      } catch {
        // a broken listener shouldn't break delivery to others
      }
    }
  } else {
    // No active listener yet: queue so a call that connects shortly still gets it.
    const q = memQueues.get(patientId) ?? [];
    q.push(note);
    memQueues.set(patientId, q);
  }
  return note;
}

/** Drain all currently-queued notes for a patient (FIFO). */
export async function drainGuidance(
  patientId: string,
): Promise<GuidanceNote[]> {
  const out: GuidanceNote[] = [];

  if (redis) {
    const key = queueKey(patientId);
    // RPOP from the tail → FIFO with LPUSH. Drain everything pending.
    for (;;) {
      const raw = await redis.rpop<string | GuidanceNote>(key);
      if (!raw) break;
      try {
        out.push(typeof raw === "string" ? JSON.parse(raw) : raw);
      } catch {
        // skip malformed entry
      }
    }
    return out;
  }

  const q = memQueues.get(patientId);
  if (q && q.length) {
    out.push(...q);
    memQueues.set(patientId, []);
  }
  return out;
}

/** Mark that a call is actively listening for this patient (presence). */
export async function markPresence(patientId: string): Promise<void> {
  if (redis) {
    await redis.set(presenceKey(patientId), "1", { ex: PRESENCE_TTL_SECONDS });
  }
}

/** Clear presence when a call ends. */
export async function clearPresence(patientId: string): Promise<void> {
  if (redis) {
    await redis.del(presenceKey(patientId));
  }
}

/** Whether a call is currently live for this patient. */
export async function hasActiveListeners(patientId: string): Promise<boolean> {
  if (redis) {
    return (await redis.exists(presenceKey(patientId))) === 1;
  }
  return (memListeners.get(patientId)?.size ?? 0) > 0;
}

/**
 * Subscribe to a patient's guidance stream (in-memory backend only). Returns an
 * unsubscribe function. With Redis, the stream route polls `drainGuidance`
 * instead.
 */
export function subscribeGuidance(patientId: string, fn: Listener): () => void {
  let subs = memListeners.get(patientId);
  if (!subs) {
    subs = new Set();
    memListeners.set(patientId, subs);
  }
  subs.add(fn);

  // Flush anything queued before this listener attached.
  const q = memQueues.get(patientId);
  if (q && q.length) {
    memQueues.set(patientId, []);
    for (const n of q) fn(n);
  }

  return () => {
    const set = memListeners.get(patientId);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) memListeners.delete(patientId);
  };
}
