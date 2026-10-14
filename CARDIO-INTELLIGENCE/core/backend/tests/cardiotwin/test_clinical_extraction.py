"""Rule-based cardiovascular extraction from clinical text (adapted from the EpiCast project).

All note text below is synthetic.
"""

from __future__ import annotations

import pytest

from app.cardiotwin.services.core__cardiotwin_services__clinical_extraction import (
    CardiacCategory,
    CardiacExtractionEngine,
    CardiacSeverity,
    CardiacSymptom,
    ClinicalExtractionError,
    ECGFinding,
    EchocardiographyFinding,
    extract_cardio_from_text,
    get_clinical_extractor,
)

ACS_NOTE = (
    "ECG shows atrial fibrillation with ST elevation in leads V1-V4. Patient reports crushing chest pain "
    "and shortness of breath. History of hypertension and diabetes. Medications: aspirin, atorvastatin. "
    "Allergies: penicillin, sulfa."
)
HEART_FAILURE_NOTE = (
    "Echocardiogram: reduced ejection fraction of 30%, mitral regurgitation. Patient has orthopnea and "
    "peripheral edema. NKDA."
)


@pytest.fixture
def engine() -> CardiacExtractionEngine:
    return CardiacExtractionEngine()


def test_acute_coronary_note(engine: CardiacExtractionEngine) -> None:
    signal = engine.extract_from_text(ACS_NOTE)
    assert set(signal.ecg_findings) == {ECGFinding.ST_ELEVATION, ECGFinding.ATRIAL_FIBRILLATION}
    assert set(signal.symptoms) == {CardiacSymptom.CHEST_PAIN, CardiacSymptom.SHORTNESS_OF_BREATH}
    assert signal.primary_category == CardiacCategory.ACUTE_CORONARY_SYNDROME
    assert CardiacCategory.ARRHYTHMIA in signal.secondary_categories
    assert signal.clinical_history == ["Hypertension", "Diabetes"]
    assert signal.medications == ["Aspirin", "Atorvastatin"]
    assert signal.allergies == ["Penicillin", "Sulfa"]
    assert signal.extraction_method == "rule_based"


def test_heart_failure_note(engine: CardiacExtractionEngine) -> None:
    signal = engine.extract_from_text(HEART_FAILURE_NOTE)
    assert set(signal.echo_findings) == {EchocardiographyFinding.REDUCED_EF, EchocardiographyFinding.MITRAL_REGURGITATION}
    assert {CardiacSymptom.ORTHOPNEA, CardiacSymptom.PERIPHERAL_EDEMA} <= set(signal.symptoms)
    assert signal.primary_category == CardiacCategory.HEART_FAILURE
    assert signal.allergies == ["No known drug allergies"]


@pytest.mark.parametrize(
    "text",
    [
        "Heart sounds are regular; the patient is sober and cooperative.",  # "ar" in heart/regular, "sob" in sober
        "Abnormal findings were excluded except a soft murmur.",  # "normal" in abnormal, "cp" in except
        "Carbon monoxide exposure ruled out.",  # "arb" in carbon
    ],
)
def test_abbreviations_match_whole_words_only(engine: CardiacExtractionEngine, text: str) -> None:
    """Short abbreviations (AR, MR, SOB, CP, ARB) used to match inside ordinary words."""
    signal = engine.extract_from_text(text)
    assert signal.ecg_findings == []
    assert signal.echo_findings == []
    assert signal.symptoms == []
    assert signal.medications == []


def test_abbreviations_still_match_on_their_own(engine: CardiacExtractionEngine) -> None:
    signal = engine.extract_from_text("Echo: moderate AR and MR. Presenting with CP and SOB.")
    assert set(signal.echo_findings) == {EchocardiographyFinding.AORTIC_REGURGITATION, EchocardiographyFinding.MITRAL_REGURGITATION}
    assert set(signal.symptoms) == {CardiacSymptom.CHEST_PAIN, CardiacSymptom.SHORTNESS_OF_BREATH}
    assert signal.overall_severity == CardiacSeverity.MODERATE


def test_unstable_is_not_read_as_stable(engine: CardiacExtractionEngine) -> None:
    assert engine.extract_from_text("Patient remains hemodynamically unstable overnight.").overall_severity == (
        CardiacSeverity.UNSTABLE
    )


def test_note_without_cardiac_content(engine: CardiacExtractionEngine) -> None:
    signal = engine.extract_from_text("Routine visit, no complaints today.")
    assert signal.ecg_findings == [] and signal.echo_findings == [] and signal.symptoms == []
    assert signal.primary_category is None
    assert signal.clinical_history == [] and signal.allergies == []


@pytest.mark.parametrize("text", ["", "   \n"])
def test_empty_text_is_rejected(engine: CardiacExtractionEngine, text: str) -> None:
    with pytest.raises(ClinicalExtractionError):
        engine.extract_from_text(text)


def test_module_helpers_share_one_engine() -> None:
    assert get_clinical_extractor() is get_clinical_extractor()
    signal = extract_cardio_from_text(HEART_FAILURE_NOTE)
    assert signal.primary_category == CardiacCategory.HEART_FAILURE
