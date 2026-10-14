# Memento Clinician Feature Brief: Medication Review Signals

## Purpose

Memento should add a clinician-facing layer that flags when a specific patient may warrant medication or treatment-plan review based on longitudinal trends collected from daily calls.

This feature should **not** prescribe, diagnose, or recommend a specific medication change. It should surface evidence-backed review signals such as:

- Diagnostic Review Signal
- Treatment Eligibility Review Signal
- Adherence Review Signal
- Tolerability Review Signal
- Effectiveness Review Signal
- Titration Checkpoint Candidate
- Urgent Safety Review

The clinician decides whether the right action is to increase dose, hold dose, reduce dose, switch medication, start medication, investigate side effects, or order more evaluation.

---

## Product Boundary

### Memento can say

> “This patient may warrant medication review because sustained memory and language deviations were detected despite mostly confirmed adherence.”

> “This patient is a titration checkpoint candidate because they are below a clinician-defined target dose, due for review, mostly adherent, and showing sustained below-baseline cognitive trends without tolerability flags.”

### Memento should not say

> “Increase donepezil.”

> “The current medication is failing.”

> “The patient needs dementia medication.”

> “The patient is getting worse.”

The clinical output should always be framed as **review support**, not autonomous recommendation.

---

## Why This Feature Exists

Dementia care has long gaps between clinic visits. Memento already collects daily cognition, speech, function, medication adherence, mood, safety, and engagement signals. The clinician-facing medication review layer turns those raw signals into a more useful question:

> “Is there a pattern here that a clinician should review?”

This is stronger than showing a single low KPI. A dementia specialist would consider several domains together:

1. Is there sustained cognitive change?
2. Is the patient taking medication reliably?
3. Did symptoms change after a medication start or dose change?
4. Are there tolerability or safety concerns?
5. Is there a non-medication explanation like poor sleep, illness, stress, bad audio, or missed medication?
6. Is the patient diagnosed and/or currently on medication?

---

## Key Data Inputs

### Patient Clinical Profile

```ts
type PatientClinicalProfile = {
  patientId: string;
  confirmedDiagnosis: boolean;
  diagnosisType?: "MCI" | "Alzheimers" | "vascular_dementia" | "lewy_body" | "frontotemporal" | "other" | "unknown";
  diagnosisStage?: "MCI" | "early" | "moderate" | "severe" | "unknown";

  currentDementiaMedication?: {
    medicationName: string;
    currentDose: string;
    medicationSchedule?: string;
    startDate: string;
    lastDoseChangeDate?: string;
    clinicianTargetDose?: string;
    nextReviewDate?: string;
    prescriberName?: string;
  };

  baselineMode: boolean;
  baselineCompletedAt?: string;
  caregiverMedicationSupport?: boolean;
};
```

### Daily KPI Result

```ts
type DailyKpiResult = {
  patientId: string;
  callId: string;
  date: string;

  fluency_count: number;
  story_recall_count: number;
  story_recall_speaking_time: number;
  naming_accuracy: number;
  word_finding_failures: number;
  immediate_recall: number;
  delayed_recall_words: number;
  orientation_score: number;
  stop_word_fraction: number;
  repetition_count: number;
  cross_session_recall: boolean;

  medication_status: "Confirmed" | "Uncertain" | "Missed";
  mood_classification: "Cheerful" | "Neutral" | "Flat" | "Anxious" | "Agitated";
  sleep_quality?: "Good" | "Fair" | "Poor" | "Unknown";

  safety_flag: boolean;
  safety_flag_type?: "fall" | "wandering" | "distress" | "confusion" | "request_for_help" | "other";

  call_completed: boolean;
  call_duration_seconds?: number;
  patient_note?: string;
  call_quality_issue?: boolean;
};
```

---

## Important KPI Domains for Medication Review

### 1. Memory Trajectory

Most important KPIs:

- `story_recall_count`
- `story_recall_speaking_time`
- `delayed_recall_words`
- `cross_session_recall`

Why this matters:

Delayed recall and episodic memory are among the highest-value signals for Alzheimer’s-type progression. For medication review, a sustained drop in story recall and delayed word recall should carry more weight than a single bad fluency score.

