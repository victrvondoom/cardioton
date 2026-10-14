# MedScribe — Federated Clinical Intelligence Platform

> AI-powered clinical documentation for healthcare providers. Built for the **[Axxess Hackathon 2026](https://www.axxess.com/hackathon)** at the University of Texas at Dallas.

MedScribe listens to doctor–patient conversations, transcribes and translates them in real time, generates structured SOAP notes with ICD-10 codes and risk stratification, and continuously improves its on-device ASR model through privacy-preserving federated learning — all while keeping Protected Health Information (PHI) strictly on-device.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Full Data Pipeline](#full-data-pipeline)
- [Federated Learning Pipeline](#federated-learning-pipeline)
- [Differential Privacy](#differential-privacy)
- [Database Schema](#database-schema)
- [FHIR Export](#fhir-export)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Building for Production](#building-for-production)
- [Supported Specialties](#supported-specialties)
- [Supported Languages](#supported-languages)
- [HIPAA Considerations](#hipaa-considerations)
- [License](#license)

---

## Features

### Clinical Documentation
- **Real-time transcription** — live speech-to-text during clinical encounters via `expo-speech-recognition`
- **Dual ASR pipeline** — Gemini 2.5 Pro (cloud) and Whisper Small (on-device) run in parallel; differences feed the federated learning system
- **Multilingual support** — 12 languages with automatic detection and translation; patient summaries generated in the patient's native language
- **AI-generated SOAP notes** — structured Subjective / Objective / Assessment / Plan via Gemini 2.5 Pro
- **ICD-10 coding** — automatic diagnosis code suggestions with confidence scores and full code descriptions
- **Risk stratification** — urgency classification (routine / urgent / emergent) plus clinical risk factor extraction
- **Medication tracking** — current, newly prescribed, and discontinued medications extracted from the transcript
- **Contradiction detection** — surfaces conflicts between current and previous visit notes
- **Patient-language discharge summaries** — plain-language instructions at a 6th-grade reading level in the patient's language

### Privacy & Security
- Local SQLite database (WAL mode) — audio and PHI never leave the device
- Biometric lock (Face ID / Fingerprint) via `expo-local-authentication`
- Configurable data retention (default 90 days, daily auto-cleanup)
- Full audit log for every significant event
- PHI stripping + text hashing before any FL upload

### Interoperability
- FHIR R4 bundle export (Patient, Encounter, DocumentReference, Condition, Observation)
- Native Share sheet integration for EMR hand-off

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Expo](https://expo.dev) ~54 (React Native 0.81) |
| Language | TypeScript ~5.9 |
| Navigation | Expo Router v6 (file-based) |
| AI — Cloud | Google Gemini 2.5 Pro API |
| AI — On-device | [whisper.rn](https://github.com/mybigday/whisper.rn) 0.5.5 (ggml-small, 466 MB) |
| FL Backend | Firebase Firestore 12.9 (round coordination + signal aggregation) |
| Local Database | expo-sqlite 16 (SQLite with WAL + foreign keys) |
| Settings | AsyncStorage (device ID + user preferences) |
| Audio | expo-speech-recognition 3.1 + expo-av |
| File I/O | expo-file-system |
| Biometric Auth | expo-local-authentication |
| Icons | @expo/vector-icons (Ionicons) |

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          MedScribe App (Expo Router)                  │
│                                                                        │
│   ┌────────────┐  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │
│   │  Dashboard │  │   Session   │  │   History    │  │Federation │  │
│   │ (index.tsx)│  │(session.tsx)│  │(sessions.tsx)│  │(federation│  │
│   └────────────┘  └──────┬──────┘  └──────────────┘  │   .tsx)   │  │
│                           │                            └─────┬─────┘  │
│              ┌────────────▼───────────────┐                  │        │
│              │      useActiveSession       │                  │        │
│              │  (session lifecycle hook)   │                  │        │
│              └──┬────────────┬────────────┘                  │        │
│                 │            │                                │        │
│         ┌───────▼──┐  ┌──────▼──────┐   ┌───────────────────▼──────┐ │
│         │ gemini.ts│  │ whisper.ts  │   │      fl/service.ts        │ │
│         │  Cloud   │  │  On-device  │   │  FL round mgmt + DP +     │ │
│         │  ASR +   │  │ ASR (ggml-  │   │  Firebase coordination    │ │
│         │ note gen │  │   small)    │   └───────────┬──────────────┘ │
│         └────┬─────┘  └──────┬──────┘               │                │
│              │               │                Firebase Firestore       │
│         ┌────▼───────────────▼────┐          fl_rounds                │
│         │    axxess__modules_db__queries.ts (SQLite)   │          fl_signals               │
│         │  sessions / utterances / │          fl_adapters              │
│         │  notes / audit_logs / fl │          fl_devices               │
│         └─────────────────────────┘                                   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Full Data Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       CLINICAL SESSION PIPELINE                          │
└─────────────────────────────────────────────────────────────────────────┘

  1. START SESSION
     └─ useActiveSession creates session row in SQLite
        expo-speech-recognition begins streaming live partials to the UI

  2. PARALLEL TRANSCRIPTION (on session stop)
     ├─ [Gemini 2.5 Pro] Audio → base64 → Gemini API
     │    Returns: speaker-attributed segments, entity tags, language detection,
     │             ICD-10 suggestions, translation to English
     │
     └─ [Whisper Small] Audio → ggml inference (on-device, offline)
          Returns: raw English transcript (auto-detected language → English)

  3. DELTA EXTRACTION → FL SIGNAL
     Gemini result vs. Whisper result are compared word-by-word.
     Differences become TrainingSignal records of type:
       · correction           — Whisper word corrected by Gemini/clinician
       · low_confidence       — Whisper confidence < threshold
       · entity_correction    — medical entity term correction
       · icd_feedback         — ICD-10 code refinement
       · approved_transcription — clinician-approved final text

  4. REVIEW & APPROVE
     Clinician reviews the transcript in the UI, makes any edits.
     Final approved text is saved to SQLite (utterances table).

  5. SOAP NOTE GENERATION
     Approved transcript → Gemini 2.5 Pro →
       · SOAP note (Subjective / Objective / Assessment / Plan)
       · ICD-10 codes with descriptions and confidence
       · Medications (current / new / discontinued)
       · Risk factors + urgency level (routine / urgent / emergent)
       · Vital signs extracted from conversation
       · Patient summary in patient's language (6th-grade reading level)
     Saved to SQLite notes table via upsertNote() (prevents duplicates).

  6. OPTIONAL EXPORT
     FHIR R4 bundle generated from session + note + utterances.
     Shared via native Share sheet or EMR integration.

  7. FL SIGNAL UPLOAD (background, on next FL round)
     PHI stripped → text hashed → signals uploaded to Firebase.
     See Federated Learning Pipeline below.
```

---

## Federated Learning Pipeline

MedScribe implements a privacy-preserving federated learning system to continuously improve the on-device Whisper ASR model without centralizing patient data.

### Overview

```
  Device A                 Device B                Firebase (FL Coordinator)
     │                        │                            │
     │── record signals ──▶   │                            │
     │   (hash + strip PHI)    │── record signals ──▶      │
     │                        │   (hash + strip PHI)        │
     │                        │                            │
     │── startNewRound() ─────────────────────────────▶   │
     │   Phase: training                                    │
     │   Phase: uploading (de-identified signals)           │
     │                        │── startNewRound() ──────▶  │
     │   Phase: merging            ┌──────────────────────┐ │
     │◀─ adapter delta ──────      │  FedAvg aggregation  │ │
     │   (LoRA weights)            │  (Cloud Function in  │ │
     │   Phase: complete           │  production)         │ │
     │                        │   └──────────────────────┘ │
     │                        │◀─ adapter delta ───────────│
```

### Round Phases

Each FL round progresses through the following phases tracked in Firestore (`fl_rounds` collection):

| Phase | Description |
|---|---|
| `waiting` | Collecting training signals from sessions |
| `training` | Round initiated, adapter training begins |
| `uploading` | De-identified signals written to `fl_signals` collection |
| `merging` | Cross-device signals aggregated via FedAvg |
| `complete` | Updated LoRA adapter written to `fl_adapters/current` |

### Training Signals

Signals are collected locally after every session and stored in memory until the next FL round:

```typescript
type TrainingSignal = {
  type: 'correction' | 'low_confidence' | 'entity_correction'
      | 'icd_feedback' | 'approved_transcription';
  original_text: string;  // hashed at collection time — raw text discarded
  corrected_text: string; // PHI-stripped correction delta
  confidence: number;
  specialty: string;      // specialty cluster routing
}
```

### Privacy Transforms (Applied Before Upload)

1. **PHI Stripping** — regex scrubbing removes: phone numbers, SSNs, dates, email addresses, 6+ digit ID numbers, and names following common titles (Dr., Mr., Mrs., Ms.)
2. **Text Hashing** — original transcript text is replaced with a non-reversible hash at collection time; raw text is never stored in Firebase
3. **Double-scrub** — PHI stripping runs a second time on corrected text immediately before upload

### LoRA Adapter (Parameter-Efficient Fine-Tuning)

The FL system updates a Low-Rank Adaptation (LoRA) layer on top of the Whisper Small base model rather than retraining the full model:

| Parameter | Value |
|---|---|
| Rank (r) | 8 |
| Alpha (α) | 16 |
| Trainable parameters | 294,912 |
| Compression ratio | ~0.1% of Whisper Small total params |
| Target modules | Attention projection layers |
| Adapter storage | `fl_adapters/current` (Firestore) |

### Privacy Guarantee

| What IS uploaded | What is NOT uploaded |
|---|---|
| Hashed original text (non-reversible) | Raw transcript text |
| PHI-stripped correction deltas | SOAP note content |
| Signal type + confidence score | Patient names or demographics |
| Specialty cluster | Audio recordings |
| Device ID (pseudonymous) | ICD-10 codes or diagnoses |
| Word count / section lengths | Any Protected Health Information |

After every completed round, a **Privacy Receipt** is generated locally. The receipt includes the epsilon consumed, clipping norm, noise multiplier, a list of all items NOT transmitted, and a hash of the round payload — giving clinicians a tamper-evident record of what happened.

### Epsilon Budget

Each device maintains a cumulative privacy budget:

| Parameter | Value |
|---|---|
| Total ε budget | 12.0 |
| Per-round ε | 0.3 – 0.7 (sampled per round) |
| δ | 0.00001 |

Once the budget is exhausted the device stops contributing to FL rounds.

---

## Differential Privacy

Before any gradient or signal data is uploaded, Gaussian noise is injected using the standard DP-SGD formulation:

```
σ = sensitivity × √(2 × ln(1.25 / δ)) / ε
```

**Parameters:** `sensitivity = 1.0`, `ε ∈ [0.3, 0.7]`, `δ = 0.00001`

Gradients are first **clipped** to `[-1, 1]` (clipping norm = 1.0) before noise is applied:

```typescript
// From src/modules/fl/service.ts
export function applyDifferentialPrivacy(gradients: number[], epsilon: number): number[] {
    const sensitivity = 1.0;
    const sigma = sensitivity * Math.sqrt(2 * Math.log(1.25 / 0.00001)) / epsilon;

    return gradients.map((g) => {
        const clipped = Math.max(-1, Math.min(1, g));          // gradient clipping
        const noise = gaussianNoise(0, sigma);                  // Box-Muller sampling
        return clipped + noise;
    });
}
```

Gaussian noise is sampled via the **Box-Muller transform** (no Web Crypto dependency, runs in React Native):

```typescript
function gaussianNoise(mean: number, stddev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return mean + stddev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
```

---

## Database Schema

All PHI is stored exclusively in on-device SQLite with WAL mode and foreign key enforcement.

```
┌──────────────┐        ┌───────────────────────────────────────┐
│   sessions   │        │              notes                     │
├──────────────┤        ├───────────────────────────────────────┤
│ session_id   │──1:1──▶│ session_id (FK)                       │
│ patient_name │        │ soap_note                             │
│ specialty    │        │ icd_codes (JSON)                      │
│ language     │        │ medications (JSON)                    │
│ started_at   │        │ risk_factors (JSON)                   │
│ ended_at     │        │ urgency_level                         │
│ status       │        │ full_result_json  ← ClinicalNoteResult│
└──────────────┘        │ translated_summary                    │
        │               │ translated_summary_lang               │
        │               └───────────────────────────────────────┘
        │
        ├──1:N──▶ utterances (transcript segments, speaker labels)
        ├──1:N──▶ entities   (extracted medical entities per utterance)
        ├──1:N──▶ fl_log     (FL round participation history)
        └──1:N──▶ audit_logs (full audit trail of all significant events)
```

Column migrations (ALTER TABLE) run automatically at startup — no destructive schema changes.

---

## FHIR Export

MedScribe generates [FHIR R4](https://www.hl7.org/fhir/R4/) compliant bundles for EMR integration, assembled in `src/modules/fhir/generator.ts`.

**Bundle type:** `document`

**Resources included:**

| Resource | Content |
|---|---|
| `Patient` | Pseudonymous ID derived from session UUID, preferred language |
| `Encounter` | Specialty, start/end time, ICD-10 reason codes |
| `DocumentReference` | Full SOAP note encoded as `text/plain` base64 |
| `Condition` | One resource per ICD-10 code extracted from the note |
| `Observation` | Up to 20 utterance segments from the transcript |

Export is available from the Dashboard (Export button) and the Note Review screen via the native Share sheet.

---

## Project Structure

```
medscribe/
├── app/                          # Expo Router — all screens (file-based routing)
│   ├── _layout.tsx               # Root layout + biometric auth gate
│   ├── note-review.tsx           # Full note viewer, translate, FHIR export
│   ├── patient-profile.tsx       # Patient profile view
│   └── (tabs)/
│       ├── index.tsx             # Dashboard — recent sessions, quick stats
│       ├── session.tsx           # Recording + live transcript + note generation
│       ├── sessions.tsx          # Session history, search, filter
│       ├── federation.tsx        # FL dashboard: rounds, accuracy chart, privacy receipts
│       └── settings.tsx          # Specialty, language, biometric, data retention
│
├── src/
│   ├── config/
│   │   └── firebase.ts           # Firestore init (reads EXPO_PUBLIC_* env vars)
│   ├── hooks/
│   │   └── useActiveSession.ts   # Full session lifecycle state machine
│   ├── modules/
│   │   ├── ai/
│   │   │   ├── gemini.ts         # Gemini 2.5 Pro — ASR, SOAP notes, translation
│   │   │   └── whisper.ts        # whisper.rn — on-device ggml-small inference
│   │   ├── db/
│   │   │   ├── schema.ts         # SQLite schema + automatic column migrations
│   │   │   └── axxess__modules_db__queries.ts        # All CRUD (upsertNote, updateNoteTranslation, …)
│   │   ├── fhir/
│   │   │   └── generator.ts      # FHIR R4 bundle assembly
│   │   └── fl/
│   │       └── service.ts        # FL round management, DP, privacy receipts
│   ├── stores/
│   │   └── settingsStore.ts      # AsyncStorage — settings persistence
│   └── types/
│       └── index.ts              # Shared TypeScript interfaces
│
├── components/
│   └── ui/                       # Header, Card, Badge, Button, StatusDot
├── constants/                    # Colors, Typography, Spacing, Radius, Shadows
├── assets/                       # Fonts, images, app icon
│
├── .env.example                  # Template — copy to .env and fill in keys
├── app.json                      # Expo configuration (bundle ID, SDK version)
├── package.json
└── tsconfig.json
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18 or newer
- An Android device or emulator (physical device recommended for Whisper performance)
- A [Google AI Studio](https://aistudio.google.com/apikey) account for the Gemini API key
- A [Firebase](https://console.firebase.google.com) project with Firestore enabled

### 1. Clone the repository

```bash
git clone https://github.com/BryanLim0214/Axxess.git
cd Axxess
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your Gemini and Firebase credentials (see [Environment Variables](#environment-variables)).

### 4. Set up Firebase Firestore

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Firestore Database** (start in test mode for development)
3. Copy the Web App config values into your `.env` file
4. The following collections are created automatically on first FL round:
   - `fl_rounds` — per-round status and accuracy metrics
   - `fl_signals` — de-identified training signals from all devices
   - `fl_adapters` — LoRA adapter version history
   - `fl_devices` — per-device metrics and epsilon budget
   - `fl_approved_data` — curated approved transcription data

### 5. Run the app

```bash
npx expo start
# then press 'a' for Android, 'i' for iOS, or scan the QR code with Expo Go
```

> **Note:** The Whisper ggml-small model (~466 MB) downloads automatically on first recording. This requires Wi-Fi and may take several minutes.

---

## Environment Variables

Copy `.env.example` → `.env`. **Never commit the `.env` file** (it is in `.gitignore`).

```env
# Google Gemini API — https://aistudio.google.com/apikey
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here

# Firebase — https://console.firebase.google.com → Project Settings → Your apps
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

All variables use the `EXPO_PUBLIC_` prefix so Expo's Metro bundler inlines them at build time.

---

## Running the App

```bash
# Development server (Expo Go / emulator)
npx expo start

# Run directly on connected Android device
npx expo run:android

# Run directly on iOS simulator
npx expo run:ios
```

---

## Building for Production

MedScribe uses [EAS Build](https://docs.expo.dev/build/introduction/) for production builds.

```bash
npm install -g eas-cli
eas login
eas build:configure

# Preview APK (direct install)
eas build --platform android --profile preview

# Production App Bundle (Play Store)
eas build --platform android --profile production
```

> Set `EXPO_PUBLIC_*` values as **EAS secrets** rather than committing them. See the [EAS environment variables guide](https://docs.expo.dev/build-reference/variables/).

---

## Supported Specialties

| Specialty | Gemini prompt tuning |
|---|---|
| Cardiology | Cardiac terminology, EKG findings, hemodynamic parameters |
| Emergency Medicine (ER) | Fast-track documentation, triage urgency, trauma vocabulary |
| General Practice | Broad clinical vocabulary, preventive care, referral language |
| Hospice | Comfort-care focus, palliative ICD codes, goals-of-care documentation |
| Palliative Care | DNR/DNI documentation, symptom burden, quality-of-life assessment |

---

## Supported Languages

| Language | ISO Code |
|---|---|
| English | `en` |
| Spanish | `es` |
| Arabic | `ar` |
| Haitian Creole | `ht` |
| Vietnamese | `vi` |
| Russian | `ru` |
| French | `fr` |
| Chinese (Mandarin) | `zh` |
| Portuguese | `pt` |
| Korean | `ko` |
| Japanese | `ja` |
| Khmer | `km` |

Patient-facing summaries are generated directly in the patient's language. All SOAP notes and ICD-10 documentation are produced in English.

---

## HIPAA Considerations

> **Disclaimer:** MedScribe is a hackathon prototype and has not undergone a formal HIPAA compliance audit. The following measures are implemented as a foundation for production hardening.

| Control | Implementation |
|---|---|
| PHI stays on-device | Audio and transcripts stored in local SQLite only; never uploaded |
| Biometric lock | `expo-local-authentication` (Face ID / Fingerprint / device passcode fallback) |
| Data retention | Configurable auto-deletion (default 90 days, runs daily) |
| Audit log | Every significant event written to `audit_logs` SQLite table |
| PHI stripping | Regex-based scrubbing of phones, SSNs, dates, emails, ID numbers, names |
| Text hashing before upload | Original transcript text hashed; raw content discarded before FL upload |
| Differential privacy | Gaussian noise injection + gradient clipping on all uploaded signals |

**Known gaps for production:**
- SQLite is not encrypted at rest (SQLCipher integration planned)
- Text hashing uses a custom polynomial function, not a cryptographic hash
- Firebase security rules should be restricted from test mode before deployment

---

## License

Created for the **[Axxess Hackathon 2026](https://www.axxess.com/hackathon)** at the University of Texas at Dallas. All rights reserved.

---

*Built with Gemini 2.5 Pro · Whisper Small (whisper.rn) · Firebase Firestore · Expo 54*
