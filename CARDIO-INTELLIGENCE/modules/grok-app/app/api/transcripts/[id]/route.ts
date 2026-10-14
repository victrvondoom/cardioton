import { NextResponse } from "next/server";
import { kpis } from "@/lib/db/grok_app__lib_db__index";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const row = await kpis.findTranscriptById(id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    console.error("[transcripts/id] query failed:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
