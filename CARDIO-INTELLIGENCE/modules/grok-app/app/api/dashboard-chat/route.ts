import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";
const MODEL = "grok-4.3";

const SYSTEM_PROMPT = `You are a warm, friendly helper talking to a family member who looks after someone with memory problems. They are not a doctor or medical professional — they just want to know how their loved one is doing in simple, everyday terms.

How to talk:
- Speak like you're chatting with a friend, not writing a report. Short sentences, simple words.
- NEVER use any of these words or phrases: cognitive score, cognitive index, metric, verbal fluency, lexical diversity, stop-word fraction, temporal orientation, weighted average, baseline, standard deviation, percentile, assessed, or any other clinical or technical term.
- Instead say things like: "the phone call games", "remembering words", "repeating themselves", "knowing what day it is", "mood during the call", "whether they took their medication".
- When you reference data, say things like "last Tuesday she seemed a bit down" or "over the past two weeks she's been doing well at the word games" — never quote raw numbers unless they make intuitive sense (e.g. "she named 12 animals, which is a little lower than usual").
- Be warm and reassuring where the data allows. If something is concerning, mention it gently and suggest they speak to a doctor if they're worried — don't catastrophise.
- Keep answers short (2–5 sentences). If they want more detail, they'll ask.
- If you don't have information to answer something, say so kindly.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "XAI_API_KEY not configured" },
      { status: 500 },
    );
  }

  let body: {
    messages?: ChatMessage[];
    context?: string;
    patientName?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = body.messages ?? [];
  const context = body.context ?? "";
  const patientName = body.patientName ?? "your loved one";

  if (messages.length === 0) {
    return NextResponse.json(
      { error: "No messages provided" },
      { status: 400 },
    );
  }

  const systemMessages: { role: string; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  if (context) {
    systemMessages.push({
      role: "system",
      content: `Current chart context for ${patientName}:\n${context}`,
    });
  }

  const res = await fetch(XAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.5,
      messages: [...systemMessages, ...messages],
    }),
  });

  if (!res.ok) {
    console.error("[dashboard-chat] xAI error:", res.status, await res.text());
    return NextResponse.json({ error: "AI request failed" }, { status: 502 });
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const reply = data.choices?.[0]?.message?.content?.trim() ?? "";

  return NextResponse.json({ reply });
}
