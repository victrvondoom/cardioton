# 01 — NIVEDHA: Machine Learning
**Read `00_MASTER_FLOW.md` first.** You own: `data/raw/`, `ml/`. Branch: `ml/nivedha`.
You carry 30% of the marks (predictive performance) plus the technical half of the extra idea.

## What you deliver (in order)
| # | Deliverable | When | Who is waiting |
|---|---|---|---|
| A | `ml/feature_schema.json` | Day 1 | Neha, Nivasri |
| C | `ml/src/inference.py` (class `RiskModel`) + baseline model | Day 2 | Neha |
| D | Final models, `metrics.json`, figures, `sample_patients.json` | Day 3 | Neha, Nivasri |
| E | Ensembles with confidence intervals + 8 group models + next-best-test | Day 4 | Neha |
| H | `docs/sections/ml.md` | Day 5 | Nivasri |

---

## PART 0 — Setup (Day 1, about 45 minutes)

**Step 0.1** Wait for Nivasri to message "REPO READY" with the GitHub link. Meanwhile accept the collaborator invite in your email (GitHub sends "You have been invited"). Click **Accept invitation**.

**Step 0.2** Open PowerShell. Go to the folder where you keep projects, then clone:
```
git clone https://github.com/<nivasri-username>/cardiolens-track-a.git
cd cardiolens-track-a
git checkout -b ml/nivedha
```

**Step 0.3** Make a virtual environment (a private box of Python libraries):
```
python -m venv .venv
.venv\Scripts\Activate.ps1
```
You should now see `(.venv)` at the start of the line. (`.venv` is already in `.gitignore`, so it will not be uploaded.)

**Step 0.4** Create `ml/requirements.txt` with this content, then install:
```
pandas
numpy
scikit-learn
xgboost
shap
imbalanced-learn
matplotlib
joblib
openpyxl
jupyter
```
```
pip install -r ml/requirements.txt
```

**Step 0.5** Make the folders and package files:
```
mkdir ml\src, ml\models, ml\reports, ml\reports\figures, ml\notebooks, data\raw
type nul > ml\__init__.py
type nul > ml\src\__init__.py
```
Open the folder in VS Code: `code .`

---

## PART 1 — Get and understand the data (Day 1)

**Step 1.1** Download the dataset. Use the link given in the Track A brief (Z-Alizadeh Sani extension, on UCI or Kaggle). Save the file into `data/raw/`. Write down the exact file name.
**Check the licence on the dataset page** (UCI datasets usually state it) and note it for the README.

**Step 1.2** Make a notebook: in VS Code create `ml/notebooks/01_eda.ipynb`. In the first cell:
```python
import pandas as pd
df = pd.read_excel("../../data/raw/YOUR_FILE_NAME.xlsx")   # use pd.read_csv for a .csv
print(df.shape)          # expect about 303 rows
df.head()
```
If VS Code asks for a kernel, choose the `.venv` Python.

**Step 1.3** Answer these questions in the notebook. Write the answers as comments, you will need them for the docs:
1. How many rows and columns?
2. Which columns are the **targets**? Look for `Cath` and the three vessel columns (`LAD`, `LCX`, `RCA`; names may differ slightly). Print `df[col].value_counts()` for each. **If the vessel columns are missing, you downloaded the wrong version. Find the extended version mentioned in the brief before continuing.**
3. Which columns are text (Y/N, Male/Fmale, Normal/Mild...)? `df.dtypes`
4. How many missing values per column? `df.isna().sum()`
5. How balanced is each target? (CAD usually has many more positives than negatives. That is a known property of this dataset and goes into the limitations.)
6. Duplicates: `df.duplicated().sum()`

**Step 1.4** Put each input column in a test group. Use clinical sense:
| Group | Typical columns (verify against the real column names) |
|---|---|
| `base` | Age, Weight, Length, BMI, Sex, DM, HTN, smoking, FH, obesity, CRF, CVA, airway disease, thyroid, CHF, DLP, BP, PR, edema, pulse, rales, murmurs, chest pain types, dyspnea, function class, exertional CP |
| `ecg` | Q Wave, ST Elevation, ST Depression, T inversion, LVH, Poor R progression, BBB, rhythm |
| `labs` | FBS, CR, TG, LDL, HDL, BUN, ESR, HB, K, Na, WBC, Lymph, Neut, PLT |
| `echo` | EF-TTE, Region RWMA, VHD |

---

## PART 2 — Deliverable A: `feature_schema.json` (finish this on Day 1)

