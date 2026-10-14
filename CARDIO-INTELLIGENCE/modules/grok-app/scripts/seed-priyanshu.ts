/**
 * Seed script: a demo patient's history.
 *
 * Populates a realistic demo history for one patient:
 *   1. Upserts the user (so phone → stable patient id resolves on the dashboard).
 *   2. Writes ~90 days of daily KPI rows that read as "mostly healthy, with a
 *      light, gradual trend toward cognitive decline" — gentle downward drift on
 *      the memory/language signals plus day-to-day noise, never a crash.
 *   3. Implants long-term memories (supermemory) painting an elderly, somewhat
 *      senile man — life details plus the kind of forgetful moments a daily
 *      check-in would accumulate over months.
 *
 * Run (defaults to Priyanshu):
 *   bun run scripts/seed-priyanshu.ts
 * Or for another patient, pass name + phone:
 *   bun run scripts/seed-priyanshu.ts "Andrew" "7789030066"
 * (bun auto-loads .env.local, so DATABASE_URL + SUPERMEMORY_* are available.)
 */

import { kpis, users } from "../lib/db/grok_app__lib_db__index";
import { rememberAboutPatient } from "../lib/memory/supermemory";

// Name + phone come from CLI args, defaulting to Priyanshu. The phone input on
// the /phone screen prepends "+1", so we normalize a 10-digit number the same
// way here and store the exact value the dashboard will look up.
const argName = process.argv[2]?.trim();
const argPhone = process.argv[3]?.trim();

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return `+${digits}`;
  // 10-digit US number → prefix +1 (matches the /phone input behaviour).
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

const NAME = argName || "Priyanshu";
const PHONE = normalizePhone(argPhone || "4255606921");
const DAYS = 90;

// ── Deterministic RNG so re-running produces the same history ────────────────
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);

/** Symmetric noise in [-m, m]. */
const noise = (m: number) => (rand() * 2 - 1) * m;
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const round = (v: number) => Math.round(v);

const ISO = (d: Date) => d.toISOString().slice(0, 10);

type Mood = "Cheerful" | "Neutral" | "Flat" | "Anxious" | "Agitated";
type Med = "Confirmed" | "Uncertain" | "Missed";
type Sleep = "Good" | "Fair" | "Poor" | "Unknown";

/**
 * Build one day's KPIs. `t` runs 0 (90 days ago) → 1 (today). Baselines are set
 * for a healthy older man; the small slopes create the gentle decline, and the
 * noise keeps individual days believable (some good days, some softer ones).
 */
function dayKpis(t: number) {
  // Memory / language — the signals that gently drift down.
  const fluency = round(clamp(14 - 5 * t + noise(1.6), 6, 17));
  const storyRecall = round(clamp(7 - 3 * t + noise(1), 2, 9));
  const naming = clamp(0.95 - 0.11 * t + noise(0.03), 0.78, 1);
  const wordFindFails = round(clamp(1 + 3 * t + noise(1), 0, 6));
  const immediateRecall = round(clamp(3 - 0.5 * t + noise(0.4), 2, 3));
  const delayedRecall = round(clamp(3 - 1.6 * t + noise(0.6), 0, 3));
  const orientation = round(clamp(4 - 0.8 * t + noise(0.4), 3, 4));
  const stopWord = clamp(0.35 + 0.12 * t + noise(0.02), 0.3, 0.5);
  const lexical = clamp(0.64 - 0.08 * t + noise(0.02), 0.5, 0.68);
  const repetition = round(clamp(0 + 2.2 * t + noise(0.8), 0, 4));

  // Adherence: mostly confirmed; a little wobble appears later on.
  let medication: Med = "Confirmed";
  const mr = rand();
  if (t > 0.55 && mr < 0.18) medication = "Uncertain";
  else if (t > 0.75 && mr > 0.96) medication = "Missed";

  // Mood: mostly cheerful/neutral, a few flatter days later.
  let mood: Mood = rand() > 0.5 ? "Cheerful" : "Neutral";
  const mq = rand();
  if (t > 0.5 && mq < 0.16) mood = "Flat";
  if (t > 0.7 && mq > 0.97) mood = "Anxious";

  // Sleep: good/fair, slipping a touch over time.
  let sleep: Sleep = rand() > 0.45 ? "Good" : "Fair";
  if (t > 0.6 && rand() < 0.18) sleep = "Poor";

  // Safety: essentially clear — one mild confusion flag in the late stretch.
  const safety = t > 0.85 && rand() > 0.93;

  // Engagement: almost always completed; an occasional partial call.
  const completed = rand() > 0.05;

  return {
    fluency,
    storyRecall,
    naming,
    wordFindFails,
    immediateRecall,
    delayedRecall,
    orientation,
    stopWord,
    lexical,
    repetition,
    medication,
    mood,
    sleep,
    safety,
    completed,
  };
}

function summaryFor(k: ReturnType<typeof dayKpis>): string {
  if (k.safety)
    return "Brief moment of confusion about the time of day; settled once reoriented. Otherwise warm and chatty.";
  if (k.medication === "Uncertain")
    return "Pleasant call. Wasn't sure whether he'd taken his morning pill. Recalled most of the little story.";
  if (k.mood === "Flat")
    return "A quieter, flatter day. Slower to find a few words but engaged warmly once chatting about cricket.";
  return "Warm, easy check-in. Good spirits, recalled the chat about his garden and the cat.";
}