Demo pattern:

- Mary’s story recall baseline: 7/10
- Recent calls: 4/10, 3/10, 3/10
- Delayed word recall baseline: 2.5/3
- Recent calls: 1/3, 1/3, 0/3

This should produce a strong **cognitive trajectory concern**.

---

### 2. Language and Executive Function

Most important KPIs:

- `fluency_count`
- `naming_accuracy`
- `word_finding_failures`
- `stop_word_fraction`
- `repetition_count`
- coherence / topic tracking if available

Why this matters:

Verbal fluency, object naming, and word-finding patterns are strong language/executive signals. They are useful when combined with memory decline because they show broader cognitive change rather than one isolated weak task.

Demo pattern:

- Mary’s fluency baseline: 14 animals
- Today: 8 animals
- Word-finding failures baseline: 1
- Today: 4 or 5
- Stop-word fraction baseline: 0.41
- Today: 0.58

This should support an **effectiveness review** or **titration checkpoint candidate** if adherence is confirmed and no tolerability flags exist.

---

### 3. Medication Adherence

Most important KPIs:

- `medication_status`
- 7-day confirmed adherence rate
- consecutive uncertain or missed days

Why this matters:

Adherence is a gate. If the patient is missing medication or is uncertain, Memento should not classify the issue as poor medication effectiveness. The first signal should be adherence review.

Demo pattern:

- Medication status: Uncertain for 2 consecutive calls
- Confirmed adherence rate: 4/7 days

Output:

> **Adherence Review Signal**
> Mary was uncertain whether she took her medication on two consecutive days. Review medication support before interpreting medication effectiveness.

---

### 4. Tolerability and Safety

Most important KPIs/signals:

- `safety_flag`
- falls
- wandering
- acute confusion
- agitation
- dizziness / faintness if captured
- appetite or GI complaint if captured
- sleep disruption
- call completion drop after medication change
- new mood change after medication start or dose change

Why this matters:

Tolerability is a hard stop for titration logic. If a patient recently started or changed medication and then shows falls, dizziness, confusion, agitation, sleep disruption, appetite changes, or reduced engagement, the system should surface tolerability review, not dose increase review.

Demo pattern:

- Medication changed 8 days ago
- Mood changed from Neutral to Agitated
- Patient mentions feeling dizzy or almost falling
- Call completion rate dropped

Output:

> **Tolerability Review Signal**
> Recent medication change plus new safety or mood concerns. Review tolerability before considering any dose escalation.

---

### 5. Orientation and Acute Change

Most important KPIs:

- `orientation_score`
- implicit disorientation during routine questions
- sudden confusion about date, place, schedule, or care circle

Why this matters:

Orientation collapse should be treated as a safety/acute-change gate, not merely as part of a weighted cognitive score. Sudden disorientation could reflect delirium, infection, missed medication, medication side effect, dehydration, sleep disruption, or acute progression.

Demo pattern:

- Baseline orientation: 4/4
- Last two calls: 1/4, 0/4
- Patient expresses confusion about location or schedule

Output:

> **Urgent Safety Review**
> Sudden orientation decline detected. Immediate clinical review recommended.

---

### 6. Context and Confounders

Most important inputs:

- `patient_note`
- poor sleep
- illness
- stressor
- travel
- interrupted call
- hearing issue
- call quality issue
- caregiver note if available

Why this matters:

Context prevents false positives. If Mary says she slept badly because of a storm, the system should still log the below-baseline score but downgrade confidence or add context to the clinician card.

Demo pattern:

- Fluency and recall are below baseline
- Mary adds: “I was tired because of the storm.”

Output should include the signal but show context:

> Patient context: Mary reported poor sleep due to storm. Interpret today’s deviation with caution.

---

## Combined Medication Review Model

Do not build one black-box score. Build four transparent sub-scores, then classify the signal.

### Sub-score 1: Cognitive Trajectory Score

Purpose:

> Is there sustained cognitive decline from this patient’s own baseline?

Suggested weighting:

