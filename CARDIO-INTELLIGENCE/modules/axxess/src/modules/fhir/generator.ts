/**
 * MedScribe — FHIR R4 Document Generator
 * Generates FHIR R4 compliant DocumentReference, Patient,
 * and Encounter resources from session data.
 *
 * Spec: https://www.hl7.org/fhir/R4/documentreference.html
 */

import type { Session, Note, Utterance } from '@/src/types/axxess__src_types__index';

// ─── FHIR Types ─────────────────────────────────────

export interface FHIRBundle {
    resourceType: 'Bundle';
    type: 'document';
    timestamp: string;
    entry: FHIRBundleEntry[];
}

interface FHIRBundleEntry {
    fullUrl: string;
    resource: Record<string, any>;
}

interface FHIRCoding {
    system: string;
    code: string;
    display: string;
}

// ─── Generator ──────────────────────────────────────

export function generateFHIRBundle(
    session: Session,
    note: Note | null,
    utterances: Utterance[]
): FHIRBundle {
    const patientId = `patient-${session.session_id.substring(0, 8)}`;
    const encounterId = `encounter-${session.session_id}`;
    const docRefId = `docref-${session.session_id}`;

    const entries: FHIRBundleEntry[] = [];

    // 1. Patient resource
    entries.push({
        fullUrl: `urn:uuid:${patientId}`,
        resource: {
            resourceType: 'Patient',
            id: patientId,
            name: [{ use: 'official', text: session.patient_name }],
            communication: [
                {
                    language: {
                        coding: [
                            {
                                system: 'urn:ietf:bcp:47',
                                code: session.patient_lang,
                                display: getLanguageName(session.patient_lang),
                            },
                        ],
                    },
                    preferred: true,
                },
            ],
        },
    });

    // 2. Encounter resource
    const encounterStart = new Date(session.started_at).toISOString();
    const encounterEnd = session.ended_at
        ? new Date(session.ended_at).toISOString()
        : encounterStart;

    entries.push({
        fullUrl: `urn:uuid:${encounterId}`,
        resource: {
            resourceType: 'Encounter',
            id: encounterId,
            status: session.status === 'complete' ? 'finished' : 'in-progress',
            class: {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                code: 'AMB',
                display: 'ambulatory',
            },
            type: [
                {
                    coding: [
                        {
                            system: 'http://snomed.info/sct',
                            code: getSpecialtySNOMED(session.specialty),
                            display: `${session.specialty} encounter`,
                        },
                    ],
                },
            ],
            subject: { reference: `urn:uuid:${patientId}` },
            period: { start: encounterStart, end: encounterEnd },
            reasonCode: note ? parseICDCodes(note.icd_codes_json) : [],
        },
    });

    // 3. DocumentReference (clinical note)
    if (note) {
        let soapData: any = {};
        try { soapData = JSON.parse(note.soap_json || '{}'); } catch { }

        const noteContent = [
            `SUBJECTIVE:\n${soapData.subjective || ''}`,
            `OBJECTIVE:\n${soapData.objective || ''}`,
            `ASSESSMENT:\n${soapData.assessment || ''}`,
            `PLAN:\n${soapData.plan || ''}`,
        ].join('\n\n');

        entries.push({
            fullUrl: `urn:uuid:${docRefId}`,
            resource: {
                resourceType: 'DocumentReference',
                id: docRefId,
                status: 'current',
                type: {
                    coding: [
                        {
                            system: 'http://loinc.org',
                            code: '34108-1',
                            display: 'Outpatient Note',
                        },
                    ],
                },
                category: [
                    {
                        coding: [
                            {
                                system: 'http://loinc.org',
                                code: '11488-4',
                                display: 'Consultation note',
                            },
                        ],
                    },
                ],
                subject: { reference: `urn:uuid:${patientId}` },
                date: new Date(session.started_at).toISOString(),
                description: `Clinical note for ${session.patient_name} — ${session.specialty}`,
                content: [
                    {
                        attachment: {
                            contentType: 'text/plain',
                            data: btoa(noteContent),
                            title: 'SOAP Note',
                        },
                    },
                ],
                context: {
                    encounter: [{ reference: `urn:uuid:${encounterId}` }],
                    period: { start: encounterStart, end: encounterEnd },
                },
            },
        });
    }

    // 4. Observation resources for each utterance
    utterances.slice(0, 20).forEach((utt, i) => {
        entries.push({
            fullUrl: `urn:uuid:utterance-${utt.utterance_id}`,
            resource: {
                resourceType: 'Observation',
                id: `obs-${utt.utterance_id}`,
                status: 'final',
                code: {
                    coding: [
                        {
                            system: 'http://loinc.org',
                            code: '75322-8',
                            display: 'Clinical transcript',
                        },
                    ],
                },
                subject: { reference: `urn:uuid:${patientId}` },
                encounter: { reference: `urn:uuid:${encounterId}` },
                effectiveDateTime: new Date(session.started_at + utt.start_ms).toISOString(),
                valueString: utt.original_text,
                component: [
                    {
                        code: { text: 'speaker' },
                        valueString: utt.speaker,
                    },
                    {
                        code: { text: 'confidence' },
                        valueQuantity: {
                            value: utt.confidence,
                            unit: '%',
                            system: 'http://unitsofmeasure.org',
                        },
                    },
                ],
            },
        });
    });

    // 5. Condition resources from ICD codes
    if (note) {
        let icdCodes: any[] = [];
        try { icdCodes = JSON.parse(note.icd_codes_json || '[]'); } catch { }

        icdCodes.forEach((icd: any) => {
            entries.push({
                fullUrl: `urn:uuid:condition-${icd.code}`,
                resource: {
                    resourceType: 'Condition',
                    id: `condition-${icd.code}`,
                    clinicalStatus: {
                        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }],
                    },
                    verificationStatus: {
                        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }],
                    },
                    category: [
                        {
                            coding: [
                                {
                                    system: 'http://terminology.hl7.org/CodeSystem/condition-category',
                                    code: 'encounter-diagnosis',
                                    display: 'Encounter Diagnosis',
                                },
                            ],
                        },
                    ],
                    code: {
                        coding: [
                            {
                                system: 'http://hl7.org/fhir/sid/icd-10-cm',
                                code: icd.code,
                                display: icd.description,
                            },
                        ],
                    },
                    subject: { reference: `urn:uuid:${patientId}` },
                    encounter: { reference: `urn:uuid:${encounterId}` },
                },
            });
        });
    }

    return {
        resourceType: 'Bundle',
        type: 'document',
        timestamp: new Date().toISOString(),
        entry: entries,
    };
}

