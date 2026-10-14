# 02 — NEHA: Backend (FastAPI), Explanations, Deployment
**Read `00_MASTER_FLOW.md` first.** You own: `backend/`. Branch: `backend/neha`.
You connect the model to the screen. Without your API, the 3D viewer and the dashboard cannot show real predictions. You also turn SHAP numbers into plain English (part of the 20% interpretability score).

## What you deliver
| # | Deliverable | When | Who is waiting |
|---|---|---|---|
| — | Mock API (fake but correctly shaped answers) | Day 1 | Nivasri, Navithanjali (optional) |
| — | Input validation from the schema | Day 2 | — |
| — | Real model connected | Day 3 | Nivasri |
| — | CI + next-best-test in the response | Day 4 | Nivasri, Navithanjali |
| F | Backend deployed on Render, live URL | Day 5 | Nivasri |
| H | `docs/sections/backend.md` | Day 5 | Nivasri |

## When you must WAIT
| You need | From | What to do until it arrives |
|---|---|---|
| `ml/feature_schema.json` (HANDOFF A) | Nivedha, Day 1 | Do Part 2 (mock API) |
| `RiskModel` + baseline model (HANDOFF C) | Nivedha, Day 2 | Keep the mock. Do validation and explanation sentences (Part 3 and 4) |
| Ensembles with confidence intervals (HANDOFF E) | Nivedha, Day 4 | Do deployment setup and tests with the baseline |

---

## PART 1 — Setup (Day 1, about 45 minutes)

**Step 1.1** Wait for Nivasri's "REPO READY" message, accept the GitHub collaborator invite from your email, then:
```
git clone https://github.com/<nivasri-username>/cardiolens-track-a.git
cd cardiolens-track-a
git checkout -b backend/neha
python -m venv .venv
.venv\Scripts\Activate.ps1
```
You should see `(.venv)` in front of the line.

**Step 1.2** Create `backend/requirements.txt`:
```
fastapi
uvicorn[standard]
pydantic
httpx
pytest
```
Also install Nivedha's requirements so the real model can run on your laptop later:
```
pip install -r backend/requirements.txt
pip install -r ml/requirements.txt
```
(If `ml/requirements.txt` is not on `main` yet, skip the second command for now.)

**Step 1.3** Create the structure:
```
mkdir backend\app, backend\tests
type nul > backend\__init__.py
type nul > backend\app\__init__.py
```

---

## PART 2 — Mock API first (Day 1 to 2)

The mock returns the sample JSON from the contract. This lets Nivasri build the dashboard without waiting for the real model.

**Step 2.1** Copy `docs/api_contract/sample_response.json` (Nivasri commits it on Day 1) to `backend/app/mock_response.json`. If it is not there yet, copy the JSON from section 7 of `00_MASTER_FLOW.md` and save it yourself.

**Step 2.2** Create `backend/app/main.py`:
```python
import json
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="CardioLens API", version="0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten to the real frontend URL on Day 5
    allow_methods=["*"],
    allow_headers=["*"],
)

HERE = Path(__file__).parent
MOCK = json.load(open(HERE / "mock_response.json"))

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/predict")
def predict(body: dict):
    return MOCK
```

**Step 2.3** Run it **from the repo root**:
```
uvicorn backend.app.main:app --reload --port 8000
```
Open `http://localhost:8000/docs` in the browser. This page lets you test every endpoint by clicking. Try `/health` and `/predict` (click **Try it out**, put `{}` as the body, **Execute**).

**Step 2.4** Commit and push:
```
git add .
git commit -m "backend: mock API"
git push origin backend/neha
```
Open a Pull Request and ask Nivasri to merge. Post:
> `READY: mock API runs on localhost:8000 (uvicorn backend.app.main:app --port 8000), merged to main. @Nivasri`

---

## PART 3 — Input validation (Day 2, after HANDOFF A)

**Step 3.1** Create `backend/app/schemas.py`:
```python
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class PredictRequest(BaseModel):
    patient: Dict[str, Any] = Field(default_factory=dict)
    available_groups: List[str] = Field(default_factory=list)

VALID_GROUPS = {"ecg", "labs", "echo"}
```

**Step 3.2** Add a validator function that reads `ml/feature_schema.json`:
- Unknown feature names: ignore them (or return 422 with a clear message, your choice, but be consistent).
- Number outside the min/max range from the schema: return **422** with text like `"Age must be between 18 and 100"`. Use a generous range so real patients are not rejected.
- Wrong type (text where a number is expected): 422.
- A group name not in `VALID_GROUPS`: 422.
- Missing values: allowed. They go to the model as `NaN` (the model handles it).

