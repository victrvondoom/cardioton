import { NextResponse } from "next/server";
import { recallAboutPatient } from "@/lib/memory/supermemory";
import { resolvePatientProfile } from "@/lib/voice/resolve-patient";

export const dynamic = "force-dynamic";

/**
 * Live memory recall the voice agent calls DURING a conversation. Lets the
 * companion look something up the moment the person references the past
 * ("do you remember what I told you about…?") instead of relying only on the
 * memories injected at call start.
 *
 * Body: { phone?, patientId?, name?, query: string }
 * Returns: { memories: string[] }
 */
export async function POST(request: Request) {
  let body: {
    phone?: string;
    patientId?: string;
    name?: string;
    query?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = String(body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ memories: [] });
  }

  const patient = await resolvePatientProfile(body);
  // Targeted live lookup: use a stricter threshold so unrelated queries return
  // nothing (lets the agent honestly say it doesn't remember).
  const hits = await recallAboutPatient(patient.id, query, 6, 0.55);

  return NextResponse.json({ memories: hits.map((h) => h.memory) });
}
