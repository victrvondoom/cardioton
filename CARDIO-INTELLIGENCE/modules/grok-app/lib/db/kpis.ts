import { sql } from "./grok_app__lib_db__client";

/** A stored KPI row (subset of columns most useful to read back). */
export type KpiRow = {
  id: string;
  patient_id: string;
  patient_name: string | null;
  call_date: string;
  mood: string | null;
  sleep_quality: string | null;
  fluency_count: number | null;
  naming_accuracy: number | null;
  word_finding_failures: number | null;
  immediate_recall: number | null;
  delayed_recall_words: number | null;
  story_recall_details: number | null;
  orientation_score: number | null;
  stop_word_fraction: number | null;
  lexical_diversity: number | null;
  repetition_count: number | null;
  medication_status: string | null;
  cross_session_recall: boolean | null;
  safety_flag: boolean;
  safety_flag_type: string | null;
  engagement: string | null;
  summary: string | null;
  observations_json: unknown;
  created_at: string;
};

export type TranscriptListRow = {
  id: string;
  patient_name: string | null;
  call_date: string;
  mood: string | null;
  safety_flag: boolean;
  summary: string | null;
  created_at: string;
};

export type TranscriptDetailRow = TranscriptListRow & {
  transcript: string | null;
};

export type KpiInsert = {
  patientId: string;
  patientName?: string | null;
  callDate?: string; // YYYY-MM-DD; defaults to today
  mood?: string | null;
  sleepQuality?: string | null;
  fluencyCount?: number | null;
  namingAccuracy?: number | null;
  wordFindingFailures?: number | null;
  immediateRecall?: number | null;
  delayedRecallWords?: number | null;
  storyRecallDetails?: number | null;
  orientationScore?: number | null;
  stopWordFraction?: number | null;
  lexicalDiversity?: number | null;
  repetitionCount?: number | null;
  medicationStatus?: string | null;
  crossSessionRecall?: boolean | null;
  safetyFlag?: boolean;
  safetyFlagType?: string | null;
  engagement?: string | null;
  deterministic?: unknown;
  kpis?: unknown;
  observations?: unknown;
  summary?: string | null;
  transcript?: string | null;
};

export const kpis = {
  save: async (input: KpiInsert): Promise<{ id: string }> => {
    const rows = await sql`
      INSERT INTO kpi_results (
        patient_id, patient_name, call_date,
        mood, sleep_quality, fluency_count, naming_accuracy,
        word_finding_failures, immediate_recall, delayed_recall_words,
        story_recall_details, orientation_score, stop_word_fraction,
        lexical_diversity, repetition_count, medication_status,
        cross_session_recall, safety_flag, safety_flag_type, engagement,
        deterministic_json, kpis_json, observations_json, summary, transcript
      ) VALUES (
        ${input.patientId}, ${input.patientName ?? null},
        ${input.callDate ?? null}::date,
        ${input.mood ?? null}, ${input.sleepQuality ?? null},
        ${input.fluencyCount ?? null}, ${input.namingAccuracy ?? null},
        ${input.wordFindingFailures ?? null}, ${input.immediateRecall ?? null},
        ${input.delayedRecallWords ?? null}, ${input.storyRecallDetails ?? null},
        ${input.orientationScore ?? null}, ${input.stopWordFraction ?? null},
        ${input.lexicalDiversity ?? null}, ${input.repetitionCount ?? null},
        ${input.medicationStatus ?? null}, ${input.crossSessionRecall ?? null},
        ${input.safetyFlag ?? false}, ${input.safetyFlagType ?? null},
        ${input.engagement ?? null},
        ${JSON.stringify(input.deterministic ?? null)}::jsonb,
        ${JSON.stringify(input.kpis ?? null)}::jsonb,
        ${JSON.stringify(input.observations ?? null)}::jsonb,
        ${input.summary ?? null}, ${input.transcript ?? null}
      )
      RETURNING id
    `;
    return { id: (rows[0] as { id: string }).id };
  },

  /** Chronological history for a patient — what the dashboards chart. */
  listByPatient: async (patientId: string, limit = 60): Promise<KpiRow[]> => {
    const rows = await sql`
      WITH latest AS (
        SELECT
          id, patient_id, patient_name, call_date,
          mood, sleep_quality, fluency_count, naming_accuracy,
          word_finding_failures, immediate_recall, delayed_recall_words,
          story_recall_details, orientation_score, stop_word_fraction,
          lexical_diversity, repetition_count, medication_status,
          cross_session_recall, safety_flag, safety_flag_type, engagement,
          summary, observations_json, created_at
        FROM kpi_results
        WHERE patient_id = ${patientId}
        ORDER BY call_date DESC, created_at DESC
        LIMIT ${limit}
      )
      SELECT
        id, patient_id, patient_name, call_date::text AS call_date,
        mood, sleep_quality, fluency_count, naming_accuracy,
        word_finding_failures, immediate_recall, delayed_recall_words,
        story_recall_details, orientation_score, stop_word_fraction,
        lexical_diversity, repetition_count, medication_status,
        cross_session_recall, safety_flag, safety_flag_type, engagement,
        summary, observations_json, created_at
      FROM latest
      ORDER BY call_date ASC, created_at ASC
    `;
    return rows as KpiRow[];
  },

  /** Lightweight list for the transcripts page — no full transcript text. */
  listTranscriptsByPatient: async (
    patientId: string,
    limit = 60,
  ): Promise<TranscriptListRow[]> => {
    const rows = await sql`
      SELECT id, patient_name, call_date::text AS call_date,
             mood, safety_flag, summary, created_at
      FROM kpi_results
      WHERE patient_id = ${patientId}
      ORDER BY call_date DESC, created_at DESC
      LIMIT ${limit}
    `;
    return rows as TranscriptListRow[];
  },

  /** Single row with full transcript for preview. */
  findTranscriptById: async (
    id: string,
  ): Promise<TranscriptDetailRow | null> => {
    const rows = await sql`
      SELECT id, patient_name, call_date::text AS call_date,
             mood, safety_flag, summary, transcript, created_at
      FROM kpi_results
      WHERE id = ${id}
    `;
    return (rows[0] as TranscriptDetailRow) ?? null;
  },

  /** Most recent KPI row for a patient (used by the test debug panel). */
  latestByPatient: async (patientId: string): Promise<KpiRow | null> => {
    const rows = await sql`
      SELECT
        id, patient_id, patient_name, call_date::text AS call_date,
        mood, sleep_quality, fluency_count, naming_accuracy,
        word_finding_failures, immediate_recall, delayed_recall_words,
        story_recall_details, orientation_score, stop_word_fraction,
        lexical_diversity, repetition_count, medication_status,
        cross_session_recall, safety_flag, safety_flag_type, engagement,
        summary, observations_json, created_at
      FROM kpi_results
      WHERE patient_id = ${patientId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return (rows[0] as KpiRow) ?? null;
  },
};
