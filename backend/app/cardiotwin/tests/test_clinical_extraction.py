"""Tests for the Clinical Extraction Service.

This module contains unit tests for the clinical extraction service that integrates
capabilities from Epicast-main project for cardiovascular-specific text processing.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.cardiotwin.services.clinical_extraction import (
    CardiacExtractionEngine,
    CardiovascularExtractor,
)


# =============================================================================
# FIXTURES
# =============================================================================

@pytest.fixture
def clinical_extraction_service():
    """Create a CardiacExtractionEngine instance for testing."""
    service = CardiacExtractionEngine()
    yield service


@pytest.fixture
def cv_extractor():
    """Create a CardiovascularExtractor instance for testing."""
    extractor = CardiovascularExtractor()
    yield extractor


# Sample clinical texts for testing
SAMPLE_ECG_TEXT = """
ECG Report
Patient: John Doe
Date: 2024-01-15
Heart Rate: 72 bpm
Rhythm: Regular
Findings: Atrial fibrillation, ST-segment elevation in leads II, III, aVF
Conclusion: Acute inferior myocardial infarction
"""

SAMPLE_ECHO_TEXT = """
Echocardiography Report
Patient: Jane Smith
Date: 2024-01-16
Left Ventricular Ejection Fraction: 45%
Findings: Left ventricular hypertrophy, moderate mitral regurgitation
Wall Motion: Hypokinesis of inferior wall
Conclusion: Ischemic cardiomyopathy
"""

SAMPLE_CLINICAL_NOTE = """
Clinical Note - 2024-01-17
HPI: 65M with chest pain x 2 hours, radiating to left arm.
PMH: Hypertension, Diabetes Mellitus Type 2, Previous MI in 2020.
Meds: Lisinopril 10mg daily, Metformin 500mg BID, Aspirin 81mg daily.
Allergies: NKDA
Vitals: BP 160/90, HR 88, RR 18, T 36.8C
Exam: Regular rate and rhythm, no murmurs, clear lungs.
Assessment: Acute coronary syndrome, rule out MI.
Plan: Admit to telemetry, obtain ECG, troponin x3, cardiology consult.
"""

SAMPLE_MEDICATION_TEXT = """
Current Medications:
- Atorvastatin 40mg daily (for hyperlipidemia)
- Metoprolol tartrate 25mg BID (for hypertension and rate control)
- Apixaban 5mg BID (for atrial fibrillation)
- Furosemide 20mg daily (for heart failure)
"""

SAMPLE_ICD10_TEXT = """
Diagnosis Codes:
I48.0 - Atrial fibrillation
I25.10 - Atherosclerotic heart disease of native coronary artery without angina pectoris
E11.65 - Type 2 diabetes mellitus with hyperglycemia
I10 - Essential (primary) hypertension
"""


# =============================================================================
# TESTS: CardiacExtractionEngine Initialization
# =============================================================================

class TestCardiacExtractionEngineInitialization:
    """Test CardiacExtractionEngine initialization."""

    def test_init_default(self):
        """Test service initialization with default parameters."""
        service = CardiacExtractionEngine()
        assert service is not None
        assert service.extractor is not None


# =============================================================================
# TESTS: CardiovascularExtractor - ECG Findings
# =============================================================================

class TestECGFindingsExtraction:
    """Test extraction of ECG-specific findings."""

    def test_extract_ecg_findings_atrial_fibrillation(self, cv_extractor):
        """Test extraction of atrial fibrillation."""
        text = "ECG shows atrial fibrillation with rapid ventricular response."
        findings = cv_extractor.extract_ecg_findings(text)

        assert findings is not None
        assert len(findings) > 0
        assert any("atrial fibrillation" in f.lower() for f in findings)

    def test_extract_ecg_findings_st_elevation(self, cv_extractor):
        """Test extraction of ST-segment elevation."""
        text = "ST-segment elevation in leads II, III, and aVF."
        findings = cv_extractor.extract_ecg_findings(text)

        assert findings is not None
        assert len(findings) > 0
        assert any("st-segment elevation" in f.lower() or "st elevation" in f.lower()
                   for f in findings)

    def test_extract_ecg_findings_multiple(self, cv_extractor):
        """Test extraction of multiple ECG findings."""
        findings = cv_extractor.extract_ecg_findings(SAMPLE_ECG_TEXT)

        assert findings is not None
        assert len(findings) >= 2  # Should find AFib and ST elevation

        finding_texts = [f.lower() for f in findings]
        assert any("atrial fibrillation" in f for f in finding_texts)
        assert any("st-segment elevation" in f or "st elevation" in f for f in finding_texts)

    def test_extract_ecg_measurements(self, cv_extractor):
        """Test extraction of ECG measurements."""
        text = "Heart rate 72 bpm, PR interval 180ms, QRS duration 100ms, QT interval 380ms."
        observations = cv_extractor.extract_ecg_measurements(text)

        assert observations is not None
        assert len(observations) >= 3

        # Check that we extract heart rate
        assert any("heart rate" in o["code"].lower() or "rate" in o["code"].lower()
                   for o in observations)


# =============================================================================
# TESTS: CardiovascularExtractor - Echo Findings
# =============================================================================

class TestEchoFindingsExtraction:
    """Test extraction of echocardiography findings."""

    def test_extract_echo_findings_lvh(self, cv_extractor):
        """Test extraction of left ventricular hypertrophy."""
        text = "Echocardiogram shows left ventricular hypertrophy with wall thickness 15mm."
        findings = cv_extractor.extract_echo_findings(text)

        assert findings is not None
        assert len(findings) > 0
        assert any("left ventricular hypertrophy" in f.lower() or "lvh" in f.lower()
                   for f in findings)

    def test_extract_echo_findings_ef(self, cv_extractor):
        """Test extraction of ejection fraction."""
        text = "Left ventricular ejection fraction is 45%."
        observations = cv_extractor.extract_echo_measurements(text)

        assert observations is not None
        assert len(observations) > 0

        # Check that we extract EF
        assert any("ejection fraction" in o["code"].lower() or "ef" in o["code"].lower()
                   for o in observations)

    def test_extract_echo_findings_multiple(self, cv_extractor):
        """Test extraction of multiple echo findings."""
        findings = cv_extractor.extract_echo_findings(SAMPLE_ECHO_TEXT)

        assert findings is not None
        assert len(findings) >= 2  # Should find LVH and mitral regurgitation

        finding_texts = [f.lower() for f in findings]
        assert any("left ventricular hypertrophy" in f or "lvh" in f for f in finding_texts)
        assert any("mitral regurgitation" in f for f in finding_texts)


# =============================================================================
# TESTS: CardiovascularExtractor - Clinical Observations
# =============================================================================

class TestClinicalObservationsExtraction:
    """Test extraction of clinical observations."""

    def test_extract_blood_pressure(self, cv_extractor):
        """Test extraction of blood pressure."""
        text = "BP 160/90 mmHg"
        observations = cv_extractor.extract_vital_signs(text)

        assert observations is not None
        assert len(observations) > 0

        # Check for blood pressure
        bp_obs = [o for o in observations if "blood pressure" in o["code"].lower()]
        assert len(bp_obs) > 0

    def test_extract_heart_rate(self, cv_extractor):
        """Test extraction of heart rate."""
        text = "Heart rate 88 bpm"
        observations = cv_extractor.extract_vital_signs(text)

        assert observations is not None
        assert len(observations) > 0

        # Check for heart rate
        hr_obs = [o for o in observations if "heart rate" in o["code"].lower()]
        assert len(hr_obs) > 0

    def test_extract_from_clinical_note(self, cv_extractor):
        """Test extraction from full clinical note."""
        observations = cv_extractor.extract_clinical_observations(SAMPLE_CLINICAL_NOTE)

        assert observations is not None
        # Should find multiple observations
        assert len(observations) >= 2


# =============================================================================
# TESTS: CardiovascularExtractor - Medications
# =============================================================================

class TestMedicationsExtraction:
    """Test extraction of cardiovascular medications."""

    def test_extract_medications_single(self, cv_extractor):
        """Test extraction of single medication."""
        text = "Taking lisinopril 10mg daily for hypertension."
        medications = cv_extractor.extract_medications(text)

        assert medications is not None
        assert len(medications) > 0
        assert any("lisinopril" in m["name"].lower() for m in medications)

    def test_extract_medications_multiple(self, cv_extractor):
        """Test extraction of multiple medications."""
        medications = cv_extractor.extract_medications(SAMPLE_MEDICATION_TEXT)

        assert medications is not None
        assert len(medications) >= 3  # Should find atorvastatin, metoprolol, apixaban

        med_names = [m["name"].lower() for m in medications]
        assert "atorvastatin" in med_names
        assert "metoprolol" in med_names
        assert "apixaban" in med_names


# =============================================================================
# TESTS: CardiovascularExtractor - ICD-10 Codes
# =============================================================================

class TestICD10Extraction:
    """Test extraction of ICD-10 codes."""

    def test_extract_icd10_single(self, cv_extractor):
        """Test extraction of single ICD-10 code."""
        text = "Diagnosis: I48.0 (Atrial fibrillation)"
        codes = cv_extractor.extract_icd10_codes(text)

        assert codes is not None
        assert len(codes) > 0
        assert any("I48.0" in c["code"] for c in codes)

    def test_extract_icd10_multiple(self, cv_extractor):
        """Test extraction of multiple ICD-10 codes."""
        codes = cv_extractor.extract_icd10_codes(SAMPLE_ICD10_TEXT)

        assert codes is not None
        assert len(codes) >= 4  # Should find all 4 codes

        code_values = [c["code"] for c in codes]
        assert "I48.0" in code_values
        assert "I25.10" in code_values
        assert "E11.65" in code_values
        assert "I10" in code_values


# =============================================================================
# TESTS: CardiacExtractionEngine - Full Extraction
# =============================================================================

class TestFullExtraction:
    """Test full clinical text extraction."""

    def test_extract_from_text_ecg(self, clinical_extraction_service):
        """Test full extraction from ECG text."""
        result = clinical_extraction_service.extract_from_text(SAMPLE_ECG_TEXT)

        assert result is not None
        assert "extraction_id" in result
        assert "entities" in result
        assert len(result["entities"]) > 0

        # Check for ECG findings
        ecg_findings = [e for e in result["entities"]
                       if e["entity_type"] == "ecg_findings"]
        assert len(ecg_findings) > 0

    def test_extract_from_text_echo(self, clinical_extraction_service):
        """Test full extraction from echo text."""
        result = clinical_extraction_service.extract_from_text(SAMPLE_ECHO_TEXT)

        assert result is not None
        assert "extraction_id" in result
        assert "entities" in result
        assert len(result["entities"]) > 0

        # Check for echo findings
        echo_findings = [e for e in result["entities"]
                        if e["entity_type"] == "echo_findings"]
        assert len(echo_findings) > 0

    def test_extract_from_text_clinical_note(self, clinical_extraction_service):
        """Test full extraction from clinical note."""
        result = clinical_extraction_service.extract_from_text(SAMPLE_CLINICAL_NOTE)

        assert result is not None
        assert "extraction_id" in result
        assert "entities" in result
        # Should find multiple entities
        assert len(result["entities"]) >= 5

    def test_extract_with_config(self, clinical_extraction_service):
        """Test extraction with custom configuration."""
        config = {
            "entity_types": ["ecg_findings", "clinical_observations"],
            "confidence_threshold": 0.8,
            "include_context": True,
        }

        result = clinical_extraction_service.extract_from_text(
            SAMPLE_ECG_TEXT,
            config=config
        )

        assert result is not None
        # With entity type filtering, should only get specified types
        entity_types = {e["entity_type"] for e in result["entities"]}
        assert "ecg_findings" in entity_types
        # Note: clinical_observations might not be in ECG text


# =============================================================================
# TESTS: Batch Extraction
# =============================================================================

class TestBatchExtraction:
    """Test batch extraction of multiple documents."""

    def test_batch_extract(self, clinical_extraction_service):
        """Test batch extraction."""
        documents = [
            {"id": "doc1", "text": SAMPLE_ECG_TEXT},
            {"id": "doc2", "text": SAMPLE_ECHO_TEXT},
            {"id": "doc3", "text": SAMPLE_CLINICAL_NOTE},
        ]

        result = clinical_extraction_service.batch_extract(documents)

        assert result is not None
        assert "results" in result
        assert len(result["results"]) == 3
        assert result["total_count"] == 3
        assert result["success_count"] == 3
        assert result["failed_count"] == 0


# =============================================================================
# TESTS: Task Management
# =============================================================================

class TestTaskManagement:
    """Test task management for async operations."""

    def test_get_status(self, clinical_extraction_service):
        """Test getting task status."""
        # First create a task
        result = clinical_extraction_service.extract_from_text(SAMPLE_ECG_TEXT)
        task_id = result["extraction_id"]

        status = clinical_extraction_service.get_status(task_id)

        assert status is not None
        assert "task_id" in status
        assert "status" in status

    def test_health_check(self, clinical_extraction_service):
        """Test service health check."""
        health = clinical_extraction_service.health_check()

        assert health is not None
        assert "status" in health
        assert health["status"] in ["healthy", "degraded"]


# =============================================================================
# TESTS: Configuration
# =============================================================================

class TestConfiguration:
    """Test service configuration."""

    def test_default_config(self, clinical_extraction_service):
        """Test default configuration."""
        config = clinical_extraction_service.get_config()

        assert config is not None
        assert "entity_types" in config
        assert "confidence_threshold" in config

    def test_custom_config(self):
        """Test custom configuration."""
        custom_config = {
            "entity_types": ["ecg_findings"],
            "confidence_threshold": 0.9,
            "include_context": False,
            "temporal_extraction": True,
        }

        service = CardiacExtractionEngine(default_config=custom_config)
        config = service.get_config()

        assert config == custom_config


# =============================================================================
# TESTS: Error Handling
# =============================================================================

class TestErrorHandling:
    """Test error handling."""

    def test_empty_text(self, clinical_extraction_service):
        """Test handling empty text."""
        result = clinical_extraction_service.extract_from_text("")

        assert result is not None
        # Should return empty entities or handle gracefully
        assert "entities" in result

    def test_invalid_text_type(self, clinical_extraction_service):
        """Test handling invalid text type."""
        with pytest.raises(Exception) as exc_info:
            clinical_extraction_service.extract_from_text(123)  # type: ignore

        assert "text" in str(exc_info.value).lower() or \
               "string" in str(exc_info.value).lower()

    def test_none_text(self, clinical_extraction_service):
        """Test handling None text."""
        with pytest.raises(Exception) as exc_info:
            clinical_extraction_service.extract_from_text(None)  # type: ignore

        assert "text" in str(exc_info.value).lower() or \
               "none" in str(exc_info.value).lower()


# =============================================================================
# INTEGRATION TESTS
# =============================================================================

class TestIntegration:
    """Integration tests for the clinical extraction service."""

    def test_complete_workflow(self, clinical_extraction_service):
        """Test a complete workflow: extract, batch, status."""
        # Step 1: Single extraction
        result1 = clinical_extraction_service.extract_from_text(SAMPLE_ECG_TEXT)
        assert result1 is not None

        # Step 2: Check status
        status = clinical_extraction_service.get_status(result1["extraction_id"])
        assert status is not None

        # Step 3: Batch extraction
        documents = [
            {"id": "1", "text": SAMPLE_ECG_TEXT},
            {"id": "2", "text": SAMPLE_ECHO_TEXT},
        ]
        batch_result = clinical_extraction_service.batch_extract(documents)
        assert batch_result is not None
        assert batch_result["success_count"] == 2

        # Step 4: Health check
        health = clinical_extraction_service.health_check()
        assert health["status"] == "healthy"


# =============================================================================
# MAIN TEST EXECUTION
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
