# Dashboard Data Gaps

Graphs that currently show no real data, and what needs to be built to enable them.

---

## 1. Speaking Time per Task (Speech tab) — always empty

**Fields:** `speakingTimeFluency`, `speakingTimeStoryRecall`

Both are hardcoded `null` in `dashboard-kpi.ts:152-153` and `dashboard/page.tsx:125-126`.

**To fix:**
- Add timestamps to `CallTurn` in `process-call.ts`
- Compute per-task speaking windows (fluency game window, story recall window)
- Add DB columns `speaking_time_fluency`, `speaking_time_story_recall` to `kpi_results`
- Wire through `KpiInsert` → `kpis.save` → `toDashboardKpiEntry`

---

## 2. Story Recall — Speaking Time line (Memory tab) — second line always absent

**Field:** `storyRecallSpeakingTime`

Hardcoded `null` in `dashboard-kpi.ts:139`. The chart renders when `storyRecallDetails` has data, but the speaking time line never appears.

**Same fix as #1 above.**

---

## 3. Call Duration (Wellness tab) — always empty

**Field:** `callDurationMinutes`

Hardcoded `null` in `dashboard-kpi.ts:162`. No DB column exists.

**To fix:**
- Record call start/end timestamps in `process-call.ts`
- Compute duration in minutes
- Add DB column `call_duration_minutes`
- Wire through `KpiInsert` → `kpis.save` → `toDashboardKpiEntry`

---

## 4. Daily Activity (Wellness tab) — permanently fake

**Fields:** `steps`, `activeMin`

Uses a hardcoded 7-element array (`activityData` at `dashboard/page.tsx:33-41`). Never changes, not connected to the mock toggle.

**To fix properly:** Requires a wearable integration (Apple Health, Google Fit, Fitbit).

**Short-term:** Either hide the chart behind the mock toggle, or remove it until an integration exists.