This file is the first thing Neha and Nivasri wait for. Do it before the models.

**Step 2.1** Create `ml/src/data.py`:
```python
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW_FILE = ROOT / "data" / "raw" / "YOUR_FILE_NAME.xlsx"     # <- change

TARGET_COLUMNS = ["Cath", "LAD", "LCX", "RCA"]               # <- check real names

def load_raw() -> pd.DataFrame:
    return pd.read_excel(RAW_FILE)                            # or read_csv

def encode(df: pd.DataFrame) -> pd.DataFrame:
    """Turn every text column into numbers. Print what you did, for the docs."""
    df = df.copy()
    for col in df.columns:
        if df[col].dtype == object:
            values = sorted(df[col].dropna().astype(str).unique())
            print(col, values)                                # LOOK at these
            if len(values) <= 2:
                df[col] = df[col].astype(str).map({values[0]: 0, values[1]: 1})
    return df
```
Run it and **read the printed values**. For columns with more than 2 text values (for example VHD: Normal / Mild / Moderate / Severe), add an explicit ordinal mapping:
```python
ORDINAL = {"VHD": {"N": 0, "mild": 1, "Moderate": 2, "Severe": 3}}   # match the real values
```
For Sex, remember which value became 1 and write it down (the dashboard will show "Male/Female" and the backend must convert).

**Step 2.2** Add the target builder to `data.py`:
```python
def make_targets(df: pd.DataFrame) -> dict:
    y = {}
    y["CAD"] = df["Cath"].astype(str).str.lower().str.contains("cad").astype(int)
    for v in ["LAD", "LCX", "RCA"]:
        # print(df[v].value_counts()) first, then map to 0/1 correctly
        y[v] = (df[v] > 0).astype(int)        # CHANGE if values are text like "Stenotic"
    return y
```

**Step 2.3 Leakage guard (very important, judges check this).** The model inputs must NOT contain `Cath`, `LAD`, `LCX`, `RCA` (the brief says so). Write:
```python
def make_features(df: pd.DataFrame) -> pd.DataFrame:
    X = df.drop(columns=[c for c in TARGET_COLUMNS if c in df.columns])
    assert not set(TARGET_COLUMNS) & set(X.columns), "LEAKAGE: target column in inputs"
    return X
```
Also scan for suspicious columns: any input with correlation above 0.9 with a target gets a note in the docs (and is investigated).

**Step 2.4** Create `ml/src/groups.py`:
```python
GROUP_OF = {
    # "Age": "base", "Sex": "base", ..., "ST Depression": "ecg", ..., "FBS": "labs", ..., "EF-TTE": "echo"
}   # fill every input column using Step 1.4
OPTIONAL_GROUPS = ["ecg", "labs", "echo"]

def columns_for(groups, all_columns):
    keep = {"base", *groups}
    return [c for c in all_columns if GROUP_OF[c] in keep]
```

**Step 2.5** Generate the schema (a small script `ml/src/make_schema.py`) that writes `ml/feature_schema.json`:
```json
{
  "features": [
    {"name": "Age", "label": "Age (years)", "type": "number", "min": 30, "max": 90, "median": 58, "group": "base"},
    {"name": "Sex", "label": "Sex", "type": "choice", "choices": {"Male": 1, "Female": 0}, "group": "base"},
    {"name": "HTN", "label": "Hypertension", "type": "binary", "group": "base"}
  ],
  "groups": ["base", "ecg", "labs", "echo"]
}
```
`type` is one of `number`, `binary`, `choice`. For numbers take min, max and median from the data. Write readable labels with units.

**Step 2.6 HANDOFF A.** Commit, push, open a Pull Request, ask Nivasri to merge, then post:
```
git add .
git commit -m "ml: data loader and feature schema"
git push origin ml/nivedha
```
> `READY: feature_schema.json, on branch ml/nivedha, merged to main, file ml/feature_schema.json. @Neha @Nivasri`

---

## PART 3 — Baseline with honest evaluation (Day 2)

