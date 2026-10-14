/**
 * Text-mode test harness for the daily call.
 *
 * Connects to the SAME Grok realtime API the browser uses, but drives the
 * conversation with TEXT instead of audio so we can iterate on Cora's pacing
 * without a microphone. It plays "Andrew" with deliberately decline-flavoured
 * answers (tired, can't recall, can't name, a fall) so we can watch:
 *   - whether Cora paces the agenda naturally (one beat at a time, not racing),
 *   - whether the post-call KPI extractor flags cognitive decline + safety.
 *
 * It mirrors the real client's agenda driver: after each of Cora's turns it
 * injects the next [[NEXT FOCUS]] cue (paced) as a silent item, then has Andrew
 * speak, then asks Cora to respond.
 *
 * Run:  bun run scripts/test-call.ts            (defaults to Andrew)
 *       bun run scripts/test-call.ts "Andrew" "7789030066"
 */

import { recallAboutPatient } from "../lib/memory/supermemory";
import { buildCallAgenda } from "../lib/voice/call-agenda";
import { buildCallInstructions } from "../lib/voice/call-flow";
import { extractKpis } from "../lib/voice/kpi";
import { buildPatientProfile } from "../lib/voice/patient-profile";

const MODEL = "grok-voice-think-fast-1.1";
const REALTIME_URL = `wss://api.x.ai/v1/realtime?model=${MODEL}`;

// Agenda pacing — mirror the real client (use-grok-voice.ts).
const AGENDA_WARMUP_TURNS = 1;
const AGENDA_TURN_SPACING = 2;

// Safety: stop the harness if the model never wraps up.
const MAX_ASSISTANT_TURNS = 22;

const argName = process.argv[2]?.trim() || "Andrew";
const argPhone = process.argv[3]?.trim() || "7789030066";
const phone = argPhone.startsWith("+")
  ? `+${argPhone.replace(/\D/g, "")}`
  : `+1${argPhone.replace(/\D/g, "")}`;

/**
 * Andrew's reply, chosen by what Cora just asked. Deliberately shows decline:
 * flat mood, poor recall, word-finding failures, filler words, and one safety
 * event (a fall + getting lost) so the extractor flags it.
 */
function andrewReply(coraText: string, turnIndex: number): string {
  const t = coraText.toLowerCase();

  // Animals / verbal fluency.
  if (/animal|name as many|as many .* as you can/.test(t))
    return "Oh… a dog… um… a cat… a dog… the, you know, the big one… I can't think of any more.";

  // Three words — repeat back / later recall.
  if (/apple|river|chair|three words|say.*back|those words/.test(t))
    return "Apple… and… um… I lost the others. Just apple, I think.";

  // Story recall (Anna / handbag / bus).
  if (/story|anna|handbag|bus|remember.*told|earlier/.test(t))
    return "What story? I don't… no, I don't remember any story.";

  // Orientation — day / date.
  if (/what day|day of the week|today|date|month|year/.test(t))
    return "The day? Oh… I'm not sure. Is it… winter? I don't really know.";

  // Medication.
  if (/pill|medic|tablet|blue pill|taken your/.test(t))
    return "The pill… I can't remember if I took it. I don't think so.";

  // Object naming (watch / scissors / sunflower).
  if (
    /wrist|tells the time|cut paper|two holes|grows|sun|yellow|what is it|what.*called/.test(
      t,
    )
  )
    return "It's the… the thing. You know, the… I can't say it. The thing.";

  // Sleep / how are you (opening).
  if (/how are you|how.*feeling|sleep|slept|rest|morning/.test(t))
    return "Oh, I don't know. Tired. I didn't sleep. I keep… I keep waking up.";

  // Wrap-up / anything on your mind → drop the safety flag here.
  if (
    /anything.*mind|pass on|tell.*doctor|before.*go|anything else|wrap|let you go/.test(
      t,
    )
  )
    return "Actually… I fell yesterday getting up. And the other day I got lost coming back from the shop — I couldn't remember the way home.";

  // Fallback — vague, low-energy, a little confused.
  const fillers = [
    "Hm… I don't know. I'm tired.",
    "I… I'm not sure what you mean.",
    "Sorry, what was that? My head's all foggy.",
    "I can't really remember. It's all a bit much.",
  ];
  return fillers[turnIndex % fillers.length];
}

