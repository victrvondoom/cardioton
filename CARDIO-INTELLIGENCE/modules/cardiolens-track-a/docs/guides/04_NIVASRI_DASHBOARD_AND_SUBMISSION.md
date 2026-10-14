# 04 — NIVASRI: Repo Owner, Dashboard, Integration, Submission
**Read `00_MASTER_FLOW.md` first.** You own: the GitHub repo setup, `frontend/` (except `components/HeartViewer/`, which is Navithanjali's), `docs/`, root files, and the final Devpost submission. Branch: `app/nivasri`.
You are the person everyone is waiting for on Day 1. Do Part 1 and Part 2 first, quickly.

## What you deliver
| # | Deliverable | When | Who is waiting |
|---|---|---|---|
| — | Repo created, 3 collaborators added, folders and sample contract pushed | Day 1 (first 2 hours) | Everyone |
| B | Frontend shell pushed | Day 1 | Navithanjali |
| — | Dashboard UI with mock data | Day 2 to 4 | — |
| — | Real API connected + deployed | Day 5 | — |
| — | README, DOCUMENTATION.md (max 6 pages) | Day 5 to 6 | — |
| — | Demo video, YouTube, Devpost, submit | Day 6 to 7 | — |

## When you must WAIT
| You need | From | What to do until it arrives |
|---|---|---|
| `feature_schema.json` (A) | Nivedha, Day 1 | Build the layout from the sample JSON; make the form fields by hand for 5 inputs |
| Heart viewer (G1, G2) | Navithanjali, Day 3 to 4 | Put a grey rounded box with the text "3D viewer here" |
| Final `metrics.json` (D) | Nivedha, Day 3 | Metrics page with dummy numbers |
| Backend live URL (F) | Neha, Day 5 | Use `http://localhost:8000` with the backend running on your laptop |

---

## PART 1 — Create the repo (Day 1, about 30 minutes)

**Step 1.1 Accounts.** Make sure you have: a GitHub account, a Devpost account (devpost.com, **Sign up**), a Google account (for YouTube). Install Git, VS Code and Node.js 20 LTS if not done. Run the Git setup commands from section 5 of the master file.

**Step 1.2 Create the repository on GitHub.**
1. Log in to github.com. Click the **+** (top right), **New repository**.
2. Repository name: `cardiolens-track-a`.
3. Description: "Interactive 3D cardiac risk visualization with uncertainty-aware predictions (Multimodal AI Hackathon 2026, Track A)".
4. Choose **Public**.
5. Tick **Add a README file**.
6. **Add .gitignore**: choose **Python**.
7. **Choose a license**: **MIT License**.
8. Click **Create repository**.

**Step 1.3 Add the three teammates.**
1. In the repo, click **Settings** (top tabs), then **Collaborators** (left menu), then **Add people**.
2. Type each teammate's GitHub username (ask them to send it). Select the person.
3. Choose the role **Write** if asked. Click **Add to repository**.
4. GitHub emails each person an invitation. Remind them to click **Accept invitation**.

**Step 1.4 Clone to your laptop.** On the repo page click the green **Code** button, copy the HTTPS link, then in PowerShell:
```
git clone https://github.com/<your-username>/cardiolens-track-a.git
cd cardiolens-track-a
code .
```

**Step 1.5 Create the folder skeleton and root files.** Empty folders are not stored by Git, so each gets a small placeholder file. In PowerShell:
```
mkdir data\raw, ml, backend, frontend, docs\api_contract, docs\guides, docs\sections, docs\images
type nul > data\raw\cardiolens_track_a__data_raw__.gitkeep
```
Copy the five guide `.md` files into `docs\guides\`. Copy `sample_response.json` into `docs\api_contract\`.
Create `requirements.txt` in the repo root:
```
-r ml/requirements.txt
-r backend/requirements.txt
```
Open `.gitignore` and add these lines at the end:
```
.venv/
node_modules/
frontend/dist/
.env
*.ipynb_checkpoints
```

**Step 1.6 Branch policy.** For this very first push you commit straight to `main` (only this once). Everything afterwards goes through your own branch and pull requests.
```
git add .
git commit -m "chore: repo skeleton, guides and API contract"
git push origin main
```

**Step 1.7 Tell the team.** Post in the group:
> `REPO READY: https://github.com/<your-username>/cardiolens-track-a. Accept the invite, clone, and create your own branch as written in your guide (ml/nivedha, backend/neha, viewer/navithanjali). Please also send me your exact full names for Devpost.`

Switch to your branch:
```
git checkout -b app/nivasri
```

---

## PART 2 — Frontend shell (Day 1, about 45 minutes) — HANDOFF B

**Step 2.1** In the repo root:
```
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install recharts
```
If the tool asks questions, choose **React** and **JavaScript**. (If the command asks to "install create-vite", type `y`.)

**Step 2.2** Run it: `npm run dev`. Open `http://localhost:5173`. You should see the Vite starter page. Stop it with `Ctrl + C`.

**Step 2.3 Clean the starter.** Delete the demo content: remove `src/App.css`, the logos in `src/assets`, and replace `src/App.jsx` with:
```jsx
export default function App() {
  return <div style={{padding: 24}}>CardioLens</div>;
}
```
Create these folders inside `frontend/src/`: `components`, `components/HeartViewer`, `pages`, `mock`, `lib`. Put a file `components/HeartViewer/.gitkeep` inside HeartViewer (Navithanjali owns this folder).

**Step 2.4 Playground route for Navithanjali.** Install the router: `npm install react-router-dom`. Create `src/pages/Playground.jsx` with a placeholder and, in `src/main.jsx`, set up two routes: `/` (Dashboard) and `/playground`. Tell Navithanjali it is fine for her to edit only `Playground.jsx` and the HeartViewer folder.

**Step 2.5 Copy the sample JSON** into `src/mock/sample_response.json`.

**Step 2.6 Commit and deliver.**
```
cd ..
git add .
git commit -m "frontend: Vite React shell with router"
git push origin app/nivasri
```
On GitHub click **Compare & pull request**, **Create pull request**, then **Merge pull request**, **Confirm merge**. Post:
> `FRONTEND SHELL PUSHED to main. Run: cd frontend, npm install, npm run dev. @Navithanjali`

---

## PART 3 — Design direction (read before you build the screens)
You want it to look distinctive, not like a template. Rules:
- **Palette:** deep ink background (`#0d1117` to `#10161f`), warm ivory text (`#f1ece2`), one muted accent for UI (steel blue `#6ea8c9`). Reserve **teal → amber → crimson** (`#2a9d8f`, `#e9c46a`, `#e63946`) only for risk, so colour always means something.
- **Fonts:** Google Fonts: **Fraunces** for headings (serif with character) and **IBM Plex Sans** for text, **IBM Plex Mono** for numbers. Add the `<link>` in `frontend/index.html`.
- **No default look:** do not use purple-blue gradients, rounded emoji icons or stock card shadows. Use thin 1 px borders, generous spacing, small uppercase labels, subtle grid or noise texture.
- **Layout:** left = patient input, centre = big 3D viewer, right = results. Below = explanation and next-best-test. The disclaimer is always visible.
- **Motion:** animate only meaningful changes (numbers counting up, fog clearing). Keep it under 300 ms.
- **Write real copy.** Short, clear English labels with units ("Systolic BP (mmHg)").

Put the colours in `src/index.css` as CSS variables (`--bg`, `--ink`, `--accent`, `--risk-low`, `--risk-mid`, `--risk-high`) and use them everywhere.

---

## PART 4 — Build the dashboard (Day 2 to 4)
Build with the **mock JSON first** (`src/mock/sample_response.json`).

**Step 4.1 API helper** `src/lib/api.js`:
```js
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

import mock from "../mock/sample_response.json";

export async function predict(patient, availableGroups) {
  if (USE_MOCK) return mock;
  const res = await fetch(`${BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient, available_groups: availableGroups }),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Prediction failed");
  return res.json();
}
export const getSchema = () => fetch(`${BASE}/feature-schema`).then((r) => r.json());
export const getMetrics = () => fetch(`${BASE}/metrics`).then((r) => r.json());
export const getSamplePatients = () => fetch(`${BASE}/sample-patients`).then((r) => r.json());
```
Create `frontend/.env` with the line `VITE_USE_MOCK=true` (it is already ignored by Git). Later change it to `false`.

**Step 4.2 Components** (one file each in `src/components/`):
| File | What it does |
|---|---|
| `DisclaimerBanner.jsx` | **Always visible** bar at the top: "Decision support and educational use only. Not a substitute for formal diagnostic imaging or clinical judgement." Do not make it closable |
| `PatientPanel.jsx` | Sample-patient dropdown + input form grouped by test group. Each optional group (ECG, Blood tests, Echo) has an **on/off switch**. Inputs from the schema (number, yes/no, choice). Button "Run assessment" |
| `EvidenceLadder.jsx` | The 4 steps "History and vitals, ECG, Blood tests, Echo" shown as a ladder with the active steps highlighted (the extra idea) |
| `ResultCards.jsx` | Overall CAD card (probability, label, confidence) and three vessel cards (probability, interval, confidence). Clicking a card selects that vessel (same as clicking the artery) |
| `ViewerPanel.jsx` | Wraps Navithanjali's `HeartViewer` and passes `vessels`, `selected`, `onSelect`. Until she delivers, show a placeholder box |
| `ExplanationPanel.jsx` | For the **selected** target (CAD or a vessel): a horizontal bar chart of SHAP values (Recharts `BarChart` layout vertical, bars coloured by direction) plus the summary sentence and the list of factor sentences |
| `NextBestTest.jsx` | "Next best test" card: recommended group and a small ranked bar chart of expected uncertainty reduction. Hide when `null` |
| `VitalsPanel.jsx` | BP, pulse, BMI, EF etc. from `vitals`, with simple normal-range hints |
| `MetricsPage.jsx` | Tab "Model performance": table of accuracy, precision, recall, F1, ROC-AUC with intervals per target, plus the figures from Nivedha |
| `AboutPage.jsx` | Tab "About and limitations": dataset source and licence, limitations, the extra idea explained in 5 lines, team names, credits |

**Step 4.3 State in `Dashboard.jsx`:**
```jsx
const [patient, setPatient] = useState({});
const [groups, setGroups] = useState([]);              // ["ecg", "labs"]
const [result, setResult] = useState(null);
const [selected, setSelected] = useState("CAD");
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

