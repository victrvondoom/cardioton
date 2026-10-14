// Free-text referral note -> structured CoroLens record, using TypeSafe "select instead of generate".
// Code finds every number in the note and tags it; TypeSafe only *chooses* which tagged number is
// which lab or vital (or none), answers yes/no findings as calibrated Nouls, and picks closed-set
// categories. Values are copied from the note by code, so the model cannot invent or mistype a number.

export const NUMERIC_FIELDS = {
  Age: "the patient's age in years",
  Weight: "body weight in kilograms",
  Length: "body height in centimetres",
  BMI: "body mass index (kg/m2)",
  BP: "systolic blood pressure in mmHg (the first number of a blood pressure reading like 130/80)",
  PR: "pulse rate or heart rate in beats per minute",
  FBS: "fasting blood sugar or fasting glucose in mg/dL",
  CR: "serum creatinine in mg/dL",
  TG: "triglycerides in mg/dL",
  LDL: "LDL cholesterol in mg/dL",
  HDL: "HDL cholesterol in mg/dL",
  BUN: "blood urea nitrogen (BUN) in mg/dL",
  ESR: "erythrocyte sedimentation rate (ESR) in mm/h",
  HB: "haemoglobin in g/dL",
  K: "serum potassium in mEq/L",
  Na: "serum sodium in mEq/L",
  WBC: "white blood cell count",
  Lymph: "lymphocytes as a percentage of white cells",
  Neut: "neutrophils as a percentage of white cells",
  PLT: "platelet count",
  "EF-TTE": "left ventricular ejection fraction (%) on transthoracic echo",
};

export const BINARY_FIELDS = {
  DM: "diabetes mellitus",
  HTN: "hypertension (high blood pressure as a diagnosis)",
  FH: "a family history of coronary artery disease",
  Obesity: "obesity",
  CRF: "chronic renal failure or chronic kidney disease",
  CVA: "a previous stroke (cerebrovascular accident)",
  "Airway disease": "an airway disease such as asthma or COPD",
  "Thyroid Disease": "a thyroid disease",
  CHF: "congestive heart failure",
  DLP: "dyslipidaemia (abnormal blood lipids as a diagnosis)",
  Edema: "oedema (swelling) on examination",
  "Weak Peripheral Pulse": "weak peripheral pulses on examination",
  "Lung rales": "lung rales or crackles on examination",
  "Systolic Murmur": "a systolic murmur on examination",
  "Diastolic Murmur": "a diastolic murmur on examination",
  Dyspnea: "dyspnoea (shortness of breath)",
  "LowTH Ang": "low-threshold angina (angina at minimal exertion)",
  "Q Wave": "pathological Q waves on the ECG",
  "St Elevation": "ST-segment elevation on the ECG",
  "St Depression": "ST-segment depression on the ECG",
  Tinversion: "T-wave inversion on the ECG",
  LVH: "left ventricular hypertrophy",
  "Poor R Progression": "poor R-wave progression on the ECG",
};
const YN_FIELDS = new Set(["Obesity", "CRF", "CVA", "Airway disease", "Thyroid Disease", "CHF", "DLP",
  "Weak Peripheral Pulse", "Lung rales", "Systolic Murmur", "Diastolic Murmur", "Dyspnea", "Atypical",
  "Nonanginal", "LowTH Ang", "LVH", "Poor R Progression"]);

