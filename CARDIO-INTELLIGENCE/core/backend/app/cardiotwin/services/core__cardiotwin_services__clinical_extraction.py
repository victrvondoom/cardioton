"""Clinical Extraction Service for CardioTwin.

This service provides cardiovascular-specific clinical information extraction
capabilities, adapted from Epicast-main's syndromic surveillance system.

Original source: Epicast-main/src/agents/intake_agent.py
License: MIT (Copyright (c) 2026 EpiCast Contributors)

Adaptations for CardioTwin:
- Changed from general syndromic surveillance to cardiovascular-specific extraction
- Adapted schema for cardiac terminology (ECG findings, echo observations, etc.)
- Removed MedASR speech-to-text (not needed for CardioTwin's text-based workflow)
- Integrated with CardioTwin's canonical domain model

Capabilities:
- Extract structured cardiac observations from clinical text
- Identify relevant cardiac symptoms and findings
- Extract temporal information (onset, duration)
- Flag urgent cardiac conditions
- Support offline-first workflows
"""

from __future__ import annotations

import re
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from app.cardiotwin.models import DataProvenance

# =============================================================================
# CARDIOVASCULAR SCHEMA
# =============================================================================

class CardiacSeverity(str, Enum):
    """Severity levels for cardiac findings."""
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"
    CRITICAL = "critical"
    STABLE = "stable"
    UNSTABLE = "unstable"


class CardiacCategory(str, Enum):
    """Cardiovascular categories for classification."""
    ACUTE_CORONARY_SYNDROME = "acute_coronary_syndrome"
    ARRHYTHMIA = "arrhythmia"
    HEART_FAILURE = "heart_failure"
    VALVULAR_DISEASE = "valvular_disease"
    CONGENITAL_HEART_DISEASE = "congenital_heart_disease"
    CARDIOMYOPATHY = "cardiomyopathy"
    PERICARDIAL_DISEASE = "pericardial_disease"
    VASCULAR_DISEASE = "vascular_disease"
    ELECTROPHYSIOLOGY = "electrophysiology"
    STRUCTURAL_HEART_DISEASE = "structural_heart_disease"
    UNCLEAR = "unclear"


class ECGFinding(str, Enum):
    """Standard ECG findings."""
    NORMAL = "normal"
    SINUS_TACHYCARDIA = "sinus_tachycardia"
    SINUS_BRADYCARDIA = "sinus_bradycardia"
    ATRIAL_FIBRILLATION = "atrial_fibrillation"
    ATRIAL_FLUTTER = "atrial_flutter"
    SVT = "svt"
    VENTRICULAR_TACHYCARDIA = "ventricular_tachycardia"
    VENTRICULAR_FIBRILLATION = "ventricular_fibrillation"
    HEART_BLOCK_FIRST = "first_degree_heart_block"
    HEART_BLOCK_SECOND = "second_degree_heart_block"
    HEART_BLOCK_THIRD = "third_degree_heart_block"
    ST_ELEVATION = "st_elevation"
    ST_DEPRESSION = "st_depression"
    T_WAVE_INVERSION = "t_wave_inversion"
    PATHOLOGICAL_Q_WAVE = "pathological_q_wave"
    LEFT_BUNDLE_BRANCH_BLOCK = "left_bundle_branch_block"
    RIGHT_BUNDLE_BRANCH_BLOCK = "right_bundle_branch_block"
    LEFT_ANTERIOR_HEMIBLOCK = "left_anterior_hemiblock"
    LEFT_POSTERIOR_HEMIBLOCK = "left_posterior_hemiblock"
    PRE_EXCITATION = "pre_excitation"
    BRUGADA = "brugada"
    LONG_QT = "long_qt"
    SHORT_QT = "short_qt"
    EARLY_REPOLARIZATION = "early_repolarization"
    PACING_RHYTHM = "pacing_rhythm"