// ─── Export as shareable text ────────────────────────

export function generateClinicalNoteText(
    session: Session,
    note: Note,
): string {
    let soap: any = {};
    let icdCodes: any[] = [];
    try { soap = JSON.parse(note.soap_json || '{}'); } catch { }
    try { icdCodes = JSON.parse(note.icd_codes_json || '[]'); } catch { }

    const header = [
        '═══════════════════════════════════════════',
        `CLINICAL NOTE — ${session.patient_name}`,
        '═══════════════════════════════════════════',
        `Specialty: ${session.specialty.toUpperCase()}`,
        `Date: ${new Date(session.started_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
        `Duration: ${session.duration_ms ? Math.round(session.duration_ms / 60000) + ' minutes' : 'N/A'}`,
        `Language: ${getLanguageName(session.patient_lang)}`,
        '',
    ].join('\n');

    const soapSection = [
        '── SUBJECTIVE ──',
        soap.subjective || 'N/A',
        '',
        '── OBJECTIVE ──',
        soap.objective || 'N/A',
        '',
        '── ASSESSMENT ──',
        soap.assessment || 'N/A',
        '',
        '── PLAN ──',
        soap.plan || 'N/A',
        '',
    ].join('\n');

    const icdSection = [
        '── ICD-10 CODES ──',
        ...icdCodes.map((c: any) =>
            `${c.is_primary ? '★ ' : '  '}${c.code} — ${c.description} (${Math.round((c.confidence || 0) * 100)}% confidence)`
        ),
        '',
    ].join('\n');

    const summarySection = [
        '── PATIENT SUMMARY ──',
        note.patient_summary || 'N/A',
        '',
        '═══════════════════════════════════════════',
        'Generated by MedScribe AI — Powered by Gemini 2.5 Pro',
        `Exported: ${new Date().toISOString()}`,
        '═══════════════════════════════════════════',
    ].join('\n');

    return [header, soapSection, icdSection, summarySection].join('\n');
}

// ─── Helpers ────────────────────────────────────────

function getLanguageName(code: string): string {
    const names: Record<string, string> = {
        en: 'English', es: 'Spanish', ar: 'Arabic', ht: 'Haitian Creole',
        vi: 'Vietnamese', ru: 'Russian', fr: 'French', zh: 'Chinese',
        pt: 'Portuguese', ko: 'Korean', ja: 'Japanese', km: 'Khmer',
    };
    return names[code] || code;
}

function getSpecialtySNOMED(specialty: string): string {
    const codes: Record<string, string> = {
        cardiology: '394579002', general: '394802001', er: '394576009',
        hospice: '394807007', palliative: '394806003',
    };
    return codes[specialty] || '394802001';
}

function parseICDCodes(icdJson: string): any[] {
    try {
        const codes = JSON.parse(icdJson || '[]');
        return codes.map((c: any) => ({
            coding: [{
                system: 'http://hl7.org/fhir/sid/icd-10-cm',
                code: c.code,
                display: c.description,
            }],
        }));
    } catch { return []; }
}
