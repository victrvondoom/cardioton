import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POC stand-in for a real database (Postgres, Mongo, etc). Synthetic data only —
 * the hackathon rules require this, and you should never put real PHI here.
 * Swap the lookup below for an actual async DB query / vector search / API call.
 */
const PATIENT_RECORDS: Record<
  string,
  {
    name: string;
    age: number;
    lastAssessment: string;
    baselineMmse: number;
    notes: string;
  }
> = {
  "margaret chen": {
    name: "Margaret Chen",
    age: 74,
    lastAssessment: "2026-03-02",
    baselineMmse: 27,
    notes:
      "Mild word-finding difficulty noted at last visit. No functional decline.",
  },
  "robert diaz": {
    name: "Robert Diaz",
    age: 81,
    lastAssessment: "2026-05-18",
    baselineMmse: 23,
    notes:
      "Reduced verbal fluency vs. prior baseline. Recommended 6-month follow-up.",
  },
};

/**
 * Tool endpoint called by the voice agent (via client-side function calling).
 * Simulates an async DB round-trip and returns a patient's baseline so Grok can
 * compare it against the live conversation.
 */
export async function POST(request: Request) {
  let name = "";
  try {
    const body = await request.json();
    name = String(body?.name ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json({ error: "Missing 'name'" }, { status: 400 });
  }

  // Simulate async database / network latency.
  await new Promise((resolve) => setTimeout(resolve, 250));

  const record = PATIENT_RECORDS[name.toLowerCase()] ?? null;
  if (!record) {
    return NextResponse.json({
      found: false,
      message: `No baseline record found for "${name}".`,
    });
  }

  return NextResponse.json({ found: true, record });
}
