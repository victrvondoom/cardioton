import { NextResponse } from "next/server";
import { hasActiveListeners, publishGuidance } from "@/lib/guidance/channel";
import { resolvePatientProfile } from "@/lib/voice/resolve-patient";

export const dynamic = "force-dynamic";

/**
 * A caretaker publishes a private guidance note for a patient's live call.
 * Resolves the patient the same way the call client does (phone/name → id) so
 * both sides land on the same channel key.
 *
 * Body: { phone?, patientId?, name?, text }
 * Returns: { delivered, live } — `live` is true if a call is currently listening.
 */
export async function POST(request: Request) {
  let body: {
    phone?: string;
    patientId?: string;
    name?: string;
    text?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = String(body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Missing 'text'" }, { status: 400 });
  }

  const patient = await resolvePatientProfile(body);
  const live = await hasActiveListeners(patient.id);
  await publishGuidance(patient.id, text);

  return NextResponse.json({
    delivered: true,
    live,
    patientName: patient.preferredName,
  });
}