**Step 3.1** Create `ml/src/train_cv.py`. The golden rules: (1) preprocessing is inside the CV pipeline (so no peeking at test folds), (2) stratified folds, (3) repeated.
```python
import numpy as np, pandas as pd, json
from sklearn.model_selection import RepeatedStratifiedKFold, cross_validate
from sklearn.pipeline import make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from ml.src.data import load_raw, encode, make_targets, make_features

SCORING = ["accuracy", "precision", "recall", "f1", "roc_auc"]
CV = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=42)

def candidates(y):
    pos_weight = (y == 0).sum() / max((y == 1).sum(), 1)       # handles imbalance
    return {
        "LogReg": make_pipeline(SimpleImputer(strategy="median"), StandardScaler(),
                                LogisticRegression(max_iter=3000, class_weight="balanced")),
        "RandomForest": make_pipeline(SimpleImputer(strategy="median"),
                                RandomForestClassifier(n_estimators=300, class_weight="balanced_subsample", random_state=42)),
        "XGBoost": make_pipeline(SimpleImputer(strategy="median"),
                                XGBClassifier(n_estimators=150, max_depth=3, learning_rate=0.05, subsample=0.8,
                                              colsample_bytree=0.8, scale_pos_weight=pos_weight,
                                              eval_metric="logloss", random_state=42)),
    }

def run():
    df = encode(load_raw())
    X, Y = make_features(df), make_targets(df)
    results = {}
    for target, y in Y.items():
        results[target] = {}
        for name, model in candidates(y).items():
            cv = cross_validate(model, X, y, cv=CV, scoring=SCORING, n_jobs=-1)
            summary = {}
            for m in SCORING:
                s = cv["test_" + m]
                summary[m] = {"mean": float(s.mean()),
                              "ci_low": float(np.percentile(s, 2.5)),
                              "ci_high": float(np.percentile(s, 97.5))}
            results[target][name] = summary
            print(target, name, round(summary["roc_auc"]["mean"], 3))
    return results

if __name__ == "__main__":
    json.dump(run(), open("ml/reports/cv_results.json", "w"), indent=2)
```
Run from the **repo root** (not inside `ml/`): `python -m ml.src.train_cv`.

**Step 3.2** Read the numbers. Typical: CAD AUC around 0.9 or higher. Vessel-specific targets are lower (LCX is usually the hardest). Do NOT be alarmed by moderate vessel scores. Report them honestly. **If any AUC is above 0.98, suspect leakage and re-check Step 2.3.**

**Step 3.3** Choose the best model **per target** by mean ROC-AUC. Because the clinical cost of missing disease is high, also report recall (sensitivity) and note the chosen decision threshold (default 0.5; optional: threshold chosen from CV to reach about 90% recall).

**Step 3.4** Create `ml/src/inference.py`. This is the interface Neha codes against. For Day 2, the baseline version only needs the full-feature model:
```python
import joblib, json, numpy as np, pandas as pd
from pathlib import Path

MODELS = Path(__file__).resolve().parents[1] / "models"
SCHEMA = json.load(open(Path(__file__).resolve().parents[1] / "feature_schema.json"))
ALL_FEATURES = [f["name"] for f in SCHEMA["features"]]

class RiskModel:
    def __init__(self):
        self.bundle = joblib.load(MODELS / "baseline.joblib")      # {"CAD": model, "LAD": model, ...}

    def _row(self, patient: dict) -> pd.DataFrame:
        row = {c: patient.get(c, np.nan) for c in ALL_FEATURES}    # missing stays NaN
        return pd.DataFrame([row])

    def predict(self, patient, groups):
        X = self._row(patient)
        out = {}
        for t, m in self.bundle.items():
            p = float(m.predict_proba(X)[0, 1])
            out[t] = {"p": p, "lo": p, "hi": p}                     # no CI yet (Day 4)
        return out

    def explain(self, patient, groups, target, top_k=6):
        return []                                                    # filled in Part 4

    def next_best_test(self, patient, groups):
        return None                                                  # filled in Part 6
```
Fit and save the baseline (a small `ml/src/save_baseline.py`): fit the best pipeline per target on **all** data and `joblib.dump(bundle, "ml/models/baseline.joblib")`.

**Step 3.5 HANDOFF C.** Commit, push, Pull Request, then:
> `READY: RiskModel baseline + baseline.joblib, merged to main, file ml/src/inference.py. @Neha`

---

## PART 4 — Final models, SHAP, metrics, figures (Day 3)

**Step 4.1 SHAP for explanations.** XGBoost works best with SHAP (tree-based). For the final models use plain `XGBClassifier` (it accepts NaN, so no imputer needed):
```python
import shap
def explain_one(model, x_row_df, top_k=6):
    explainer = shap.TreeExplainer(model)
    sv = explainer.shap_values(x_row_df)
    sv = np.array(sv).reshape(-1)             # one value per feature
    order = np.argsort(-np.abs(sv))[:top_k]
    return [{"feature": x_row_df.columns[i], "value": x_row_df.iloc[0, i].item() if pd.notna(x_row_df.iloc[0, i]) else None,
             "shap": float(sv[i])} for i in order]
```
Fill `RiskModel.explain` with it. Return only features that were actually provided.

