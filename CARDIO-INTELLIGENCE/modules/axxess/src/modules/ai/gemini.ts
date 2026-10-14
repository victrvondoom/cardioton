/**
 * MedScribe — Gemini AI Service
 * Generates highly detailed clinical SOAP notes, ICD-10 codes,
 * patient summaries, vitals summary, and risk assessment
 * using the Gemini 2.5 Pro API.
 */

const GEMINI_MODEL = 'gemini-2.5-pro';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{ text?: string }>;
        };
    }>;
    error?: { message: string };
}

async function callGemini(prompt: string): Promise<string> {
    const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.2,
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
            },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
    }

    const data: GeminiResponse = await response.json();

    if (data.error) {
        throw new Error(`Gemini API error: ${data.error.message}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        throw new Error('No response content from Gemini');
    }

    return text;
}

// ─── Types ──────────────────────────────────────────

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

export interface VitalSign {
    name: string;
    value: string;
    unit: string;
    status: 'normal' | 'elevated' | 'low' | 'critical';
    reference_range: string;
}

export interface RiskFactor {
    factor: string;
    level: 'low' | 'moderate' | 'high' | 'critical';
    detail: string;
}

export interface MedicationEntry {
    name: string;
    dosage: string;
    frequency: string;
    route: string;
    indication: string;
    status: 'current' | 'new' | 'discontinued' | 'modified';
}

export interface ClinicalNoteResult {
    soap: SOAPNote;
    icd_codes: ICDCode[];
    patient_summary: string;
    contradiction_flags: string[];
    vitals: VitalSign[];
    risk_factors: RiskFactor[];
    medications: MedicationEntry[];
    follow_up_days: number;
    urgency_level: 'routine' | 'urgent' | 'emergent';
    key_findings: string[];
    differential_diagnoses: string[];
}

// ─── Clinical Note Generation ───────────────────────

export async function generateClinicalNote(
    transcript: Array<{ speaker: string; text: string; confidence: number }>,
    specialty: string,
    patientLang: string,
    previousNotes?: string
): Promise<ClinicalNoteResult> {
    const transcriptText = transcript
        .map((u) => `[${u.speaker === 'DR' ? 'Clinician' : 'Patient'}] (confidence: ${Math.round(u.confidence * 100)}%): ${u.text}`)
        .join('\n');

    const languageInstruction =
        patientLang !== 'en'
            ? `The patient speaks ${getLanguageName(patientLang)}. Generate the patient_summary in ${getLanguageName(patientLang)} so the patient can understand their condition, treatment plan, and follow-up instructions directly.`
            : 'Generate the patient_summary in plain English at a 6th-grade reading level. Include what was found, what the treatment plan is, and when to follow up.';

    const contradictionInstruction = previousNotes
        ? `\nPrevious visit notes for context:\n${previousNotes}\n\nCheck for contradictions between this visit and previous visits (e.g., patient denied a condition before but now reports it, medication changes, vitals significantly different). List any contradictions found.`
        : '';

    const prompt = `You are an expert clinical documentation AI for a ${specialty} practice. You produce comprehensive, detailed, and clinically precise documentation.

TRANSCRIPT:
${transcriptText}

${languageInstruction}
${contradictionInstruction}

Analyze the transcript thoroughly and generate a comprehensive JSON response with EXACTLY this structure:

{
  "soap": {
    "subjective": "DETAILED patient history: chief complaint with onset/duration/quality/severity/location/radiation/aggravating-relieving factors, associated symptoms (positive AND pertinent negatives), past medical history mentioned, medications, allergies, social history, family history — all that is mentioned or can be inferred",
    "objective": "ALL physical exam findings: vital signs with exact values, general appearance, system-by-system exam findings (cardiac, respiratory, abdominal, neurological, musculoskeletal as relevant), any diagnostic results (labs, imaging, ECG) mentioned or ordered",
    "assessment": "Primary diagnosis with clinical reasoning, differential diagnoses ranked by likelihood, severity assessment, risk stratification, any complications or concerns noted",
    "plan": "NUMBERED treatment plan: 1) Diagnostic workup ordered 2) Medications with exact doses/routes/frequencies 3) Non-pharmacological interventions 4) Patient education points 5) Follow-up timeline 6) Return precautions / red flags to watch for"
  },
  "icd_codes": [
    {
      "code": "Exact ICD-10-CM code (e.g., I20.9)",
      "description": "Full official description",
      "confidence": 0.0 to 1.0 based on evidence strength,
      "is_primary": true for primary diagnosis
    }
  ],
  "vitals": [
    {
      "name": "Blood Pressure",
      "value": "142/88",
      "unit": "mmHg",
      "status": "normal|elevated|low|critical",
      "reference_range": "Normal: <120/80"
    }
  ],
  "risk_factors": [
    {
      "factor": "Uncontrolled Hypertension",
      "level": "low|moderate|high|critical",
      "detail": "BP 142/88 above target of 130/80 for cardiac patients. Increases risk of MI and stroke."
    }
  ],
  "medications": [
    {
      "name": "Lisinopril",
      "dosage": "10mg",
      "frequency": "Once daily",
      "route": "Oral",
      "indication": "Hypertension management",
      "status": "current|new|discontinued|modified"
    }
  ],
  "patient_summary": "Comprehensive but readable summary ${patientLang !== 'en' ? `in ${getLanguageName(patientLang)}` : 'in plain English'}. Include: what was found, what tests are needed, medication instructions, follow-up timeline, and when to seek emergency care.",
  "contradiction_flags": ["List contradictions with previous visits, or empty array"],
  "follow_up_days": 7,
  "urgency_level": "routine|urgent|emergent",
  "key_findings": ["Most clinically significant finding 1", "Finding 2", "Finding 3"],
  "differential_diagnoses": ["Primary diagnosis (most likely)", "Alternative 1", "Alternative 2"]
}

IMPORTANT RULES:
- Be EXHAUSTIVE — extract every piece of clinical data from the transcript
- Include at least 2-4 ICD-10 codes with accurate confidence scores
- Extract ALL vitals mentioned (with exact values)
- Identify ALL medications (current AND newly prescribed)
- Assess risk factors based on the clinical picture
- The plan section MUST be numbered with specific, actionable items
- Include pertinent negatives in subjective and objective
- If information is not in the transcript, do NOT fabricate it — only document what is present
- Each SOAP section should be 3-6 sentences minimum`;

    const responseText = await callGemini(prompt);

    try {
        const parsed = JSON.parse(responseText);
        return {
            soap: parsed.soap || { subjective: '', objective: '', assessment: '', plan: '' },
            icd_codes: (parsed.icd_codes || []).map((c: any) => ({
                code: c.code || '',
                description: c.description || '',
                confidence: typeof c.confidence === 'number' ? c.confidence : 0.5,
                is_primary: Boolean(c.is_primary),
            })),
            patient_summary: parsed.patient_summary || '',
            contradiction_flags: parsed.contradiction_flags || [],
            vitals: (parsed.vitals || []).map((v: any) => ({
                name: v.name || '',
                value: v.value || '',
                unit: v.unit || '',
                status: v.status || 'normal',
                reference_range: v.reference_range || '',
            })),
            risk_factors: (parsed.risk_factors || []).map((r: any) => ({
                factor: r.factor || '',
                level: r.level || 'low',
                detail: r.detail || '',
            })),
            medications: (parsed.medications || []).map((m: any) => ({
                name: m.name || '',
                dosage: m.dosage || '',
                frequency: m.frequency || '',
                route: m.route || '',
                indication: m.indication || '',
                status: m.status || 'current',
            })),
            follow_up_days: parsed.follow_up_days || 7,
            urgency_level: parsed.urgency_level || 'routine',
            key_findings: parsed.key_findings || [],
            differential_diagnoses: parsed.differential_diagnoses || [],
        };
    } catch (parseError) {
        console.error('Failed to parse Gemini response:', responseText);
        throw new Error('Failed to parse clinical note response');
    }
}

// ─── Helper ─────────────────────────────────────────

function getLanguageName(code: string): string {
    const names: Record<string, string> = {
        en: 'English', es: 'Spanish', ar: 'Arabic', ht: 'Haitian Creole',
        vi: 'Vietnamese', ru: 'Russian', fr: 'French', zh: 'Chinese',
        pt: 'Portuguese', ko: 'Korean', ja: 'Japanese', km: 'Khmer',
    };
    return names[code] || code;
}

// ─── Audio Transcription (Gemini Multimodal ASR) ────

export interface TranscriptSegment {
    speaker: 'DR' | 'PT';
    text: string;               // Original language text
    translatedText: string | null; // English translation (null if already English)
    sourceLang: string;          // Language code of the original text
    confidence: number;
    entities: Array<{ text: string; type: string }>;
    startMs: number;
    endMs: number;
}

/**
 * Transcribes audio using Gemini 2.5 Pro multimodal.
 * Sends base64-encoded audio and gets back speaker-attributed,
 * entity-tagged transcript segments with translations.
 */
export async function transcribeAudio(
    base64Audio: string,
    mimeType: string = 'audio/wav',
    patientLang: string = 'en',
    specialty: string = 'general',
): Promise<TranscriptSegment[]> {
    const needsTranslation = patientLang !== 'en';
    const langName = getLanguageName(patientLang);

    const prompt = `You are a medical speech-to-text engine specialized in ${specialty}.
Transcribe this audio recording of a clinical encounter.

RULES:
- Identify each speaker as DR (clinician) or PT (patient) based on context
  (asking questions/instructions = DR, reporting symptoms/answering = PT)
- Transcribe exactly what is said in the ORIGINAL language spoken
- The doctor likely speaks English
- The patient speaks ${langName}
${needsTranslation ? `- For non-English speech, provide an English translation in "translatedText"
- For English speech, set "translatedText" to null` : '- All speech is in English, set "translatedText" to null'}
- Set "sourceLang" to the language code of the original text (e.g. "en", "${patientLang}")
- Extract medical entities: medications, conditions, symptoms, vitals, procedures, durations
- Estimate confidence (0.0 to 1.0) for each segment based on audio clarity
- Estimate start and end timestamps in milliseconds
- Do NOT paraphrase — transcribe exactly what is said

Return a JSON array:
[
  {
    "speaker": "DR" or "PT",
    "text": "original language transcription",
    "translatedText": "English translation" or null,
    "sourceLang": "en" or "${patientLang}",
    "confidence": 0.0-1.0,
    "entities": [{"text": "entity text", "type": "medication|condition|symptom|vital|procedure|duration"}],
    "startMs": 0,
    "endMs": 5000
  }
]

If the audio is unclear or empty, return an empty array [].`;

    const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    {
                        inlineData: {
                            mimeType,
                            data: base64Audio,
                        },
                    },
                    { text: prompt },
                ],
            }],
            generationConfig: {
                temperature: 0.1,
                topP: 0.8,
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
            },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini ASR error (${response.status}): ${errorBody}`);
    }

    const data: GeminiResponse = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return [];

    try {
        const segments: TranscriptSegment[] = JSON.parse(text);
        return segments.map((s) => ({
            speaker: s.speaker === 'PT' ? 'PT' : 'DR',
            text: s.text || '',
            translatedText: s.translatedText || null,
            sourceLang: s.sourceLang || 'en',
            confidence: typeof s.confidence === 'number' ? s.confidence : 0.8,
            entities: Array.isArray(s.entities) ? s.entities : [],
            startMs: s.startMs || 0,
            endMs: s.endMs || 0,
        }));
    } catch {
        console.warn('Failed to parse ASR response, returning raw text');
        return [{
            speaker: 'DR',
            text: text,
            translatedText: null,
            sourceLang: 'en',
            confidence: 0.7,
            entities: [],
            startMs: 0,
            endMs: 0,
        }];
    }
}

