// CoroLens inference engine: runs fully in the browser (or Node) from the exported JSON bundle.
// Encoding, random-forest and logistic inference, Platt calibration, split-conformal sets,
// and exact path-dependent TreeSHAP (Lundberg et al., 2018, Algorithm 2) for forest models.

export const TARGETS = ["CAD", "LAD", "LCX", "RCA"];

const YES = new Set(["Y", "YES", "1", "TRUE", "1.0"]);

export function encode(bundle, record) {
  const rec = { ...bundle.defaults, ...record };
  const types = bundle.raw_types;
  return bundle.feature_names.map((f) => {
    if (f === "Sex_male") return String(rec.Sex).toLowerCase() === "male" ? 1 : 0;
    if (f.startsWith("BBB_")) return String(rec.BBB) === f.slice(4) ? 1 : 0;
    if (f === "VHD") {
      const levels = types.VHD.split("|");
      const i = levels.findIndex((l) => l.toLowerCase() === String(rec.VHD).toLowerCase());
      return i < 0 ? 0 : i;
    }
    if (types[f] === "number") {
      const v = Number(rec[f]);
      if (!Number.isFinite(v)) throw new Error(`feature ${f} must be a number`);
      return v;
    }
    return YES.has(String(rec[f]).toUpperCase()) ? 1 : 0;
  });
}

// sklearn casts inputs to float32 before walking the trees; mirror that for identical splits.
const goesLeft = (tree, node, x) => Math.fround(x[tree.feature[node]]) <= tree.threshold[node];

function treePredict(tree, x) {
  let n = 0;
  while (tree.left[n] !== -1) n = goesLeft(tree, n, x) ? tree.left[n] : tree.right[n];
  return tree.value[n];
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const logit = (p) => {
  const q = Math.min(Math.max(p, 1e-4), 1 - 1e-4);
  return Math.log(q / (1 - q));
};

export function rawProbability(model, x) {
  if (model.kind === "random_forest") {
    let s = 0;
    for (const t of model.trees) s += treePredict(t, x);
    return s / model.trees.length;
  }
  let z = model.intercept;
  for (let i = 0; i < x.length; i++) z += model.coef[i] * ((x[i] - model.mean[i]) / model.scale[i]);
  return sigmoid(z);
}

export const calibrate = (model, p) => sigmoid(model.platt.a * logit(p) + model.platt.b);

export function conformalSet(model, p) {
  const set = [];
  if (1 - (1 - p) <= model.conformal_q) set.push("Normal"); // score for class 0 is p
  if (1 - p <= model.conformal_q) set.push("Stenotic");
  return set;
}

// ---------------------------------------------------------------- TreeSHAP (path-dependent)
function extend(m, pz, po, pi) {
  const l = m.length;
  m.push({ d: pi, z: pz, o: po, w: l === 0 ? 1 : 0 });
  for (let i = l - 1; i >= 0; i--) {
    m[i + 1].w += (po * m[i].w * (i + 1)) / (l + 1);
    m[i].w = (pz * m[i].w * (l - i)) / (l + 1);
  }
}

function unwind(m, i) {
  const l = m.length - 1;
  let n = m[l].w;
  const { o, z } = m[i];
  for (let j = l - 1; j >= 0; j--) {
    if (o !== 0) {
      const t = m[j].w;
      m[j].w = (n * (l + 1)) / ((j + 1) * o);
      n = t - (m[j].w * z * (l - j)) / (l + 1);
    } else {
      m[j].w = (m[j].w * (l + 1)) / (z * (l - j));
    }
  }
  for (let j = i; j < l; j++) {
    m[j].d = m[j + 1].d;
    m[j].z = m[j + 1].z;
    m[j].o = m[j + 1].o;
  }
  m.pop();
}

function unwoundSum(m, i) {
  const l = m.length - 1;
  const { o, z } = m[i];
  let total = 0;
  let n = m[l].w;
  for (let j = l - 1; j >= 0; j--) {
    if (o !== 0) {
      const t = (n * (l + 1)) / ((j + 1) * o);
      total += t;
      n = m[j].w - (t * z * (l - j)) / (l + 1);
    } else {
      total += (m[j].w * (l + 1)) / (z * (l - j));
    }
  }
  return total;
}

function recurse(tree, x, phi, node, path, pz, po, pi) {
  const m = path.map((e) => ({ ...e }));
  extend(m, pz, po, pi);
  if (tree.left[node] === -1) {
    for (let i = 1; i < m.length; i++) {
      phi[m[i].d] += unwoundSum(m, i) * (m[i].o - m[i].z) * tree.value[node];
    }
    return;
  }
  const f = tree.feature[node];
  const left = tree.left[node];
  const right = tree.right[node];
  const [hot, cold] = goesLeft(tree, node, x) ? [left, right] : [right, left];
  let iz = 1;
  let io = 1;
  const k = m.findIndex((e, idx) => idx > 0 && e.d === f);
  if (k > 0) {
    iz = m[k].z;
    io = m[k].o;
    unwind(m, k);
  }
  const r = tree.cover[node];
  recurse(tree, x, phi, hot, m, (iz * tree.cover[hot]) / r, io, f);
  recurse(tree, x, phi, cold, m, (iz * tree.cover[cold]) / r, 0, f);
}

export function treeShap(model, x) {
  const phi = new Array(x.length).fill(0);
  let base = 0;
  for (const t of model.trees) {
    recurse(t, x, phi, 0, [], 1, 1, -1);
    base += t.value[0];
  }
  const n = model.trees.length;
  return { base: base / n, phi: phi.map((v) => v / n), space: "forest probability" };
}

export function linearShap(model, x) {
  const phi = x.map((v, i) => model.coef[i] * ((v - model.mean[i]) / model.scale[i]));
  return { base: model.intercept, phi, space: "log-odds" };
}

export function explain(model, x) {
  return model.kind === "random_forest" ? treeShap(model, x) : linearShap(model, x);
}

// ---------------------------------------------------------------- one-call API
export function predict(bundle, record, { top = 8 } = {}) {
  const x = encode(bundle, record);
  const out = {};
  for (const t of TARGETS) {
    const model = bundle.targets[t];
    const raw = rawProbability(model, x);
    const p = calibrate(model, raw);
    const ex = explain(model, x);
    const contributions = ex.phi
      .map((v, i) => ({ feature: bundle.feature_names[i], value: x[i], contribution: v }))
      .filter((c) => c.contribution !== 0)
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    out[t] = {
      probability: p,
      raw_probability: raw,
      model: model.kind,
      conformal_set: conformalSet(model, p),
      coverage_target: 1 - model.alpha,
      explanation: { base: ex.base, space: ex.space, top: contributions.slice(0, top), all: contributions },
    };
  }
  return out;
}
