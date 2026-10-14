import {
  clearPresence,
  drainGuidance,
  isRedisEnabled,
  markPresence,
  subscribeGuidance,
} from "@/lib/guidance/channel";
import { resolvePatientProfile } from "@/lib/voice/resolve-patient";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream of caretaker guidance for a patient's live call.
 * The call client opens this (EventSource is GET-only, so identity comes via
 * query params) and feeds each note into the running session.
 *
 * With Redis configured we poll-drain the patient's queue and refresh a
 * presence key (so cross-device, multi-instance works). Without Redis we use
 * the in-memory pub/sub for local dev.
 *
 * GET /api/guidance/stream?phone=...&name=...   (or ?patientId=...)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const patient = await resolvePatientProfile({
    phone: url.searchParams.get("phone") ?? undefined,
    name: url.searchParams.get("name") ?? undefined,
    patientId: url.searchParams.get("patientId") ?? undefined,
  });
  const patientId = patient.id;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      // Tell the client which patient id it actually resolved to.
      send("ready", { patientId });

      let unsubscribe: (() => void) | null = null;
      let pollTimer: ReturnType<typeof setInterval> | null = null;

      if (isRedisEnabled()) {
        // Redis path: announce presence, then poll-drain the queue.
        void markPresence(patientId);
        pollTimer = setInterval(async () => {
          try {
            await markPresence(patientId);
            const notes = await drainGuidance(patientId);
            for (const note of notes) send("guidance", note);
          } catch {
            // transient Redis error — keep the stream alive and retry next tick
          }
        }, 1000);
      } else {
        // In-memory path: push-subscribe.
        unsubscribe = subscribeGuidance(patientId, (note) => {
          send("guidance", note);
        });
      }

      // Heartbeat keeps the connection alive through proxies.
      const heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        if (pollTimer) clearInterval(pollTimer);
        if (unsubscribe) unsubscribe();
        void clearPresence(patientId);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
