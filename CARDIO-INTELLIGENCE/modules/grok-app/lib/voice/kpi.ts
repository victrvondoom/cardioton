/**
 * Post-call KPI extraction. Sends the transcript to the xAI chat API and asks
 * for the JUDGMENT-based cognitive signals as strict JSON — the things a human
 * would have to interpret (mood, did they recall the story, orientation,
 * medication status, safety). Deterministic features (stop-word fraction, etc.)
 * are computed separately in linguistics.ts, NOT here.
 *
 * Everything is nullable: a natural call won't always include every task. A
 * missing task must come back null, never a fabricated number.
 */

const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";
const EXTRACTION_MODEL = "grok-4.3";

export type Mood = "Cheerful" | "Neutral" | "Flat" | "Anxious" | "Agitated";
export type MedicationStatus = "Confirmed" | "Uncertain" | "Missed";
export type SleepQuality = "Good" | "Fair" | "Poor" | "Unknown";

/** Judgment KPIs extracted by the model. `null` = not assessed this call. */
export type ExtractedKpis = {
  mood: Mood | null;
  sleep_quality: SleepQuality | null;
  fluency_count: number | null; // unique animals, only if the game happened
  naming_accuracy: number | null; // 0..1 across naming prompts attempted
  word_finding_failures: number | null; // hedges / substitutions / trailing off
  immediate_recall: number | null; // 0..3 words repeated back
  delayed_recall_words: number | null; // 0..3 words recalled later
  story_recall_details: number | null; // count of story details recalled
  orientation_score: number | null; // 0..4 (day, date, month, year)
  medication_status: MedicationStatus | null;
  cross_session_recall: boolean | null; // remembered something from a past call?
  safety_flag: boolean;
  safety_flag_type: string | null; // fall | wandering | confusion | distress | ...
  engagement: "Completed" | "Partial";
  observations: string[]; // short qualitative notes for clinicians
  summary: string; // 1-2 sentence plain-language recap
};

const SYSTEM_PROMPT = `You are a careful clinical-signal extractor for a dementia check-in service. You read a transcript of a warm phone call between a companion (assistant) and an older person (the patient), and you return STRICT JSON capturing how the PATIENT did cognitively.

Rules:
- Judge ONLY the patient's speech and behaviour, never the companion's.
- If a task did not occur in this call, return null for it — NEVER invent a number. Most casual calls will only touch a few of these.
- Be conservative and factual. This supports clinician review; it is not a diagnosis.
- "fluency_count": only if the patient was asked to name animals/things in a category — count distinct valid items they produced; else null.
- "naming_accuracy": only if object-naming riddles were attempted — fraction correct (0..1); else null.
- "immediate_recall"/"delayed_recall_words": only if a 3-word list was given/asked back — count 0..3; else null.
- "story_recall_details": only if a short story was planted and later recalled — count distinct correct details; else null.
- "orientation_score": 0..4 for (knows day of week, approximate date, month, year) IF any came up; else null.
- "word_finding_failures": count clear hedges/substitutions/"the thing"/long trailing-off when reaching for a word; 0 if none observed.
- "cross_session_recall": true/false ONLY if the call referenced something from a previous call and you can tell whether the patient remembered it; else null.
- "safety_flag": true ONLY for a physical-safety or medical emergency the patient mentions: a fall or near-fall, wandering / getting lost, acute confusion about where they are, explicit distress, or a request for help. Medication uncertainty, low mood, or a missed word are NOT safety flags.
- All count fields (fluency_count, immediate_recall, delayed_recall_words, story_recall_details, orientation_score, word_finding_failures, naming_accuracy) must be a single NUMBER, never a list or a phrase.
- "mood": ALWAYS classify the patient's overall affect from how they speak and what they say — this is observable in essentially every call, so do NOT return null unless the patient said almost nothing. Map to one of: Cheerful (warm, positive, upbeat), Neutral (even, ordinary), Flat (low energy, apathetic, "I don't know", little affect, weary), Anxious (worried, fearful, unsettled), Agitated (frustrated, irritable). Tiredness, listlessness, repeated "I don't know", and low engagement are Flat. Only return null if there is genuinely no patient speech to judge.
- "sleep_quality": if the patient says ANYTHING about how they slept or how rested they feel, classify it — Good, Fair, or Poor. "Tired", "didn't sleep", "kept waking up", "rough night", "exhausted" → Poor. "Slept alright / okay" → Fair. "Slept well / great" → Good. Use Unknown only if sleep/rest came up but was truly ambiguous; use null only if sleep and rest were never mentioned at all.
- "observations": 0-5 short, specific notes a clinician would value (e.g. "Took a long pause and substituted 'the cutting thing' for scissors").
- "summary": one or two warm, factual sentences.

Return ONLY a JSON object with exactly these keys: mood, sleep_quality, fluency_count, naming_accuracy, word_finding_failures, immediate_recall, delayed_recall_words, story_recall_details, orientation_score, medication_status, cross_session_recall, safety_flag, safety_flag_type, engagement, observations, summary.`;

export async function extractKpis(
  transcript: string,
  patientName: string,
): Promise<ExtractedKpis | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    console.error("[kpi] XAI_API_KEY missing");
    return null;
  }

  const res = await fetch(XAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `The patient's name is ${patientName}.\n\nTranscript:\n${transcript}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error("[kpi] extraction failed:", res.status, await res.text());
    return null;
  }

  try {
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return normalize(JSON.parse(content));
  } catch (err) {
    console.error("[kpi] parse failed:", err);
    return null;
  }
}

/** Coerce/clamp the model output into our typed shape with safe defaults. */
function normalize(raw: Record<string, unknown>): ExtractedKpis {
  // Count coercion: accept number, numeric string, or array (use its length).
  const num = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (Array.isArray(v)) return v.length;
    if (typeof v === "string") {
      const n = Number.parseFloat(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  // Title-case a value and match it against an allowed enum set.
  const enumOf = <T extends string>(v: unknown, allowed: T[]): T | null => {
    const s = str(v);
    if (!s) return null;
    const tc = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    return (allowed as string[]).includes(tc) ? (tc as T) : null;
  };

  return {
    mood: enumOf<Mood>(raw.mood, [
      "Cheerful",
      "Neutral",
      "Flat",
      "Anxious",
      "Agitated",
    ]),
    sleep_quality: enumOf<SleepQuality>(raw.sleep_quality, [
      "Good",
      "Fair",
      "Poor",
      "Unknown",
    ]),
    fluency_count: num(raw.fluency_count),
    naming_accuracy: num(raw.naming_accuracy),
    word_finding_failures: num(raw.word_finding_failures),
    immediate_recall: num(raw.immediate_recall),
    delayed_recall_words: num(raw.delayed_recall_words),
    story_recall_details: num(raw.story_recall_details),
    orientation_score: num(raw.orientation_score),
    medication_status: enumOf<MedicationStatus>(raw.medication_status, [
      "Confirmed",
      "Uncertain",
      "Missed",
    ]),
    cross_session_recall:
      typeof raw.cross_session_recall === "boolean"
        ? raw.cross_session_recall
        : null,
    safety_flag: raw.safety_flag === true,
    safety_flag_type: str(raw.safety_flag_type),
    engagement: raw.engagement === "Partial" ? "Partial" : "Completed",
    observations: Array.isArray(raw.observations)
      ? raw.observations.filter((o): o is string => typeof o === "string")
      : [],
    summary: str(raw.summary) ?? "",
  };
}
