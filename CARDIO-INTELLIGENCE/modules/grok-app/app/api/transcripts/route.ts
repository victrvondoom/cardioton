import { NextResponse } from "next/server";
import { kpis } from "@/lib/db/grok_app__lib_db__index";
import { resolvePatientProfile } from "@/lib/voice/resolve-patient";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: {
    phone?: string;
    patientId?: string;
    name?: string;
    limit?: number;
  } = {};

  try {
    body = await request.json();
  } catch {
    // falls back to demo
  }

  const patient = await resolvePatientProfile(body);
  const limit =
    typeof body.limit === "number" && Number.isFinite(body.limit)
      ? Math.min(Math.max(Math.trunc(body.limit), 1), 180)
      : 60;

  try {
    const rows = await kpis.listTranscriptsByPatient(patient.id, limit);
    return NextResponse.json({ patientId: patient.id, rows });
  } catch (err) {
    console.error("[transcripts] query failed:", err);
    return NextResponse.json(
      { patientId: patient.id, rows: [] },
      { status: 200 },
    );
  }
}
