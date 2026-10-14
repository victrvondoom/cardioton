# MASTER FLOW — Multimodal AI Hackathon 2026, Track A
### Cardiovascular Risk Visualization & Prediction — working name: **CardioLens**

**Team (4):** Nivedha · Neha · Nivasri (team lead on Unstop/Devpost) · Navithanjali
**Everyone reads this file first. Then each person follows their own file.**

| Person | Own file | Main job |
|---|---|---|
| Nivedha | `01_NIVEDHA_ML.md` | Data, ML models, metrics, SHAP, the "extra" ML (uncertainty + test ladder) |
| Neha | `02_NEHA_BACKEND.md` | FastAPI backend, explanations in plain language, backend deploy |
| Navithanjali | `03_NAVITHANJALI_3D_VIEWER.md` | The interactive 3D heart + coronary arteries |
| Nivasri | `04_NIVASRI_DASHBOARD_AND_SUBMISSION.md` | GitHub repo owner, dashboard UI, integration, frontend deploy, Devpost, video editing |

> **Fill this in today:** Submission deadline = `____ / ____ / 2026, ____ : ____ IST`. Check the Unstop page and the Devpost page. The day numbers below are a 7-day plan. If you have fewer days, tell me the real deadline and I will compress the plan.

---

## 1. What we must deliver (from the Track A brief + Submission Guidelines)

1. **Working web prototype**: ML backend + 3D viewer + dashboard, all connected.
2. **Trained prediction pipeline**: clean code + saved model files.
3. **Clinical dashboard**: overall CAD status, LAD / LCX / RCA probabilities, interpretable breakdown (SHAP), physiological measurements.
4. **Visible safety disclaimer** in the UI (decision support and education only, not a substitute for formal diagnostic imaging).
5. **Documentation, maximum 6 pages.**
6. **Demo video, 3 to 10 minutes, on YouTube** (Unlisted is OK, Private is NOT). It must show the project running and explain the approach. English audio or English subtitles.
7. **Devpost submission with 4 parts:** project description, public GitHub repo with README (setup, prerequisites, how to run), demo video link, team info (real full names, every member added).

There is no separate PPT in the documents we have. The Unstop page may show rounds or stages. Nivasri checks the "Rounds / Timeline" section once and reports back to the group.

---

## 2. Where the marks are (and who protects them)

| Criterion | Weight | What a strong answer looks like | Owner |
|---|---|---|---|
| Predictive performance | 30% | Leakage-free pipeline, repeated stratified CV, ROC-AUC with confidence intervals, model comparison | Nivedha |
| 3D visualization | 25% | Smooth, custom arteries, rotate/zoom/select, live colour change, polished feel | Navithanjali |
| Clinical interpretability | 20% | Per-vessel SHAP + plain-English sentences + limitations | Neha (sentences), Nivedha (SHAP), Nivasri (display) |
| System integration | 15% | Frontend, backend and model run as one product, live link | Neha + Nivasri |
| Technical implementation | 10% | Clean repo, README, tests, documentation | Everyone, compiled by Nivasri |

---

## 3. Our "extra" idea — solid, not decoration

### The drawbacks in the brief as written
1. **A single probability looks more certain than it is.** The dataset has only 303 patients from one hospital. A model that says "LAD: 0.78" gives no sign of how much to trust it.
2. **Real patients arrive with partial data.** Tests are ordered step by step (history, then ECG, then blood tests, then echo). A model that needs all ~55 inputs does not match how a clinic works.
3. **A 3D heart that only recolours adds no decision value.** It repeats the numbers in a prettier way.

### The idea: "Evidence Ladder + Fog of Uncertainty"
- **Fog of Uncertainty (in 3D).** Colour shows risk (teal, amber, crimson). Each artery also shows **how sure the model is**: a confident artery is crisp and solid; an unsure artery is hazy, with a soft halo and a faster pulse. Uncertainty is shown **on the anatomy itself**.
- **Evidence Ladder.** The user ticks which test groups are available: **History/Vitals (always)**, **ECG**, **Blood tests**, **Echo**. The prediction changes live and **the fog clears as more evidence is added**. This matches a real work-up.
- **Next-Best-Test advisor.** For the current patient, the system says which missing test group would reduce uncertainty the most ("Adding Echo would cut LAD uncertainty by about 40%"). A second chart shows, over the whole dataset, how much each test group is worth.