// Mutually exclusive findings (never co-occur in the 303 records) are asked as ONE Choice each, so the
// model compares the options instead of answering overlapping yes/no questions (v2 design change).
export const GROUPED_FIELDS = {
  chest_pain: {
    instructions: "Which type of chest pain does the note describe?",
    criteria: {
      typical: "Typical or classic angina: exertional chest pain or pressure relieved by rest",
      atypical: "Chest pain explicitly described as atypical",
      nonanginal: "Chest pain explicitly described as non-anginal",
      none: "No chest pain is described, or chest pain is denied",
    },
    map: { typical: { "Typical Chest Pain": 1 }, atypical: { Atypical: "Y" }, nonanginal: { Nonanginal: "Y" }, none: {} },
    fields: { "Typical Chest Pain": 0, Atypical: "N", Nonanginal: "N" },
  },
  smoking: {
    instructions: "What is the patient's smoking status according to the note?",
    criteria: {
      current: "Currently smokes",
      former: "Used to smoke but has quit (ex-smoker, former smoker)",
      never_or_not_stated: "Never smoked, non-smoker, or smoking is not mentioned",
    },
    map: { current: { "Current Smoker": 1 }, former: { "EX-Smoker": 1 }, never_or_not_stated: {} },
    fields: { "Current Smoker": 0, "EX-Smoker": 0 },
  },
};

export const CHOICE_FIELDS = {
  Sex: {
    instructions: "What is the patient's sex according to the note?",
    criteria: { Male: "The patient is male (man, he, Mr)", Fmale: "The patient is female (woman, she, Mrs, Ms)", not_stated: "The note does not indicate the sex" },
  },
  VHD: {
    instructions: "What degree of valvular heart disease does the note report?",
    criteria: { N: "No valvular heart disease, or none mentioned", mild: "Mild valvular disease", Moderate: "Moderate valvular disease", Severe: "Severe valvular disease" },
  },
  BBB: {
    instructions: "Which bundle branch block does the ECG show according to the note?",
    criteria: { N: "No bundle branch block, or none mentioned", LBBB: "Left bundle branch block", RBBB: "Right bundle branch block" },
  },
  "Function Class": {
    instructions: "What functional class (NYHA or CCS class for symptoms) does the note report?",
    criteria: { "0": "No functional class is reported", "1": "Class I", "2": "Class II", "3": "Class III", "4": "Class IV" },
  },
  "Region RWMA": {
    instructions: "In how many myocardial regions does the echo report a regional wall motion abnormality (RWMA)?",
    criteria: { "0": "No regional wall motion abnormality, or none mentioned", "1": "One region", "2": "Two regions", "3": "Three regions", "4": "Four or more regions" },
  },
};

const NUM_RE = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

export function findNumbers(note) {
  const out = [];
  for (const m of note.matchAll(NUM_RE)) {
    out.push({ id: `n${out.length + 1}`, text: m[0], value: Number(m[0].replace(/,/g, "")), index: m.index });
  }
  return out;
}

export function tagNote(note, numbers) {
  let s = "";
  let last = 0;
  for (const n of numbers) {
    s += note.slice(last, n.index) + `[${n.id}]` + n.text;
    last = n.index + n.text.length;
  }
  return s + note.slice(last);
}

export function buildRequest(note, model = "jev-latest") {
  const numbers = findNumbers(note);
  const tagged = tagNote(note, numbers);
  const questions = {};
  for (const [field, desc] of Object.entries(NUMERIC_FIELDS)) {
    const criteria = {};
    for (const n of numbers) criteria[n.id] = `the number ${n.text} tagged [${n.id}] in the note`;
    criteria.none = `The note does not state ${desc}`;
    questions[`num:${field}`] = {
      type: "choice",
      instructions: `Every number in the note is tagged like [n3]. Which tagged number is ${desc}?`,
      criteria,
    };
  }
  for (const [field, desc] of Object.entries(BINARY_FIELDS)) {
    questions[`bin:${field}`] = {
      type: "noul",
      instructions: `Does the note state that the patient currently has or has a history of ${desc}?`,
      criteria: { true: `The note states ${desc} is present`, false: `The note says it is absent or denied, or does not mention it` },
    };
  }
  for (const [field, spec] of Object.entries(CHOICE_FIELDS)) {
    questions[`cho:${field}`] = { type: "choice", ...spec };
  }
  for (const [group, spec] of Object.entries(GROUPED_FIELDS)) {
    questions[`grp:${group}`] = { type: "choice", instructions: spec.instructions, criteria: spec.criteria };
  }
  return { body: { state: tagged, model, questions }, numbers };
}