| Component | Weight |
|---|---:|
| Delayed memory: story recall + delayed word recall | 35% |
| Semantic fluency | 20% |
| Object naming + word-finding failures | 15% |
| Orientation | 15% |
| Paralinguistic/coherence: stop words, speaking time, repetition | 15% |

Suggested threshold:

```ts
sustainedCognitiveDecline =
  cognitiveTrajectoryScore <= -0.20 for 2 consecutive calls ||
  cognitiveTrajectoryScore <= -0.15 for 3 of last 5 calls ||
  twoOrMoreCoreDomainsBelowBaselineForTwoConsecutiveCalls;
```

Core domains:

```ts
const coreDomains = [
  "delayed_memory",
  "semantic_fluency",
  "naming_word_finding",
  "orientation",
  "paralinguistic_coherence"
];
```

---

### Sub-score 2: Adherence Confidence Score

Purpose:

> Can the clinician reasonably interpret medication effectiveness?

Suggested logic:

| Pattern | Interpretation |
|---|---|
| Confirmed 6–7 of last 7 days | High adherence confidence |
| Confirmed 4–5 of last 7 days | Moderate adherence confidence |
| Uncertain or missed for 2 consecutive days | Low adherence confidence |
| 3+ uncertain/missed in 7 days | Low adherence confidence |

If adherence confidence is low, suppress `effectiveness_review_signal` and `titration_checkpoint_candidate`. Output `adherence_review_signal` instead.

---

### Sub-score 3: Tolerability and Safety Risk Score

Purpose:

> Could symptoms be related to a medication side effect or acute safety issue?

Suggested logic:

| Pattern | Output |
|---|---|
| Fall, wandering, severe distress, request for help | `urgent_safety_review` |
| Full disorientation or sudden orientation collapse | `urgent_safety_review` |
| Recent medication change + new dizziness/fall/sleep/appetite/GI/mood/confusion signal | `tolerability_review_signal` |
| New agitation | Same-day `tolerability_review_signal` or `urgent_safety_review` depending severity |

This score should act as a gate. If tolerability/safety risk is moderate or high, do not output titration checkpoint.

---

### Sub-score 4: Context / Confounder Score

Purpose:

> Is there a plausible non-medication explanation for today’s deviation?

Suggested logic:

| Context | Effect |
|---|---|
| Poor sleep, illness, storm, stress, travel | Downgrade confidence |
| Bad call quality or interrupted call | Mark signal as low-confidence |
| Patient/caregiver note explains deviation | Add to clinician card |
| No confounders over several days | Increase confidence |

---

## Final Classifier

```ts
type MedicationReviewSignalType =
  | "none"
  | "diagnostic_review_signal"
  | "treatment_eligibility_review_signal"
  | "adherence_review_signal"
  | "tolerability_review_signal"
  | "effectiveness_review_signal"
  | "titration_checkpoint_candidate"
  | "urgent_safety_review";

function classifyMedicationReviewSignal(patient, today, trends) {
  if (patient.baselineMode && !today.safety_flag) {
    return "none";
  }

  if (trends.safetyRiskHigh || trends.fullDisorientation || today.safety_flag) {
    return "urgent_safety_review";
  }

  if (!patient.confirmedDiagnosis && trends.sustainedCognitiveDecline) {
    return "diagnostic_review_signal";
  }

  if (patient.confirmedDiagnosis && !patient.currentDementiaMedication && trends.sustainedCognitiveDecline) {
    return "treatment_eligibility_review_signal";
  }

  if (patient.currentDementiaMedication && trends.adherenceConfidence === "low") {
    return "adherence_review_signal";
  }

  if (patient.currentDementiaMedication && trends.medicationChangedRecently && trends.tolerabilityRisk !== "low") {
    return "tolerability_review_signal";
  }

  if (
    patient.currentDementiaMedication &&
    trends.sustainedCognitiveDecline &&
    trends.adherenceConfidence === "high" &&
    trends.tolerabilityRisk === "low"
  ) {
    if (
      patient.currentDementiaMedication.clinicianTargetDose &&
      patient.currentDementiaMedication.currentDose !== patient.currentDementiaMedication.clinicianTargetDose &&
      isDueForReview(patient.currentDementiaMedication.nextReviewDate)
    ) {
      return "titration_checkpoint_candidate";
    }

    return "effectiveness_review_signal";
  }

  return "none";
}
```

