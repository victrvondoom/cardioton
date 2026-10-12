/**
 * Evidence Types for CardioTwin
 *
 * Extracted and adapted from: case-twin-main/src/lib/caseProfileTypes.ts
 * Original License: MIT (CaseTwin project)
 *
 * These types support case profile management, similar case matching,
 * and multi-agent orchestration for cardiovascular use cases.
 */

// ============================================================================
// Case Profile Types
// ============================================================================

/**
 * Complete case profile schema for cardiovascular cases
 * Mirrors the JSON schema used by MedGemma extraction, adapted for cardiology
 */
export interface CardiacCaseProfile {
    /** Unique profile identifier */
    profile_id: string;
    /** Case identifier */
    case_id: string;
    /** Image identifier */
    image_id: string;

    /** Patient information */
    patient: CardiacPatientInfo;
    /** Presentation information */
    presentation: CardiacPresentationInfo;
    /** Study information */
    study: CardiacStudyInfo;
    /** Assessment information */
    assessment: CardiacAssessmentInfo;
    /** Findings from imaging and clinical evaluation */
    findings: CardiacFindingsInfo;
    /** Summary information */
    summary: CardiacSummaryInfo;
    /** Outcome information */
    outcome: CardiacOutcomeInfo;
    /** Provenance information */
    provenance: ProvenanceInfo;
    /** Tags and labels */
    tags: TagsInfo;
    /** Dynamic key-value pairs for additional information */
    extra_fields: Record<string, string | string[]>;
}

/** Patient information for cardiovascular cases */
export interface CardiacPatientInfo {
    age_years: number | null;
    sex: string | null;
    immunocompromised: string | null;
    weight_kg: number | null;
    comorbidities: string[];
    medications: string[];
    allergies: string | null;
    /** Cardiovascular-specific */
    cardiovascular_risk_factors?: string[];
    family_history?: string | null;
}

/** Presentation information for cardiovascular cases */
export interface CardiacPresentationInfo {
    chief_complaint: string | null;
    symptom_duration: string | null;
    hpi: string | null; // History of Present Illness
    pmh: string | null; // Past Medical History
    /** Cardiovascular-specific */
    chest_pain_characteristics?: string | null;
    dyspnea_class?: string | null; // NYHA class
    palpitations?: string | null;
    syncope?: string | null;
}

/** Study information for cardiovascular imaging */
export interface CardiacStudyInfo {
    modality: string | null;
    body_region: string | null;
    view_position: string | null;
    radiology_region: string | null;
    caption: string | null;
    image_type: string | null;
    image_subtype: string | null;
    image_url: string | null;
    storage_path: string | null;
    /** Cardiovascular-specific */
    ecg_url?: string | null;
    echo_url?: string | null;
    cmr_url?: string | null;
}

/** Assessment information for cardiovascular cases */
export interface CardiacAssessmentInfo {
    diagnosis_primary: string | null;
    suspected_primary: string[];
    differential: string[];
    urgency: string | null;
    infectious_concern: string | null;
    icu_candidate: string | null;
    clinical_synthesis?: string | null;
    /** Cardiovascular-specific */
    cardiac_risk_score?: string | null;
    ejection_fraction?: string | null;
    arrhythmia_type?: string | null;
}

/** Cardiovascular-specific findings */
export interface CardiovascularFindings {
    /** Cardiac structure */
    cardiomegaly: string | null;
    left_atrial_enlargement: string | null;
    left_ventricular_hypertrophy: string | null;
    right_ventricular_enlargement: string | null;

    /** Coronary findings */
    coronary_artery_disease: string | null;
    stenosis_location?: string | null;
    stenosis_severity?: string | null;

    /** Valvular findings */
    aortic_stenosis: string | null;
    mitral_regurgitation: string | null;
    aortic_regurgitation: string | null;
    mitral_stenosis: string | null;