// Unit normalisation stays in code (Jev docs: keep arithmetic out of the model).
function normalise(field, v) {
  if (field === "Length" && v < 3) return Math.round(v * 100);
  if (field === "PLT" && v >= 1000) return Math.round(v / 1000);
  if (field === "WBC" && v < 100) return Math.round(v * 1000);
  if (field === "HB" && v > 30) return v / 10; // g/L -> g/dL
  return v;
}

export function parseAnswers(resp, numbers, { reviewBelow = 0.6 } = {}) {
  const byId = Object.fromEntries(numbers.map((n) => [n.id, n]));
  const record = {};
  const fields = {};
  const a = resp.answers || {};
  for (const field of Object.keys(NUMERIC_FIELDS)) {
    const ans = a[`num:${field}`];
    if (!ans || ans.choice === "none" || !byId[ans.choice]) {
      fields[field] = { source: "default", confidence: ans?.confidence ?? null };
      continue;
    }
    const n = byId[ans.choice];
    const value = normalise(field, n.value);
    record[field] = value;
    fields[field] = { source: "note", value, evidence: n.text, confidence: ans.confidence, review: ans.confidence < reviewBelow };
  }
  for (const field of Object.keys(BINARY_FIELDS)) {
    const ans = a[`bin:${field}`];
    if (!ans) continue;
    const yes = ans.noul >= 0.5;
    record[field] = YN_FIELDS.has(field) ? (yes ? "Y" : "N") : yes ? 1 : 0;
    fields[field] = { source: "note", value: record[field], p_yes: ans.noul, review: ans.noul > 0.3 && ans.noul < 0.7 };
  }
  for (const field of Object.keys(CHOICE_FIELDS)) {
    const ans = a[`cho:${field}`];
    if (!ans || ans.choice === "not_stated") {
      fields[field] = { source: "default", confidence: ans?.confidence ?? null };
      continue;
    }
    record[field] = ["Function Class", "Region RWMA"].includes(field) ? Number(ans.choice) : ans.choice;
    fields[field] = { source: "note", value: record[field], confidence: ans.confidence, review: ans.confidence < reviewBelow };
  }
  for (const [group, spec] of Object.entries(GROUPED_FIELDS)) {
    const ans = a[`grp:${group}`];
    if (!ans) continue;
    const set = { ...spec.fields, ...(spec.map[ans.choice] || {}) };
    for (const [f, v] of Object.entries(set)) {
      record[f] = v;
      fields[f] = { source: "note", value: v, via: `${group}=${ans.choice}`, confidence: ans.confidence, review: ans.confidence < reviewBelow };
    }
  }
  // Derived in code when both inputs came from the note.
  if (record.BMI === undefined && record.Weight && record.Length) {
    record.BMI = Math.round((record.Weight / (record.Length / 100) ** 2) * 10) / 10;
    fields.BMI = { source: "computed", value: record.BMI };
  }
  return { record, fields, model: resp.model, usage: resp.usage };
}

export async function extract(note, { apiKey, fetchImpl = fetch, model = "jev-latest" } = {}) {
  if (!apiKey) throw new Error("TYPESAFE_API_KEY is not configured on the server");
  if (!note || note.length > 12000) throw new Error("note must be 1-12000 characters");
  const { body, numbers } = buildRequest(note, model);
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetchImpl("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) return parseAnswers(await r.json(), numbers);
    last = `${r.status} ${await r.text()}`;
    if (![429, 529, 500, 502, 503].includes(r.status)) break;
    await new Promise((res) => setTimeout(res, 500 * 2 ** attempt));
  }
  throw new Error(`TypeSafe request failed: ${last}`);
}
