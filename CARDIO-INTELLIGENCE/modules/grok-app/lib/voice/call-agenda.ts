import type { PatientProfile } from "./patient-profile";

/**
 * The ordered assessment agenda for a daily check-in call.
 *
 * Why this exists: the system prompt alone can't make Cora *progress*. Each
 * Grok response is generated fresh from the transcript with no memory of "which
 * clinical beats have I covered?", so a warmth-first prompt reliably drifts into
 * endless small talk and never plants the story or runs the recall tasks.
 *
 * This module turns the engineering brief's conversation flow into an explicit,
 * ordered list of beats. The call client walks the list during natural lulls and
 * feeds each beat to the live session as a *silent private cue* (never spoken),
 * so the conversation always moves forward and the clinically-critical ordering
 * holds — story planted in the first third, fluency in the middle, delayed
 * recall in the final third (WMS protocol).
 *
 * Each beat is phrased as a gentle instruction Cora acts on in her own warm
 * words. It is NEVER read aloud — see the `[[NEXT FOCUS ...]]` convention the
 * system prompt is taught to follow.
 */
export type AgendaBeat = {
  /** Stable id for the beat (used for logging / debugging). */
  id: string;
  /** Private instruction Cora acts on in her next turn. Never spoken verbatim. */
  instruction: string;
};

/**
 * Build the ordered agenda for a daily call. Beats that depend on details we
 * don't have (a known routine, interests, prior-call thread) are adapted or
 * dropped so we never reference things that aren't true for this patient.
 */
export function buildCallAgenda(p: PatientProfile): AgendaBeat[] {
  const { preferredName: name, routine, careCircle } = p;
  const story = p.plantedStory;
  const [w1, w2, w3] = p.recallWords;
  const interests = p.interests ?? [];
  const hasInterests = interests.length > 0;

  const beats: AgendaBeat[] = [];

  // 1. Sleep + mood — light, natural, sets affect/sleep KPIs.
  beats.push({
    id: "sleep_mood",
    instruction: `Gently move on from the opening: ask warmly how ${name} slept last night and whether they were comfortable. One short, caring question.`,
  });

  // 2. Cross-session episodic recall — only if we have something to recall.
  if (p.lastCallThread) {
    beats.push({
      id: "cross_session_recall",
      instruction: `Bring up something from last time as a warm follow-up: "${p.lastCallThread}". Ask how it went, in a way that lets you tell whether they remember it — but never make it feel like a test.`,
    });
  }

  // 3. STORY PLANT — must land in the first third of the call.
  beats.push({
    id: "plant_story",
    instruction: `Share a little story as ordinary friendly chatter — something you heard that you think they'd enjoy: ${story.intro}. Tell it once, warmly and naturally, like a friend passing on a nice anecdote, then let the conversation breathe. Do NOT say "remember this", do NOT say you'll ask about it later, do NOT call it a story to hold onto — just tell it as a normal moment of chat.`,
  });

  // 4. Orientation + medication — woven as friendly banter.
  beats.push({
    id: "orientation_meds",
    instruction: routine
      ? `Chat about their morning like a friend would: ask in ONE gentle question whether they've taken their ${routine.medication} yet. In a LATER turn, slip in — as your own shared confusion, never as a quiz — what day of the week it feels like ("I completely lose track myself — what day is it, even?"). Keep each to one casual question.`
      : `Chat about their morning like a friend would: ask in ONE gentle question whether they've taken any morning medicine yet. In a LATER turn, slip in — as your own shared confusion, never as a quiz — what day of the week it feels like ("I completely lose track myself — what day is it, even?").`,
  });

  // 5. VERBAL FLUENCY — the top predictor; goes in the middle, between plant and recall.
  beats.push({
    id: "fluency",
    instruction: `Bring up a light, playful moment the way friends tease each other: see how many animals ${name} can reel off — any animals at all. Frame it as fun ("quick — how many animals can you think of?"), let them run as long as they like, and just enjoy it. Do NOT say it's a game you "do together", a task, or anything you're checking.`,
  });

  // 6. OBJECT NAMING (BNT analog) — describe, let them name.
  beats.push({
    id: "naming",
    instruction: `As playful banter, describe an everyday thing and let ${name} guess what you mean — ONE at a time, waiting for each answer: (1) worn on the wrist, has numbers, tells the time [watch]; (2) used to cut paper, two holes for your fingers, two blades [scissors]; (3)${hasInterests && interests.some((i) => /garden/i.test(i)) ? " planted in the garden," : ""} grows toward the sun and turns yellow when it blooms [sunflower]. If they can't land one, DON'T correct them or announce the right answer like a teacher — just warmly move the chat along.`,
  });

  // 7. Conversational recall — episodic memory + coherence via their interests.
  if (hasInterests) {
    beats.push({
      id: "conversational_recall",
      instruction: `Linger warmly on something they love (${interests.join(", ")}) — ask about it in a way that draws on what they've told you before, so you can quietly tell whether they remember. Enjoy it with them; this is the warm heart of the call.`,
    });
  }

  // 8. IMMEDIATE WORD RECALL — seed three words to ask back now and later.
  beats.push({
    id: "immediate_words",
    instruction: `Make a tiny playful game of three words — "${w1}, ${w2}, ${w3}" — and ask ${name} to echo them back to you once, just for fun. Say them ONCE, warmly. Don't call it a memory exercise and don't say you'll test them later — keep it light, like a silly little rhyme between friends.`,
  });

  // 9. DELAYED STORY RECALL — must land in the final third.
  beats.push({
    id: "delayed_story",
    instruction: `Come back to that story from earlier out of genuine curiosity, OPEN-ENDED: "that little story I mentioned earlier — did any of it stick with you?" CRUCIAL: do NOT say the names or details yourself first (no ${story.details[0]}, no ${story.details[1]}) — let ${name} tell you what they remember unaided. If little comes back, give one soft nudge, then let it go warmly. Never sound disappointed.`,
  });

  // 10. DELAYED WORD RECALL.
  beats.push({
    id: "delayed_words",
    instruction: `Lightly wonder aloud whether those three little words stayed with them: "those three words from before — do any come back to you?" CRUCIAL: do NOT say the words yourself first — let ${name} try unaided. Warm and easy however many (or few) come back; never correct or sound let down.`,
  });

  // 11. Agency + warm close.
  beats.push({
    id: "agency_close",
    instruction: careCircle
      ? `Begin wrapping up warmly: make space for them — anything on their mind, or anything they'd like passed on to ${careCircle.caregiver}${careCircle.clinician ? ` or ${careCircle.clinician}` : ""}? Make clear it's entirely their choice what's shared. Then thank ${name} by name and close kindly.`
      : `Begin wrapping up warmly: make space for them — anything on their mind they'd like noted for the people who help look after them? Make clear it's their choice what's shared. Then thank ${name} by name and close kindly.`,
  });

  return beats;
}