class EchocardiographyFinding(str, Enum):
    """Standard echocardiography findings."""
    NORMAL = "normal"
    LEFT_VENTRICULAR_HYPERTROPHY = "left_ventricular_hypertrophy"
    LEFT_VENTRICULAR_DILATION = "left_ventricular_dilation"
    RIGHT_VENTRICULAR_DILATION = "right_ventricular_dilation"
    LEFT_ATRIAL_ENLARGEMENT = "left_atrial_enlargement"
    RIGHT_ATRIAL_ENLARGEMENT = "right_atrial_enlargement"
    MITRAL_STENOSIS = "mitral_stenosis"
    MITRAL_REGURGITATION = "mitral_regurgitation"
    AORTIC_STENOSIS = "aortic_stenosis"
    AORTIC_REGURGITATION = "aortic_regurgitation"
    TRICUSPID_REGURGITATION = "tricuspid_regurgitation"
    PULMONIC_STENOSIS = "pulmonic_stenosis"
    PULMONIC_REGURGITATION = "pulmonic_regurgitation"
    PERICARDIAL_EFFUSION = "pericardial_effusion"
    WALL_MOTION_ABNORMALITY = "wall_motion_abnormality"
    REDUCED_EF = "reduced_ejection_fraction"
    NORMAL_EF = "normal_ejection_fraction"
    HYPERKINESIS = "hyperkinesis"
    VALVE_VEGETATION = "valve_vegetation"
    INTRA_CARDIAC_MASS = "intra_cardiac_mass"
    CONGENITAL_ANOMALY = "congenital_anomaly"


class CardiacSymptom(str, Enum):
    """Cardiovascular symptoms."""
    CHEST_PAIN = "chest_pain"
    SHORTNESS_OF_BREATH = "shortness_of_breath"
    PALPITATIONS = "palpitations"
    SYNCOPE = "syncope"
    PRESYNCOPE = "presyncope"
    FATIGUE = "fatigue"
    PERIPHERAL_EDEMA = "peripheral_edema"
    ORTHOPNEA = "orthopnea"
    PAROXYSMAL_NOCTURNAL_DYSPNEA = "paroxysmal_nocturnal_dyspnea"
    CLAUDICATION = "claudication"
    DIZZINESS = "dizziness"
    DIAPHORESIS = "diaphoresis"
    COUGH = "cough"
    HEMOPTYSIS = "hemoptysis"
    FEVER = "fever"


def _mentions(text: str, phrase: str) -> bool:
    """Whole-word, case-insensitive match: "ar" must not match "heart", nor "normal" match "abnormal"."""
    return re.search(rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])", text, re.IGNORECASE) is not None


def _split_items(phrase: str) -> list[str]:
    """ "hypertension, diabetes and CKD" -> ["Hypertension", "Diabetes", "CKD"]."""
    items = (item.strip(" :-") for item in re.split(r",|;|\band\b|\bor\b", phrase))
    return [item[:1].upper() + item[1:] for item in items if item]


class ClinicalExtractionError(Exception):
    """Exception raised when clinical extraction fails."""
    pass


class CardiacObservation(BaseModel):
    """A single extracted cardiac observation."""

    finding: str | ECGFinding | EchocardiographyFinding | CardiacSymptom
    category: CardiacCategory | None = None
    severity: CardiacSeverity | None = None
    onset_days: int | None = None
    duration_minutes: int | None = None
    confidence: float = 0.0
    source_text: str | None = None
    negation: bool = False
    temporal_relationship: str | None = None

    class Config:
        use_enum_values = True