---

## Clinician-Facing UI Card

### Card title

**Medication Review Signal**

### Example: Titration Checkpoint Candidate

**Signal:** Titration Checkpoint Candidate  
**Severity:** Medium  
**Confidence:** Moderate to High

**Why surfaced:**  
Mary has shown sustained decline across delayed memory and language retrieval. Her story recall is below personal baseline on 3 of the last 5 calls, semantic fluency is below baseline on 2 consecutive calls, and word-finding failures are elevated. Medication adherence was confirmed on 6 of the last 7 days. No safety or tolerability flags were detected. Mary is listed as below the clinician-defined target dose and due for medication review.

**Evidence:**

| Domain | Signal | Baseline | Recent Pattern |
|---|---:|---:|---:|
| Delayed memory | Story recall | 7/10 | 3–4/10 |
| Word recall | Delayed words | 2.5/3 | 0–1/3 |
| Language/executive | Animal fluency | 14 | 8–10 |
| Word finding | Failures | 1 | 4–5 |
| Orientation | Orientation score | 4/4 | 3–4/4 |
| Adherence | Confirmed medication | N/A | 6/7 days |
| Safety | Falls/wandering/distress | N/A | None |
| Context | Patient notes | N/A | “Tired from storm” on Tuesday |

**Suggested clinician question:**  
Review whether the current medication plan remains appropriate.

**Boundary copy:**  
Memento does not recommend medication changes. This signal is intended to support clinician review.

---

## Signal Output Schema

```ts
type MedicationReviewSignal = {
  id: string;
  patientId: string;
  signalType: MedicationReviewSignalType;
  severity: "none" | "low" | "medium" | "high";
  confidence: "low" | "moderate" | "high";
  createdAt: string;

  reasonCodes: string[];

  evidence: Array<{
    domain: string;
    kpiName: string;
    baselineValue?: number | string;
    todayValue?: number | string;
    recentPattern?: string;
    percentDeviation?: number;
    consecutiveDays?: number;
  }>;

  context: {
    patientNotes?: string[];
    caregiverNotes?: string[];
    confounders?: string[];
    callQualityIssue?: boolean;
  };

  clinicianCopy: {
    title: string;
    summary: string;
    suggestedQuestion: string;
    boundaryCopy: string;
  };

  status: "new" | "reviewed" | "dismissed" | "added_to_previsit_summary";
};
```

---

## Database Tables