**Step 3.3** Use it in `main.py`:
```python
from fastapi import HTTPException
from backend.app.schemas import PredictRequest

@app.post("/predict")
def predict(req: PredictRequest):
    errors = validate(req)           # your function; returns a list of strings
    if errors:
        raise HTTPException(status_code=422, detail=errors)
    ...
```
Test in `/docs`: send `{"patient": {"Age": 500}}` and confirm you get the 422 message.

**Step 3.4** Add the two simple endpoints:
```python
@app.get("/feature-schema")
def feature_schema():
    return json.load(open(ROOT / "ml" / "feature_schema.json"))

@app.get("/metrics")
def metrics():
    path = ROOT / "ml" / "reports" / "metrics.json"
    return json.load(open(path)) if path.exists() else {"status": "not ready"}
```
(`ROOT = Path(__file__).resolve().parents[2]`.)

---

## PART 4 — Plain-English explanations (Day 2 to 3)

This is your creative contribution to interpretability. Judges love explanations a doctor could read.

**Step 4.1** Create `backend/app/explain_text.py`. Idea: each SHAP item (feature, value, shap number) becomes a sentence.
```python
FRIENDLY = {            # fill from the schema labels; add units
    "Age": "age",
    "HTN": "hypertension",
    "DM": "diabetes",
    "EF-TTE": "ejection fraction",
}

def sentence(feature, value, shap):
    name = FRIENDLY.get(feature, feature)
    direction = "increases" if shap > 0 else "decreases"
    return {
        "feature": feature,
        "value": value,
        "shap": round(shap, 3),
        "direction": direction,
        "sentence": f"{name.capitalize()} ({value}) {direction} the predicted risk."
    }
```
Improve it with rules: binary features say "Presence of hypertension raises..." / "No diabetes lowers..."; numbers can say "Higher than typical". Keep each sentence under 15 words.

**Step 4.2** Summary sentence per target: take the top 3 factors and build one line:
`"Age, hypertension and ST depression pushed the LAD risk up; normal EF pulled it down."`
Only list factors that really are in the top 3 by absolute SHAP, with the direction from the sign of SHAP.

**Step 4.3** Output shape (same as the contract):
```python
{"summary": "...", "top_factors": [ {feature, value, shap, direction, sentence}, ... ]}
```

---

## PART 5 — Connect the real model (Day 3, after HANDOFF C)

**Step 5.1** Pull the latest: `git checkout main`, `git pull origin main`, `git checkout backend/neha`, `git merge main`.

**Step 5.2** Load the model **once**, when the server starts (loading on every request would be slow):
```python
from backend.app.explain_text import build_explanation
from ml.src.inference import RiskModel

model = RiskModel()          # loads files once
```

**Step 5.3** Build the real response in `/predict`:
```python
THRESHOLD = 0.5

def conf_label(lo, hi):
    w = hi - lo
    return "high" if w < 0.15 else "medium" if w < 0.30 else "low"      # same thresholds as Nivedha's; ask her

@app.post("/predict")
def predict(req: PredictRequest):
    ...validation...
    groups = req.available_groups
    preds = model.predict(req.patient, groups)             # {"CAD": {"p","lo","hi"}, ...}

    def card(t):
        v = preds[t]
        return {"probability": v["p"], "ci_low": v["lo"], "ci_high": v["hi"],
                "confidence": conf_label(v["lo"], v["hi"])}

    cad = card("CAD")
    cad["label"] = "CAD likely" if cad["probability"] >= THRESHOLD else "CAD less likely"

    explanations = {t: build_explanation(model.explain(req.patient, groups, t)) for t in ["CAD", "LAD", "LCX", "RCA"]}

    return {
        "cad": cad,
        "vessels": {t: card(t) for t in ["LAD", "LCX", "RCA"]},
        "groups_used": ["base"] + groups,
        "explanations": explanations,
        "next_best_test": model.next_best_test(req.patient, groups),
        "vitals": pick_vitals(req.patient),      # BP, PR, BMI etc. that were entered
        "disclaimer": DISCLAIMER,
    }
```
`DISCLAIMER = "For decision support and educational use only. Not a substitute for formal diagnostic imaging or clinical judgement."`

**Step 5.4** `GET /sample-patients` returns `ml/reports/sample_patients.json`.

**Step 5.5 Test with the real model.** In `/docs`, try a sample patient. Check: (1) probabilities are between 0 and 1, (2) CAD label matches probability, (3) the explanation sentences make sense, (4) with the baseline the `ci_low`, `ci_high` equal the probability (that is expected until the ensemble arrives), (5) an empty `patient: {}` still returns an answer without crashing.

