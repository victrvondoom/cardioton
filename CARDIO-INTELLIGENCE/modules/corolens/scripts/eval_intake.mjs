// Live evaluation of TypeSafe intake on results/intake_eval/notes.json (needs TYPESAFE_API_KEY).
//   node scripts/eval_intake.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { extract, NUMERIC_FIELDS, BINARY_FIELDS, CHOICE_FIELDS, GROUPED_FIELDS } from "../web/intake_core.js";
import { predict, TARGETS } from "../web/engine.js";

const root = new URL("../", import.meta.url);
const NOTES = process.argv[2] || "results/intake_eval/notes_test_seed11.json";
const OUT = process.argv[3] || "results/intake_eval/v2_test_seed11_summary.json";
const notes = JSON.parse(readFileSync(new URL(NOTES, root)));
const ALL_BINARY = [...Object.keys(BINARY_FIELDS), ...Object.values(GROUPED_FIELDS).flatMap((g) => Object.keys(g.fields))];
const bundle = JSON.parse(readFileSync(new URL("web/model/corolens_model.json", root)));
const apiKey = process.env.TYPESAFE_API_KEY;

const yes = (v) => ["Y", "1"].includes(String(v).toUpperCase());
const tally = () => ({ correct: 0, total: 0, errors: [] });
const stats = { numeric_mentioned: tally(), numeric_absent_no_pick: tally(), binary: tally(), choice: tally(), bmi_computed: tally() };
const deltas = Object.fromEntries(TARGETS.map((t) => [t, []]));
let tokens = 0;
let ms = 0;
const perNote = [];

async function run(n) {
  const t0 = Date.now();
  const out = await extract(n.note, { apiKey });
  ms += Date.now() - t0;
  tokens += out.usage?.input_tokens || 0;
  const rec = n.record;
  const m = n.mentioned_numeric_or_choice;
  for (const f of Object.keys(NUMERIC_FIELDS)) {
    if (f === "BMI") continue;
    if (f in m) {
      const ok = out.record[f] !== undefined && Math.abs(out.record[f] - m[f]) < 1e-6;
      stats.numeric_mentioned.total++; if (ok) stats.numeric_mentioned.correct++; else stats.numeric_mentioned.errors.push(`${n.id} ${f}: got ${out.record[f]} want ${m[f]}`);
    } else {
      const ok = out.record[f] === undefined;
      stats.numeric_absent_no_pick.total++; if (ok) stats.numeric_absent_no_pick.correct++; else stats.numeric_absent_no_pick.errors.push(`${n.id} ${f}: picked ${out.record[f]} but not in note`);
    }
  }
  if ("Weight" in m) {
    const ok = out.record.BMI !== undefined && Math.abs(out.record.BMI - rec.BMI) < 0.5;
    stats.bmi_computed.total++; if (ok) stats.bmi_computed.correct++; else stats.bmi_computed.errors.push(`${n.id} BMI ${out.record.BMI} vs ${rec.BMI}`);
  }
  for (const f of ALL_BINARY) {
    const ok = yes(out.record[f]) === yes(rec[f]);
    stats.binary.total++; if (ok) stats.binary.correct++; else stats.binary.errors.push(`${n.id} ${f}: got ${out.record[f]} want ${rec[f]} (p=${out.fields[f]?.p_yes?.toFixed(2)})`);
  }
  for (const f of Object.keys(CHOICE_FIELDS)) {
    const want = String(rec[f]).toLowerCase();
    const got = String(out.record[f] ?? bundle.defaults[f]).toLowerCase();
    const ok = got === want;
    stats.choice.total++; if (ok) stats.choice.correct++; else stats.choice.errors.push(`${n.id} ${f}: got ${got} want ${want}`);
  }
  // downstream: same information, hand-entered vs extracted
  const oracle = {};
  for (const f of Object.keys(m)) oracle[f] = rec[f];
  for (const f of [...ALL_BINARY, "VHD", "BBB", "Region RWMA"]) oracle[f] = rec[f];
  if ("Weight" in m) oracle.BMI = rec.BMI;
  const pe = predict(bundle, out.record);
  const po = predict(bundle, oracle);
  for (const t of TARGETS) deltas[t].push(Math.abs(pe[t].probability - po[t].probability));
  perNote.push({ id: n.id, review_flags: Object.entries(out.fields).filter(([, v]) => v.review).map(([k]) => k) });
}

const queue = [...notes];
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await run(queue.shift()); }));

const pct = (s) => (s.total ? s.correct / s.total : null);
const summary = {
  notes_file: NOTES,
  notes: notes.length,
  model: "jev-latest (responses report jev-1.13.0)",
  accuracy: Object.fromEntries(Object.entries(stats).map(([k, s]) => [k, { accuracy: pct(s), correct: s.correct, total: s.total }])),
  downstream_mean_abs_prob_diff_vs_hand_entry: Object.fromEntries(TARGETS.map((t) => [t, deltas[t].reduce((a, b) => a + b, 0) / deltas[t].length])),
  downstream_max_abs_prob_diff: Object.fromEntries(TARGETS.map((t) => [t, Math.max(...deltas[t])])),
  mean_input_tokens_per_note: tokens / notes.length,
  mean_latency_ms_per_note_with_4_parallel: ms / notes.length,
  notes_with_any_review_flag: perNote.filter((p) => p.review_flags.length).length,
  errors: Object.fromEntries(Object.entries(stats).map(([k, s]) => [k, s.errors])),
};
writeFileSync(new URL(OUT, root), JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ ...summary, errors: Object.fromEntries(Object.entries(summary.errors).map(([k, v]) => [k, v.slice(0, 12)])) }, null, 1));
