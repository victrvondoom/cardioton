import { NextResponse } from "next/server";
import { toDashboardKpiEntry } from "@/lib/dashboard-kpi";
import { kpis } from "@/lib/db/grok_app__lib_db__index";
import { resolvePatientProfile } from "@/lib/voice/resolve-patient";

export const dynamic = "force-dynamic";

/**
 * Returns chronological KPI history for the dashboard.
 *
 * Body: { phone?, patientId?, name?, limit? }
 */
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
    // Empty body falls back to the demo patient.
  }

  const patient = await resolvePatientProfile(body);
  const limit =
    typeof body.limit === "number" && Number.isFinite(body.limit)
      ? Math.min(Math.max(Math.trunc(body.limit), 1), 180)
      : 60;

  try {
    const rows = await kpis.listByPatient(patient.id, limit);
    return NextResponse.json({
      patientId: patient.id,
      rows: rows.map(toDashboardKpiEntry),
    });
  } catch (err) {
    console.error("[kpi/history] query failed:", err);
    return NextResponse.json(
      { error: "KPI history is unavailable" },
      { status: 503 },
    );
  }
}