function observationsFor(k: ReturnType<typeof dayKpis>): string[] {
  const obs: string[] = [];
  if (k.wordFindFails >= 3)
    obs.push("Reached for a few everyday words; filled in gently.");
  if (k.delayedRecall <= 1)
    obs.push("Recalled little of the planted story by the end of the call.");
  if (k.repetition >= 2)
    obs.push("Repeated an earlier question once or twice within the call.");
  if (k.orientation < 4) obs.push("Slightly unsure of the day of the week.");
  if (obs.length === 0)
    obs.push("Bright, coherent, stayed on topic throughout.");
  return obs;
}

async function seedKpis(patientId: string) {
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);

  let written = 0;
  for (let i = DAYS - 1; i >= 0; i--) {
    const t = (DAYS - 1 - i) / (DAYS - 1); // 0 → 1
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - i);
    const k = dayKpis(t);

    await kpis.save({
      patientId,
      patientName: NAME,
      callDate: ISO(date),
      mood: k.mood,
      sleepQuality: k.sleep,
      fluencyCount: k.completed ? k.fluency : null,
      namingAccuracy: k.completed ? Number(k.naming.toFixed(2)) : null,
      wordFindingFailures: k.completed ? k.wordFindFails : null,
      immediateRecall: k.completed ? k.immediateRecall : null,
      delayedRecallWords: k.completed ? k.delayedRecall : null,
      storyRecallDetails: k.completed ? k.storyRecall : null,
      orientationScore: k.completed ? k.orientation : null,
      stopWordFraction: Number(k.stopWord.toFixed(2)),
      lexicalDiversity: Number(k.lexical.toFixed(2)),
      repetitionCount: k.completed ? k.repetition : null,
      medicationStatus: k.medication,
      crossSessionRecall: k.delayedRecall >= 2,
      safetyFlag: k.safety,
      safetyFlagType: k.safety ? "confusion" : null,
      engagement: k.completed ? "Completed" : "Partial",
      summary: summaryFor(k),
      observations: observationsFor(k),
    });
    written++;
  }
  return written;
}

// ── Long-term memories: an elderly, somewhat senile man ──────────────────────
const MEMORIES: string[] = [
  `${NAME} is 78 and lives on his own in a small house with a garden. He was a high-school mathematics teacher for over thirty years and still likes explaining little number puzzles.`,
  "His late wife was named Meera; she passed a few years ago. He speaks about her warmly and sometimes, mid-conversation, talks as if she is still in the next room.",
  `He has a son, Arjun, who lives a couple of hours away and visits on weekends. ${NAME} occasionally calls Arjun by his younger brother's name, Vinod, and then corrects himself with a laugh.`,
  "He keeps a tabby cat named Simba who sleeps on the windowsill. The cat is one of his favourite things to talk about.",
  "He loves cricket and old Hindi film songs from the 1960s and 70s. He can sing long stretches of lyrics from decades ago even on days he struggles with recent events.",
  "He grows tomatoes and chillies in his back garden and is proud of them, though lately he sometimes forgets whether he has watered them and waters twice.",
  "Over the last couple of months he has more often lost track of what day of the week it is, and has asked during the call what day it is more than once.",
  "He frequently misplaces his reading glasses and his keys, and has mentioned searching the house for them. They are often on his own head or in his pocket.",
  "He sometimes forgets he has already eaten breakfast and will mention making tea and toast a second time in the same morning.",
  "He repeats favourite stories — especially one about meeting Meera at a wedding in Pune — often within the same conversation, not remembering he just told it.",
  "He is usually warm and cheerful on calls, but has flatter, quieter days where he is slower to find words and reaches for 'the thing, you know the thing' before landing on a word.",
  "He is generally good about taking his morning blood-pressure pill after breakfast, but on some days recently he wasn't sure whether he had taken it.",
  "He mentioned once that he stood in the kitchen and couldn't remember why he had walked in, which worried him a little.",
  "He enjoys talking to Cora and looks forward to the morning calls; he says the house is quiet and it's nice to hear a friendly voice.",
  "He still does the newspaper crossword most mornings but says it takes him longer than it used to, and he leaves more of it unfinished than before.",
];

async function seedMemories(patientId: string) {
  let stored = 0;
  for (const text of MEMORIES) {
    const res = await rememberAboutPatient(patientId, text, {
      kind: "seed_profile_note",
    });
    if (res.stored) stored++;
  }
  return stored;
}

async function main() {
  console.log(`Seeding ${NAME} (${PHONE})…`);
  const user = await users.upsert(PHONE, NAME);
  console.log(`  user id: ${user.id}`);

  const written = await seedKpis(user.id);
  console.log(`  KPI rows written: ${written} (last ${DAYS} days)`);

  const stored = await seedMemories(user.id);
  console.log(
    stored > 0
      ? `  memories stored: ${stored}/${MEMORIES.length}`
      : `  memories: skipped (supermemory disabled — set SUPERMEMORY_ENABLED=true)`,
  );

  console.log(
    `\nDone. On the /phone screen, sign in as name "${NAME}" and phone "4255606921" (the +1 is added automatically) so the dashboard resolves to this patient.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
