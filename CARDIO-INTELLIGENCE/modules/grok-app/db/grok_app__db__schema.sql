-- Example schema — expected to evolve as the product takes shape

CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'patient', -- 'patient' | 'caregiver'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  agent_id   TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL, -- 'user' | 'assistant'
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transcripts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calls (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID REFERENCES sessions(id) ON DELETE SET NULL,
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  duration_seconds INT,
  summary          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per completed call: the cognitive signals extracted from its
-- transcript. `patient_id` is the stable id we key everything by (a real
-- users.id, or a demo id like "mary-demo") — intentionally TEXT, NOT a FK, so
-- demo and real patients both work. Chartable KPIs are promoted to columns for
-- easy dashboard queries; the full evolving set lives in the JSONB blobs.
CREATE TABLE IF NOT EXISTS kpi_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id          TEXT NOT NULL,
  patient_name        TEXT,
  call_date           DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Promoted, chartable KPIs (nullable: a task may not have happened this call).
  mood                TEXT,            -- Cheerful | Neutral | Flat | Anxious | Agitated
  sleep_quality       TEXT,            -- Good | Fair | Poor | Unknown
  fluency_count       INT,             -- unique animals named (if the game happened)
  naming_accuracy     NUMERIC,         -- 0..1 across naming prompts
  word_finding_failures INT,
  immediate_recall    INT,             -- 0..3
  delayed_recall_words INT,            -- 0..3
  story_recall_details INT,            -- 0..N story details recalled
  orientation_score   INT,             -- 0..4
  stop_word_fraction  NUMERIC,         -- 0..1 (computed deterministically)
  lexical_diversity   NUMERIC,         -- type-token ratio (computed)
  repetition_count    INT,
  medication_status   TEXT,            -- Confirmed | Uncertain | Missed
  cross_session_recall BOOLEAN,
  safety_flag         BOOLEAN DEFAULT FALSE,
  safety_flag_type    TEXT,
  engagement          TEXT,            -- Completed | Partial

  -- Full sets + provenance.
  deterministic_json  JSONB,           -- all computed linguistic features
  kpis_json           JSONB,           -- full LLM-extracted KPI object
  observations_json   JSONB,           -- qualitative notes (string[])
  summary             TEXT,            -- short plain-language recap
  transcript          TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kpi_results_patient_date_idx
  ON kpi_results (patient_id, call_date DESC);

