/**
 * MedScribe — Core Types
 * Shared type definitions for sessions, utterances, entities, notes.
 */

export type SessionStatus = 'recording' | 'processing' | 'complete' | 'error';
export type SpeakerType = 'DR' | 'PT';
export type EntityType = 'symptom' | 'medication' | 'condition' | 'vital' | 'duration' | 'procedure';
export type Specialty = 'cardiology' | 'er' | 'general' | 'hospice' | 'palliative';

export interface Session {
    session_id: string;
    clinician_id: string;
    started_at: number;
    ended_at: number | null;
    duration_ms: number | null;
    patient_name: string;
    patient_lang: string;
    specialty: Specialty;
    status: SessionStatus;
    audio_path: string | null;
    fl_contributed: number;
}

export interface Utterance {
    utterance_id: string;
    session_id: string;
    speaker: SpeakerType;
    start_ms: number;
    end_ms: number;
    original_text: string;
    translated_text: string | null;
    source_lang: string;
    confidence: number;
    corrected_text: string | null;
    used_for_fl: number;
}

export interface Entity {
    entity_id: string;
    utterance_id: string;
    session_id: string;
    entity_type: EntityType;
    raw_text: string;
    normalized: string | null;
    start_char: number;
    end_char: number;
}

export interface SOAPNote {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
}

export interface ICDCode {
    code: string;
    description: string;
    confidence: number;
    is_primary: boolean;
}

export interface Note {
    note_id: string;
    session_id: string;
    soap_json: string;
    icd_codes_json: string;
    patient_summary: string;
    contradiction_flags: string;
    generated_at: number;
    gemini_model: string;
    signed_at: number | null;
    fhir_json: string | null;
    full_result_json: string | null;
    translated_summary: string | null;
    translated_summary_lang: string | null;
}

export interface FLLog {
    fl_id: string;
    session_id: string;
    submitted_at: number;
    delta_size_kb: number;
    epsilon_used: number;
    budget_remaining: number;
    dr_pairs_count: number;
    pt_pairs_count: number;
    model_version_before: string;
    model_version_after: string;
}

// Display-ready types with parsed JSON
export interface SessionWithNote extends Session {
    soap?: SOAPNote;
    icd_codes?: ICDCode[];
    patient_summary?: string;
    signed_at?: number | null;
}