**Step 4.2 `metrics.json` and figures.** Save to `ml/reports/`:
- `metrics.json`: for each target, the chosen model's CV metrics (accuracy, precision, recall, F1, ROC-AUC, each with mean and 95% interval) and the model comparison table.
- `figures/roc_<target>.png` using out-of-fold predictions (`cross_val_predict` with `method="predict_proba"`).
- `figures/confusion_<target>.png`
- `figures/model_comparison.png` (bar chart of AUC by model and target)
- `figures/shap_summary_CAD.png` (global importance)
Use a clean, consistent style: dark text on white, one accent colour, readable font sizes (at least 12 pt).

**Step 4.3 `sample_patients.json`.** Pick 6 real rows for the demo: 2 clearly low risk, 2 clearly high risk, 2 ambiguous (probability near 0.5). Save only the input columns (never the target) plus a friendly label such as "Patient A". Use whole-number identifiers, not real names (the dataset is anonymous).

**Step 4.4 HANDOFF D.** Pull Request, then:
> `READY: final models + metrics.json + sample_patients.json, merged to main. @Neha @Nivasri`

---

## PART 5 — THE EXTRA, part 1: groups + uncertainty (Day 4)

**Step 5.1 Why.** Ensembles of bootstrapped models give a spread of predictions. A wide spread means "the model is unsure". We train this for 8 combinations of available tests.

**Step 5.2 Create `ml/src/ensemble.py`:**
```python
import itertools, joblib, numpy as np, pandas as pd
from xgboost import XGBClassifier
from ml.src.groups import GROUP_OF, OPTIONAL_GROUPS, columns_for

N_BOOT = 20

def key_of(groups):
    g = sorted(set(groups) & set(OPTIONAL_GROUPS))
    return "base" if not g else "base+" + "+".join(g)

def all_subsets():
    for r in range(len(OPTIONAL_GROUPS) + 1):
        for combo in itertools.combinations(OPTIONAL_GROUPS, r):
            yield list(combo)

def fit_ensemble(X, y, cols, seed=0):
    rng = np.random.default_rng(seed)
    pos_weight = (y == 0).sum() / max((y == 1).sum(), 1)
    models = []
    while len(models) < N_BOOT:
        idx = rng.choice(len(X), size=len(X), replace=True)
        if y.iloc[idx].nunique() < 2:        # skip a bootstrap sample with one class only
            continue
        m = XGBClassifier(n_estimators=100, max_depth=3, learning_rate=0.05, subsample=0.8,
                          colsample_bytree=0.8, scale_pos_weight=pos_weight,
                          eval_metric="logloss", random_state=int(rng.integers(1e9)))
        m.fit(X.iloc[idx][cols], y.iloc[idx])
        models.append(m)
    return models

def predict_ensemble(models, cols, row_df):
    p = np.array([m.predict_proba(row_df[cols])[0, 1] for m in models])
    return {"p": float(p.mean()), "lo": float(np.percentile(p, 5)), "hi": float(np.percentile(p, 95))}
```

**Step 5.3 Train everything** (`ml/src/train_groups.py`): loop over `all_subsets()` and over the 4 targets, store `bundle[key][target] = {"cols": cols, "models": models}`, then `joblib.dump(bundle, "ml/models/groups.joblib", compress=3)`.
**Check the file size** (`dir ml\models`). It must be **under 60 MB**. If bigger: lower `N_BOOT` to 15, `n_estimators` to 80, or the `compress` level up to 6.

**Step 5.4 Evaluate each group combo honestly.** For the CAD target, run the same repeated CV for each of the 8 column sets and record AUC. Save a figure `figures/test_value_ablation.png`: bars = AUC for each combination. This chart answers "how much is each test worth?" for the whole dataset and is great for the demo and the docs.

**Step 5.5 Confidence labels.** Compute width = `hi - lo`. Rule of thumb: width below 0.15 gives `"high"`, 0.15 to 0.30 gives `"medium"`, above 0.30 gives `"low"`. Look at the real distribution of widths and adjust thresholds so all three labels appear. Keep the thresholds in one constant.

**Step 5.6 Update `RiskModel`:** `predict` loads the bundle for `key_of(groups)` and returns `{"p","lo","hi"}` per target. `explain` uses the model with the median-index in the ensemble (or the first one) for SHAP.
**Check:** with all groups ticked, CAD AUC should be close to your Day 3 result. With only `base`, it should be lower and the intervals wider. If it is the opposite, there is a bug.

