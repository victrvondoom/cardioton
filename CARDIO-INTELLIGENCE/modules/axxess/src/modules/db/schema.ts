/**
 * MedScribe — Database Schema
 * SQLite schema using expo-sqlite (Expo Go compatible).
 * Will migrate to op-sqlite + SQLCipher in Phase 4 (dev builds).
 */
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Open or create the MedScribe database.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('medscribe.db');
  await initializeSchema(db);
  return db;
}

/**
 * Initialize all tables if they don't exist.
 */
async function initializeSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS sessions (
      session_id      TEXT PRIMARY KEY,
      clinician_id    TEXT NOT NULL,
      started_at      INTEGER NOT NULL,
      ended_at        INTEGER,
      duration_ms     INTEGER,
      patient_name    TEXT NOT NULL DEFAULT 'Unknown Patient',
      patient_lang    TEXT DEFAULT 'en',
      specialty       TEXT DEFAULT 'general',
      status          TEXT DEFAULT 'recording',
      audio_path      TEXT,
      fl_contributed  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS utterances (
      utterance_id    TEXT PRIMARY KEY,
      session_id      TEXT NOT NULL,
      speaker         TEXT NOT NULL,
      start_ms        INTEGER,
      end_ms          INTEGER,
      original_text   TEXT,
      translated_text TEXT,
      source_lang     TEXT DEFAULT 'en',
      confidence      REAL DEFAULT 0.0,
      corrected_text  TEXT,
      used_for_fl     INTEGER DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS entities (
      entity_id       TEXT PRIMARY KEY,
      utterance_id    TEXT NOT NULL,
      session_id      TEXT NOT NULL,
      entity_type     TEXT NOT NULL,
      raw_text        TEXT NOT NULL,
      normalized      TEXT,
      start_char      INTEGER,
      end_char        INTEGER,
      FOREIGN KEY (utterance_id) REFERENCES utterances(utterance_id),
      FOREIGN KEY (session_id) REFERENCES sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS notes (
      note_id               TEXT PRIMARY KEY,
      session_id            TEXT NOT NULL,
      soap_json             TEXT,
      icd_codes_json        TEXT,
      patient_summary       TEXT,
      contradiction_flags   TEXT,
      generated_at          INTEGER,
      gemini_model          TEXT,
      signed_at             INTEGER,
      fhir_json             TEXT,
      full_result_json      TEXT,
      translated_summary    TEXT,
      translated_summary_lang TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS fl_log (
      fl_id                TEXT PRIMARY KEY,
      session_id           TEXT NOT NULL,
      submitted_at         INTEGER,
      delta_size_kb        REAL,
      epsilon_used         REAL,
      budget_remaining     REAL,
      dr_pairs_count       INTEGER,
      pt_pairs_count       INTEGER,
      model_version_before TEXT,
      model_version_after  TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      log_id        TEXT PRIMARY KEY,
      event_type    TEXT NOT NULL,
      description   TEXT NOT NULL,
      metadata      TEXT,
      created_at    INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_utterances_session ON utterances(session_id);
    CREATE INDEX IF NOT EXISTS idx_entities_session ON entities(session_id);
    CREATE INDEX IF NOT EXISTS idx_entities_utterance ON entities(utterance_id);
    CREATE INDEX IF NOT EXISTS idx_notes_session ON notes(session_id);
    CREATE INDEX IF NOT EXISTS idx_fl_log_session ON fl_log(session_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
  `);

  // Migrate existing databases to add new columns (safe — errors ignored if already exist)
  const migrations = [
    `ALTER TABLE notes ADD COLUMN full_result_json TEXT`,
    `ALTER TABLE notes ADD COLUMN translated_summary TEXT`,
    `ALTER TABLE notes ADD COLUMN translated_summary_lang TEXT`,
  ];
  for (const sql of migrations) {
    try { await database.runAsync(sql); } catch { /* column already exists */ }
  }
}

/**
 * Close the database connection.
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
