/**
 * MedScribe — Database Queries
 * CRUD operations for all tables using expo-sqlite.
 */
import { getDatabase } from './schema';
import type {
    Session,
    Utterance,
    Entity,
    Note,
    FLLog,
    SessionStatus,
    SessionWithNote,
} from '@/src/types/axxess__src_types__index';

// ─── Utility ────────────────────────────────────────

function generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// ─── Sessions ───────────────────────────────────────

export async function createSession(
    data: Partial<Session> & { patient_name: string }
): Promise<Session> {
    const db = await getDatabase();
    const session: Session = {
        session_id: data.session_id || generateId(),
        clinician_id: data.clinician_id || 'device-' + generateId().substring(0, 8),
        started_at: data.started_at || Date.now(),
        ended_at: data.ended_at || null,
        duration_ms: data.duration_ms || null,
        patient_name: data.patient_name,
        patient_lang: data.patient_lang || 'en',
        specialty: data.specialty || 'general',
        status: data.status || 'recording',
        audio_path: data.audio_path || null,
        fl_contributed: data.fl_contributed || 0,
    };

    await db.runAsync(
        `INSERT INTO sessions (session_id, clinician_id, started_at, ended_at, duration_ms, patient_name, patient_lang, specialty, status, audio_path, fl_contributed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            session.session_id,
            session.clinician_id,
            session.started_at,
            session.ended_at,
            session.duration_ms,
            session.patient_name,
            session.patient_lang,
            session.specialty,
            session.status,
            session.audio_path,
            session.fl_contributed,
        ]
    );

    return session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<Session>(
        'SELECT * FROM sessions WHERE session_id = ?',
        [sessionId]
    );
    return result || null;
}

export async function getAllSessions(
    limit = 50,
    offset = 0
): Promise<Session[]> {
    const db = await getDatabase();
    return db.getAllAsync<Session>(
        'SELECT * FROM sessions ORDER BY started_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
    );
}

export async function getSessionsWithNotes(
    limit = 50,
    offset = 0
): Promise<SessionWithNote[]> {
    const db = await getDatabase();
    const sessions = await db.getAllAsync<Session & { soap_json?: string; icd_codes_json?: string; patient_summary?: string; note_signed_at?: number }>(
        `SELECT s.*, n.soap_json, n.icd_codes_json, n.patient_summary, n.signed_at as note_signed_at
     FROM sessions s
     LEFT JOIN notes n ON s.session_id = n.session_id
     ORDER BY s.started_at DESC
     LIMIT ? OFFSET ?`,
        [limit, offset]
    );

    return sessions.map((s) => ({
        ...s,
        soap: s.soap_json ? JSON.parse(s.soap_json) : undefined,
        icd_codes: s.icd_codes_json ? JSON.parse(s.icd_codes_json) : undefined,
        patient_summary: s.patient_summary || undefined,
        signed_at: s.note_signed_at || null,
    }));
}

export async function searchSessions(
    query: string,
    specialty?: string
): Promise<SessionWithNote[]> {
    const db = await getDatabase();
    let sql = `
    SELECT s.*, n.soap_json, n.icd_codes_json, n.patient_summary, n.signed_at as note_signed_at
    FROM sessions s
    LEFT JOIN notes n ON s.session_id = n.session_id
    WHERE (s.patient_name LIKE ? OR n.icd_codes_json LIKE ? OR n.patient_summary LIKE ?)
  `;
    const params: any[] = [`%${query}%`, `%${query}%`, `%${query}%`];

    if (specialty && specialty !== 'All') {
        sql += ' AND s.specialty = ?';
        params.push(specialty.toLowerCase());
    }

    sql += ' ORDER BY s.started_at DESC LIMIT 50';

    const sessions = await db.getAllAsync<any>(sql, params);
    return sessions.map((s: any) => ({
        ...s,
        soap: s.soap_json ? JSON.parse(s.soap_json) : undefined,
        icd_codes: s.icd_codes_json ? JSON.parse(s.icd_codes_json) : undefined,
        patient_summary: s.patient_summary || undefined,
        signed_at: s.note_signed_at || null,
    }));
}

export async function updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    endedAt?: number
): Promise<void> {
    const db = await getDatabase();
    if (endedAt) {
        const session = await getSession(sessionId);
        const durationMs = session ? endedAt - session.started_at : null;
        await db.runAsync(
            'UPDATE sessions SET status = ?, ended_at = ?, duration_ms = ? WHERE session_id = ?',
            [status, endedAt, durationMs, sessionId]
        );
    } else {
        await db.runAsync(
            'UPDATE sessions SET status = ? WHERE session_id = ?',
            [status, sessionId]
        );
    }
}

export async function getSessionCount(): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM sessions'
    );
    return result?.count || 0;
}

export async function getTodaySessionCount(): Promise<number> {
    const db = await getDatabase();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const result = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM sessions WHERE started_at >= ?',
        [todayStart.getTime()]
    );
    return result?.count || 0;
}

export async function getWeekSessionCount(): Promise<number> {
    const db = await getDatabase();
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    const result = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM sessions WHERE started_at >= ?',
        [weekStart.getTime()]
    );
    return result?.count || 0;
}

export async function getAverageConfidence(): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ avg_conf: number }>(
        'SELECT AVG(confidence) as avg_conf FROM utterances'
    );
    return result?.avg_conf || 0;
}

// ─── Utterances ─────────────────────────────────────

export async function createUtterance(data: Partial<Utterance> & { session_id: string; speaker: string; original_text: string }): Promise<Utterance> {
    const db = await getDatabase();
    const utterance: Utterance = {
        utterance_id: data.utterance_id || generateId(),
        session_id: data.session_id,
        speaker: data.speaker as 'DR' | 'PT',
        start_ms: data.start_ms || 0,
        end_ms: data.end_ms || 0,
        original_text: data.original_text,
        translated_text: data.translated_text || null,
        source_lang: data.source_lang || 'en',
        confidence: data.confidence || 0,
        corrected_text: data.corrected_text || null,
        used_for_fl: data.used_for_fl || 0,
    };

    await db.runAsync(
        `INSERT INTO utterances (utterance_id, session_id, speaker, start_ms, end_ms, original_text, translated_text, source_lang, confidence, corrected_text, used_for_fl)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            utterance.utterance_id,
            utterance.session_id,
            utterance.speaker,
            utterance.start_ms,
            utterance.end_ms,
            utterance.original_text,
            utterance.translated_text,
            utterance.source_lang,
            utterance.confidence,
            utterance.corrected_text,
            utterance.used_for_fl,
        ]
    );

    return utterance;
}

