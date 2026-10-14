import { predict, TARGETS } from "./engine.js";
import { HeartView } from "./heart.js";
import { LABELS, TARGET_NAMES } from "./labels.js";

const $ = (s) => document.querySelector(s);
const pct = (p) => (p > 0.995 ? ">99%" : p < 0.005 ? "<1%" : `${(p * 100).toFixed(0)}%`);
const state = { bundle: null, patients: [], record: {}, selected: "LAD", fieldMeta: {}, truth: null };

function riskCss(p) {
  const c = HeartView.riskColor(p);
  return `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
}

function buildForm() {
  const { bundle } = state;
  const form = $("#form");
  form.innerHTML = "";
  for (const [group, fields] of Object.entries(bundle.feature_groups)) {
    const det = document.createElement("details");
    det.className = "group";
    det.open = ["Symptoms", "Echocardiography", "ECG"].includes(group);
    det.innerHTML = `<summary>${group}</summary>`;
    for (const f of fields) {
      const type = bundle.raw_types[f];
      const row = document.createElement("div");
      row.className = "field";
      row.dataset.field = f;
      const id = `f-${f.replace(/\W/g, "_")}`;
      let input;
      if (type === "number") {
        input = `<input id="${id}" type="number" step="any">`;
      } else {
        const opts = type.split("|").map((o) => `<option value="${o}">${o === "Fmale" ? "Female" : o === "1" ? "Yes" : o === "0" ? "No" : o === "Y" ? "Yes" : o === "N" ? (f === "VHD" || f === "BBB" ? "None" : "No") : o}</option>`);
        input = `<select id="${id}">${opts.join("")}</select>`;
      }
      row.innerHTML = `<label for="${id}">${LABELS[f] || f}</label>${input}`;
      det.appendChild(row);
      row.querySelector("input,select").addEventListener("input", (e) => {
        state.record[f] = type === "number" ? Number(e.target.value) : e.target.value;
        row.classList.remove("review");
        refresh();
      });
    }
    form.appendChild(det);
  }
}

function fillForm() {
  for (const row of document.querySelectorAll(".field")) {
    const f = row.dataset.field;
    const el = row.querySelector("input,select");
    const v = state.record[f] ?? state.bundle.defaults[f];
    el.value = String(v);
    const meta = state.fieldMeta[f];
    row.classList.toggle("from-note", !!meta && meta.source !== "default" && !meta.review);
    row.classList.toggle("review", !!meta && !!meta.review);
  }
}

function renderSummary(res) {
  const cad = res.CAD;
  const set = cad.conformal_set;
  const vessels = ["LAD", "LCX", "RCA"].map((v) => {
    const r = res[v];
    const unsure = r.conformal_set.length === 2;
    return `<div class="vcard ${v === state.selected ? "sel" : ""}" data-target="${v}">
      <span>${TARGET_NAMES[v]}</span><span class="p" style="color:${riskCss(r.probability)}">${pct(r.probability)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${r.probability * 100}%;background:${riskCss(r.probability)}"></div></div>
      <span class="small muted">90% set: ${r.conformal_set.join(" or ") || "empty"} · ${r.model === "random_forest" ? "random forest" : "L1 logistic"}</span>
      <span class="pill ${unsure ? "unsure" : ""}">${unsure ? "uncertain" : "confident"}</span>
    </div>`;
  });
  $("#summary").innerHTML = `
    <div class="cad vcard ${state.selected === "CAD" ? "sel" : ""}" data-target="CAD">
      <span class="small muted">Overall coronary artery disease (at least one vessel with 50% or more stenosis)</span><span></span>
      <span class="big" style="color:${riskCss(cad.probability)}">${pct(cad.probability)}</span>
      <span class="pill ${set.length === 2 ? "unsure" : ""}">90% set: ${set.join(" or ")}</span>
    </div>
    <h3>Vessels</h3>${vessels.join("")}`;
  document.querySelectorAll("[data-target]").forEach((el) => el.addEventListener("click", () => select(el.dataset.target)));
}

function renderExplain(res) {
  const r = res[state.selected];
  $("#explain-title").textContent = `Why this estimate: ${TARGET_NAMES[state.selected]}`;
  const unit = r.explanation.space === "log-odds" ? "log-odds (exact linear SHAP)" : "forest probability (exact TreeSHAP)";
  $("#explain-note").textContent = `Top contributions in ${unit}. Red pushes toward stenosis, teal toward normal. Values shown are this patient's inputs.`;
  const top = r.explanation.top;
  const max = Math.max(...top.map((c) => Math.abs(c.contribution)), 1e-9);
  $("#explain").innerHTML = top.map((c) => {
    const w = (Math.abs(c.contribution) / max) * 50;
    const bar = c.contribution > 0 ? `<div class="up" style="width:${w}%"></div>` : `<div class="down" style="width:${w}%"></div>`;
    const raw = state.bundle.raw_types[c.feature] === "number" ? (state.record[c.feature] ?? state.bundle.defaults[c.feature]) : c.value ? "yes" : "no";
    return `<div class="contrib"><span>${LABELS[c.feature] || c.feature}: <b>${raw}</b></span><div class="track"><div class="mid"></div>${bar}</div><span class="small muted">${c.contribution > 0 ? "+" : ""}${c.contribution.toFixed(3)}</span></div>`;
  }).join("");
  $("#truth").innerHTML = state.truth
    ? `Angiography result for this held-out patient: CAD ${state.truth.CAD ? "yes" : "no"} · LAD ${state.truth.LAD ? "stenotic" : "normal"} · LCX ${state.truth.LCX ? "stenotic" : "normal"} · RCA ${state.truth.RCA ? "stenotic" : "normal"}. The model never saw this patient.`
    : "";
}

let heart;
function refresh() {
  const res = predict(state.bundle, state.record);
  heart.update(res, state.selected);
  renderSummary(res);
  renderExplain(res);
}

function select(target) {
  state.selected = target;
  refresh();
}

function loadPatient(id) {
  const p = state.patients.find((x) => x.id === id);
  state.record = p ? { ...p.record } : {};
  state.truth = p ? p.truth : null;
  state.fieldMeta = {};
  fillForm();
  refresh();
}

async function runIntake() {
  const note = $("#note").value.trim();
  if (!note) return;
  const btn = $("#extract");
  btn.disabled = true;
  $("#intake-status").textContent = "Reading note...";
  try {
    const r = await fetch("/api/intake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || r.statusText);
    state.record = { ...data.record };
    state.truth = null;
    state.fieldMeta = data.fields;
    $("#patient").value = "";
    const n = Object.values(data.fields).filter((f) => f.source === "note" || f.source === "computed").length;
    const review = Object.values(data.fields).filter((f) => f.review).length;
    $("#intake-status").textContent = `${n} fields filled, ${review} to check. Missing fields use dataset medians.`;
    fillForm();
    refresh();
  } catch (e) {
    $("#intake-status").textContent = `Intake unavailable: ${e.message}`;
  } finally {
    btn.disabled = false;
  }
}

function intakeTable(e) {
  const a = e.v2_test.accuracy;
  const row = (name, k) => `<tr><td>${name}</td><td>${(a[k].accuracy * 100).toFixed(2)}%</td><td>${a[k].correct} / ${a[k].total}</td></tr>`;
  return `<h3>TypeSafe note intake (live jev-1.13 calls, ${e.v2_test.notes} fresh template notes from held-out records)</h3>
    <table><tr><th>Check</th><th>Accuracy</th><th>Correct / total</th></tr>
    ${row("Numbers in the note picked for the right field", "numeric_mentioned")}
    ${row("Fields absent from the note left empty (no invented value)", "numeric_absent_no_pick")}
    ${row("Yes/no findings", "binary")}${row("Categorical fields", "choice")}${row("BMI computed in code from weight and height", "bmi_computed")}</table>
    <p class="muted small">Mean change in predicted probability versus hand entry of the same facts: ${Object.entries(e.v2_test.downstream_mean_abs_prob_diff_vs_hand_entry).map(([k, v]) => `${k} ${v.toFixed(4)}`).join(", ")}.
    About ${Math.round(e.v2_test.mean_input_tokens_per_note).toLocaleString()} input tokens per note. Notes are synthetic (built from real records with varied phrasing, negations and distractor numbers), so real clinical notes will be harder.</p>`;
}

function renderModelCard(m) {
  const rows = TARGETS.map((t) => {
    const h = m.heldout_test[t];
    const n = m.nested_cv_dev[t];
    const ci = (k) => `${h.metrics[k].toFixed(3)} <span class="muted small">(${h.ci95[k][0].toFixed(2)}-${h.ci95[k][1].toFixed(2)})</span>`;
    return `<tr><td>${TARGET_NAMES[t]}</td><td>${h.model === "random_forest" ? "Random forest" : "L1 logistic"}</td><td>${ci("roc_auc")}</td><td>${h.metrics.accuracy.toFixed(3)}</td><td>${h.metrics.precision.toFixed(3)}</td><td>${h.metrics.recall.toFixed(3)}</td><td>${ci("f1")}</td><td>${h.metrics.brier.toFixed(3)}</td><td>${(h.conformal.coverage * 100).toFixed(1)}%</td><td>${n.roc_auc_mean.toFixed(3)} ± ${n.roc_auc_sd.toFixed(3)}</td></tr>`;
  }).join("");
  $("#modelcard").innerHTML = `
    <h2>Model card</h2>
    <p>Data: UCI "Extension of Z-Alizadeh Sani" (303 patients, angiography labels). Split ${m.split.development} development / ${m.split.test} held-out test (stratified, seed ${m.split.seed}).
    Excluded from inputs to prevent leakage: ${m.excluded_from_inputs.join(", ")}.</p>
    <table><tr><th>Target</th><th>Model</th><th>ROC-AUC (95% CI)</th><th>Accuracy</th><th>Precision</th><th>Recall</th><th>F1 (95% CI)</th><th>Brier</th><th>90% set coverage</th><th>Nested CV AUC (dev)</th></tr>${rows}</table>
    <p class="muted small">Held-out metrics use a 0.5 threshold on calibrated probabilities; CIs are 1000-sample bootstrap. Nested CV: outer 5x2 folds on the development set, with model choice, calibration and conformal fitting repeated inside each fold.
    Conformal sets target 90% coverage; on 61 patients the observed coverage has wide sampling error.</p>
    <p>Overall CAD prediction agrees with "any vessel predicted stenotic" for ${(m.consistency_cad_vs_any_vessel_test * 100).toFixed(1)}% of held-out patients.</p>
    <h3>What drives each prediction (mean |SHAP| on the development set)</h3>
    <table><tr>${TARGETS.map((t) => `<th>${t}</th>`).join("")}</tr>${[0, 1, 2, 3, 4].map((i) => `<tr>${TARGETS.map((t) => `<td>${LABELS[m.global_importance_dev[t][i].feature] || m.global_importance_dev[t][i].feature}</td>`).join("")}</tr>`).join("")}</table>
    ${state.intakeEval ? intakeTable(state.intakeEval) : ""}
    <p class="muted small">Generated ${m.generated}. scikit-learn ${m.environment.scikit_learn}. Full numbers: results/metrics.json in the repository.</p>`;
}

async function main() {
  const [bundle, patients, metrics, intakeEval] = await Promise.all(
    ["model/corolens_model.json", "model/heldout_patients.json", "model/metrics.json", "model/intake_eval.json"].map((u) => fetch(u).then((r) => r.json())),
  );
  Object.assign(state, { bundle, patients, intakeEval });
  $("#patient").innerHTML = `<option value="">Blank (dataset medians)</option>` + patients.map((p) => `<option value="${p.id}">${p.id}</option>`).join("");
  $("#patient").addEventListener("change", (e) => loadPatient(e.target.value));
  $("#extract").addEventListener("click", runIntake);
  document.querySelectorAll("nav .link").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("nav .link").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $("#view-map").hidden = b.dataset.view !== "map";
    $("#view-model").hidden = b.dataset.view !== "model";
  }));
  heart = new HeartView($("#heart"), { onSelect: (v) => select(v) });
  buildForm();
  renderModelCard(metrics);
  $("#patient").value = patients[0].id;
  loadPatient(patients[0].id);
  if (location.hash === "#model") document.querySelector('nav .link[data-view="model"]').click();
}

main();
