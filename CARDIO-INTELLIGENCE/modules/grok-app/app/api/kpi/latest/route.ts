import { NextResponse } from "next/server";
import { kpis } from "@/lib/db/grok_app__lib_db__index";
import { resolvePatientProfile } from "@/lib/voice/resolve-patient";

export const dynamic = "force-dynamic";

/**
 * Returns the most recent extracted KPI row for a patient. Used by the /test
 * debug panel to poll for the result of the background extraction pipeline.
 *
 * Body: { phone?, patientId?, name? }
 */
export async function POST(request: Request) {
  let body: { phone?: string; patientId?: string; name?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body → demo patient
  }

  const patient = await resolvePatientProfile(body);
  try {
    const row = await kpis.latestByPatient(patient.id);
    return NextResponse.json({ patientId: patient.id, latest: row });
  } catch (err) {
    console.error("[kpi/latest] query failed:", err);
    return NextResponse.json({ patientId: patient.id, latest: null });
  }
}