// ─── Translation (Gemini-powered) ───────────────────

/**
 * Translates text using Gemini 2.5 Pro.
 * Preserves medical terminology and context.
 */
export async function translateText(
    text: string,
    sourceLang: string,
    targetLang: string,
): Promise<string> {
    if (sourceLang === targetLang) return text;

    const prompt = `Translate the following medical text from ${getLanguageName(sourceLang)} to ${getLanguageName(targetLang)}.

RULES:
- Preserve medical terminology accurately (drug names, anatomical terms, procedures)
- Keep dosage numbers and units as-is
- Maintain clinical context and meaning
- Do NOT add explanations or notes — return ONLY the translated text

Text to translate:
${text}`;

    const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 2048,
            },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
        }),
    });

    if (!response.ok) {
        throw new Error(`Translation error: ${response.status}`);
    }

    const data: GeminiResponse = await response.json();
    const translated = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return translated?.trim() || text;
}

// ─── Fast ASR (minimal prompt for speed) ────────────

/**
 * FAST transcription — minimal prompt to get text on screen ASAP.
 * Just identifies speaker and text, skips entities/detailed analysis.
 * ~2-3x faster than full transcribeAudio.
 */
export async function transcribeAudioFast(
    base64Audio: string,
    mimeType: string = 'audio/m4a',
): Promise<Array<{ speaker: 'DR' | 'PT'; text: string; confidence: number }>> {
    const prompt = `Transcribe this audio. Identify speakers as DR (doctor/clinician) or PT (patient).
Return JSON array: [{"speaker":"DR","text":"...","confidence":0.9}]
If silent or unclear, return [].`;

    const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { inlineData: { mimeType, data: base64Audio } },
                    { text: prompt },
                ],
            }],
            generationConfig: {
                temperature: 0.0,
                maxOutputTokens: 1024,
                responseMimeType: 'application/json',
            },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
        }),
    });

    if (!response.ok) return [];

    const data: GeminiResponse = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return [];

    try {
        const parsed = JSON.parse(text);
        return (Array.isArray(parsed) ? parsed : []).map((s: any) => ({
            speaker: (s.speaker === 'PT' ? 'PT' : 'DR') as 'DR' | 'PT',
            text: s.text || '',
            confidence: typeof s.confidence === 'number' ? s.confidence : 0.8,
        }));
    } catch {
        // If JSON parsing fails, return raw text as single segment
        return [{ speaker: 'DR' as const, text: text.trim(), confidence: 0.6 }];
    }
}