### How we do it technically (simple, doable)
- Train **8 model sets** (history/vitals alone, plus every combination of ECG / Labs / Echo).
- Each set is an **ensemble of 20 bootstrapped XGBoost models**. The spread of their predictions gives the confidence interval (low, high) for each vessel.
- Next-best-test = for each missing group, simulate plausible values taken from the 30 most similar training patients, re-predict, and measure how much the interval shrinks.

### Honest claim (use this wording in the docs)
Bootstrap uncertainty and staged models each exist in research. **To our knowledge**, putting uncertainty directly onto the 3D coronary anatomy, together with an interactive evidence ladder and next-best-test advice, is not a standard hackathon or open-source solution. We cannot search every paper, so always write "to our knowledge", never "the first".

### It is built to degrade safely
The API contract (section 7) already has the confidence-interval fields. If the extra is not finished, the backend sends low = high = probability, the viewer shows solid arteries, and **the core project is still complete**. The extra can never break the core.

---

## 4. Your doubts, answered

**Q1. Who should create the GitHub repository? Does it have to be the team lead?**
No. GitHub does not care who the Unstop team lead is. Recommended: **Nivasri creates the repo in her account** (she will also do the Devpost submission, so one person owns the final links). Then she adds the other three as **Collaborators with Write access**. All four commit from their own accounts, so everyone's contribution is visible. Alternative if Nivasri prefers: any of the four can create it. Do not create two repos.

**Q2. "Deploy" — is it required?**
The Submission Guidelines require four things: description, public GitHub repo with README, YouTube demo, team info. A **live link is not listed as mandatory**. But "System Integration" is 15% and judges like to click and try, so we deploy: backend on **Render** (Neha, like CropChar) and frontend on **Vercel or Netlify** (Nivasri). If deployment fails near the deadline, the video + README still make a valid submission. Free Render sleeps when idle, so the first request after a break can take about a minute. Open the link once before you record or submit.

**Q3. Who submits on Devpost / Unstop?**
**Nivasri** creates the Devpost project and adds the other three. Every teammate **must have a Devpost account** (create it on Day 1) and **must accept the team invitation**. Unstop's page may also ask for the Devpost or GitHub link. Nivasri checks the Unstop page for that on Day 1.

**Q4. Real names.**
Devpost needs **real full names** of all members. Each person sends their exact full name (as on their college ID) to Nivasri on Day 1.

---

## 5. Install checklist (everyone, Day 1)

Windows (PowerShell). On a Mac the commands are the same except the virtual-environment activation.

| Tool | Who | How to check it works |
|---|---|---|
| Git | all | `git --version` |
| VS Code | all | open it |
| Python 3.11 or 3.12 | Nivedha, Neha | `python --version` |
| Node.js 20 LTS (or newer) | Navithanjali, Nivasri | `node --version` and `npm --version` |
| GitHub account | all | login works |
| Devpost account | all | login works |
| YouTube / Google account | Nivasri | login works |

First-time Git setup (run once on your own laptop):
```
git config --global user.name "Your Full Name"
git config --global user.email "the-email-used-on-github@example.com"
```
If PowerShell refuses to activate a virtual environment, run once:
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

---

## 6. Repository layout and ownership

