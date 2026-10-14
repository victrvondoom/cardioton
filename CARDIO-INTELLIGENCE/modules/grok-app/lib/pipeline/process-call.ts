import { kpis } from "@/lib/db/grok_app__lib_db__index";
import { extractKpis } from "@/lib/voice/kpi";
import { computeLinguisticFeatures } from "@/lib/voice/linguistics";

export type CallTurn = { role: "user" | "assistant"; text: string };

export type ProcessCallInput = {
  patientId: string;
  patientName: string;
  companionName: string;
  turns: CallTurn[];
  callDate?: string; // YYYY-MM-DD
};

/**
 * The post-call processing pipeline. Pure server function with no HTTP/runtime
 * assumptions, so it can be invoked from a route via `after()` today and from
 * an Inngest function tomorrow with zero changes.
 *
 *   transcript → deterministic features (code) + judgment KPIs (xAI) → DB row
 *
 * Returns the new row id, or null if there was nothing worth storing.
 */
export async function processCall(
  input: ProcessCallInput,
): Promise<{ id: string } | null> {
  const userTurns = input.turns
    .filter((t) => t.role === "user" && t.text.trim())
    .map((t) => t.text.trim());

  // Nothing the patient said → nothing to measure.
  if (userTurns.length === 0) return null;

  // 1. Deterministic linguistic features (exact, no LLM).
  const features = computeLinguisticFeatures(userTurns);

  // 2. Judgment KPIs from the transcript (xAI).
  const transcript = input.turns
    .filter((t) => t.text.trim())
    .map(
      (t) =>
        `${t.role === "user" ? input.patientName : input.companionName}: ${t.text.trim()}`,
    )
    .join("\n");

  const extracted = await extractKpis(transcript, input.patientName);

  // 3. Persist one KPI row (promoted columns + full JSON blobs).
  const { id } = await kpis.save({
    patientId: input.patientId,
    patientName: input.patientName,
    callDate: input.callDate,

    mood: extracted?.mood ?? null,
    sleepQuality: extracted?.sleep_quality ?? null,
    fluencyCount: extracted?.fluency_count ?? null,
    namingAccuracy: extracted?.naming_accuracy ?? null,
    wordFindingFailures: extracted?.word_finding_failures ?? null,
    immediateRecall: extracted?.immediate_recall ?? null,
    delayedRecallWords: extracted?.delayed_recall_words ?? null,
    storyRecallDetails: extracted?.story_recall_details ?? null,
    orientationScore: extracted?.orientation_score ?? null,
    medicationStatus: extracted?.medication_status ?? null,
    crossSessionRecall: extracted?.cross_session_recall ?? null,
    safetyFlag: extracted?.safety_flag ?? false,
    safetyFlagType: extracted?.safety_flag_type ?? null,
    engagement: extracted?.engagement ?? "Completed",

    // Deterministic features as promoted columns too.
    stopWordFraction: features.stopWordFraction,
    lexicalDiversity: features.lexicalDiversity,
    repetitionCount: features.repetitionCount,

    deterministic: features,
    kpis: extracted,
    observations: extracted?.observations ?? [],
    summary: extracted?.summary ?? null,
    transcript,
  });

  return { id };
}
