/**
 * Deterministic linguistic features computed directly from the patient's speech.
 * These are exact and free — no LLM needed — and form the "paralinguistic"
 * signals from Tavabi et al. (stop-word fraction, lexical diversity, etc.).
 *
 * Only the PATIENT's turns are analysed; the companion's speech is ignored.
 */

export type LinguisticFeatures = {
  totalWords: number;
  uniqueWords: number;
  /** Type-token ratio: unique/total. Lower can indicate reduced vocabulary. */
  lexicalDiversity: number;
  /** Fraction of words that are stop/function/filler words (0..1). */
  stopWordFraction: number;
  /** Count of disfluency fillers (um, uh, er, like, you know, …). */
  fillerCount: number;
  /** Times the patient repeats a near-identical sentence within the call. */
  repetitionCount: number;
  /** Mean words per patient turn — terser turns can signal reduced output. */
  meanWordsPerTurn: number;
};

// Common English stop/function words + conversational fillers.
const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "of",
  "at",
  "by",
  "for",
  "with",
  "about",
  "to",
  "from",
  "in",
  "on",
  "off",
  "out",
  "over",
  "under",
  "again",
  "then",
  "once",
  "here",
  "there",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "can",
  "will",
  "just",
  "is",
  "am",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "i",
  "me",
  "my",
  "we",
  "us",
  "our",
  "you",
  "your",
  "he",
  "him",
  "his",
  "she",
  "her",
  "it",
  "its",
  "they",
  "them",
  "their",
  "this",
  "that",
  "these",
  "those",
  "what",
  "which",
  "who",
  "whom",
  "as",
  "up",
  "down",
  "into",
  "well",
  "yeah",
  "yes",
  "no",
  "oh",
  "okay",
  "ok",
  "now",
  "got",
  "get",
  // fillers
  "um",
  "uh",
  "er",
  "erm",
  "hmm",
  "like",
  "mhm",
]);

const FILLER_PATTERNS = [
  /\bum+\b/gi,
  /\buh+\b/gi,
  /\ber+m?\b/gi,
  /\bhmm+\b/gi,
  /\blike\b/gi,
  /\byou know\b/gi,
  /\bi mean\b/gi,
  /\bsort of\b/gi,
  /\bkind of\b/gi,
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeSentence(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function computeLinguisticFeatures(
  userTurns: string[],
): LinguisticFeatures {
  const joined = userTurns.join(" ");
  const tokens = tokenize(joined);
  const total = tokens.length;

  const unique = new Set(tokens).size;
  const stopCount = tokens.filter((t) => STOP_WORDS.has(t)).length;

  let fillerCount = 0;
  for (const re of FILLER_PATTERNS) {
    fillerCount += (joined.match(re) ?? []).length;
  }

  // Repetition: count patient turns whose normalized form closely repeats an
  // earlier turn (same opening words) — a simple perseveration proxy.
  const seen = new Set<string>();
  let repetitionCount = 0;
  for (const turn of userTurns) {
    const norm = normalizeSentence(turn);
    if (norm.split(" ").length < 3) continue;
    const key = norm.split(" ").slice(0, 6).join(" ");
    if (seen.has(key)) repetitionCount++;
    else seen.add(key);
  }

  const turnsWithWords = userTurns.filter((t) => tokenize(t).length > 0).length;

  return {
    totalWords: total,
    uniqueWords: unique,
    lexicalDiversity: total > 0 ? round(unique / total) : 0,
    stopWordFraction: total > 0 ? round(stopCount / total) : 0,
    fillerCount,
    repetitionCount,
    meanWordsPerTurn: turnsWithWords > 0 ? round(total / turnsWithWords) : 0,
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