**Step 5.6** Push, Pull Request, then post:
> `READY: /predict uses the real model, merged to main. Run: uvicorn backend.app.main:app --port 8000. @Nivasri`

---

## PART 6 — Tests (Day 3 to 5)

Create `backend/tests/test_api.py`:
```python
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_health():
    assert client.get("/health").json() == {"status": "ok"}

def test_predict_shape():
    r = client.post("/predict", json={"patient": {"Age": 60}, "available_groups": []})
    assert r.status_code == 200
    body = r.json()
    for key in ["cad", "vessels", "explanations", "disclaimer"]:
        assert key in body
    assert set(body["vessels"]) == {"LAD", "LCX", "RCA"}

def test_bad_input():
    r = client.post("/predict", json={"patient": {"Age": 500}})
    assert r.status_code == 422
```
Run from the repo root: `pytest backend`.

---

## PART 7 — Extra fields (Day 4, after HANDOFF E)

Pull the latest `main`. The `RiskModel` now returns real `lo`/`hi` and `next_best_test`. Your code from Part 5 already passes them through, so the main job is **testing**:
1. Send the same patient with `available_groups: []`, then `["ecg"]`, then `["ecg","labs","echo"]`. The intervals should get narrower.
2. `next_best_test` is `null` when all three groups are given.
3. Response time under about 3 seconds. If slower, tell Nivedha.
Post:
> `READY: CI and next-best-test verified through the API. @Nivasri @Navithanjali`

---

## PART 8 — Deploy on Render (Day 5)

You did this for CropChar. Same idea.

**Step 8.1 Prepare.**
- Root `requirements.txt` (Nivasri's file) must contain `-r ml/requirements.txt` and `-r backend/requirements.txt`. Check it.
- Remove `jupyter` from `ml/requirements.txt` for deployment (ask Nivedha; it is big and not needed on the server). Keep `shap`, `xgboost`, `scikit-learn`, `pandas`, `numpy`, `joblib`, `openpyxl`.
- Make sure the model files are on `main` and under 100 MB each.

**Step 8.2 On render.com:** log in with GitHub, **New +**, **Web Service**, connect the repo.
- Name: `cardiolens-api`
- Root Directory: leave **empty** (repo root)
- Runtime: Python 3
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
- Instance type: Free
- Environment variable: `PYTHON_VERSION` = `3.11.9`
Click **Create Web Service**. Watch the logs. The first build takes a few minutes.

**Step 8.3 Test:** open `https://<your-service>.onrender.com/health` then `/docs`. Try `/predict` there.

**Step 8.4 If the build runs out of memory** (free tier is small): lower `N_BOOT` or model size (ask Nivedha), or reduce the number of loaded group models by lazy-loading (load a group model the first time it is requested).

**Step 8.5 CORS.** Once Nivasri shares the frontend URL, change `allow_origins=["*"]` to `["https://<frontend-url>", "http://localhost:5173"]`, push, wait for the auto-redeploy.

**Step 8.6** Post:
> `READY: backend live at https://<your-service>.onrender.com. Note: free tier sleeps, the first call takes about a minute. @Nivasri`

**Wake-up trick:** open `/health` a few minutes before recording the video or submitting, so the server is awake.

---

## PART 9 — Docs and voice-over (Day 5 to 6)

**`docs/sections/backend.md` (about 1 page):** architecture diagram (React app, FastAPI, RiskModel, SHAP), endpoint table, how validation works, how SHAP becomes sentences (with one real example), response time, deployment, security note (no patient data is stored; all values are processed in memory).
**Voice-over (about 1 minute):** show the `/docs` page, one `/predict` call, and the explanation sentences.

## Done checklist
- [ ] `/health`, `/predict`, `/feature-schema`, `/metrics`, `/sample-patients` work
- [ ] Bad input returns 422 with a clear message
- [ ] Explanation sentences read well for CAD and each vessel
- [ ] Real model used; mock removed from `/predict`
- [ ] Tests pass with `pytest backend`
- [ ] Live Render URL, CORS set to the frontend URL
- [ ] `docs/sections/backend.md` merged
- [ ] Voice-over recorded

## If you get stuck
Send Claude: the step number, the full terminal error, and the file. Common problems: running `uvicorn` from the wrong folder (always run from the repo root), `ModuleNotFoundError: ml` (missing `__init__.py` files), Render build failing (read the last 30 lines of the log).
