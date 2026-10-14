
| Field                                             | Notes                                                    |
| ------------------------------------------------- | -------------------------------------------------------- |
| `call_id`, `patient_id`, `started_at`, `ended_at` | Keys + timing                                            |
| `call_status`                                     | Completed / Partial / Declined / No-answer               |
| `transcript`                                      | Full, with per-word `{speaker, text, t_start, t_end}`    |
| `task_segments`                                   | `[{task, t_start, t_end}]` from your runtime markers     |
| `kpis_extracted`                                  | The strict-JSON LLM output (all semantic KPIs)           |
| `kpis_computed`                                   | stop_word_fraction, speaking_time_per_task, durations    |
| `extraction_meta`                                 | model name + prompt/schema version (for reproducibility) |
| `deviations`                                      | per-KPI z-score and % vs baseline, computed at scoring   |
| `alerts`                                          | `[{level, kpi, reason, status: queued/approved/sent}]`   |
| `patient_note`                                    | Mary's own context ("tired from the storm")              |
| `mood_checkin`                                    | Patient self-report, separate from call-derived mood     |
| `consent_snapshot`                                | Sharing/escalation settings at call time                 |

| KPI                           | How produced                                  | Units                      | Clinical anchor                     |
| ----------------------------- | --------------------------------------------- | -------------------------- | ----------------------------------- |
| ⭐ Semantic fluency            | LLM (count valid unique animals in window)    | int                        | FAS / category fluency              |
| ⭐ Story recall (detail count) | LLM (score vs fixed detail list)              | int 0–10                   | WMS Logical Memory                  |
| Story recall speaking time    | computed (timestamps)                         | sec                        | Tavabi paralinguistic               |
| ⭐ Naming accuracy             | LLM (match to expected answers)               | %                          | BNT                                 |
| Word-finding failures         | LLM (hedges, substitutions, self-corrections) | int                        | BNT / anomia trend                  |
| Immediate word recall         | LLM                                           | int 0–3                    | MoCA/ADAS-Cog registration          |
| Delayed word recall           | LLM                                           | int 0–3                    | MoCA delayed recall                 |
| Orientation                   | LLM (vs actual date)                          | int 0–4                    | MMSE/MoCA orientation               |
| Stop-word fraction 🧮         | computed (wordlist)                           | ratio 0–1                  | Tavabi (top paralinguistic feature) |
| Speaking time per task 🧮     | computed (timestamps)                         | sec/task                   | Tavabi                              |
| Repetition count              | LLM (semantic dedup)                          | int                        | perseveration                       |
| Medication status             | LLM (classify response)                       | Confirmed/Uncertain/Missed | adherence                           |
| Mood                          | LLM (classify tone)                           | 5-way categorical          | NPI-Q affect                        |
| Safety flag                   | LLM (semantic monitor)                        | bool + type                | escalation standard                 |
| Call completion/engagement    | computed (system)                             | %/categorical              | apathy/engagement                   |

KPI Computations 🧮:

Let `P` = the patient's tokens after diarization (lowercased, punctuation stripped):
- **Stop-word fraction:** `SWF = |{t ∈ P : t ∈ STOPWORDS}| / |P|`. Pick a stop-word list (NLTK English is the standard ~179-word set). Decision point: the clinical construct includes disfluencies (um, uh, like, you know), but STT often strips or normalizes those — so you need Grok STT in a verbatim/disfluency-preserving mode, or you'll under-count the most diagnostic fillers. Compute over _patient_ tokens only.
- **Speaking time per task:** for task segment `s` with patient words `W_s`, sum the phonation durations: `T_s = Σ_{w ∈ W_s} (w.end − w.start)` using the word-level timestamps. Total speaking time is `Σ_s T_s`. (Optionally also track _response latency_ = first patient word start − agent prompt end; long latency before naming is itself a word-finding signal.)
- **Call duration:** `ended_at − started_at`. **Completion:** 1 if the "close" segment was reached, else 0.
- **Rolling rates:** `completion_rate(7d) = completed / scheduled` over the window; `adherence_rate(7d) = confirmed_days / total_days`.

> Show KPI states immediately on dash, show baseline after 5-7 calls.

## Math for Deviation from Baseline

For each patient × continuous KPI, over the baseline calls `{x₁…x_N}`:

```
μ = (1/N) Σ xᵢ
σ = sqrt( (1/(N−1)) Σ (xᵢ − μ)² )     # sample SD, N−1
```

Then for each new call value `x`:

```
z   = (x − μ) / max(σ, σ_min)          # σ_min floor prevents blowup
pct = 100 · (x − μ) / μ                 # only when μ is comfortably ≠ 0
```

For detecting decline, the governing fact is that the standard error of a mean over `k` calls is `σ/√k`, so to detect a shift of size `Δ` you need roughly:

```
k ≈ ( (z_α + z_β) · σ / Δ )²
```

> Baseline is a reference band drawn on each KPI's trend chart
> 
> Each KPI chart should have: the daily data line, a centerline at μ, and a shaded band at μ ± 2σ (the patient's "normal range")

> Keep in mind some are "lower is better" some are "higher is better"

## Alert Logic


| KPI                         | Decline threshold                                    | Window                            | Source                                     |
| --------------------------- | ---------------------------------------------------- | --------------------------------- | ------------------------------------------ |
| Semantic fluency            | >20% below baseline                                  | 2 consecutive calls               | doc design                                 |
| Story recall (detail count) | >20% below baseline                                  | 2 consecutive calls               | doc design                                 |
| Story recall speaking time  | **<50% of baseline**                                 | single → review flag              | doc; loosely anchored to Tavabi            |
| Naming accuracy             | below baseline (no fixed %)                          | trend                             | doc design                                 |
| Word-finding failures       | upward trend (no fixed cutoff)                       | trend                             | doc design                                 |
| Immediate word recall       | = 0                                                  | 2 consecutive                     | doc design                                 |
| Delayed word recall         | 0, or steady decline                                 | 3 consecutive                     | doc design                                 |
| Orientation                 | = 0 (full disorientation) → **High**                 | 2 consecutive                     | doc design                                 |
| Stop-word fraction          | **+15 percentage points** above baseline             | 2 consecutive                     | doc; KPI is Tavabi-validated, cutoff isn't |
| Repetition count            | ≥ 3 in one call                                      | single call                       | doc design                                 |
| Medication status           | Uncertain/Missed → notify; 3+ Uncertain/wk → medium  | 2 consecutive days / rolling week | doc design                                 |
| Mood                        | 3+ Flat/Anxious/week → note; any Agitated → same-day | rolling week / single             | doc design                                 |
| Safety flag                 | any → **High**, immediate                            | single                            | clinical escalation standard               |
| Call completion             | <60% over 7 days → notify; 3 no-answers → High       | rolling                           | doc design                                 |