```
cardiolens-track-a/
├── README.md                     (Nivasri)
├── requirements.txt              (Nivasri; just points to the two files below)
├── .gitignore                    (Nivasri)
├── data/raw/                     (Nivedha)  the dataset file
├── ml/                           (Nivedha)  ALL machine learning code and trained models
│   ├── requirements.txt
│   ├── src/                      data.py, groups.py, train_cv.py, ensemble.py, inference.py
│   ├── models/                   saved trained models
│   ├── feature_schema.json       the list of inputs (names, types, ranges, test groups)
│   └── reports/                  metrics.json, figures/, sample_patients.json
├── backend/                      (Neha)  FastAPI
│   ├── requirements.txt
│   ├── app/                      main.py, schemas.py, explain_text.py, mock_data.py
│   └── tests/
├── frontend/                     (Nivasri app shell and dashboard)
│   └── src/components/HeartViewer/   (Navithanjali ONLY)
├── docs/
│   ├── api_contract/sample_response.json   (Nivasri commits; Neha changes it only after telling everyone)
│   ├── guides/                   these 5 markdown files
│   ├── sections/                 ml.md, backend.md, viewer.md, dashboard.md (one per person)
│   └── DOCUMENTATION.md          (Nivasri compiles, max 6 pages)
```

**Golden rule: only edit files inside your own folder.** If you need a change in someone else's folder, message them. This is how we avoid merge conflicts, which are the number one thing that scares first-time teams.

---

## 7. The API contract (the single source of truth)

Everyone builds against this on Day 1, so nobody waits for anybody.

**Endpoints (Neha builds):**
- `GET /health` returns `{"status":"ok"}`
- `GET /feature-schema` returns the inputs list (from `ml/feature_schema.json`)
- `POST /predict` main prediction
- `GET /metrics` returns `ml/reports/metrics.json`
- `GET /sample-patients` returns 6 demo patients