// ─── Transcript Refinement (periodic Gemini polish) ──

export interface RefinedEntry {
    index: number;       // which entry to update
    text: string;        // fixed text
    speaker?: 'DR' | 'PT'; // corrected speaker role
    translatedText?: string; // translation if applicable
}

/**
 * Periodic Gemini refinement pass — reviews accumulated transcript
 * and fixes medical terminology, typos, and translation.
 * Called every ~30s in the background, does NOT block the UI.
 */
export async function refineTranscript(
    entries: Array<{ index: number; speaker: string; text: string; sourceLang: string }>,
    targetLang: string = 'en',
): Promise<RefinedEntry[]> {
    if (entries.length === 0) return [];

    const needsTranslation = entries.some(e => e.sourceLang !== 'en');
    const transcriptText = entries.map((e, i) =>
        `[${i}] [${e.speaker}] (${e.sourceLang}) ${e.text}`
    ).join('\n');

    const prompt = `Review this medical transcript and fix any errors.

TRANSCRIPT:
${transcriptText}

FIX:
- SPEAKER ROLES: Identify who is the Doctor (DR) and who is the Patient (PT). 
  Doctor usually: asks questions, gives instructions, makes assessments, prescribes.
  Patient usually: describes symptoms, answers questions, reports pain/feelings.
  Re-label speakers if they seem wrong.
- Correct obvious speech-to-text errors (e.g. "lisin o pril" → "Lisinopril")
- Fix medical terminology spelling (drug names, conditions, procedures)
- Fix number/dosage errors (e.g. "to milligrams" → "two milligrams")
${needsTranslation ? `- Translate non-English entries (sourceLang != "en") to English in "translatedText"` : ''}
- ONLY return entries that need changes — skip correct ones

Return JSON array:
[{"index": 0, "text": "corrected text", "speaker": "DR"${needsTranslation ? ', "translatedText": "english translation"' : ''}}]

If nothing needs fixing, return [].`;

    try {
        const responseText = await callGemini(prompt);
        const parsed = JSON.parse(responseText);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}