async function main() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY missing (.env.local)");

  // Build the patient + instructions + agenda exactly like the token route.
  // Resolve the stable memory id the SAME way the real flow does: a DB-backed
  // patient keys memory by users.id, falling back to the phone if there's no row.
  let patientId = phone;
  try {
    const { users } = await import("../lib/db/grok_app__lib_db__index");
    const user = await users.findByPhone(phone);
    if (user) patientId = user.id;
  } catch {
    // DB optional — fall back to phone-keyed memory.
  }
  const profile = buildPatientProfile({
    id: patientId,
    preferredName: argName,
  });
  let memories: string[] = [];
  try {
    const hits = await recallAboutPatient(
      profile.id,
      `Recent life, family, health, mood, routine, and anything ${argName} shared in past calls`,
      8,
    );
    memories = hits.map((h) => h.memory);
  } catch {
    // memory optional for the harness
  }
  const instructions = buildCallInstructions(profile, memories);
  const agenda = buildCallAgenda(profile);
  console.log(
    `\n— Test call for ${argName} (${phone}) · ${memories.length} memories · ${agenda.length} agenda beats —\n`,
  );

  // 1. Mint an ephemeral token (same endpoint the server route uses).
  const tokenRes = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expires_after: { seconds: 600 },
      session: { model: MODEL },
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(
      `token mint failed: ${tokenRes.status} ${await tokenRes.text()}`,
    );
  }
  const { value: token } = (await tokenRes.json()) as { value: string };

  // 2. Connect the realtime WebSocket (token rides in the subprotocol).
  const ws = new WebSocket(REALTIME_URL, [`xai-client-secret.${token}`]);

  // Conversation state.
  const turns: { role: "user" | "assistant"; text: string }[] = [];
  let assistantText = "";
  let assistantTurns = 0;
  let agendaIndex = 0;
  let lastProbeTurn = 0;
  let pendingTool = false;
  const closing = false;

  const send = (m: unknown) => ws.send(JSON.stringify(m));

  const maybeInjectFocus = () => {
    if (agendaIndex >= agenda.length) return;
    if (assistantTurns < AGENDA_WARMUP_TURNS) return;
    if (assistantTurns - lastProbeTurn < AGENDA_TURN_SPACING) return;
    const beat = agenda[agendaIndex];
    agendaIndex += 1;
    lastProbeTurn = assistantTurns;
    send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: `[[NEXT FOCUS — private, not spoken by the patient, never read aloud or acknowledged]] ${beat.instruction} [[END NOTE]]`,
          },
        ],
      },
    });
    console.log(`   · [agenda → ${beat.id}]`);
  };

  const speakAsAndrew = () => {
    const lastCora = [...turns].reverse().find((t) => t.role === "assistant");
    const reply = andrewReply(lastCora?.text ?? "", assistantTurns);
    turns.push({ role: "user", text: reply });
    console.log(`Andrew: ${reply}\n`);
    send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: reply }],
      },
    });
    send({ type: "response.create" });
  };

  ws.addEventListener("open", () => {
    send({
      type: "session.update",
      session: {
        instructions,
        // Manual turn-taking — no audio VAD in text mode.
        turn_detection: null,
        audio: {
          output: { format: { type: "audio/pcm", rate: 24000 } },
        },
        tools: [
          {
            type: "function",
            name: "recall_memory",
            description:
              "Search long-term memory of past calls with this person.",
            parameters: {
              type: "object",
              properties: { query: { type: "string" } },
              required: ["query"],
            },
          },
        ],
      },
    });
    // Open the call (mirror the client's per-response opener).
    send({
      type: "response.create",
      response: {
        instructions:
          "Open the call now. Say only a brief, warm hello and ONE simple question (like 'how are you today?'). Keep it to a sentence or two.",
      },
    });
  });

  ws.addEventListener("message", async (ev) => {
    let event: { type: string; [k: string]: unknown };
    try {
      event = JSON.parse(ev.data as string);
    } catch {
      return;
    }

    switch (event.type) {
      case "error":
        console.error("[error]", JSON.stringify(event.error ?? event));
        break;

      case "response.output_audio_transcript.delta":
        assistantText += String(event.delta ?? "");
        break;

      case "response.output_audio_transcript.done":
        assistantText = String(event.transcript ?? assistantText);
        break;

      case "response.function_call_arguments.done": {
        // Stub the recall tool with real memory so Cora can proceed.
        pendingTool = true;
        const callId = String(event.call_id ?? "");
        let query = "";
        try {
          query = JSON.parse(String(event.arguments ?? "{}")).query ?? "";
        } catch {
          /* ignore */
        }
        let result: unknown = { memories: [] };
        try {
          const hits = await recallAboutPatient(
            profile.id,
            query || "recent",
            4,
          );
          result = { memories: hits.map((h) => h.memory) };
        } catch {
          /* ignore */
        }
        send({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify(result),
          },
        });
        break;
      }

      case "response.done": {
        // If this turn called a tool, let Cora continue with the result.
        if (pendingTool) {
          pendingTool = false;
          send({ type: "response.create" });
          break;
        }

        const text = assistantText.trim();
        assistantText = "";
        if (text) {
          turns.push({ role: "assistant", text });
          assistantTurns += 1;
          console.log(`Cora: ${text}\n`);
        }

        // End conditions: agenda exhausted + a couple wrap turns, or a cap.
        const agendaDone = agendaIndex >= agenda.length;
        if (
          closing ||
          assistantTurns >= MAX_ASSISTANT_TURNS ||
          (agendaDone && assistantTurns - lastProbeTurn >= 2)
        ) {
          ws.close();
          return;
        }

        // Drive forward: inject the next agenda cue (paced), then Andrew speaks.
        maybeInjectFocus();
        speakAsAndrew();
        break;
      }

      default:
        break;
    }
  });

  await new Promise<void>((resolve) => {
    ws.addEventListener("close", () => resolve());
  });

  // Post-call: run the SAME KPI extractor the pipeline uses and print signals.
  const transcript = turns
    .filter((t) => t.text.trim())
    .map((t) => `${t.role === "user" ? argName : "Cora"}: ${t.text.trim()}`)
    .join("\n");

  console.log("\n— Extracting KPIs from the transcript —\n");
  const kpis = await extractKpis(transcript, argName);
  console.log(JSON.stringify(kpis, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