**Request to `POST /predict`:**
```json
{
  "patient": { "Age": 62, "Sex": "Male", "HTN": 1, "DM": 0, "BP": 140 },
  "available_groups": ["ecg", "labs"]
}
```
`base` (history, vitals, symptoms) is always used. `available_groups` can contain `"ecg"`, `"labs"`, `"echo"`. Exact field names and allowed values come from `ml/feature_schema.json` (Nivedha's file is the truth). Unknown or missing fields are allowed.

**Response (Navithanjali and Nivasri code against this immediately):**
```json
{
  "cad": { "probability": 0.82, "ci_low": 0.70, "ci_high": 0.91, "label": "CAD likely", "confidence": "high" },
  "vessels": {
    "LAD": { "probability": 0.78, "ci_low": 0.55, "ci_high": 0.92, "confidence": "medium" },
    "LCX": { "probability": 0.35, "ci_low": 0.18, "ci_high": 0.60, "confidence": "low" },
    "RCA": { "probability": 0.66, "ci_low": 0.58, "ci_high": 0.74, "confidence": "high" }
  },
  "groups_used": ["base", "ecg", "labs"],
  "explanations": {
    "CAD": {
      "summary": "Age, hypertension and ST depression pushed the risk up.",
      "top_factors": [
        { "feature": "Age", "value": 62, "shap": 0.14, "direction": "increases", "sentence": "Age 62 raises the predicted risk." }
      ]
    },
    "LAD": { "summary": "...", "top_factors": [] },
    "LCX": { "summary": "...", "top_factors": [] },
    "RCA": { "summary": "...", "top_factors": [] }
  },
  "next_best_test": {
    "recommended_group": "echo",
    "ranking": [
      { "group": "echo", "expected_uncertainty_reduction": 0.12 },
      { "group": "labs", "expected_uncertainty_reduction": 0.05 }
    ]
  },
  "vitals": { "BP": 140, "PR": 78, "BMI": 27.4 },
  "disclaimer": "For decision support and educational use only. Not a substitute for formal diagnostic imaging or clinical judgement."
}
```
`next_best_test` can be `null` when all groups are already available.
**Rule:** if a field is not ready yet, the backend still sends it (with placeholder values). The shape never changes.

---

## 8. Git rules (everyone)

**Branches (each person works only on their own branch):**
| Person | Branch name |
|---|---|
| Nivedha | `ml/nivedha` |
| Neha | `backend/neha` |
| Navithanjali | `viewer/navithanjali` |
| Nivasri | `app/nivasri` |

**Every working session:**
1. `git checkout main` then `git pull origin main` (get the latest from others)
2. `git checkout <your-branch>` then `git merge main` (bring the latest into your branch)
3. Work. Save often.
4. `git add .` then `git commit -m "short clear message"`
5. `git push origin <your-branch>`

**Delivering a milestone ("handoff"):** open a **Pull Request** on GitHub from your branch into `main` (GitHub shows a yellow "Compare & pull request" button after you push). Nivasri clicks **Merge**. Then post the READY message (section 10).
If Git shows a **conflict**, stop and message Nivasri. Do not delete code to "make it go away".
Never commit files larger than 100 MB (GitHub rejects them). Keep model files and the 3D model under about 60 MB each.

---

## 9. Timeline — who does what each day

`P` = your parallel work, `WAIT` = you need something from someone first.

| Day | Nivedha (ML) | Neha (Backend) | Navithanjali (3D) | Nivasri (Lead/UI) |
|---|---|---|---|---|
| **1** | Install tools. Download dataset. Explore data. Make **feature_schema.json** (HANDOFF A) | Install tools. Build **mock API** that returns the sample response | Install tools. Find and test a heart 3D model. Learn `/playground` | Create repo, add 3 collaborators, folders, README skeleton, sample contract. Create frontend shell (HANDOFF B). All 4 create Devpost accounts |
| **2** | Leakage-free pipeline + repeated CV baseline. Save **baseline model + RiskModel class** (HANDOFF C) | WAIT for HANDOFF A. Build input validation from schema. Explanation sentences | Heart + 3 arteries drawn, colour from probability (using sample JSON) | Layout, patient form, test-group tick boxes (using mock JSON) |
| **3** | Compare models, tune, final metrics + figures (HANDOFF D) | WAIT for HANDOFF C. Replace mock with real model. SHAP to sentences | Rotate/zoom/click-to-select, camera focus, tooltips | Result cards, SHAP chart, vitals panel, disclaimer banner |
| **4** | EXTRA: 8 group models + bootstrap ensembles (CI) (HANDOFF E) | WAIT for HANDOFF E. Send CI + next-best-test in `/predict` | Fog of uncertainty (halo, opacity, pulse), legend | Evidence ladder panel, next-best-test card, metrics page |
| **5** | Next-best-test code, ablation chart, write ML doc section | Deploy backend on Render. Tests. Write backend doc section | Polish, performance, write viewer doc section | Connect real API, deploy frontend, end-to-end test (HANDOFF F) |
| **6** | Bug fixes. Record own voice-over part | Bug fixes. Record own part | Bug fixes. Record own part | Compile DOCUMENTATION.md (max 6 pages), final README, record screen, edit video |
| **7** | Spare day: final checks | Final checks | Final checks | Upload YouTube (Unlisted), fill Devpost, add teammates, submit EARLY |

Target: **submit at least 12 hours before the deadline.** Platforms get slow at the last minute.

---

## 10. Dependencies and handoffs (read this carefully)

Post this exact format in your WhatsApp group when a handoff is ready:
> `READY: <what>, on branch <branch>, merged to main, file <path>. @<who needs it>`

| ID | What | From | To | Until it arrives, the receiver should... |
|---|---|---|---|---|
| **A** | `ml/feature_schema.json` (input names, types, allowed values, test group of each input) | **Nivedha** (Day 1) | Neha, Nivasri | Neha: build the mock API. Nivasri: build the layout using the sample contract |
| **B** | Frontend shell pushed (`frontend/` runs with `npm run dev`) | **Nivasri** (Day 1) | Navithanjali | Navithanjali: do model hunting and the point picker on her own laptop |
| **C** | `ml/src/inference.py` with class `RiskModel` + baseline model files | **Nivedha** (Day 2) | Neha | Neha: keep the mock; do validation and explanation sentences |
| **D** | Final models, `ml/reports/metrics.json`, figures, `sample_patients.json` | **Nivedha** (Day 3) | Neha, Nivasri | Nivasri: build the metrics page with dummy numbers |
| **E** | Ensemble (CI) + group models inside `RiskModel`, next-best-test | **Nivedha** (Day 4) | Neha | Neha: finish deploy setup and tests with the baseline |
| **F** | Backend live URL (Render) | **Neha** (Day 5) | Nivasri | Nivasri: use a local backend (`localhost:8000`) |
| **G** | `HeartViewer` component merged | **Navithanjali** (Day 3, fog update Day 4) | Nivasri | Nivasri: use a simple placeholder box where the viewer goes |
| **H** | Each person's doc section in `docs/sections/` | All | Nivasri (Day 5 end) | Nivasri: write the skeleton |

The `RiskModel` interface is fixed now, so Neha can code against it before it exists:
```python
class RiskModel:
    def predict(self, patient: dict, groups: list[str]) -> dict:
        # {"CAD": {"p":0.82,"lo":0.70,"hi":0.91}, "LAD": {...}, "LCX": {...}, "RCA": {...}}
    def explain(self, patient: dict, groups: list[str], target: str, top_k: int = 6) -> list[dict]:
        # [{"feature":"Age","value":62,"shap":0.14}, ...] sorted by |shap|
    def next_best_test(self, patient: dict, groups: list[str]) -> dict | None:
        # {"recommended_group":"echo","ranking":[{"group":"echo","expected_uncertainty_reduction":0.12}]}
```

---

## 11. If time runs short — the cut list (cut from the bottom)

1. **MUST (core):** leakage-free models + CV metrics, 3D viewer with colours, dashboard with SHAP, disclaimer, README, video, Devpost.
2. Live deployment.
3. Fog of uncertainty (CI + visual halo).
4. Evidence ladder (group models).
5. Next-best-test advisor.
6. What-if sliders (stretch, Nivasri only if everything else is done).

Never cut the README, video or Devpost fields.

---

## 12. Demo video plan (target 6 to 7 minutes)

Recorded by Nivasri (screen), voice-over by all. English only, speak slowly and clearly. If anyone is not comfortable, write the script and add **English subtitles** (YouTube can auto-generate; check them).

| Minutes | Content | Speaker |
|---|---|---|
| 0:00–0:40 | Problem, the 3 vessels, what CardioLens does, the extra idea in one sentence | Nivasri |
| 0:40–2:30 | Live demo: pick a patient, 3D heart rotates and colours, click LAD, dashboard, SHAP | Navithanjali + Nivasri |
| 2:30–4:00 | Evidence ladder: tick ECG, labs, echo and watch the fog clear. Next-best-test | Nivedha |
| 4:00–5:15 | ML pipeline: leakage prevention, CV, metrics, comparison, limitations | Nivedha |
| 5:15–6:15 | Architecture: backend, SHAP sentences, API, deployment | Neha |
| 6:15–6:45 | Disclaimer, limitations, future work, thanks | Nivasri |

---

## 13. Final submission checklist (Nivasri ticks, all verify)

- [ ] GitHub repo is **Public**; README has prerequisites, setup, how to run (backend and frontend)
- [ ] Fresh-clone test: another teammate clones to a new folder and runs it by the README alone
- [ ] YouTube video is **Unlisted** (not Private), 3 to 10 minutes, English audio or subtitles
- [ ] Disclaimer banner visible in the app and in the video
- [ ] DOCUMENTATION.md exported to PDF, 6 pages or fewer
- [ ] Devpost: description, GitHub link, YouTube link, all 4 teammates added with **real full names** and accepted
- [ ] Unstop: link pasted there if the page asks
- [ ] Dataset and 3D model credits and licences included in the README
- [ ] Live links opened once to wake the free servers

---

## 14. Who to ask

| Topic | Ask |
|---|---|
| Data, features, model numbers | Nivedha |
| API, errors, deployment of backend | Neha |
| 3D, camera, colours of arteries | Navithanjali |
| Git, repo, UI layout, Devpost, video | Nivasri |
| Anything else | Group chat first, then ask Claude with the error message and the file name |

When asking Claude for help, always paste: (1) your file name, (2) the exact step number, (3) the full error text.
