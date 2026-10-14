import { readFileSync } from "fs";
import { NextResponse } from "next/server";
import { join } from "path";
import type { DashboardKpiEntry } from "@/lib/dashboard-kpi";

export const dynamic = "force-dynamic";

const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";
const MODEL = "grok-4.3";

function loadKnowledge(): string {
  try {
    return readFileSync(join(process.cwd(), "KNOWLEDGE.md"), "utf-8");
  } catch {
    return "";
  }
}

const KNOWLEDGE = loadKnowledge();

const SYSTEM_PROMPT = `You are a warm, friendly helper writing a short update for a family member who looks after someone with memory problems. They are not a medical professional — write as if you're leaving a kind note for a friend.

Rules:
- Write 2–4 sentences. No bullet points, no headers.
- Use everyday language only. Never use words like: cognitive, score, index, metric, fluency, orientation, lexical, baseline, or any clinical term.
- Instead say things like: "the phone call games", "remembering words", "knowing what day it is", "her mood", "whether she took her medication".
- Say whether things seem about the same, a little better, or worth keeping an eye on — in plain terms.
- If there are safety concerns, mention them gently and suggest talking to a doctor.
- End with something human and warm when the data allows.
- Use the research context below only to inform your understanding — never quote or reference it directly.

<research_context>
${KNOWLEDGE}
</research_context>`;

function buildDigest(rows: DashboardKpiEntry[], patientName: string): string {
  if (rows.length === 0) return "No call data available.";

  const latest = rows.at(-1)!;
  const earliest = rows[0];
  const callCount = rows.length;

  const trendNote = (
    key: keyof DashboardKpiEntry,
    label: string,
    higherIsBetter = true,
  ): string => {
    const first =
      typeof earliest[key] === "number" ? (earliest[key] as number) : null;
    const last =
      typeof latest[key] === "number" ? (latest[key] as number) : null;
    if (first == null || last == null) return "";
    const diff = last - first;
    if (Math.abs(diff) < 0.5) return `${label}: stable`;
    const direction =
      diff > 0 === higherIsBetter ? "slightly improved" : "slightly declined";
    return `${label}: ${direction} (${first} → ${last})`;
  };

  const trends = [
    trendNote("verbalFluency", "animal naming game"),
    trendNote("immediateWordRecall", "remembering words right away"),
    trendNote("delayedWordRecall", "recalling words later"),
    trendNote("temporalOrientation", "knowing today's date", true),
    trendNote("wordFindingFailures", "trouble finding words", false),
    trendNote("repetitionCount", "repeating things in one call", false),
  ]
    .filter(Boolean)
    .join("; ");

  const safetyFlags = rows.filter((r) => r.safetyFlag).length;
  const recentMoods = rows
    .slice(-5)
    .map((r) => r.mood)
    .filter((m) => m !== "Not assessed");

  const lines = [
    `Patient: ${patientName}`,
    `Calls reviewed: ${callCount} (from ${earliest.date} to ${latest.date})`,
    `Most recent call: ${latest.date}`,
    `Mood on last call: ${latest.mood}`,
    `Medication on last call: ${latest.medicationAdherence}`,
    latest.safetyFlag
      ? `SAFETY FLAG on last call: ${latest.safetyFlagType ?? "yes"}`
      : "No safety flag on last call",
    safetyFlags > 0
      ? `Total safety flags across all calls: ${safetyFlags}`
      : "No safety flags across any call",
    recentMoods.length > 0
      ? `Recent moods (last 5 calls): ${recentMoods.join(", ")}`
      : "",
    trends ? `Cognitive trends: ${trends}` : "",
    latest.summary ? `Last call summary: ${latest.summary}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return lines;
}

export async function POST(request: Request) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "XAI_API_KEY not configured" },
      { status: 500 },
    );
  }

  let body: { rows?: DashboardKpiEntry[]; patientName?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rows = body.rows ?? [];
  const patientName = body.patientName ?? "your loved one";

  if (rows.length === 0) {
    return NextResponse.json({ summary: null });
  }

  const digest = buildDigest(rows, patientName);

  const res = await fetch(XAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: digest },
      ],
    }),
  });

  if (!res.ok) {
    console.error("[trend-summary] xAI error:", res.status, await res.text());
    return NextResponse.json({ error: "AI request failed" }, { status: 502 });
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const summary = data.choices?.[0]?.message?.content?.trim() ?? null;

  return NextResponse.json({ summary });
}
