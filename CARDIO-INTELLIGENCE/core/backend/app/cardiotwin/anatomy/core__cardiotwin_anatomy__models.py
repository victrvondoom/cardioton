"""Versioned report/review contracts; callers cannot supply reviewer identity."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

Structure = Literal[
    "LA", "RA", "LV", "RV", "SEPTUM", "MITRAL", "TRICUSPID", "PULMONARY_VALVE",
    "AORTIC_VALVE", "AORTA", "PULMONARY_ARTERY", "VENA_CAVA", "PULMONARY_VEINS",
    "LAD", "LCX", "RCA",
]
Kind = Literal[
    "stenosis", "calcification", "lvef", "atrial_fibrillation", "regurgitation",
    "valve_stenosis", "pulmonary_hypertension", "heart_failure", "congestion",
    "myocardial_infarction", "general_cardiac_disease", "heart_rate", "systolic_bp", "diastolic_bp", "unsupported",
]
Certainty = Literal["documented", "uncertain", "negated", "conflicting", "unsupported"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Normalized(StrictModel):
    kind: Kind
    label: str = Field(min_length=1, max_length=240)
    structure_id: Structure | None = None
    segment: Literal["proximal", "mid", "distal", "ostial"] | None = None
    value: float | None = None
    unit: str | None = Field(default=None, max_length=32)

    @model_validator(mode="after")
    def supported_scope(self) -> Normalized:
        coronary = self.kind in ("stenosis", "calcification")
        if coronary and self.structure_id not in ("LAD", "LCX", "RCA"):
            raise ValueError("Coronary findings require an explicitly identified LAD, LCX or RCA")
        if self.segment and not coronary:
            raise ValueError("Segments are supported only for explicitly named coronary arteries")
        structures: dict[str, set[str | None]] = {
            "lvef": {"LV"}, "atrial_fibrillation": {"LA", "RA"},
            "regurgitation": {"MITRAL", "TRICUSPID", "PULMONARY_VALVE", "AORTIC_VALVE"},
            "valve_stenosis": {"MITRAL", "TRICUSPID", "PULMONARY_VALVE", "AORTIC_VALVE"},
            "pulmonary_hypertension": {"PULMONARY_ARTERY"},
            "heart_failure": {None}, "congestion": {None}, "myocardial_infarction": {None},
            "general_cardiac_disease": {None},
            "heart_rate": {None}, "systolic_bp": {None}, "diastolic_bp": {None},
            "unsupported": {None},
        }
        if not coronary and self.structure_id not in structures.get(self.kind, {None}):
            raise ValueError("Structure does not preserve this finding's supported scope")
        if self.kind in ("stenosis", "lvef") and self.value is not None and (not 0 <= self.value <= 100 or self.unit != "%"):
            raise ValueError("Documented percentage must be between 0 and 100 with unit %")
        if self.kind in ("heart_rate", "systolic_bp", "diastolic_bp") and self.value is not None:
            if self.value <= 0 or self.value > 500:
                raise ValueError("Unsupported measurement range")
            expected = "/min" if self.kind == "heart_rate" else "mmHg"
            if self.unit != expected:
                raise ValueError("Unsupported measurement unit")
        return self


class ReviewRequest(StrictModel):
    finding_id: str = Field(min_length=1, max_length=80)
    action: Literal["approve", "reject", "correct"]
    expected_version: int = Field(ge=1)
    normalized: Normalized | None = None
    note: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def correction_requires_evidence(self) -> ReviewRequest:
        if self.action == "correct" and (self.normalized is None or not (self.note or "").strip()):
            raise ValueError("Correction requires normalized findings and a supporting reviewer note")
        if self.action != "correct" and self.normalized is not None:
            raise ValueError("Only an explicit correction may change normalized findings")
        return self


class Mapping(StrictModel):
    version: str
    structure_id: Structure | None
    structure_ids: list[Structure]
    label: str
    rationale: str
    explanation: str
    location_status: str
    no_lesion_geometry: bool = True
    reference_anatomy: bool = True


class Decision(StrictModel):
    action: Literal["approve", "reject", "correct"]
    reviewer_id: str
    reviewed_at: AwareDatetime
    note: str | None = None
    normalized: Normalized


class Finding(StrictModel):
    @model_validator(mode="before")
    @classmethod
    def retain_legacy_extraction_certainty(cls, value: Any) -> Any:
        if isinstance(value, dict) and "extracted_certainty" not in value:
            value = dict(value)
            # Early locally persisted records lack this additive provenance field.
            # A prior correction cannot retrospectively establish source certainty.
            corrected = any(isinstance(decision, dict) and decision.get("action") == "correct" for decision in value.get("decisions", []))
            value["extracted_certainty"] = "uncertain" if corrected else value.get("certainty", "unsupported")
        return value

    id: str
    source_excerpt: str
    original_observation: dict[str, Any]
    extracted: Normalized
    normalized: Normalized
    certainty: Certainty
    extracted_certainty: Certainty
    event_at: AwareDatetime | None
    available_at: AwareDatetime
    status: Literal["pending", "approved", "rejected"] = "pending"
    reviewer_id: str | None = None
    reviewed_at: AwareDatetime | None = None
    mapping: Mapping
    active_annotation: bool = False
    decisions: list[Decision] = Field(default_factory=list)


class Report(StrictModel):
    id: str
    version: int = 1
    organization_id: str
    owner_user_id: str
    case_ref: str
    patient_ref: str
    source: dict[str, Any]
    event_at: AwareDatetime | None
    available_at: AwareDatetime
    synthetic: bool
    findings: list[Finding]
    audit: list[dict[str, Any]]
    warnings: list[str]
    storage_mode: str
    extractor_version: str = "cardio-extract-1.0"
    mapping_version: str = "cardio-anatomy-1.0"
    clinical_approval: bool = False