**Step 5.7 HANDOFF E (part 1).** Pull Request, then:
> `READY: groups.joblib + ensemble CI inside RiskModel.predict, merged to main. @Neha`

---

## PART 6 — THE EXTRA, part 2: next-best-test (Day 5 morning)

**Step 6.1 Logic.** For a patient with current groups G, for each missing group g:
1. Find the **30 most similar training patients** using only the inputs in G (standardise numbers, fill NaN with medians, use Euclidean distance).
2. For each neighbour, copy their values for the inputs of group g into a copy of the patient.
3. Predict with the model set for `G + g`; take the interval width of CAD and the three vessels (average of the 4 widths).
4. `expected_width(g)` = average over the 30 neighbours.
5. `reduction(g) = current_width - expected_width(g)`. Rank groups by reduction.

```python
def next_best_test(self, patient, groups):
    missing = [g for g in OPTIONAL_GROUPS if g not in groups]
    if not missing:
        return None
    now = self.predict(patient, groups)
    width_now = np.mean([v["hi"] - v["lo"] for v in now.values()])
    ranking = []
    for g in missing:
        new_groups = list(groups) + [g]
        widths = []
        for _, neighbour in self._nearest(patient, groups, k=30).iterrows():
            p2 = dict(patient)
            for c in columns_for([g], ALL_FEATURES):
                if GROUP_OF[c] == g:
                    p2[c] = neighbour[c]
            pred = self.predict(p2, new_groups)
            widths.append(np.mean([v["hi"] - v["lo"] for v in pred.values()]))
        ranking.append({"group": g, "expected_uncertainty_reduction": float(width_now - np.mean(widths))})
    ranking.sort(key=lambda r: -r["expected_uncertainty_reduction"])
    return {"recommended_group": ranking[0]["group"], "ranking": ranking}
```
(`_nearest` is a helper that you write with scikit-learn's `NearestNeighbors` on the training rows. Keep the training matrix inside the model bundle.)

**Step 6.2 Sanity checks:** (a) reductions are usually positive; a negative value means the extra test would add confusing evidence, which is allowed but check a few by hand. (b) The result for a patient with all groups is `None`. (c) It runs in under about 2 seconds. If slower, use k = 20 and fewer bootstrap models.

**Step 6.3 HANDOFF E (part 2).**
> `READY: next_best_test in RiskModel, merged to main. @Neha`

---

## PART 7 — Tests, docs, voice-over (Day 5 to 6)

**Step 7.1 A quick test file** `ml/tests/test_model.py`: (a) no target column in the inputs, (b) predictions are between 0 and 1, (c) `lo <= p <= hi`, (d) a patient with only `base` works. Run `pytest ml`.

**Step 7.2 Write `docs/sections/ml.md` (about 1.5 pages)** with:
1. Data: source, 303 patients, targets, licence, imbalance, single-centre limitation.
2. Leakage prevention (what was dropped and the assertion).
3. Pipeline, CV design (5-fold × 3 repeats, stratified), metrics table with confidence intervals.
4. Model comparison and why the final models were chosen.
5. SHAP explanation approach.
6. The extra: groups, bootstrap ensembles, how the confidence interval is computed, next-best-test method, the ablation figure.
7. **Limitations (be honest):** small dataset, one hospital, high disease prevalence, probabilities are not population-calibrated, not externally validated, educational only. Honest limits earn trust and marks.

**Step 7.3 Voice-over** (about 2.5 minutes, English): Evidence Ladder demo (30 s), leakage + CV + metrics (60 s), uncertainty and next-best-test method (60 s). Write the script first, read it slowly twice.

---

## Done checklist
- [ ] `feature_schema.json` merged (A)
- [ ] No target column in inputs, with the assertion
- [ ] Repeated stratified CV; metrics with intervals for CAD, LAD, LCX, RCA
- [ ] SHAP works for each target
- [ ] `groups.joblib` under 60 MB; CI fields in predictions
- [ ] Next-best-test returns a ranking
- [ ] `metrics.json`, figures, `sample_patients.json` merged
- [ ] `docs/sections/ml.md` merged
- [ ] Voice-over recorded

## If you get stuck
Send Claude: your step number, the full error, and the 10 lines of code around it. Common problems: wrong column names (print `df.columns`), running from the wrong folder (always run `python -m ml.src.<file>` from the repo root), a text column that was not encoded.
