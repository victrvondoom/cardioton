<div align="center">

# 🩺 CaseTwin

### *MedGemma reads the X-ray. CaseTwin closes the case.*

**An end-to-end clinical intelligence platform powered by Google's Health AI Developer Foundations.**
From chest X-ray upload to printed specialist referral — in a single workflow.

<br/>

![MedGemma](https://img.shields.io/badge/MedGemma-HAI--DEF-4285F4?style=for-the-badge&logo=google&logoColor=white)
![MedSiglip](https://img.shields.io/badge/MedSiglip-HAI--DEF-0F9D58?style=for-the-badge&logo=google&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_2.5_Flash-Google-EA4335?style=for-the-badge&logo=googlegemini&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![GCP](https://img.shields.io/badge/GCP-Cloud_Run-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

</div>

---

## Why MedGemma?

> Generic large language models are trained to be broadly helpful — but medicine demands more than broad helpfulness. A model that can confidently identify a pulmonary nodule on a chest X-ray, localise it with a bounding box, compare it to a historical case, and then answer a physician's follow-up question in the same session is not a general-purpose tool — it is a specialist.
>
> **MedGemma is that specialist.** It is Google's open-weight multimodal model fine-tuned specifically on medical imaging and clinical text, part of the HAI-DEF (Health AI Developer Foundations) collection. CaseTwin is built around MedGemma because no other open model delivers the combination of image understanding, clinical language grounding, and instruction-following that the workflows here demand.

CaseTwin deploys MedGemma across **four distinct clinical tasks** — each one a place where a general-purpose LLM would produce inferior or unsafe output without the medical fine-tuning:

| Task | Why MedGemma specifically |
|---|---|
| **Clinical note extraction** | Understands medical shorthand, ICD terminology, and radiology report structure that generic models misparse |
| **Bounding box localisation** | Trained on annotated medical imaging — can return pixel-accurate `[x, y, w, h]` coordinates for findings like consolidation, effusion, nodules |
| **Twin case comparison** | Reasons about progression risk and imaging differences using learned clinical priors, not just surface text similarity |
| **Dual-context clinical Q&A** | Holds both the historical twin case AND the current patient's profile in context simultaneously, reasoning across both like a consulting clinician |

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Impact](#impact)
- [HAI-DEF Models Used](#hai-def-models-used)
- [Application Flow](#application-flow)
  - [Step 1 — Upload & Case Extraction](#step-1--upload--case-extraction)
  - [Step 2 — Case Matches & AI Insights](#step-2--case-matches--ai-insights)
  - [Step 3 — Hospital Routing & Physician Discovery](#step-3--hospital-routing--physician-discovery)
  - [Step 4 — Referral Memo](#step-4--referral-memo)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [AI Components Deep Dive](#ai-components-deep-dive)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [License](#license)

---

## Problem Statement

When a radiologist encounters a rare or complex chest finding, the standard workflow is deeply fragmented:

1. **Manual literature search** — 30+ minutes trawling PubMed for cases with similar imaging findings
2. **Peer consultation** — calling colleagues to identify the right specialist, often across time zones
3. **Facility identification** — researching which hospitals have the necessary equipment and expertise
4. **Physician outreach** — tracking down individual doctor names and contact details
5. **Referral letter writing** — manually drafting a structured referral memo from scratch

Each step introduces delay and cognitive load at exactly the moment when decisions matter most — and in critical care, delay costs outcomes.

**CaseTwin collapses all five steps into a single AI-guided session.** Upload an image, find the closest historical case twin, see where that case was treated and how it progressed, identify the right facility and physician today, and generate the referral memo — all without leaving the interface.

---

## Impact

| Metric | Before CaseTwin | With CaseTwin |
|---|---|---|
| Similar case search | 30–60 min (manual PubMed) | < 30 seconds (MedSiglip + Qdrant) |
| Imaging comparison & annotation | 15–20 min (manual review) | < 60 seconds (MedGemma bounding boxes) |
| Hospital & specialist identification | 1–3 hours (phone calls, web research) | 2–3 min (You.com + CrewAI agents) |
| Referral memo drafting | 20–30 min | Instant (auto-generated from case data) |
| **Total workflow** | **~4 hours** | **~5 minutes** |

Beyond individual efficiency, CaseTwin makes a strong case for AI in resource-constrained clinical settings — the system uses open-weight models deployable via HuggingFace Inference Endpoints, meaning the core intelligence does not require a proprietary cloud dependency. Institutions that cannot rely on closed centralized models can run MedGemma and MedSiglip on their own infrastructure.

---

## HAI-DEF Models Used

CaseTwin integrates **two models from Google's Health AI Developer Foundations collection**:

### 🔬 MedGemma *(primary — multimodal clinical LLM)*

MedGemma is deployed via a HuggingFace Inference Endpoint and is the clinical reasoning core of CaseTwin. It handles every task where medical domain knowledge is load-bearing:

- `POST /extract` — parses raw clinical notes into a structured `CaseProfile` (demographics, vitals, findings, diagnoses, plan)
- `POST /compare_insights` — performs multimodal side-by-side analysis of two chest X-rays, returns bounding box coordinates for the primary finding in each, and generates a structured comparison (similarities, differences, progression risk)
- `POST /chat_twin` — answers physician questions grounded in both the historical twin case text and the current patient's CaseProfile
- `POST /explain_selection` — explains any highlighted medical term in 1–2 plain-language sentences

### 🖼️ MedSiglip *(vision encoder — image embeddings)*

MedSiglip is a medical vision-language model whose image encoder is used to generate 512-dimensional embeddings from chest X-ray images. These embeddings are stored in Qdrant and queried at search time via cosine similarity to retrieve the most clinically similar historical cases from the dataset.

**Why this matters:** A general-purpose CLIP embedding trained on natural images would not understand that two images of bilateral perihilar opacification are more similar to each other than either is to a pleural effusion. MedSiglip's medical fine-tuning makes the similarity search clinically meaningful, not just visually meaningful.

---

## Application Flow

The entire workflow is a four-step stepper in the main dashboard. Each step builds on the previous one's output.

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│   1. Upload    │────►│   2. Matches   │────►│   3. Route     │────►│   4. Memo      │
│                │     │                │     │                │     │                │
│ CXR + notes    │     │ Twin cases     │     │ Hospitals      │     │ Referral       │
│                │     │ ranked by      │     │ ranked by      │     │ letter         │
│ ► MedSiglip    │     │ MedSiglip      │     │ capability     │     │ auto-generated │
│   embedding    │     │ similarity     │     │ + drive time   │     │ ready to print │
│ ► MedGemma     │     │ ► MedGemma     │     │ ► CrewAI       │     │ ► Combines all │
│   extraction   │     │   comparison   │     │   agents       │     │   prior steps  │
└────────────────┘     └────────────────┘     └────────────────┘     └────────────────┘
```

---

### Step 1 — Upload & Case Extraction

**What the user does:**
The physician uploads a chest X-ray image (JPEG/PNG) and optionally adds clinical notes, history, or lab values in the **Agentic Copilot** panel on the right side of the screen.

**What happens under the hood:**

1. The uploaded image is sent to `POST /search` alongside any text context.
2. The backend calls the **MedSiglip** HuggingFace Inference Endpoint to generate a 512-dimensional medical image embedding.
3. That embedding is used to query **Qdrant** (pre-loaded with historical chest X-ray cases from published medical literature) via cosine similarity search.
4. In parallel, the **Agentic Copilot** panel allows the clinician to describe the patient in natural language. The system uses **Gemini 2.5 Flash** to progressively build a structured `CaseProfile` — patient demographics, vitals, lung findings, impression, assessment, and plan — displayed in the left panel as it is constructed in real time.
5. Structured extraction is also available via `POST /extract`, where **MedGemma** parses pasted clinical notes directly into the same CaseProfile schema.

**Outputs at the end of Step 1:**
- Ranked list of up to 5 historically similar cases from the literature
- A fully structured CaseProfile ready for comparison

---

### Step 2 — Case Matches & AI Insights

**What the user does:**
The physician reviews the ranked historical case twins. Each card shows the diagnosis, patient demographics, outcome badge (success / warning / neutral), treating facility, and a brief clinical summary. The user selects one as the primary twin for deep comparison.

**What happens under the hood:**

1. On selection, `POST /compare_insights` is called with both the uploaded image and the twin's image URL, plus the matched diagnosis.
2. **MedGemma** (multimodal) performs a side-by-side analysis:
   - Identifies the primary abnormality in each image
   - Returns bounding box coordinates `[x, y, width, height]` for each finding
   - Generates a structured comparison: similarities, differences, progression risk, and clinical recommendations
3. The bounding boxes are rendered as **SVG overlays** directly on both the current image and the twin image — physicians can see exactly what MedGemma is comparing.
4. `POST /enhance_profile` generates a deep **Clinical Synthesis** narrative — a paragraph summarising the imaging context, the relevant history, and recommended next steps — which is appended to the CaseProfile display.
5. The **TwinChatPanel** becomes active. Each question typed by the physician is sent to `POST /chat_twin` where **MedGemma** answers grounded simultaneously in the full twin case text AND the current patient's structured CaseProfile — the dual-context reasoning that distinguishes it from a generic chatbot.
6. Hovering or selecting any medical term in the case text triggers `POST /explain_selection` — **MedGemma** returns a 1–2 sentence plain-language explanation in a popover, making the system accessible to non-specialist clinicians.

**Outputs at the end of Step 2:**
- Visual abnormality bounding boxes on both images
- AI-generated structured comparison analysis
- Enhanced CaseProfile with clinical synthesis narrative
- Active clinical Q&A session grounded in the twin case

---

### Step 3 — Hospital Routing & Physician Discovery

**What the user does:**
An interactive **Leaflet map** shows candidate hospitals as markers. Below it, a ranked list of facilities is displayed. On the right, a **Routing Criteria** panel provides filters:
- **Facility Capabilities** — checkboxes for Interventional Radiology, 3T MRI, Robotic Surgery, Pediatric ICU
- **Maximum Travel Time** — slider from 0 to 6 hours
- **Search Radius** — dropdown (25 / 50 / 100 / 200 miles)

Clicking a hospital card opens a detail panel with the facility's rationale, real drive-time estimate, and a live-extracted list of specialist physicians.

**What happens under the hood:**

1. `POST /search_hospitals` is called with the diagnosis, user GPS coordinates, selected capabilities, travel limit, and radius.
2. The backend runs the following multi-step pipeline:
   - **You.com RAG API** is queried with a constructed natural-language search string (e.g. `"top hospitals near Orlando, FL treating lung adenocarcinoma with Interventional Radiology, 3T MRI"`).
   - If that query returns empty results, an **automatic retry** fires with a simplified query (diagnosis + location only, dropping capability constraints).
   - If You.com is unavailable entirely, **Gemini 2.5 Flash** acts as a fallback — generating a list of 5 real specialist hospitals for the diagnosis and location from its own knowledge.
   - All search results are passed through a **Gemini batch enrichment call** that cleans hospital names (strips service-level titles like "Imaging Services", resolves ambiguous domain names to institution names, removes duplicates) and writes 2–3 sentence rationales per facility.
   - **Geopy (Nominatim)** reverse-geocodes the user's GPS coordinates to a city/state string and forward-geocodes each hospital name to latitude/longitude.
   - **OSRM** (Open Source Routing Machine) calculates real driving ETAs from the user's location to each hospital.
3. When the physician **selects a specific hospital**, `POST /analyze_hospital_page` is triggered for that hospital only — cancelling any previous in-flight request via `AbortController` to avoid concurrent agent runs:
   - A **CrewAI sequential crew** of two agents is launched:
     - **Medical Intelligence Researcher** uses the YouCom Search Tool and JS-Aware Web Page Reader (via Jina.ai `r.jina.ai`) to find real physician names, credentials, and direct profile URLs. The 4-step strategy: read search snippet text for instant names → locate physician directory pages → scrape individual doctor profile pages → fall back to department head searches. Max 8 iterations; stops early once 3+ named physicians with credentials are confirmed.
     - **Precision Data Extractor** reads the researcher's report and outputs a validated JSON array of 3–5 physicians with: full name + title, exact specialty, all credentials (MD/PhD/FACS/board certifications), one-sentence clinical context, direct profile URL, and phone number.
   - Results are **cached in Zustand** — switching back to a previously viewed hospital reuses the cached data instantly.

**Outputs at the end of Step 3:**
- Interactive map with positioned hospital markers
- Ranked facility list with AI-generated rationales and real drive times
- Per-hospital named specialist physicians with credentials and direct profile links

---

### Step 4 — Referral Memo

**What the user does:**
A structured, formatted referral letter is auto-generated from all data collected across the prior three steps. The physician can copy it to clipboard or print it directly from the browser.

**What the memo contains:**
- **Patient summary** — age, diagnosis, and primary imaging findings from the CaseProfile
- **Historical evidence** — the matched twin case (diagnosis, outcome, treating facility) as supporting rationale
- **Referral destination** — selected hospital name with required facility capabilities listed explicitly
- **Clinical reasoning** — why the patient requires transfer, what the twin case outcome suggests, and the recommended workup pathway at the receiving facility

---

## Features

| Feature | Description |
|---|---|
| **Multimodal Case Search** | MedSiglip embeddings + Qdrant vector search across a chest X-ray dataset from published medical literature |
| **Agentic Case Building** | Natural-language conversation with Gemini 2.5 Flash progressively builds a structured CaseProfile in real time |
| **Visual Abnormality Mapping** | MedGemma returns bounding box coordinates for findings; rendered as SVG overlays on both the current and twin images |
| **Dual-Context Clinical Chat** | MedGemma answers grounded simultaneously in the twin case text and the current patient's CaseProfile |
| **Medical Term Explanation** | Select any phrase → MedGemma delivers a 1–2 sentence plain-language explanation in a popover |
| **Hospital Routing Pipeline** | You.com RAG → Gemini enrichment → Geopy geocoding → OSRM real drive-time estimates |
| **Smart Search Fallbacks** | Automatic retry with simplified query → Gemini-generated hospital list when You.com is unavailable |
| **Routing Criteria Filters** | Capability checkboxes, max travel time slider, and search radius dropdown sent to the backend |
| **Agentic Physician Discovery** | Two-agent CrewAI crew (researcher + extractor) with Jina.ai JS rendering for live hospital directory scraping |
| **Request Cancellation** | `AbortController` cancels previous agent calls when the user switches hospitals — no wasted compute |
| **Referral Memo Generation** | Printable referral letter auto-assembled from the CaseProfile, twin match, and selected hospital data |
| **Full Observability** | Every CrewAI agent run traced end-to-end in LangSmith |

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript 5.7, Vite 6, Tailwind CSS 3.4, Zustand 5 |
| **UI Components** | Radix UI primitives, Lucide React icons, React Markdown |
| **Maps** | React Leaflet 4.2, Leaflet 1.9, OpenStreetMap tiles |
| **Backend** | FastAPI, Uvicorn (ASGI), Python 3.11 |
| **HAI-DEF Models** | MedGemma (multimodal clinical LLM), MedSiglip (medical image encoder) — via HuggingFace Inference Endpoints |
| **General LLM** | Gemini 2.5 Flash (Google) — Agentic Copilot, hospital enrichment, fallback generation |
| **Agents** | CrewAI, LiteLLM, google-genai |
| **Vector DB** | Qdrant |
| **Observability** | LangSmith |
| **Web Search & Scraping** | You.com RAG API, Jina.ai reader (`r.jina.ai`) |
| **Geocoding / Routing** | Geopy (Nominatim), OSRM |
| **Infrastructure** | GCP Cloud Run, Docker (multi-stage builds), nginx 1.27, Google Cloud Storage |

---

## System Architecture

```
Browser
  │
  │  HTTPS
  ▼
┌──────────────────────────────────────────────────────────────┐
│                 nginx  (Cloud Run — port 80)                  │
│                 React SPA — static files served               │
│                                                               │
│   Stepper: [Upload] ──► [Matches] ──► [Route] ──► [Memo]      │
│   Zustand store  ·  React Leaflet map  ·  SVG overlays        │
└──────────────────────────┬───────────────────────────────────┘
                           │  REST  (VITE_API_URL)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│             FastAPI Backend  (Cloud Run — port 8000)          │
│                                                               │
│  POST /search           ──► MedSiglip embedding ──► Qdrant   │
│  POST /extract          ──► MedGemma (HF endpoint)           │
│  POST /compare_insights ──► MedGemma multimodal              │
│  POST /enhance_profile  ──► Gemini 2.5 Flash                 │
│  POST /chat_twin        ──► MedGemma + dual CaseProfile ctx  │
│  POST /explain_selection──► MedGemma                         │
│  POST /search_hospitals ──► You.com → Gemini → Geopy → OSRM  │
│  POST /analyze_hospital_page                                  │
│           └──► CrewAI Sequential Crew                         │
│                 ├─ Agent 1: Researcher (YouCom + Jina.ai)     │
│                 └─ Agent 2: Extractor  (JSON output)          │
└──────────────────────────────────────────────────────────────┘
          │                              │
 ┌────────┴──────────┐         ┌─────────┴──────────┐
 │  HuggingFace      │         │  Google Cloud APIs  │
 │  Inference        │         │  Gemini 2.5 Flash   │
 │  Endpoints        │         │  Cloud Storage      │
 │  ├─ MedGemma      │         │  Nominatim (Geopy)  │
 │  └─ MedSiglip     │         └────────────────────┘
 │         │         │
 │         ▼         │
 │      Qdrant       │
 │  (vector store)   │
 └───────────────────┘
```

---

## AI Components Deep Dive

### MedGemma — Multimodal Clinical LLM *(HAI-DEF)*

MedGemma is Google's open-weight model fine-tuned on medical imaging and clinical text. It is deployed via a HuggingFace Inference Endpoint and serves as the clinical reasoning core throughout CaseTwin:

- **Structured extraction** — parses radiology reports, discharge summaries, and clinical notes into a typed CaseProfile schema, understanding medical abbreviations and ICD terminology that generic models frequently misparse
- **Multimodal abnormality localisation** — given two chest X-ray images and a diagnosis, returns bounding box coordinates `[x, y, width, height]` for the primary finding in each image, enabling the SVG overlay visualisation
- **Case comparison analysis** — produces a structured clinical report covering imaging similarities, differences, progression risk, and recommended management — reasoning with learned medical priors rather than surface-level text matching
- **Dual-context clinical Q&A** — holds both the full historical twin case text and the current patient's structured CaseProfile in context simultaneously, allowing physicians to ask questions like "Would this patient respond to the same treatment regimen?" with both datasets in scope
- **Medical term explanation** — delivers 1–2 sentence plain-language definitions for any highlighted clinical phrase

### MedSiglip — Medical Vision Encoder *(HAI-DEF)*

MedSiglip is a medical vision-language model. CaseTwin uses its image encoder to produce 512-dimensional embeddings from chest X-ray images. These are stored in Qdrant at indexing time and queried at search time via cosine similarity.

The medical fine-tuning is critical: a general-purpose CLIP model trained on natural images does not understand that bilateral perihilar opacification is more similar to another case of pulmonary oedema than it is to a unilateral pleural effusion. MedSiglip embeds clinically meaningful similarity — the search results reflect shared pathology, not just shared visual texture.

### Gemini 2.5 Flash — General Intelligence Layer

Used for tasks requiring fast instruction-following and general world knowledge rather than medical fine-tuning:
- **Agentic Copilot** — builds the CaseProfile conversationally from physician natural-language input
- **Hospital enrichment** — cleans raw You.com search results into proper institution names and writes clinical rationales
- **Fallback hospital generation** — when You.com is unavailable, Gemini generates a location- and diagnosis-aware list of real specialist hospitals

### CrewAI Physician Discovery Agents

Two agents run sequentially, powered by Gemini 2.5 Flash via LiteLLM:

**Agent 1 — Medical Intelligence Researcher**
- Tools: YouCom Search Tool (results ranked by doctor-name signal strength), JS-Aware Web Page Reader (Jina.ai `r.jina.ai` for JavaScript-rendered hospital directories)
- 4-step strategy: scan search snippets for instant physician names → locate physician directory pages → scrape individual doctor profile URLs → fall back to department head searches
- Max 8 iterations; terminates early once 3+ named physicians with credentials are confirmed

**Agent 2 — Precision Data Extractor**
- No tools — operates solely on the researcher's compiled report
- Produces a validated JSON array of 3–5 physicians: full name + title, exact specialty, credentials (MD/PhD/FACS/board certs), one-sentence clinical context, direct profile URL, phone number
- Strict hallucination guard: only includes individuals whose last names appear verbatim in the research report

All agent executions are traced end-to-end in **LangSmith** for debugging and quality monitoring.

---

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- A running Qdrant instance ([Qdrant Cloud](https://cloud.qdrant.io) free tier or local via Docker)
- HuggingFace Inference Endpoints for MedSiglip and MedGemma (endpoints must be in **Running** state)
- API keys — see [Environment Variables](#environment-variables)

### 1. Clone the repository

```bash
git clone https://github.com/your-org/casetwin.git
cd casetwin
```

### 2. Frontend

```bash
npm install
# create a .env file with:
# VITE_API_URL=http://localhost:8000
npm run dev        # → http://localhost:5173
```

### 3. Backend

```bash
cd backend
pip install -r requirements.txt

# create backend/.env with all keys listed below
uvicorn case_twin__backend__main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Production build

```bash
# Frontend — outputs to dist/
npm run build

# Backend — production server
cd backend && uvicorn case_twin__backend__main:app --host 0.0.0.0 --port 8000
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Google AI Studio / Gemini API key |
| `YDC_API_KEY` | ✅ | You.com web search API key |
| `QDRANT_URL` | ✅ | Qdrant cluster endpoint URL |
| `QDRANT_API_KEY` | ✅ | Qdrant API key |
| `COLLECTION_NAME` | ✅ | Qdrant collection name (e.g. `chest_xrays`) |
| `HF_TOKEN` | ✅ | HuggingFace access token |
| `MEDSIGLIP_ENDPOINT` | ✅ | HuggingFace Inference Endpoint URL for MedSiglip |
| `MEDGEMMA_ENDPOINT` | ✅ | HuggingFace Inference Endpoint URL for MedGemma |
| `LANGCHAIN_API_KEY` | ⬜ | LangSmith API key for agent tracing |
| `LANGCHAIN_PROJECT` | ⬜ | LangSmith project name (default: `casetwin`) |
| `GCS_BUCKET_NAME` | ⬜ | Google Cloud Storage bucket for image hosting |
| `GCS_PROJECT_ID` | ⬜ | GCP project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | ⬜ | Path to GCP service account JSON |
| `ALLOWED_ORIGINS` | ⬜ | Comma-separated CORS origins for production |

### Frontend (`.env` / `.env.production`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ prod | Backend base URL. Falls back to `http://localhost:8000` in dev. |

> `.env.production` is committed to the repo (it contains no secrets — only the Cloud Run backend URL) so GCP Cloud Build can access it during the Docker build and bake `VITE_API_URL` into the frontend bundle at build time.

---

## Deployment

Both services run as separate **GCP Cloud Run** containers. `gcloud run deploy --source` triggers a remote Docker build via Cloud Build — no local Docker daemon required.

### Backend

Uses a **multi-stage Dockerfile**: a builder stage installs all Python packages (including those requiring gcc/build-essential), then a clean slim runtime stage copies only the compiled packages — keeping the final image lean and free of compiler toolchains.

```bash
gcloud run deploy casetwin-backend \
  --source ./backend \
  --region us-central1 \
  --port 8000 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --min-instances 0 \
  --allow-unauthenticated \
  --env-vars-file backend/env.yaml
```

### Frontend

Uses a **two-stage Dockerfile**: Node 20 Alpine builds the React app, then nginx 1.27 Alpine serves the static output. `VITE_API_URL` is baked in at build time from `.env.production`.

```bash
gcloud run deploy casetwin-frontend \
  --source . \
  --region us-central1 \
  --port 80 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --allow-unauthenticated
```

### Secrets

Backend environment variables are stored in `backend/env.yaml` (gitignored). Pass them at deploy time with `--env-vars-file backend/env.yaml`:

```yaml
# backend/env.yaml  — gitignored, never commit this file
GEMINI_API_KEY: "..."
YDC_API_KEY: "..."
QDRANT_URL: "..."
QDRANT_API_KEY: "..."
# ... remaining keys
```

---

## License

This project is licensed under the [MIT License](case_twin__LICENSE).
