import { NextResponse } from "next/server";
import {
  patientHasHistory,
  recallAboutPatient,
} from "@/lib/memory/supermemory";
import { type AgendaBeat, buildCallAgenda } from "@/lib/voice/call-agenda";
import {
  buildCallInstructions,
  buildIntroInstructions,
} from "@/lib/voice/call-flow";
import { resolvePatientProfile } from "@/lib/voice/resolve-patient";

// Always run at request time — we never want to cache a short-lived token.
export const dynamic = "force-dynamic";

/**
 * Starts a call: resolves the real patient from the database, mints a
 * short-lived xAI ephemeral token, AND builds the memory-personalized system
 * instructions — all server-side so neither the xAI key nor the supermemory key
 * ever reaches the browser.
 *
 * Body: { phone?: string, patientId?: string, name?: string }
 * Returns: { value, expires_at, instructions, mode, memoriesRecalled }
 *
 * Docs: https://docs.x.ai/developers/model-capabilities/audio/ephemeral-tokens
 */
export async function POST(request: Request) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "XAI_API_KEY is not set. Add it to .env.local." },
      { status: 500 },
    );
  }

  // Resolve who we're calling from the DB (name + stable memory id).
  let body: {
    phone?: string;
    patientId?: string;
    name?: string;
    companionName?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine — resolver falls back to the demo patient.
  }
  const patient = await resolvePatientProfile(body);
  const patientId = patient.id;

  // First-ever call? Run the warm intro instead of the daily check-in.
  const hasHistory = await patientHasHistory(patientId);

  let instructions: string;
  let memories: string[] = [];
  let mode: "intro" | "daily";
  // Ordered assessment beats the call client walks through during lulls. The
  // intro call has none — first contact is purely warmth, no assessment.
  let agenda: AgendaBeat[] = [];

  if (!hasHistory) {
    mode = "intro";
    instructions = buildIntroInstructions(patient);
  } else {
    mode = "daily";
    // Recall what we learned in previous calls.
    const hits = await recallAboutPatient(
      patientId,
      `Recent life, family, health, mood, routine, and anything ${patient.preferredName} shared in past calls`,
      8,
    );
    memories = hits.map((h) => h.memory);
    instructions = buildCallInstructions(patient, memories);
    agenda = buildCallAgenda(patient);
  }

  const res = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Token lifetime. Plenty for a single conversation; client reconnects mint a new one.
      expires_after: { seconds: 600 },
      // Bind the session model to the secret.
      session: { model: "grok-voice-think-fast-1.1" },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      { error: "Failed to mint ephemeral token", detail },
      { status: res.status },
    );
  }

  // Shape from xAI: { value: string, expires_at: number }
  const data = (await res.json()) as { value: string; expires_at: number };
  return NextResponse.json({
    value: data.value,
    expires_at: data.expires_at,
    instructions,
    agenda,
    mode,
    memoriesRecalled: memories.length,
  });
}