    /** Functional findings */
    ejection_fraction: string | null;
    wall_motion_abnormalities: string | null;
    regional_wall_motion: string | null;

    /** Other */
    pericardial_effusion: string | null;
    myocardial_infarction_evidence: string | null;
    pulmonary_congestion: string | null;
}

/** Lung findings (relevant for cardiac patients with pulmonary issues) */
export interface LungsFindings {
    consolidation_present: string | null;
    consolidation_locations: string[];
    consolidation_extent: string | null;
    atelectasis_present: string | null;
    atelectasis_locations: string[];
    edema_present: string | null;
    edema_pattern: string | null;
}

/** Pleura findings */
export interface PleuraFindings {
    effusion_present: string | null;
    effusion_side: string | null;
    effusion_size: string | null;
    pneumothorax_present: string | null;
    pneumothorax_side: string | null;
}

/** Combined findings information */
export interface CardiacFindingsInfo {
    lungs: LungsFindings;
    pleura: PleuraFindings;
    cardiomediastinal: CardiovascularFindings;
    devices: DevicesFindings;
}

/** Devices findings */
export interface DevicesFindings {
    lines_tubes_present: string | null;
    device_list: string[];
}

/** Summary information */
export interface CardiacSummaryInfo {
    one_liner: string | null;
    key_points: string[];
    red_flags: string[];
}

/** Outcome information */
export interface CardiacOutcomeInfo {
    success: string | null;
    detail: string | null;
}

/** Provenance information */
export interface ProvenanceInfo {
    dataset_name: string | null;
    pmc_id: string | null;
    pmid: string | null;
    doi: string | null;
    article_title: string | null;
    journal: string | null;
    year: number | null;
    authors: string[];
    license: string | null;
    source_url: string | null;
}

/** Tags information */
export interface TagsInfo {
    ml_labels: string[];
    gt_labels: string[];
    keywords: string[];
    mesh_terms: string[];
}

// ============================================================================
// Match Types
// ============================================================================

/** Similar case match for cardiovascular cases */
export interface CardiacCaseMatch {
    id: string;
    facility: string;
    country: string;
    diagnosis: string;
    similarity: number; // 0-100
    outcome: "Stable" | "Improved" | "Transferred" | "Deteriorated";
    details: Record<string, string>;
    image_url?: string;
    age?: number;
    gender?: string;
    /** Cardiovascular-specific */
    cardiac_case_type?: string;
    risk_factors?: string[];
}

// ============================================================================
// Agent Orchestration Types
// ============================================================================

/** Phase of the agentic orchestrator */
export type OrchestratorPhase =
    | "greeting"
    | "extracting"
    | "patching"
    | "questioning"
    | "ready"
    | "expanded";

/** Type of message in the orchestrator */
export type MessageType =
    | "text"
    | "file_attach"
    | "thinking"
    | "confidence_update"
    | "field_patch"
    | "schema_expansion"
    | "cta";

/** Message in the agentic orchestrator */
export interface OrchestratorMessage {
    id: string;
    role: "assistant" | "user";
    type: MessageType;
    content: string;
    /** Files attached by the user */
    files?: Array<{ name: string; type: string; preview?: string }>;
    /** Which fields were patched in this turn */
    patchedFields?: string[];
    /** Confidence score to display inline */
    confidence?: number;
}

/** State of the agentic orchestrator */
export interface OrchestratorState {
    profile: CardiacCaseProfile;
    phase: OrchestratorPhase;
    messages: OrchestratorMessage[];
    /** The field label we are currently questioning about */
    currentQuestion: string | null;
    readyToProceed: boolean;
}

/** Input for processing a turn in the orchestrator */
export interface ProcessTurnInput {
    userText: string;
    files: File[];
    currentState: OrchestratorState;
}

/** Output from processing a turn in the orchestrator */
export interface ProcessTurnOutput {
    newState: OrchestratorState;
}

// ============================================================================
// UI State Types
// ============================================================================

