import { after, NextResponse } from "next/server";
import { rememberAboutPatient } from "@/lib/memory/supermemory";
import { processCall } from "@/lib/pipeline/process-call";
import { resolvePatientProfile } from "@/lib/voice/resolve-patient";

export const dynamic = "force-dynamic";

type Turn = { role: "user" | "assistant"; text: string };

/**
 * Called when a call ends. Does two things with the transcript:
 *  1. Stores it in long-term memory (supermemory) for future personalization.
 *  2. Kicks off the KPI extraction pipeline in the BACKGROUND (Next `after()`),
 *     which writes a row to `kpi_results` for the dashboards. This runs after
 *     the response is sent, so the client isn't blocked on it. The pipeline is
 *     a pure function (`processCall`) so it can move to Inngest later unchanged.
 *
 * Body: { phone?: string, patientId?: string, name?: string, turns: { role, text }[] }
 */
export async function POST(request: Request) {
  let body: {
    phone?: string;
    patientId?: string;
    name?: string;
    turns?: Turn[];
  } = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const turns: Turn[] = Array.isArray(body.turns) ? body.turns : [];

  // Only store if the patient actually said something — skip empty / one-sided
  // calls so we don't pollute memory with greetings that went nowhere.
  const patientSpoke = turns.some(
    (t) => t.role === "user" && t.text.trim().length > 0,
  );
  if (!patientSpoke) {
    return NextResponse.json({ stored: false, reason: "no patient speech" });
  }

  // Resolve the real patient (DB-backed name + stable memory id).
  const patient = await resolvePatientProfile(body);
  const name = patient.preferredName;
  const companion = patient.companionName;
  const date = new Date().toISOString().slice(0, 10);

  const transcript = turns
    .filter((t) => t.text.trim())
    .map((t) => `${t.role === "user" ? name : companion}: ${t.text.trim()}`)
    .join("\n");

  // Frame the transcript so memory extraction captures the longitudinal
  // cognitive picture (word-finding, recall, orientation, mood) as well as the
  // life details — this is what lets us "slowly learn" how they're tracking.
  const content = [
    `Daily check-in call between ${companion} and ${name} on ${date}.`,
    ``,
    `Remember both: (a) life details ${name} shares (people, events, feelings, routine), and (b) observations about how ${name} is doing cognitively in this call — any word-finding difficulty or substitutions, what they did and didn't recall (including anything ${companion} asked them to hold onto), their orientation to day/time/place, and their mood and energy. Note these factually and gently for tracking changes over time.`,
    ``,
    `Transcript:`,
    transcript,
  ].join("\n");

  const result = await rememberAboutPatient(patient.id, content, {
    kind: "call_transcript",
    date,
  });

  // Extract cognitive KPIs in the background and write them to the DB for the
  // dashboards. Runs after the response is flushed; failures are logged, never
  // surfaced to the caller.
  after(async () => {
    try {
      await processCall({
        patientId: patient.id,
        patientName: name,
        companionName: companion,
        turns,
        callDate: date,
      });
    } catch (err) {
      console.error("[remember] KPI pipeline failed:", err);
    }
  });

  return NextResponse.json(result);
}