```sql
CREATE TABLE medication_review_signals (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  confidence TEXT NOT NULL,
  reason_codes_json JSONB NOT NULL,
  evidence_json JSONB NOT NULL,
  context_json JSONB,
  clinician_summary TEXT,
  suggested_clinician_question TEXT,
  boundary_copy TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE medication_plans (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  medication_name TEXT,
  current_dose TEXT,
  medication_schedule TEXT,
  start_date DATE,
  last_dose_change_date DATE,
  clinician_target_dose TEXT,
  next_review_date DATE,
  prescriber_name TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Event Flow

Use the existing Memento loop:

1. Daily call completes
2. Transcript is analyzed
3. KPI JSON is generated
4. Baseline deviation is calculated
5. Trend summary is calculated
6. Medication review classifier runs
7. Signal is saved
8. Clinician dashboard updates
9. Medium caregiver-facing alerts route through patient approval
10. High safety alerts go immediately to the care circle

Suggested events:

```ts
"call.completed"
"kpi.extracted"
"baseline.deviation.computed"
"trend_summary.computed"
"medication_review_signal.created"
"clinician_dashboard.updated"
"care_circle_alert.queued"
```

---

## Key Demo Trends to Show

### Demo Trend 1: Titration Checkpoint Candidate

Use this as the main clinician-facing medication review demo.

Patient state:

- Mary has confirmed early Alzheimer’s / early MCI context
- Mary is on a dementia medication
- Current dose is below clinician-defined target dose
- Next review date is today or this week
- Medication adherence is mostly confirmed
- No safety or tolerability flags

Trend data:

| KPI | Baseline | Recent |
|---|---:|---:|
| Fluency count | 14 | 8, 9, 8 |
| Story recall | 7/10 | 4/10, 3/10, 3/10 |
| Delayed word recall | 2.5/3 | 1/3, 1/3, 0/3 |
| Word-finding failures | 1 | 4, 5, 4 |
| Medication adherence | N/A | Confirmed 6/7 days |
| Safety flags | N/A | None |
| Mood | Neutral | Flat twice, not agitated |

Clinician card:

> Titration Checkpoint Candidate: sustained cognitive deviation detected despite mostly confirmed adherence and no tolerability flags. Patient is below clinician-defined target dose and due for review.

This is the strongest demo because it shows Memento doing the “first layer” of dose-review reasoning without claiming to prescribe.

---

### Demo Trend 2: Adherence Review Signal

Patient state:

- Mary has an active medication plan
- Cognitive KPIs are mildly worse, but medication use is uncertain

Trend data:

| KPI | Pattern |
|---|---|
| Medication status | Uncertain or Missed for 2 consecutive days |
| Fluency | Slightly below baseline |
| Story recall | Slightly below baseline |
| Safety flags | None |

Clinician card:

> Adherence Review Signal: Mary was uncertain whether she took her medication on two consecutive days. Review adherence support before interpreting treatment effectiveness.

This is useful because it shows the system avoids false “medication not working” logic.

---

### Demo Trend 3: Tolerability Review Signal

Patient state:

- Mary recently started medication or had a dose change
- New mood/safety/engagement concerns appear

Trend data:

| KPI | Pattern |
|---|---|
| Last dose change | 8 days ago |
| Mood | New Agitated or Anxious classification |
| Safety flag | Mentions dizziness / near fall / confusion |
| Call completion | Drops from 7/7 to 4/7 |
| Cognition | Variable |

Clinician card:

> Tolerability Review Signal: New safety or mood concerns appeared after a recent medication change. Review tolerability before considering further dose changes.

This demo proves the classifier is clinically cautious.

---

### Demo Trend 4: Treatment Eligibility Review Signal

Patient state:

- Mary has a documented diagnosis/stage
- No active dementia medication plan exists
- Sustained cognitive deviation is present

Trend data:

| KPI | Baseline | Recent |
|---|---:|---:|
| Story recall | 7/10 | 3–4/10 |
| Fluency | 14 | 8–10 |
| Delayed word recall | 2.5/3 | 0–1/3 |
| Medication plan | None | None |

Clinician card:

> Treatment Eligibility Review Signal: Mary has a documented diagnosis but no active medication plan. Recent trends show sustained decline from her personal baseline. Consider whether treatment discussion is appropriate.

This demo covers the “what if patient is not on medication?” case.

---

## MVP Scope

Build only these visible states for hackathon:

1. `treatment_eligibility_review_signal`
2. `adherence_review_signal`
3. `tolerability_review_signal`
4. `titration_checkpoint_candidate`

Hide the other states behind the classifier if needed.

---

## Acceptance Criteria

- The clinician dashboard shows a Medication Review Signal card when criteria are met.
- The signal includes a type, severity, confidence, reason codes, and evidence table.
- The signal compares today/recent values to the patient’s own baseline.
- The card includes patient context notes when available.
- The card never recommends a specific medication, dose, or prescription action.
- If adherence is poor, the system prioritizes adherence review over effectiveness/titration review.
- If tolerability or safety flags exist, the system suppresses titration checkpoint and surfaces tolerability/safety review instead.
- If the patient is not on medication, the system uses treatment eligibility language, not dose-review language.
- High safety flags should bypass patient approval and alert the care circle immediately.

---

## One-Sentence Demo Explanation

Memento turns daily conversational KPIs into clinician-facing medication review signals by combining memory, language, adherence, tolerability, safety, and context against the patient’s personal baseline, so clinicians know what deserves review without the system pretending to prescribe.
