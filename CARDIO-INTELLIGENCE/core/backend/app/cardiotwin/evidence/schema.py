"""Canonical schema for CardioTwin Global Evidence & Intelligence.

Preserves data provenance, validation maturity (Grades 1-5), evidence relationships,
and source attribution across clinical trials, publications, safety events, and simulations.
"""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ValidationGrade(str, Enum):
    UNASSESSED = "Unassessed: source metadata does not establish validation"
    GRADE_1 = "Grade 1: Internal validation (single cohort)"
    GRADE_2 = "Grade 2: External cohort validation by authors"
    GRADE_3 = "Grade 3: Single-center independent external team"
    GRADE_4 = "Grade 4: Multi-center independent external team"
    GRADE_5 = "Grade 5: Validated in randomized controlled trial (RCT)"


class EvidenceTaskCategory(str, Enum):
    UNKNOWN = "unmapped"
    PROGNOSTIC = "prognostic"
    DIAGNOSTIC = "diagnostic"
    THERAPEUTIC = "therapeutic"
    MONITORING = "monitoring"
    RISK_ASSESSMENT = "risk_assessment"


class EvidenceModality(str, Enum):
    UNKNOWN = "Unmapped modality"
    ECG = "ECG12"
    ECHO = "Echocardiography"
    CT = "CT"
    MRI = "CMR"
    CXR = "CXR"
    EHR = "EHR / Clinical Records"
    OMICS = "Omics / Biomarkers"
    ANGIO = "Coronary Angiography"
    WEARABLES = "Home Monitoring / Wearables"
    MULTIMODAL = "Multimodal AI"
    SIMULATION = "Physiological Physics Simulation"


class ClinicalArea(str, Enum):
    UNKNOWN = "Unmapped clinical area"
    IMAGING = "Cardiovascular imaging"
    NONINVASIVE_ECG = "Noninvasive electrocardiography"
    CORONARY_SYNDROME = "Coronary syndrome & CAD"
    HEART_FAILURE = "Heart failure"
    ACUTE_CARE = "Acute CV care"
    PREVENTIVE = "Preventive cardiology"
    PHARMACOTHERAPY = "Cardiovascular pharmacotherapy"
    ELECTROPHYSIOLOGY = "Electrophysiology"
    VALVULAR = "Valvular heart disease"
    HYPERTENSION = "Hypertension"
    PULMONARY_HTN = "Pulmonary hypertension"


class DataMode(str, Enum):
    PUBLIC_SCIENTIFIC = "public_scientific"
    SYNTHETIC_DEMO = "synthetic_demo"
    EVALUATION_DATA = "evaluation_data"
    CLINICAL_INTEGRATION = "clinical_integration"


class EvidenceRecord(BaseModel):
    id: str = Field(..., description="Internal canonical record identifier")
    source_name: str = Field(..., description="Source system e.g. ClinicalTrials.gov, PubMed, openFDA")
    source_identifier: str = Field(..., description="Original ID e.g. NCT04512345, PMID38210982")
    source_url: str = Field(..., description="Canonical source URL")
    title: str = Field(..., description="Study or publication title")
    authors_or_sponsor: str = Field(..., description="Lead author or sponsoring organization")
    publication_or_start_date: str | None = Field(None, description="Publication date or trial start timestamp; never imputed")
    clinical_area: ClinicalArea = Field(..., description="Cardiovascular subspecialty area")
    modality: EvidenceModality = Field(..., description="Primary diagnostic or therapeutic modality")
    task_category: EvidenceTaskCategory = Field(..., description="Clinical task category")
    target_indication: str = Field(..., description="Cardiovascular clinical target or indication")
    intervention_or_device: str | None = Field(None, description="Intervention, therapy, or device name")
    study_design: str = Field(..., description="Study design e.g. RCT, Prospective Cohort, Retrospective")
    validation_grade: ValidationGrade = Field(default=ValidationGrade.UNASSESSED)
    sample_size: int | None = Field(None, description="Enrolled patients or dataset sample size")
    reported_endpoints: list[str] = Field(default_factory=list, description="Primary clinical endpoints evaluated")
    summary_findings: str = Field(..., description="Verified summary of findings")
    source_version_hash: str = Field(..., description="SHA-256 snapshot hash of raw record")
    retrieved_at: str = Field(..., description="Timestamp when record was ingested")
    last_updated_at: str | None = Field(None, description="Timestamp of last update in source; null when unreported")
    mapping_status: str = Field(default="proposed", description="Status: proposed, mapped, verified, rejected")
    human_verified: bool = Field(default=False, description="Whether mapping has been human-reviewed")
    data_mode: DataMode = Field(default=DataMode.PUBLIC_SCIENTIFIC)
    record_type: str = "publication"
    trial_metadata: dict[str, Any] = Field(default_factory=dict)
    provenance: dict[str, Any] = Field(default_factory=dict)
    quality: dict[str, Any] = Field(default_factory=lambda: {
        "external_validation": "not_assessed", "independent_replication": "not_assessed",
        "risk_of_bias": "not_assessed", "applicability": "not_assessed",
        "source_verification": "metadata_only", "performance_evidence": "not_extracted",
    })
    mapping_rationale: list[str] = Field(default_factory=list)


class EvidenceNode(BaseModel):
    id: str
    label: str
    category: str  # "source", "area", "modality", "task", "target"
    count: int = 1
    description: str | None = None


class EvidenceEdge(BaseModel):
    source: str
    target: str
    value: int = 1
    flow_category: str  # e.g. "area_to_modality"
    evidence_ids: list[str] = Field(default_factory=list)
    mapping_rationale: str = "Aggregates source metadata categories; does not establish clinical support or causality."
    verification_status: str = "proposed"


class EvidenceGraphData(BaseModel):
    nodes: list[EvidenceNode]
    edges: list[EvidenceEdge]
    total_records: int
    data_mode: DataMode
    as_of: str
    filter_summary: dict[str, Any] = Field(default_factory=dict)


class ReviewScreeningStats(BaseModel):
    articles_retrieved: int = 0
    articles_screened: int = 0
    ai_articles_screened: int = 0
    ai_articles_included: int = 0
    rct_percentage: float = 0.0
    prospective_percentage: float = 0.0
    top_modality: str = "No records"
    independent_reviewers: int = 0
    grade_distribution: dict[str, int] = Field(default_factory=dict)
