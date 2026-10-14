/**
 * Enrich Andrew's long-term memory (supermemory) so Cora feels like she truly
 * knows him during a live demo.
 *
 * These go BEYOND the generic seed memories: vivid, specific life details plus
 * recent "previous call" threads Cora can naturally follow up on ("last week you
 * mentioned…"), and gentle recurring cognitive observations so the longitudinal
 * story stays consistent with the seeded 90-day decline trend.
 *
 * Safe to run repeatedly — supermemory just adds documents.
 *
 * Run:  bun run scripts/enrich-andrew.ts
 *       bun run scripts/enrich-andrew.ts "Andrew" "7789030066"
 */

import {
  isMemoryEnabled,
  rememberAboutPatient,
} from "../lib/memory/supermemory";

const NAME = process.argv[2]?.trim() || "Andrew";
const RAW_PHONE = process.argv[3]?.trim() || "7789030066";
const PHONE = RAW_PHONE.startsWith("+")
  ? `+${RAW_PHONE.replace(/\D/g, "")}`
  : `+1${RAW_PHONE.replace(/\D/g, "")}`;

// Patient id matches resolvePatientProfile: a DB-backed patient keys memory by
// their users.id, but the seed/test paths key by phone. We store under BOTH so
// recall works no matter which path resolves the demo.
// (rememberAboutPatient is keyed by the id we pass; we just store twice.)

/** Rich, specific memories — the kind that make Cora sound like an old friend. */
const MEMORIES: string[] = [
  // — Identity & history —
  `${NAME} is 78 and lives alone in a small bungalow on Maple Street with a front garden he is very proud of.`,
  `${NAME} worked as a high-school mathematics teacher for 34 years and still lights up explaining a number trick or a bit of geometry.`,
  `${NAME}'s late wife was Meera. They were married 49 years. He talks about her with great tenderness and sometimes speaks as if she has just stepped into the next room.`,
  `${NAME} met Meera at a friend's wedding in Pune in 1971 — he tells the story of spilling tea on his shirt and her laughing kindly. It is his favourite memory and he retells it often, sometimes twice in one call.`,
  `${NAME} has a son, Arjun, who lives about two hours away and visits most weekends. ${NAME} sometimes calls Arjun by his late brother Vinod's name and then chuckles at himself.`,
  `${NAME} has a granddaughter, Priya, who is 9 and plays the violin. He keeps her drawings on the fridge and beams whenever she is mentioned.`,

  // — Daily life & interests —
  `${NAME} keeps a tabby cat named Simba who sleeps on the windowsill in the sun. The cat is one of his favourite things to talk about.`,
  `${NAME} grows tomatoes, chillies and roses in his back garden. Lately he sometimes forgets whether he has watered them and waters twice.`,
  `${NAME} loves cricket — he supports India and still remembers ball-by-ball details of matches from the 1980s, even on days when recent events are hazy.`,
  `${NAME} adores old Hindi film songs from the 1960s and 70s and can sing long stretches of Kishore Kumar lyrics from memory.`,
  `${NAME} does the newspaper crossword most mornings with his tea and toast, but says it takes him longer than it used to and he leaves more of it unfinished.`,
  `${NAME}'s morning routine: wakes around 7, makes tea and toast, takes a blue blood-pressure pill after breakfast, then sits in the garden if it's fine.`,

  // — Care circle —
  `${NAME}'s main support is his son Arjun; his GP is Dr. Lee, whom he has seen for years. He trusts both and is happy for them to be kept in the loop.`,
  `A neighbour, Mrs. Alvarez, looks in on ${NAME} a few times a week and brings him soup. He is fond of her and her little dog.`,

  // — Recent "previous call" threads Cora can follow up on —
  `Last week ${NAME} mentioned Arjun was going to bring Priya over on the weekend to play her violin for him. Cora should gently ask how that visit went.`,
  `A few days ago ${NAME} talked about his roses finally blooming after a slow start, and how proud Meera would have been of them. Worth following up warmly.`,
  `Recently ${NAME} said he'd been meaning to fix the squeaky garden gate but kept forgetting where he put the oil. He found it funny and a little frustrating.`,
  `On a recent call ${NAME} was looking forward to watching the cricket highlights with a cup of tea. Cora could ask who won.`,

  // — Gentle recurring cognitive observations (consistent with the decline trend) —
  `Over the last couple of months ${NAME} has more often lost track of what day of the week it is, sometimes asking twice in one call.`,
  `${NAME} frequently misplaces his reading glasses and keys and searches the house for them — they are often on his head or already in his pocket.`,
  `${NAME} sometimes forgets he has already had breakfast and mentions making tea and toast a second time in the same morning.`,
  `${NAME} has been having flatter, lower-energy mornings lately, reaching for "the thing, you know the thing" before landing on a word, and tiring quickly.`,
  `${NAME} has, once or twice recently, stood in a room and not remembered why he went in, which quietly worried him.`,
  `On a few recent mornings ${NAME} wasn't sure whether he had taken his blue pill after breakfast.`,

  // — Warmth anchors —
  `${NAME} genuinely looks forward to Cora's morning calls; he says the house is very quiet since Meera passed and it's lovely to hear a friendly voice.`,
  `${NAME} responds best to a calm, unhurried, warm tone, plenty of pauses, and being reminded gently that there's no rush and nothing he says has to go anywhere he doesn't want.`,
];

async function main() {
  if (!isMemoryEnabled()) {
    console.error(
      "Supermemory is disabled. Set SUPERMEMORY_ENABLED=true and SUPERMEMORY_API_KEY in .env.local.",
    );
    process.exit(1);
  }

  console.log(
    `Enriching memory for ${NAME} (${PHONE}) — ${MEMORIES.length} memories…`,
  );

  // Store under the phone-keyed id (seed/test path) AND, to be safe, we rely on
  // the DB resolving a real patient to users.id. The dashboard/call use users.id
  // when a DB row exists, so we also store under that if we can find it.
  const ids = new Set<string>([PHONE]);
  try {
    const { users } = await import("../lib/db/grok_app__lib_db__index");
    const user = await users.findByPhone(PHONE);
    if (user) ids.add(user.id);
  } catch {
    // DB optional here
  }

  let stored = 0;
  for (const id of ids) {
    for (const text of MEMORIES) {
      const res = await rememberAboutPatient(id, text, {
        kind: "demo_profile_memory",
      });
      if (res.stored) stored++;
    }
  }
  console.log(
    `Done. Stored ${stored} memory documents across ${ids.size} container(s): ${[...ids].join(", ")}.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
