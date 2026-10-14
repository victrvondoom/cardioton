import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { encode, rawProbability, calibrate, treeShap, linearShap, predict, conformalSet, TARGETS } from "../../web/engine.js";

const root = new URL("../../", import.meta.url);
const bundle = JSON.parse(readFileSync(new URL("web/model/corolens_model.json", root)));
const fx = JSON.parse(readFileSync(new URL("tests/fixtures/parity.json", root)));
const patients = JSON.parse(readFileSync(new URL("web/model/heldout_patients.json", root)));

test("JS encoding of raw held-out records equals the Python model matrix", () => {
  patients.forEach((p, i) => {
    const x = encode(bundle, p.record);
    x.forEach((v, j) => assert.ok(Math.abs(v - fx.encoded[i][j]) < 1e-9, `${p.id} ${bundle.feature_names[j]}`));
  });
});

test("JS raw and calibrated probabilities match scikit-learn on all 61 held-out patients", () => {
  for (const t of TARGETS) {
    fx.encoded.forEach((x, i) => {
      const raw = rawProbability(bundle.targets[t], x);
      assert.ok(Math.abs(raw - fx.prob_raw[t][i]) < 1e-9, `${t} raw ${i}`);
      assert.ok(Math.abs(calibrate(bundle.targets[t], raw) - fx.prob_cal[t][i]) < 1e-6, `${t} cal ${i}`);
    });
  }
});

test("JS TreeSHAP matches the shap library (TreeExplainer) to 1e-9", () => {
  for (const [t, rows] of Object.entries(fx.shap)) {
    rows.forEach((ref, i) => {
      const { phi } = treeShap(bundle.targets[t], fx.encoded[i]);
      ref.forEach((v, j) => assert.ok(Math.abs(v - phi[j]) < 1e-9, `${t} row ${i} feature ${j}: ${v} vs ${phi[j]}`));
    });
  }
});

test("explanations are locally accurate (base + sum(phi) = model output)", () => {
  for (const t of TARGETS) {
    const m = bundle.targets[t];
    const x = fx.encoded[0];
    if (m.kind === "random_forest") {
      const { base, phi } = treeShap(m, x);
      assert.ok(Math.abs(base + phi.reduce((a, b) => a + b, 0) - rawProbability(m, x)) < 1e-9);
    } else {
      const { base, phi } = linearShap(m, x);
      const z = base + phi.reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(1 / (1 + Math.exp(-z)) - rawProbability(m, x)) < 1e-9);
    }
  }
});

test("conformal sets: confident predictions give one label, uncertain give both", () => {
  const m = { conformal_q: 0.7 };
  assert.deepEqual(conformalSet(m, 0.95), ["Stenotic"]);
  assert.deepEqual(conformalSet(m, 0.05), ["Normal"]);
  assert.deepEqual(conformalSet(m, 0.5), ["Normal", "Stenotic"]);
});

test("predict() returns all four targets and fills missing fields from defaults", () => {
  const out = predict(bundle, { Age: 61, "Typical Chest Pain": 1 });
  for (const t of TARGETS) {
    assert.ok(out[t].probability > 0 && out[t].probability < 1);
    assert.ok(out[t].explanation.top.length > 0);
  }
});