async function run() {
  setLoading(true); setError("");
  try { setResult(await predict(patient, groups)); }
  catch (e) { setError(e.message); }
  finally { setLoading(false); }
}
```
Always handle **loading**, **error** and **empty** states with clear messages (for example "The server is waking up, this can take up to a minute").

**Step 4.4 The key interaction (the demo moment).** When the user toggles ECG, labs or echo, call `run()` again automatically (debounce 300 ms). The fog on the arteries clears and the numbers update.

**Step 4.5 Stretch: what-if sliders.** Only if all above is done: a small panel with sliders for Age, BP, cholesterol (LDL), blood sugar (FBS). Moving them calls `run()` (debounce 400 ms) and the arteries recolour live.

**Step 4.6 Check for each screen:** works on a laptop width (1280 px) and does not break at 1024 px. Text is readable. No console errors.

**Step 4.7 Commit often** (end of every work session):
```
git add .
git commit -m "frontend: <what you did>"
git push origin app/nivasri
```
Pull Request, Merge. Do not leave work unpushed overnight.

---

## PART 5 — Merge the viewer and connect the real API (Day 3 to 5)
**Step 5.1** When Navithanjali posts READY (G1, then G2): `git checkout main`, `git pull origin main`, `git checkout app/nivasri`, `git merge main`. In `ViewerPanel.jsx`:
```jsx
import HeartViewer from "./HeartViewer/HeartViewer";
<HeartViewer vessels={result?.vessels} selected={selected} onSelect={setSelected} />
```
If the 3D library versions clash, run `npm install` again after merging.
**Step 5.2** When Neha's backend is on `main`, start it locally in one terminal (`.venv` activated, from the repo root): `uvicorn backend.app.main:app --port 8000`, and the frontend in another: `cd frontend`, `npm run dev`. Set `VITE_USE_MOCK=false` in `frontend/.env`.
**Step 5.3 Full test:** choose each sample patient, toggle the three groups, click each artery, and check that the disclaimer is visible.

---

## PART 6 — Deploy the frontend (Day 5)
**Step 6.1** Wait for Neha's READY with the Render URL (F).
**Step 6.2 Vercel (or Netlify):** go to vercel.com, **Sign Up** with GitHub, **Add New**, **Project**, import `cardiolens-track-a`.
- **Root Directory:** `frontend`
- **Framework Preset:** Vite
- **Environment Variables:** `VITE_API_URL` = `https://<neha-service>.onrender.com`, `VITE_USE_MOCK` = `false`
Click **Deploy**.
**Step 6.3** Open the Vercel URL. Test the full flow. Send the URL to Neha so she can set CORS (she changes `allow_origins` to your URL).
**Step 6.4** Share the live link in the group. Everyone opens it once on their phone.
**Step 6.5 Note:** the Render backend sleeps when idle. Open `https://<neha-service>.onrender.com/health` a few minutes before any recording or submission.

