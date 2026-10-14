/**
 * Synthetic demo patient profile. SYNTHETIC DATA ONLY (hackathon rule + no PHI).
 *
 * The profile is what makes the call feel personal instead of clinical. Every
 * question in the call flow pulls from these fields so no two patients hear the
 * same call. Later this comes from a DB / supermemory; for now it's hardcoded.
 */

export type PatientProfile = {
  /** Stable id used to key this patient's long-term memory (supermemory). */
  id: string;
  /** Preferred name the agent uses out loud. */
  preferredName: string;
  /** The agent's own name — a familiar, recurring companion. */
  companionName: string;
  /** Warm, dementia-friendly delivery notes. */
  pacePreference: string;
  /**
   * The short story planted near the start and recalled near the end
   * (WMS Logical Memory analog). Keep it concrete and small.
   */
  plantedStory: {
    intro: string; // what the agent says to plant it
    details: string[]; // canonical details used later for scoring
  };
  /** Three words for immediate + delayed recall (MoCA analog). */
  recallWords: [string, string, string];

  // --- Personal details. Optional: for a real patient these are unknown at
  // first and get discovered during the intro call, then filled from memory.
  // The demo persona below populates them so the daily call has rich context.
  age?: number;
  /** Natural check-in anchors that also probe routine/orientation memory. */
  routine?: {
    wakeTime: string;
    breakfastHabit: string;
    medication: string; // e.g. "blue pill after breakfast"
  };
  /** Makes questions personal: "before I remind Sarah…" */
  careCircle?: {
    caregiver: string; // e.g. "daughter Sarah"
    clinician: string; // e.g. "Dr. Lee"
  };
  /** Conversation hooks so it never feels like a cold call. */
  interests?: string[];
  /** A real thing from "last call" to test episodic/conversational recall. */
  lastCallThread?: string;
};

/**
 * Clinical + companion scaffolding shared by every patient. The planted story
 * and recall words are fixed assessment items; the companion identity and pace
 * are product-level defaults. Personal details are NOT here — they're per-patient.
 */
const SHARED_PROFILE: Pick<
  PatientProfile,
  "companionName" | "pacePreference" | "plantedStory" | "recallWords"
> = {
  companionName: "Cora",
  pacePreference:
    "warm, calm, unhurried; short sentences; leave a generous pause after each question",
  plantedStory: {
    intro:
      "a short story to remember for me — Anna Thompson left her handbag on the bus in London, and inside it were fifteen dollars and her keys",
    details: [
      "Anna Thompson",
      "handbag",
      "bus",
      "London",
      "fifteen dollars",
      "her keys",
    ],
  },
  recallWords: ["apple", "river", "chair"],
};

/**
 * Build a profile for a real, DB-backed patient. We know their id and name;
 * everything personal starts empty and is learned through conversation + memory.
 */
export function buildPatientProfile(input: {
  id: string;
  preferredName: string;
  companionName?: string;
}): PatientProfile {
  return {
    ...SHARED_PROFILE,
    id: input.id,
    preferredName: input.preferredName,
    ...(input.companionName ? { companionName: input.companionName } : {}),
  };
}

/** Fully populated demo persona — used for local/demo testing only. */
export const DEMO_PATIENT: PatientProfile = {
  ...SHARED_PROFILE,
  id: "mary-demo",
  preferredName: "Mary",
  age: 76,
  routine: {
    wakeTime: "around 7 in the morning",
    breakfastHabit: "tea and toast",
    medication: "blue pill after breakfast",
  },
  careCircle: {
    caregiver: "daughter Sarah",
    clinician: "Dr. Lee",
  },
  interests: ["her garden club", "her grandson's soccer games", "old musicals"],
  lastCallThread: "her grandson's soccer game over the weekend",
};