/** File-like object for upload */
export interface FileLike {
    name: string;
    size: number;
}

/** Upload dropzone props */
export interface UploadDropzoneProps {
    value: FileLike | null;
    onChange: (file: FileLike | null) => void;
    acceptedTypes?: string;
    maxFileSize?: number;
}

/** Match card props */
export interface MatchCardProps {
    match: CardiacCaseMatch;
    onViewDetails: (match: CardiacCaseMatch) => void;
    selected?: boolean;
    onSelect?: () => void;
    condensed?: boolean;
}

/** Case profile view props */
export interface CaseProfileViewProps {
    profile: CardiacCaseProfile;
    className?: string;
    onEnhance?: () => void;
    isEnhancing?: boolean;
    enhancedSynthesis?: string;
    enhancedImaging?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/** Outcome variant for styling */
export type OutcomeVariant = "success" | "warning" | "neutral" | "danger";

/** Analysis status */
export type AnalysisPhase = "upload" | "matches" | "route" | "memo";

/** Empty profile factory function */
export function emptyCardiacProfile(): CardiacCaseProfile {
    return {
        profile_id: "",
        case_id: "",
        image_id: "",
        patient: {
            age_years: null,
            sex: null,
            immunocompromised: null,
            weight_kg: null,
            comorbidities: [],
            medications: [],
            allergies: null,
            cardiovascular_risk_factors: [],
            family_history: null,
        },
        presentation: {
            chief_complaint: null,
            symptom_duration: null,
            hpi: null,
            pmh: null,
            chest_pain_characteristics: null,
            dyspnea_class: null,
            palpitations: null,
            syncope: null,
        },
        study: {
            modality: null,
            body_region: null,
            view_position: null,
            radiology_region: null,
            caption: null,
            image_type: null,
            image_subtype: null,
            image_url: null,
            storage_path: null,
            ecg_url: null,
            echo_url: null,
            cmr_url: null,
        },
        assessment: {
            diagnosis_primary: null,
            suspected_primary: [],
            differential: [],
            urgency: null,
            infectious_concern: null,
            icu_candidate: null,
            clinical_synthesis: null,
            cardiac_risk_score: null,
            ejection_fraction: null,
            arrhythmia_type: null,
        },
        findings: {
            lungs: {
                consolidation_present: null,
                consolidation_locations: [],
                consolidation_extent: null,
                atelectasis_present: null,
                atelectasis_locations: [],
                edema_present: null,
                edema_pattern: null,
            },
            pleura: {
                effusion_present: null,
                effusion_side: null,
                effusion_size: null,
                pneumothorax_present: null,
                pneumothorax_side: null,
            },
            cardiomediastinal: {
                cardiomegaly: null,
                left_atrial_enlargement: null,
                left_ventricular_hypertrophy: null,
                right_ventricular_enlargement: null,
                coronary_artery_disease: null,
                stenosis_location: null,
                stenosis_severity: null,
                aortic_stenosis: null,
                mitral_regurgitation: null,
                aortic_regurgitation: null,
                mitral_stenosis: null,
                ejection_fraction: null,
                wall_motion_abnormalities: null,
                regional_wall_motion: null,
                pericardial_effusion: null,
                myocardial_infarction_evidence: null,
                pulmonary_congestion: null,
            },
            devices: {
                lines_tubes_present: null,
                device_list: [],
            },
        },
        summary: {
            one_liner: null,
            key_points: [],
            red_flags: [],
        },
        outcome: {
            success: null,
            detail: null,
        },
        provenance: {
            dataset_name: null,
            pmc_id: null,
            pmid: null,
            doi: null,
            article_title: null,
            journal: null,
            year: null,
            authors: [],
            license: null,
            source_url: null,
        },
        tags: {
            ml_labels: [],
            gt_labels: [],
            keywords: [],
            mesh_terms: [],
        },
        extra_fields: {},
    };
}