---

## PART 7 — README and documentation (Day 5 to 6)
**Step 7.1 README.md (root)** must include (the Submission Guidelines require setup, prerequisites, and run instructions):
1. Title, one-paragraph description, screenshot or GIF.
2. The disclaimer sentence.
3. What it does and the extra idea (Evidence Ladder + Fog of Uncertainty) in 5 lines.
4. Live demo link and YouTube video link.
5. **Prerequisites:** Python 3.11+, Node.js 20+, Git.
6. **Setup and run**, exactly the commands:
```
git clone https://github.com/<username>/cardiolens-track-a.git
cd cardiolens-track-a
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn backend.app.main:app --port 8000
```
and in a second terminal:
```
cd frontend
npm install
npm run dev
```
Then open `http://localhost:5173`.
7. How to retrain the models (Nivedha supplies the exact command, for example `python -m ml.src.train_groups`).
8. Folder structure, tech stack, dataset source and licence, 3D model credit and licence, limitations, team (full names), licence.
**Step 7.2 Fresh-clone test (very important).** Ask a teammate who did not write the code to follow the README on their laptop in a **new folder**. Fix every place where they get stuck.

**Step 7.3 DOCUMENTATION.md (max 6 pages).** Compile from `docs/sections/*.md`:
| Page | Content |
|---|---|
| 1 | Problem, solution overview, architecture diagram, extra idea |
| 2 to 3 | ML (Nivedha's section: data, leakage, CV, metrics, SHAP, uncertainty, ablation) |
| 4 | Backend and integration (Neha) |
| 5 | 3D visualization (Navithanjali) and dashboard (yours) |
| 6 | Limitations, ethics and disclaimer, future work, credits |
Export to PDF: open the markdown in VS Code, use a Markdown-to-PDF extension, or paste into a Word / Google Doc and **File, Download, PDF**. Check the page count is 6 or less. Put the PDF at `docs/DOCUMENTATION.pdf` and link it in the README.

---

## PART 8 — Demo video (Day 6)
**Step 8.1 Script and timing:** follow section 12 of the master file. Each teammate sends you a recording of their own voice-over (phone voice recorder is fine; quiet room; speak slowly) as an `.mp3` or `.m4a` file.
**Step 8.2 Screen recording:** use **OBS Studio** (free) or Windows `Win + G` (Game Bar, Record). Record at 1080p. Use the **live deployed link** and close other tabs and notifications. Do a practice run first.
**Step 8.3 Edit:** use **CapCut** (free), **DaVinci Resolve** or Clipchamp. Place the voice-overs over the screen recording. Add short titles ("Problem", "Demo", "Evidence Ladder", "ML pipeline", "Architecture"). Add **English subtitles** (CapCut has auto-captions; correct the mistakes, especially medical words).
**Step 8.4 Must show in the video:** the project running, the disclaimer banner, the 3D heart rotating and clicked, the fog clearing as tests are added, the SHAP explanation, the metrics page, and a short explanation of the approach. Length: **3 to 10 minutes** (aim for about 6 to 7).
**Step 8.5 Upload to YouTube:**
1. Open youtube.com, click the camera icon (top right), **Upload video**.
2. Title: "CardioLens: Uncertainty-aware 3D Cardiac Risk Visualization | Multimodal AI Hackathon 2026 Track A".
3. Description: one paragraph, the GitHub link and the live link.
4. Audience: **No, it's not made for kids**.
5. Visibility: **Unlisted** (never **Private**).
6. Click **Publish**. Open the link in a private/incognito window to confirm that it plays without logging in.

---

## PART 9 — Submit (Day 6 to 7, aim for at least 12 hours before the deadline)

**Step 9.1 Devpost.** Log in to devpost.com. Open the hackathon's Devpost page (find the link on the Unstop page or the hackathon website; if the hackathon needs registration on Devpost, click **Join hackathon** first). Click **Start a project** / **Submit project**.
(The button names can differ a little; follow what you see on screen.)

**Step 9.2 Fill the four required parts:**
1. **Project description:** title, tagline, and a description that covers *what you built*, *the problem it solves* and *how it works* (the Submission Guidelines ask for exactly these). Use headings: Inspiration, What it does, How we built it, Challenges, Accomplishments, What we learned, What's next. Mention the Evidence Ladder + Fog of Uncertainty clearly. Upload 4 to 6 screenshots.
2. **Source code:** paste the GitHub URL (repo must be **Public**, README present).
3. **Demo video:** paste the YouTube URL.
4. **Team information:** add each teammate (Devpost username or email). **Each must have a Devpost account** and must **accept** the invitation. Names must be **real full names**.
Add "Built with": Python, FastAPI, XGBoost, SHAP, React, Three.js, React Three Fiber, Recharts, Render, Vercel.

**Step 9.3 Verify before pressing Submit:**
- [ ] Open the Devpost preview as a visitor. Do all four team members appear?
- [ ] Click the GitHub link while logged out (private window). Does it open?
- [ ] Click the YouTube link while logged out. Does it play?
- [ ] Is the disclaimer visible in the video and the app?
- [ ] Is the repo free of secrets, passwords and huge files?
**Step 9.4** Click **Submit**. Take a screenshot of the confirmation. Check the Unstop page for any field that needs the Devpost or GitHub link and paste it there. Post in the group:
> `SUBMITTED. Devpost link: ... Screenshot attached. Please everyone open it and confirm your name appears.`

**Step 9.5 After submitting:** you can usually edit before the deadline. Do not change anything in the last hour unless it is a real error.

---

## Done checklist
- [ ] Repo public, 3 collaborators with Write access, branch workflow running
- [ ] Frontend shell merged on Day 1
- [ ] All dashboard components finished, loading and error states handled
- [ ] Disclaimer banner always visible
- [ ] Viewer merged, real API connected, `VITE_USE_MOCK=false` in production
- [ ] Vercel live link tested from a phone
- [ ] README tested by a teammate on a fresh clone
- [ ] DOCUMENTATION.pdf, 6 pages or fewer
- [ ] Video 3 to 10 minutes, Unlisted, English audio or subtitles
- [ ] Devpost submitted with 4 components and all 4 teammates; Unstop checked

## If you get stuck
Send Claude: the step number, the error text (terminal or browser console, F12), and the file name. Common problems: Git conflict (stop, do not delete code, ask), `npm install` errors (delete `node_modules` and run again), blank page after deploy (check that `VITE_API_URL` is set in Vercel and redeploy), CORS error in the console (Neha adds your Vercel URL to `allow_origins`).