class StructuredCardiacSignal(BaseModel):
    """Structured cardiovascular signal extracted from clinical text."""

    # Patient context
    patient_id: str | None = None
    patient_age: int | None = None
    patient_sex: str | None = None

    # Temporal information
    encounter_date: datetime | None = None
    symptom_onset_days: int | None = None

    # ECG findings
    ecg_findings: list[ECGFinding] = []
    ecg_description: str | None = None

    # Echocardiography findings
    echo_findings: list[EchocardiographyFinding] = []
    echo_description: str | None = None

    # Symptoms
    symptoms: list[CardiacSymptom] = []
    symptom_description: str | None = None

    # Cardiac categories
    primary_category: CardiacCategory | None = None
    secondary_categories: list[CardiacCategory] = []

    # Severity
    overall_severity: CardiacSeverity | None = None

    # Urgency
    urgent_conditions: list[str] = []

    # ICD-10 codes
    icd10_codes: list[str] = []

    # Clinical context
    clinical_history: list[str] = []
    medications: list[str] = []
    allergies: list[str] = []

    # Quality and provenance
    confidence_score: float = 0.0
    extraction_method: str = "medical_llm"
    provenance: str = DataProvenance.MANUAL_ENTRY.value

    # Raw observations
    observations: list[CardiacObservation] = []

    # Metadata
    extracted_at: datetime = Field(default_factory=datetime.utcnow)
    model_version: str = "1.0"


# =============================================================================
# EXTRACTION ENGINE
# =============================================================================