export async function getUtterancesForSession(sessionId: string): Promise<Utterance[]> {
    const db = await getDatabase();
    return db.getAllAsync<Utterance>(
        'SELECT * FROM utterances WHERE session_id = ? ORDER BY start_ms ASC',
        [sessionId]
    );
}

// ─── Notes ──────────────────────────────────────────

export async function createNote(data: Partial<Note> & { session_id: string }): Promise<Note> {
    const db = await getDatabase();
    const note: Note = {
        note_id: data.note_id || generateId(),
        session_id: data.session_id,
        soap_json: data.soap_json || '{}',
        icd_codes_json: data.icd_codes_json || '[]',
        patient_summary: data.patient_summary || '',
        contradiction_flags: data.contradiction_flags || '[]',
        generated_at: data.generated_at || Date.now(),
        gemini_model: data.gemini_model || 'gemini-2.5-pro',
        signed_at: data.signed_at || null,
        fhir_json: data.fhir_json || null,
        full_result_json: data.full_result_json || null,
        translated_summary: data.translated_summary || null,
        translated_summary_lang: data.translated_summary_lang || null,
    };

    await db.runAsync(
        `INSERT INTO notes (note_id, session_id, soap_json, icd_codes_json, patient_summary, contradiction_flags, generated_at, gemini_model, signed_at, fhir_json, full_result_json, translated_summary, translated_summary_lang)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            note.note_id,
            note.session_id,
            note.soap_json,
            note.icd_codes_json,
            note.patient_summary,
            note.contradiction_flags,
            note.generated_at,
            note.gemini_model,
            note.signed_at,
            note.fhir_json,
            note.full_result_json,
            note.translated_summary,
            note.translated_summary_lang,
        ]
    );

    return note;
}

export async function upsertNote(data: Partial<Note> & { session_id: string }): Promise<Note> {
    const existing = await getNoteForSession(data.session_id);
    if (existing) {
        const db = await getDatabase();
        await db.runAsync(
            `UPDATE notes SET
                soap_json = ?, icd_codes_json = ?, patient_summary = ?,
                contradiction_flags = ?, generated_at = ?, gemini_model = ?,
                fhir_json = ?, full_result_json = ?
             WHERE session_id = ?`,
            [
                data.soap_json ?? existing.soap_json,
                data.icd_codes_json ?? existing.icd_codes_json,
                data.patient_summary ?? existing.patient_summary,
                data.contradiction_flags ?? existing.contradiction_flags,
                Date.now(),
                data.gemini_model ?? existing.gemini_model,
                data.fhir_json ?? existing.fhir_json,
                data.full_result_json ?? existing.full_result_json,
                data.session_id,
            ]
        );
        return (await getNoteForSession(data.session_id))!;
    }
    return createNote(data);
}

export async function updateNoteTranslation(
    sessionId: string,
    translatedSummary: string,
    lang: string,
): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
        'UPDATE notes SET translated_summary = ?, translated_summary_lang = ? WHERE session_id = ?',
        [translatedSummary, lang, sessionId]
    );
}

export async function getNoteForSession(sessionId: string): Promise<Note | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<Note>(
        'SELECT * FROM notes WHERE session_id = ? ORDER BY generated_at DESC',
        [sessionId]
    );
    return result || null;
}

// ─── Audit Logs ─────────────────────────────────────

export interface AuditLogEntry {
    log_id: string;
    event_type: string;
    description: string;
    metadata: string | null;
    created_at: number;
}

export async function logAuditEvent(
    eventType: string,
    description: string,
    metadata?: Record<string, any>
): Promise<void> {
    try {
        const db = await getDatabase();
        await db.runAsync(
            'INSERT INTO audit_logs (log_id, event_type, description, metadata, created_at) VALUES (?, ?, ?, ?, ?)',
            [
                generateId(),
                eventType,
                description,
                metadata ? JSON.stringify(metadata) : null,
                Date.now(),
            ]
        );
    } catch (err) {
        console.error('Failed to log audit event:', err);
    }
}

export async function getAuditLogs(limit = 50): Promise<AuditLogEntry[]> {
    const db = await getDatabase();
    return db.getAllAsync<AuditLogEntry>(
        'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?',
        [limit]
    );
}

// ─── Data Management ────────────────────────────────

export async function deleteAllSessions(): Promise<number> {
    const db = await getDatabase();
    // Delete in dependency order
    await db.runAsync('DELETE FROM entities');
    await db.runAsync('DELETE FROM utterances');
    await db.runAsync('DELETE FROM notes');
    await db.runAsync('DELETE FROM fl_log');
    const result = await db.runAsync('DELETE FROM sessions');
    await logAuditEvent('data_deleted', 'All sessions deleted by user');
    return result.changes;
}

export async function deleteSessionsOlderThan(days: number): Promise<number> {
    const db = await getDatabase();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    // Get session IDs to delete
    const sessionsToDelete = await db.getAllAsync<{ session_id: string }>(
        'SELECT session_id FROM sessions WHERE started_at < ?',
        [cutoff]
    );

    if (sessionsToDelete.length === 0) return 0;

    const ids = sessionsToDelete.map(s => s.session_id);
    const placeholders = ids.map(() => '?').join(',');

    await db.runAsync(`DELETE FROM entities WHERE session_id IN (${placeholders})`, ids);
    await db.runAsync(`DELETE FROM utterances WHERE session_id IN (${placeholders})`, ids);
    await db.runAsync(`DELETE FROM notes WHERE session_id IN (${placeholders})`, ids);
    await db.runAsync(`DELETE FROM fl_log WHERE session_id IN (${placeholders})`, ids);
    const result = await db.runAsync(`DELETE FROM sessions WHERE session_id IN (${placeholders})`, ids);

    await logAuditEvent('data_retention', `Deleted ${result.changes} sessions older than ${days} days`, { days, count: result.changes });
    return result.changes;
}

// ─── Seed Data ──────────────────────────────────────

export async function seedDemoData(): Promise<void> {
    const db = await getDatabase();

    // Check if data already exists
    const count = await getSessionCount();
    if (count > 0) return;

    // Check if user manually cleared sessions — don't re-seed if they did
    try {
        const clearLog = await db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM audit_logs WHERE event_type = 'data_deleted'`
        );
        if (clearLog && clearLog.count > 0) return; // User cleared — respect their choice
    } catch { /* audit_log might not exist yet */ }

    const now = Date.now();
    const hour = 3600000;
    const day = 86400000;

    // Create demo sessions
    const demoSessions = [
        { patient_name: 'Maria Garcia', specialty: 'cardiology' as const, patient_lang: 'es', started_at: now - 2 * hour, duration_ms: 18 * 60000, status: 'complete' as const },
        { patient_name: 'James Wilson', specialty: 'general' as const, patient_lang: 'en', started_at: now - 5 * hour, duration_ms: 12 * 60000, status: 'complete' as const },
        { patient_name: 'Fatima Al-Rashid', specialty: 'er' as const, patient_lang: 'ar', started_at: now - 8 * hour, duration_ms: 8 * 60000, status: 'complete' as const },
        { patient_name: 'Robert Chen', specialty: 'cardiology' as const, patient_lang: 'en', started_at: now - 1 * day - 3 * hour, duration_ms: 25 * 60000, status: 'complete' as const },
        { patient_name: 'Jean-Baptiste Pierre', specialty: 'hospice' as const, patient_lang: 'ht', started_at: now - 1 * day - 6 * hour, duration_ms: 15 * 60000, status: 'complete' as const },
        { patient_name: 'Anh Nguyen', specialty: 'general' as const, patient_lang: 'vi', started_at: now - 2 * day - 2 * hour, duration_ms: 10 * 60000, status: 'complete' as const },
        { patient_name: 'Sarah Johnson', specialty: 'palliative' as const, patient_lang: 'en', started_at: now - 2 * day - 5 * hour, duration_ms: 22 * 60000, status: 'complete' as const },
        { patient_name: 'Dmitri Volkov', specialty: 'er' as const, patient_lang: 'ru', started_at: now - 3 * day - 1 * hour, duration_ms: 6 * 60000, status: 'complete' as const },
    ];

    const demoNotes = [
        {
            soap: { subjective: 'Patient reports intermittent chest tightness over 3 days, worse with exertion. Denies radiation to arm. Takes Lisinopril 10mg daily.', objective: 'BP 142/88, HR 78 regular. No murmurs. ECG shows normal sinus rhythm. Troponin negative.', assessment: 'Unstable angina versus musculoskeletal chest pain. Elevated blood pressure noted.', plan: 'Order stress test within 48 hours. Continue Lisinopril. Add Aspirin 81mg daily. Follow up in 1 week.' },
            icd: [{ code: 'I20.9', description: 'Angina pectoris, unspecified', confidence: 0.87, is_primary: true }, { code: 'I10', description: 'Essential hypertension', confidence: 0.94, is_primary: false }],
            summary: 'Usted tiene dolor en el pecho que necesita mas pruebas. Continue tomando su medicamento y agregue Aspirina 81mg al dia.',
        },
        {
            soap: { subjective: 'Patient presents with productive cough for 5 days, low-grade fever. No shortness of breath. No sick contacts.', objective: 'Temp 100.2F, lungs with bilateral rhonchi, clear with cough. Throat mildly erythematous. No lymphadenopathy.', assessment: 'Acute bronchitis, likely viral. No signs of pneumonia.', plan: 'Supportive care. OTC expectorant. Rest and fluids. Return if worsening or SOB develops.' },
            icd: [{ code: 'J20.9', description: 'Acute bronchitis, unspecified', confidence: 0.92, is_primary: true }],
            summary: 'You have a chest cold that should improve on its own. Get rest, drink fluids, and take over-the-counter cough medicine.',
        },
        {
            soap: { subjective: 'Patient brought in by EMS after fall. Complains of right wrist pain and swelling. Denies head injury or LOC.', objective: 'Right wrist with dorsal angulation and swelling. Tenderness over distal radius. Neurovascular intact distally. X-ray confirms distal radius fracture.', assessment: 'Distal radius fracture (Colles type), non-displaced.', plan: 'Short arm splint applied. Orthopedic follow-up in 3 days. Ibuprofen 400mg TID PRN pain. Ice and elevation.' },
            icd: [{ code: 'S52.501A', description: 'Unspecified fracture of lower end of right radius', confidence: 0.95, is_primary: true }],
            summary: 'You have a broken wrist. Keep the splint on and follow up with the bone doctor in 3 days.',
        },
        {
            soap: { subjective: 'Follow-up visit. Patient reports stable angina, well-controlled on current regimen. No new chest pain episodes since stress test.', objective: 'BP 128/82, HR 72. Stress test results reviewed: negative for inducible ischemia. Lipid panel: LDL 145.', assessment: 'Stable coronary artery disease. LDL above target.', plan: 'Increase Atorvastatin to 40mg nightly. Continue current cardiac medications. Annual echo. Follow up 3 months.' },
            icd: [{ code: 'I25.10', description: 'Atherosclerotic heart disease of native coronary artery', confidence: 0.88, is_primary: true }, { code: 'E78.5', description: 'Hyperlipidemia, unspecified', confidence: 0.91, is_primary: false }],
            summary: 'Your heart tests look stable. We are increasing your cholesterol medicine. Come back in 3 months.',
        },
        {
            soap: { subjective: 'Hospice visit. Patient with Stage IV pancreatic cancer. Caregiver reports increased pain overnight, rated 7/10. Not eating well for past 2 days.', objective: 'Cachectic. Pain on palpation in epigastric region. Jaundice stable. Weight 112 lbs, down 3 from last week.', assessment: 'Progressive cancer pain. Nutritional decline.', plan: 'Increase morphine to 15mg q4h. Add Ondansetron for nausea. Nutritional supplement shakes. Comfort care priority. Caregiver support referral.' },
            icd: [{ code: 'C25.9', description: 'Malignant neoplasm of pancreas, unspecified', confidence: 0.97, is_primary: true }, { code: 'Z51.5', description: 'Encounter for palliative care', confidence: 0.95, is_primary: false }],
            summary: 'Nou ogmante medikaman doulè ou. Eseye bwè bwason nitrisyon. Ekip swen an la pou ede ou.',
        },
        {
            soap: { subjective: 'Patient reports chronic headaches, 3-4 times per week for 2 months. Worse in the afternoon. OTC acetaminophen provides minimal relief.', objective: 'Neurological exam normal. Visual fields intact. No papilledema. BMI 31.', assessment: 'Chronic tension-type headache. Obesity may be contributing factor.', plan: 'Trial of Amitriptyline 25mg nightly for prophylaxis. Headache diary. Lifestyle modifications. Follow up 4 weeks.' },
            icd: [{ code: 'G44.209', description: 'Tension-type headache, unspecified, not intractable', confidence: 0.84, is_primary: true }],
            summary: 'You have frequent headaches. We are starting a medicine to prevent them. Keep a diary of when headaches happen.',
        },
        {
            soap: { subjective: 'Palliative care consult. Patient with advanced COPD on 4L home O2. Reports increasing dyspnea at rest. Goals of care discussion with family present.', objective: 'O2 sat 88% on 4L. Bilateral crackles. Edematous lower extremities. Weak cough.', assessment: 'End-stage COPD with respiratory failure. Advance directive reviewed and updated.', plan: 'Comfort-focused care. Continue O2. Add low-dose morphine 2.5mg q6h for dyspnea relief. DNR/DNI confirmed. Chaplain referral.' },
            icd: [{ code: 'J44.1', description: 'Chronic obstructive pulmonary disease with acute exacerbation', confidence: 0.89, is_primary: true }, { code: 'Z51.5', description: 'Encounter for palliative care', confidence: 0.93, is_primary: false }],
            summary: 'Your breathing condition is advanced. We will focus on keeping you comfortable. The care team is here for you and your family.',
        },
        {
            soap: { subjective: 'Patient brought in by ambulance with acute abdominal pain, RLQ. Nausea, one episode of vomiting. No fever reported at home.', objective: 'Temp 101.1F. RLQ tenderness with rebound. Positive McBurney point. WBC 14,200. CT shows inflamed appendix.', assessment: 'Acute appendicitis.', plan: 'Surgical consult for appendectomy. NPO. IV fluids. Ceftriaxone 1g IV. Pre-op labs.' },
            icd: [{ code: 'K35.80', description: 'Unspecified acute appendicitis', confidence: 0.96, is_primary: true }],
            summary: 'Your appendix is inflamed and you need surgery to remove it. The surgeon will see you shortly.',
        },
    ];

    // Utterance templates per session
    const demoUtterances = [
        // Session 0: Cardiology (Spanish patient)
        [
            { speaker: 'DR', text: 'Good morning. Can you tell me what brought you in today?', confidence: 0.96, start_ms: 5000, end_ms: 10000 },
            { speaker: 'PT', text: 'Tengo dolor en el pecho desde hace tres dias.', translated: 'I have had chest pain for three days.', lang: 'es', confidence: 0.91, start_ms: 12000, end_ms: 18000 },
            { speaker: 'DR', text: 'Does the pain get worse with activity or breathing?', confidence: 0.94, start_ms: 20000, end_ms: 25000 },
            { speaker: 'PT', text: 'Si, cuando camino o respiro profundo.', translated: 'Yes, when I walk or breathe deeply.', lang: 'es', confidence: 0.88, start_ms: 27000, end_ms: 32000 },
            { speaker: 'DR', text: 'Are you taking any medications currently?', confidence: 0.97, start_ms: 35000, end_ms: 39000 },
            { speaker: 'PT', text: 'Tomo Lisinopril diez miligramos cada dia.', translated: 'I take Lisinopril ten milligrams each day.', lang: 'es', confidence: 0.85, start_ms: 41000, end_ms: 46000 },
        ],
        // Session 1: General (English)
        [
            { speaker: 'DR', text: 'What brings you in today?', confidence: 0.97, start_ms: 3000, end_ms: 6000 },
            { speaker: 'PT', text: 'I have had a cough for about five days now with some mucus.', confidence: 0.93, start_ms: 8000, end_ms: 14000 },
            { speaker: 'DR', text: 'Any fever or shortness of breath?', confidence: 0.95, start_ms: 16000, end_ms: 20000 },
            { speaker: 'PT', text: 'Low grade fever, maybe 100 degrees. No trouble breathing.', confidence: 0.89, start_ms: 22000, end_ms: 28000 },
        ],
        // Session 2: ER (Arabic patient)
        [
            { speaker: 'DR', text: 'Can you tell me what happened?', confidence: 0.96, start_ms: 2000, end_ms: 5000 },
            { speaker: 'PT', text: 'I fell and my wrist hurts a lot.', translated: 'I fell and my wrist hurts a lot.', lang: 'ar', confidence: 0.82, start_ms: 7000, end_ms: 12000 },
            { speaker: 'DR', text: 'Did you hit your head when you fell?', confidence: 0.94, start_ms: 14000, end_ms: 18000 },
            { speaker: 'PT', text: 'No, just my wrist.', translated: 'No, just my wrist.', lang: 'ar', confidence: 0.90, start_ms: 20000, end_ms: 23000 },
        ],
    ] as const;

    for (let i = 0; i < demoSessions.length; i++) {
        const s = demoSessions[i];
        const session = await createSession({
            patient_name: s.patient_name,
            specialty: s.specialty,
            patient_lang: s.patient_lang,
            started_at: s.started_at,
            ended_at: s.started_at + (s.duration_ms || 0),
            duration_ms: s.duration_ms,
            status: s.status,
        });

        // Create note
        if (demoNotes[i]) {
            const n = demoNotes[i];
            await createNote({
                session_id: session.session_id,
                soap_json: JSON.stringify(n.soap),
                icd_codes_json: JSON.stringify(n.icd),
                patient_summary: n.summary,
            });
        }

        // Create utterances if available
        if (demoUtterances[i]) {
            for (const u of demoUtterances[i]) {
                await createUtterance({
                    session_id: session.session_id,
                    speaker: u.speaker,
                    original_text: u.text,
                    translated_text: (u as any).translated || null,
                    source_lang: (u as any).lang || 'en',
                    confidence: u.confidence,
                    start_ms: u.start_ms,
                    end_ms: u.end_ms,
                });
            }
        }
    }
}
