import { test } from "node:test";
import assert from "node:assert/strict";
import { findNumbers, tagNote, buildRequest, parseAnswers, extract, NUMERIC_FIELDS, BINARY_FIELDS, CHOICE_FIELDS, GROUPED_FIELDS } from "../../web/intake_core.js";

const NOTE = "58-year-old man. BP 140/90, pulse 72. LDL 1,45 typo, WBC 7,700. Aspirin 75 mg. EF 50%.";

test("findNumbers keeps thousands separators and decimal points", () => {
  const n = findNumbers("WBC 7,700 and Cr 1.1 and PLT 261,000");
  assert.deepEqual(n.map((x) => x.value), [7700, 1.1, 261000]);
});

test("tagNote marks every number with an id without changing the text otherwise", () => {
  const nums = findNumbers("BP 140/90");
  assert.equal(tagNote("BP 140/90", nums), "BP [n1]140/[n2]90");
});

test("buildRequest asks one question per field, with a 'none' escape for numbers", () => {
  const { body, numbers } = buildRequest(NOTE);
  const q = body.questions;
  const expected = Object.keys(NUMERIC_FIELDS).length + Object.keys(BINARY_FIELDS).length + Object.keys(CHOICE_FIELDS).length + Object.keys(GROUPED_FIELDS).length;
  assert.equal(Object.keys(q).length, expected);
  assert.ok("none" in q["num:LDL"].criteria);
  assert.equal(Object.keys(q["num:LDL"].criteria).length, numbers.length + 1);
  assert.equal(body.model, "jev-latest");
});

test("parseAnswers copies the selected number verbatim and normalises units in code", () => {
  const numbers = findNumbers("pulse 72, WBC 7.7 x10^3, PLT 261,000, height 1.68 m, weight 70 kg");
  const id = (t) => numbers.find((n) => n.text === t).id;
  const resp = {
    model: "jev-test",
    answers: {
      "num:PR": { choice: id("72"), confidence: 0.99 },
      "num:WBC": { choice: id("7.7"), confidence: 0.9 },
      "num:PLT": { choice: id("261,000"), confidence: 0.9 },
      "num:Length": { choice: id("1.68"), confidence: 0.9 },
      "num:Weight": { choice: id("70"), confidence: 0.4 },
      "num:LDL": { choice: "none", confidence: 0.95 },
      "bin:HTN": { noul: 0.92 },
      "bin:LVH": { noul: 0.1 },
      "cho:Sex": { choice: "Fmale", confidence: 0.97 },
      "grp:chest_pain": { choice: "typical", confidence: 0.9 },
      "grp:smoking": { choice: "former", confidence: 0.9 },
    },
  };
  const { record, fields } = parseAnswers(resp, numbers);
  assert.equal(record.PR, 72);
  assert.equal(record.WBC, 7700);
  assert.equal(record.PLT, 261);
  assert.equal(record.Length, 168);
  assert.equal(record.LDL, undefined);
  assert.equal(fields.Weight.review, true);
  assert.equal(record.HTN, 1);
  assert.equal(record.LVH, "N");
  assert.equal(record.Sex, "Fmale");
  assert.equal(record["Typical Chest Pain"], 1);
  assert.equal(record.Atypical, "N");
  assert.equal(record["EX-Smoker"], 1);
  assert.equal(record["Current Smoker"], 0);
  assert.equal(record.BMI, 24.8); // computed in code from weight and height
});

test("extract retries on 429 and never sends the key anywhere but the TypeSafe endpoint", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, auth: opts.headers.Authorization });
    if (calls.length === 1) return { ok: false, status: 429, text: async () => "slow down" };
    return { ok: true, json: async () => ({ model: "jev-test", answers: {} }) };
  };
  const out = await extract("pulse 72", { apiKey: "k-test", fetchImpl });
  assert.equal(calls.length, 2);
  assert.ok(calls.every((c) => c.url === "https://api.typesafe.ai/v1/systemone" && c.auth === "Bearer k-test"));
  assert.equal(out.model, "jev-test");
});

test("extract refuses to run without a server-side key", async () => {
  await assert.rejects(() => extract("pulse 72", { apiKey: undefined }), /not configured/);
});