class CardiacExtractionEngine:
    """Engine for extracting cardiovascular information from clinical text.

    This engine adapts Epicast's syndromic surveillance approach to
    cardiovascular-specific extraction. It processes clinical narratives
    and extracts structured cardiac observations.

    The extraction is designed to be:
    - Offline-capable (when models are available locally)
    - Cardiovascular-specific
    - Structured and machine-readable
    - Traceable to source text
    """

    def __init__(self, model_name: str = "medgemma-4b", device: str = "cpu"):
        """Initialize the extraction engine.

        Args:
            model_name: Name of the model to use for extraction
            device: PyTorch device ('cuda' or 'cpu')
        """
        self.model_name = model_name
        self.device = device
        self._model = None
        self._processor = None
        self._is_loaded = False

    def load_model(self) -> None:
        """Load the extraction model.

        Note: In CardioTwin, this is a placeholder. Actual implementation
        would load a cardiovascular-specific LLM or use an API.
        """
        # For CardioTwin, we'll use a simpler approach
        # In production, this would load MedGemma or similar
        self._is_loaded = True

    @property
    def is_loaded(self) -> bool:
        """Check if model is loaded."""
        return self._is_loaded

    def extract_from_text(
        self,
        clinical_text: str,
        patient_context: dict[str, Any] | None = None
    ) -> StructuredCardiacSignal:
        """Extract cardiovascular information from clinical text.

        Args:
            clinical_text: The clinical narrative to process
            patient_context: Optional patient context (age, sex, etc.)

        Returns:
            StructuredCardiacSignal with extracted information
        """
        if not clinical_text or not clinical_text.strip():
            raise ClinicalExtractionError("Clinical text is empty")

        # For now, implement a rule-based extraction
        # In production, this would use an LLM
        return self._rule_based_extraction(clinical_text, patient_context)

    def _rule_based_extraction(
        self,
        text: str,
        patient_context: dict[str, Any] | None = None
    ) -> StructuredCardiacSignal:
        """Rule-based extraction as a fallback.

        This provides basic extraction without requiring an LLM.
        """
        # Normalize text
        text_lower = text.lower()

        # Extract observations
        observations = self._extract_observations(text_lower, text)

        # Extract ECG findings
        ecg_findings = self._extract_ecg_findings(text_lower)

        # Extract echo findings
        echo_findings = self._extract_echo_findings(text_lower)

        # Extract symptoms
        symptoms = self._extract_symptoms(text_lower)

        # Extract categories
        primary_category, secondary_categories = self._extract_categories(
            ecg_findings, echo_findings, symptoms
        )

        # Extract severity
        overall_severity = self._extract_severity(text_lower)

        # Extract ICD-10 codes
        icd10_codes = self._extract_icd10_codes(
            ecg_findings, echo_findings, symptoms
        )

        # Extract urgent conditions
        urgent_conditions = self._extract_urgent_conditions(text_lower)

        return StructuredCardiacSignal(
            patient_id=patient_context.get("patient_id") if patient_context else None,
            patient_age=patient_context.get("age") if patient_context else None,
            patient_sex=patient_context.get("sex") if patient_context else None,
            encounter_date=patient_context.get("encounter_date") if patient_context else None,
            symptom_onset_days=patient_context.get("symptom_onset_days") if patient_context else None,
            ecg_findings=ecg_findings,
            ecg_description=self._extract_ecg_description(text_lower),
            echo_findings=echo_findings,
            echo_description=self._extract_echo_description(text_lower),
            symptoms=symptoms,
            symptom_description=self._extract_symptom_description(text_lower),
            primary_category=primary_category,
            secondary_categories=secondary_categories,
            overall_severity=overall_severity,
            urgent_conditions=urgent_conditions,
            icd10_codes=icd10_codes,
            clinical_history=self._extract_clinical_history(text_lower),
            medications=self._extract_medications(text_lower),
            allergies=self._extract_allergies(text_lower),
            confidence_score=self._calculate_confidence(observations),
            observations=observations,
            provenance=DataProvenance.AI_GENERATED.value,
            extraction_method="rule_based",
            model_version="1.0"
        )

    def _extract_observations(
        self,
        text_lower: str,
        text_original: str
    ) -> list[CardiacObservation]:
        """Extract individual observations from text."""
        observations: list[CardiacObservation] = []

        # This is a simplified implementation
        # In production, this would be more sophisticated

        return observations

    def _extract_ecg_findings(self, text: str) -> list[ECGFinding]:
        """Extract ECG findings from text."""
        findings = []

        # Map text patterns to ECG findings
        ecg_patterns = {
            "st elevation": ECGFinding.ST_ELEVATION,
            "st depression": ECGFinding.ST_DEPRESSION,
            "t wave inversion": ECGFinding.T_WAVE_INVERSION,
            "atrial fibrillation": ECGFinding.ATRIAL_FIBRILLATION,
            "atrial flutter": ECGFinding.ATRIAL_FLUTTER,
            "ventricular tachycardia": ECGFinding.VENTRICULAR_TACHYCARDIA,
            "ventricular fibrillation": ECGFinding.VENTRICULAR_FIBRILLATION,
            "sinus tachycardia": ECGFinding.SINUS_TACHYCARDIA,
            "sinus bradycardia": ECGFinding.SINUS_BRADYCARDIA,
            "first degree block": ECGFinding.HEART_BLOCK_FIRST,
            "second degree block": ECGFinding.HEART_BLOCK_SECOND,
            "third degree block": ECGFinding.HEART_BLOCK_THIRD,
            "complete heart block": ECGFinding.HEART_BLOCK_THIRD,
            "lbbb": ECGFinding.LEFT_BUNDLE_BRANCH_BLOCK,
            "left bundle branch block": ECGFinding.LEFT_BUNDLE_BRANCH_BLOCK,
            "rbbb": ECGFinding.RIGHT_BUNDLE_BRANCH_BLOCK,
            "right bundle branch block": ECGFinding.RIGHT_BUNDLE_BRANCH_BLOCK,
            "pathological q wave": ECGFinding.PATHOLOGICAL_Q_WAVE,
            "normal ecg": ECGFinding.NORMAL,
            "normal": ECGFinding.NORMAL,
        }

        for pattern, finding in ecg_patterns.items():
            if _mentions(text, pattern) and finding not in findings:
                findings.append(finding)

        return findings

    def _extract_echo_findings(self, text: str) -> list[EchocardiographyFinding]:
        """Extract echocardiography findings from text."""
        findings = []

        echo_patterns = {
            "lv hypertrophy": EchocardiographyFinding.LEFT_VENTRICULAR_HYPERTROPHY,
            "lvh": EchocardiographyFinding.LEFT_VENTRICULAR_HYPERTROPHY,
            "left ventricular hypertrophy": EchocardiographyFinding.LEFT_VENTRICULAR_HYPERTROPHY,
            "lv dilation": EchocardiographyFinding.LEFT_VENTRICULAR_DILATION,
            "left ventricular dilation": EchocardiographyFinding.LEFT_VENTRICULAR_DILATION,
            "rv dilation": EchocardiographyFinding.RIGHT_VENTRICULAR_DILATION,
            "right ventricular dilation": EchocardiographyFinding.RIGHT_VENTRICULAR_DILATION,
            "left atrial enlargement": EchocardiographyFinding.LEFT_ATRIAL_ENLARGEMENT,
            "right atrial enlargement": EchocardiographyFinding.RIGHT_ATRIAL_ENLARGEMENT,
            "mitral stenosis": EchocardiographyFinding.MITRAL_STENOSIS,
            "mitral regurgitation": EchocardiographyFinding.MITRAL_REGURGITATION,
            "mr": EchocardiographyFinding.MITRAL_REGURGITATION,
            "aortic stenosis": EchocardiographyFinding.AORTIC_STENOSIS,
            "aortic regurgitation": EchocardiographyFinding.AORTIC_REGURGITATION,
            "ar": EchocardiographyFinding.AORTIC_REGURGITATION,
            "tricuspid regurgitation": EchocardiographyFinding.TRICUSPID_REGURGITATION,
            "pericardial effusion": EchocardiographyFinding.PERICARDIAL_EFFUSION,
            "wall motion abnormality": EchocardiographyFinding.WALL_MOTION_ABNORMALITY,
            "reduced ef": EchocardiographyFinding.REDUCED_EF,
            "reduced ejection fraction": EchocardiographyFinding.REDUCED_EF,
            "normal ef": EchocardiographyFinding.NORMAL_EF,
            "normal ejection fraction": EchocardiographyFinding.NORMAL_EF,
            "normal echo": EchocardiographyFinding.NORMAL,
            "normal": EchocardiographyFinding.NORMAL,
        }

        for pattern, finding in echo_patterns.items():
            if _mentions(text, pattern) and finding not in findings:
                findings.append(finding)

        return findings

    def _extract_symptoms(self, text: str) -> list[CardiacSymptom]:
        """Extract symptoms from text."""
        symptoms = []

        symptom_patterns = {
            "chest pain": CardiacSymptom.CHEST_PAIN,
            "cp": CardiacSymptom.CHEST_PAIN,
            "shortness of breath": CardiacSymptom.SHORTNESS_OF_BREATH,
            "sob": CardiacSymptom.SHORTNESS_OF_BREATH,
            "dyspnea": CardiacSymptom.SHORTNESS_OF_BREATH,
            "palpitations": CardiacSymptom.PALPITATIONS,
            "syncope": CardiacSymptom.SYNCOPE,
            "presyncope": CardiacSymptom.PRESYNCOPE,
            "near syncope": CardiacSymptom.PRESYNCOPE,
            "fatigue": CardiacSymptom.FATIGUE,
            "edema": CardiacSymptom.PERIPHERAL_EDEMA,
            "peripheral edema": CardiacSymptom.PERIPHERAL_EDEMA,
            "orthopnea": CardiacSymptom.ORTHOPNEA,
            "pnd": CardiacSymptom.PAROXYSMAL_NOCTURNAL_DYSPNEA,
            "paroxysmal nocturnal dyspnea": CardiacSymptom.PAROXYSMAL_NOCTURNAL_DYSPNEA,
            "claudication": CardiacSymptom.CLAUDICATION,
            "dizziness": CardiacSymptom.DIZZINESS,
            "diaphoresis": CardiacSymptom.DIAPHORESIS,
            "sweating": CardiacSymptom.DIAPHORESIS,
            "cough": CardiacSymptom.COUGH,
        }

        for pattern, symptom in symptom_patterns.items():
            if _mentions(text, pattern) and symptom not in symptoms:
                symptoms.append(symptom)

        return symptoms

    def _extract_categories(
        self,
        ecg_findings: list[ECGFinding],
        echo_findings: list[EchocardiographyFinding],
        symptoms: list[CardiacSymptom]
    ) -> tuple[CardiacCategory | None, list[CardiacCategory]]:
        """Determine cardiac categories from findings."""
        primary = None
        secondary = []

        # ACS detection
        acs_keywords = [
            ECGFinding.ST_ELEVATION,
            ECGFinding.ST_DEPRESSION,
            ECGFinding.PATHOLOGICAL_Q_WAVE,
            CardiacSymptom.CHEST_PAIN
        ]
        if any(f in ecg_findings or f in symptoms for f in acs_keywords):
            primary = CardiacCategory.ACUTE_CORONARY_SYNDROME

        # Arrhythmia detection
        arr_keywords = [
            ECGFinding.ATRIAL_FIBRILLATION,
            ECGFinding.ATRIAL_FLUTTER,
            ECGFinding.VENTRICULAR_TACHYCARDIA,
            ECGFinding.VENTRICULAR_FIBRILLATION,
            ECGFinding.HEART_BLOCK_FIRST,
            ECGFinding.HEART_BLOCK_SECOND,
            ECGFinding.HEART_BLOCK_THIRD,
        ]
        if any(f in ecg_findings for f in arr_keywords):
            if primary is None:
                primary = CardiacCategory.ARRHYTHMIA
            else:
                if CardiacCategory.ARRHYTHMIA not in secondary:
                    secondary.append(CardiacCategory.ARRHYTHMIA)

        # Heart failure detection
        hf_keywords = [
            EchocardiographyFinding.REDUCED_EF,
            EchocardiographyFinding.LEFT_VENTRICULAR_DILATION,
            CardiacSymptom.SHORTNESS_OF_BREATH,
            CardiacSymptom.ORTHOPNEA,
            CardiacSymptom.PAROXYSMAL_NOCTURNAL_DYSPNEA,
            CardiacSymptom.PERIPHERAL_EDEMA
        ]
        if any(f in echo_findings or f in symptoms for f in hf_keywords):
            if primary is None:
                primary = CardiacCategory.HEART_FAILURE
            else:
                if CardiacCategory.HEART_FAILURE not in secondary:
                    secondary.append(CardiacCategory.HEART_FAILURE)

        # Valvular disease detection
        valv_keywords = [
            EchocardiographyFinding.MITRAL_STENOSIS,
            EchocardiographyFinding.MITRAL_REGURGITATION,
            EchocardiographyFinding.AORTIC_STENOSIS,
            EchocardiographyFinding.AORTIC_REGURGITATION,
        ]
        if any(f in echo_findings for f in valv_keywords):
            if primary is None:
                primary = CardiacCategory.VALVULAR_DISEASE
            else:
                if CardiacCategory.VALVULAR_DISEASE not in secondary:
                    secondary.append(CardiacCategory.VALVULAR_DISEASE)

        return primary, secondary

    def _extract_severity(self, text: str) -> CardiacSeverity | None:
        """Extract severity from text."""
        severity_patterns = {
            "critical": CardiacSeverity.CRITICAL,
            "life threatening": CardiacSeverity.CRITICAL,
            "unstable": CardiacSeverity.UNSTABLE,
            "severe": CardiacSeverity.SEVERE,
            "moderate": CardiacSeverity.MODERATE,
            "mild": CardiacSeverity.MILD,
            "stable": CardiacSeverity.STABLE,
        }

        for pattern, severity in severity_patterns.items():
            if _mentions(text, pattern):
                return severity

        return None

    def _extract_icd10_codes(
        self,
        ecg_findings: list[ECGFinding],
        echo_findings: list[EchocardiographyFinding],
        symptoms: list[CardiacSymptom]
    ) -> list[str]:
        """Generate ICD-10 codes from findings."""
        codes = []

        # Map findings to ICD-10 codes
        icd10_map = {
            ECGFinding.ATRIAL_FIBRILLATION: "I48.0",
            ECGFinding.ATRIAL_FLUTTER: "I48.1",
            ECGFinding.VENTRICULAR_TACHYCARDIA: "I47.2",
            ECGFinding.VENTRICULAR_FIBRILLATION: "I49.0",
            ECGFinding.ST_ELEVATION: "I21.3",
            ECGFinding.ST_DEPRESSION: "I20.8",
            ECGFinding.HEART_BLOCK_FIRST: "I44.0",
            ECGFinding.HEART_BLOCK_SECOND: "I44.1",
            ECGFinding.HEART_BLOCK_THIRD: "I44.2",
            ECGFinding.LEFT_BUNDLE_BRANCH_BLOCK: "I44.7",
            ECGFinding.RIGHT_BUNDLE_BRANCH_BLOCK: "I44.5",
            EchocardiographyFinding.LEFT_VENTRICULAR_HYPERTROPHY: "I11.9",
            EchocardiographyFinding.LEFT_VENTRICULAR_DILATION: "I51.9",
            EchocardiographyFinding.REDUCED_EF: "I50.9",
            EchocardiographyFinding.MITRAL_STENOSIS: "I05.0",
            EchocardiographyFinding.MITRAL_REGURGITATION: "I05.1",
            EchocardiographyFinding.AORTIC_STENOSIS: "I06.0",
            EchocardiographyFinding.AORTIC_REGURGITATION: "I06.1",
            CardiacSymptom.CHEST_PAIN: "R07.9",
            CardiacSymptom.SHORTNESS_OF_BREATH: "R06.0",
            CardiacSymptom.SYNCOPE: "R55",
            CardiacSymptom.PALPITATIONS: "R00.2",
        }

        for finding in ecg_findings + echo_findings + symptoms:
            code = icd10_map.get(finding)
            if code and code not in codes:
                codes.append(code)

        return codes

    def _extract_urgent_conditions(self, text: str) -> list[str]:
        """Extract urgent conditions from text."""
        urgent = []

        urgent_patterns = [
            ("acs", "Acute Coronary Syndrome"),
            ("ami", "Acute Myocardial Infarction"),
            ("nstemi", "Non-ST Elevation MI"),
            ("stemi", "ST Elevation MI"),
            ("vf", "Ventricular Fibrillation"),
            ("vt", "Sustained Ventricular Tachycardia"),
            ("torsades", "Torsades de Pointes"),
            ("complete heart block", "Complete Heart Block"),
            ("cardiac arrest", "Cardiac Arrest"),
            ("pulmonary edema", "Acute Pulmonary Edema"),
            ("cardiogenic shock", "Cardiogenic Shock"),
            ("tamponade", "Cardiac Tamponade"),
            ("aortic dissection", "Aortic Dissection"),
            ("ruptured aneurysm", "Ruptured Aneurysm"),
        ]

        for pattern, label in urgent_patterns:
            if pattern in text.lower() and label not in urgent:
                urgent.append(label)

        return urgent

    def _extract_ecg_description(self, text: str) -> str | None:
        """Extract ECG description from text."""
        # Look for ECG-related sections
        ecg_markers = ["ecg", "ekg", "electrocardiogram", "12-lead", "rhythm strip"]
        for marker in ecg_markers:
            if marker in text:
                # Extract surrounding text
                return text
        return None

    def _extract_echo_description(self, text: str) -> str | None:
        """Extract echo description from text."""
        echo_markers = ["echo", "echocardiogram", "tte", "tte", "2d echo"]
        for marker in echo_markers:
            if marker in text:
                return text
        return None

    def _extract_symptom_description(self, text: str) -> str | None:
        """Extract symptom description from text."""
        # Look for symptom-related content
        if any(symptom.value in text.lower() for symptom in CardiacSymptom):
            return text
        return None

    def _extract_clinical_history(self, text: str) -> list[str]:
        """Extract clinical history from text."""
        history: list[str] = []
        pattern = r"\b(?:history of|h/o|past medical history\s*:?|pmh\s*:?)\s*([^.\n]+)"
        for match in re.finditer(pattern, text, re.IGNORECASE):
            for item in _split_items(match.group(1)):
                if item.lower() not in {h.lower() for h in history}:
                    history.append(item)
        return history

    def _extract_medications(self, text: str) -> list[str]:
        """Extract medications from text."""
        medications = []

        # Look for common cardiac medications
        med_patterns = [
            "aspirin",
            "clopidogrel",
            "prasugrel",
            "ticagrelor",
            "warfarin",
            "dabigatran",
            "rivaroxaban",
            "apixaban",
            "edoxaban",
            "beta blocker",
            "metoprolol",
            "atenolol",
            "carvedilol",
            "bisoprolol",
            "ace inhibitor",
            "lisinopril",
            "ramipril",
            "enalapril",
            "arb",
            "losartan",
            "valsartan",
            "olsartan",
            "statin",
            "atorvastatin",
            "rosuvastatin",
            "simvastatin",
            "diuretic",
            "furosemide",
            "bumetanide",
            "hydrochlorothiazide",
            "digoxin",
            "amiodarone",
            "sotalol",
            "flecainide",
            "nitrate",
            "nitroglycerin",
            "isosorbide",
        ]

        for pattern in med_patterns:
            # Whole words (plural allowed): "arb" must not match "carbon", "statin" not "atorvastatin".
            if _mentions(text, pattern) or _mentions(text, f"{pattern}s"):
                # Capitalize for display
                med_name = pattern.title() if pattern != "ace inhibitor" else "ACE Inhibitor"
                med_name = med_name.replace(" ", "")
                if med_name not in medications:
                    medications.append(med_name)

        return medications

    def _extract_allergies(self, text: str) -> list[str]:
        """Extract allergies from text."""
        if re.search(r"\b(nka|nkda|no known (drug )?allergies)\b", text, re.IGNORECASE):
            return ["No known drug allergies"]
        match = re.search(r"\b(?:allergies|allergy|allergic to)\s*:?\s*([^.\n]+)", text, re.IGNORECASE)
        return _split_items(match.group(1)) if match else []

    def _calculate_confidence(self, observations: list[CardiacObservation]) -> float:
        """Calculate confidence score based on observations."""
        # This is a placeholder
        # In production, this would be based on model confidence
        return 0.7 if observations else 0.0


# Singleton instance
_extractor: CardiacExtractionEngine | None = None


def get_clinical_extractor() -> CardiacExtractionEngine:
    """Get the singleton clinical extractor instance."""
    global _extractor
    if _extractor is None:
        _extractor = CardiacExtractionEngine()
    return _extractor


def extract_cardio_from_text(
    clinical_text: str,
    patient_context: dict[str, Any] | None = None
) -> StructuredCardiacSignal:
    """Extract cardiovascular information from clinical text.

    Convenience function for extracting cardiac signals.

    Args:
        clinical_text: The clinical narrative to process
        patient_context: Optional patient context

    Returns:
        StructuredCardiacSignal with extracted information
    """
    extractor = get_clinical_extractor()
    return extractor.extract_from_text(clinical_text, patient_context)


__all__ = [
    "ClinicalExtractionError",
    "CardiacSeverity",
    "CardiacCategory",
    "ECGFinding",
    "EchocardiographyFinding",
    "CardiacSymptom",
    "CardiacObservation",
    "StructuredCardiacSignal",
    "CardiacExtractionEngine",
    "get_clinical_extractor",
    "extract_cardio_from_text",
]
