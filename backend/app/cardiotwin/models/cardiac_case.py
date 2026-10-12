"""Canonical CardiacCase Domain Model for CardioTwin.

This module defines the core domain entities for the unified CardioTwin cardiovascular
intelligence platform. It integrates concepts from:
- Existing CardioTwin schema (schema.py, ecg/models.py, evidence/schema.py)
- heartAI-main (medical imaging, embeddings, diagnosis)
- case-twin-main (similar case retrieval, vector search)
- FHIR standards for healthcare interoperability

The CardiacCase model provides the central context for:
- Patient information and clinical encounters
- Multi-modality evidence (ECG, imaging, clinical notes, lab results)
- AI model inferences and predictions
- Digital twin instances and simulations
- Agent executions and workflows
- Clinical reviews and follow-up tasks

This is the foundation for the Cardiac Evidence Continuity Engine, which
ensures that all evidence supporting a cardiac case is temporally consistent,
provenance-tracked, and uncertainty-aware.
"""

from __future__ import annotations

from datetime import UTC, datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator

# =============================================================================
# ENUMS AND CONSTANTS
# =============================================================================

class ModalityType(str, Enum):
    """Cardiovascular modality types aligned with DICOM and FHIR."""

    ECG = "ECG"
    ECHOCARDIOGRAPHY = "Echocardiography"
    CMR = "Cardiac MRI"
    CT = "Cardiac CT"
    CORONARY_ANGIOGRAPHY = "Coronary Angiography"
    NUCLEAR = "Nuclear Cardiology"
    WEARABLES = "Wearables"
    CLINICAL_NOTES = "Clinical Notes"
    LAB = "Laboratory"
    VITAL_SIGNS = "Vital Signs"
    MULTIMODAL = "Multimodal"
    SIMULATION = "Digital Twin Simulation"


class EvidenceStatus(str, Enum):
    """Status of evidence in the continuity workflow."""

    PENDING = "pending"
    PROCESSING = "processing"
    VALIDATED = "validated"
    INCONSISTENT = "inconsistent"
    SUPERSEDED = "superseded"
    REJECTED = "rejected"
    UNKNOWN = "unknown"


class TemporalConsistencyStatus(str, Enum):
    """Temporal consistency status for evidence alignment."""

    CONSISTENT = "consistent"
    MINOR_MISALIGNMENT = "minor_misalignment"
    MAJOR_MISALIGNMENT = "major_misalignment"
    CONFLICTING = "conflicting"
    UNRESOLVED = "unresolved"


class UncertaintyLevel(str, Enum):
    """Uncertainty levels for evidence and predictions."""

    VERY_LOW = "very_low"
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"
    UNKNOWN = "unknown"


class DataProvenance(str, Enum):
    """Data provenance categories."""

    REAL_OBSERVATION = "real_observation"
    AI_GENERATED = "ai_generated"
    SIMULATION_OUTPUT = "simulation_output"
    SYNTHETIC = "synthetic"
    MANUAL_ENTRY = "manual_entry"
    IMPORTED = "imported"


class AgentExecutionStatus(str, Enum):
    """Status of agent execution."""

    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    AWAITING_REVIEW = "awaiting_review"


class ReviewStatus(str, Enum):
    """Status of clinical review."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_REVISION = "needs_revision"


class DigitalTwinState(str, Enum):
    """State of a digital twin instance."""

    INITIALIZED = "initialized"
    UPDATING = "updating"
    SYNCHRONIZED = "synchronized"
    STALE = "stale"
    INVALID = "invalid"
    ARCHIVED = "archived"


# =============================================================================
# CORE DOMAIN ENTITIES
# =============================================================================


class PatientIdentifier(BaseModel):
    """Patient identifier with provenance tracking."""

    id: str = Field(default=..., description="Patient identifier (can be anonymized)")
    system: str = Field(default=..., description="System that assigned the identifier")
    type: str = Field(default=..., description="Type of identifier (MRN, UUID, etc.)")
    assigner: str | None = Field(default=None, description="Organization that assigned the ID")

    @field_validator('id')
    @classmethod
    def validate_id(cls, v: str) -> str:
        if not v or len(v.strip()) == 0:
            raise ValueError("Patient ID cannot be empty")
        return v.strip()


class PatientDemographics(BaseModel):
    """Patient demographic information (FHIR-aligned)."""

    age: int | None = Field(default=None, description="Age in years")
    age_unit: str = Field(default="years", description="Unit of age")
    sex: str | None = Field(default=None, description="Biological sex (FHIR: male|female|other|unknown)")
    gender: str | None = Field(default=None, description="Gender identity")
    race: str | None = Field(default=None, description="Race")
    ethnicity: str | None = Field(default=None, description="Ethnicity")
    height_cm: float | None = Field(default=None, description="Height in centimeters")
    weight_kg: float | None = Field(default=None, description="Weight in kilograms")
    bmi: float | None = Field(default=None, description="Body mass index")

    @property
    def calculated_bmi(self) -> float | None:
        """Calculate BMI from height and weight."""
        if self.height_cm and self.weight_kg and self.height_cm > 0:
            height_m = self.height_cm / 100
            return self.weight_kg / (height_m ** 2)
        return None


class Patient(BaseModel):
    """Patient entity (FHIR-aligned).

    This is the root entity for all cardiovascular cases.
    """

    id: UUID = Field(default_factory=uuid4, description="Internal CardioTwin patient UUID")
    identifiers: list[PatientIdentifier] = Field(
        default_factory=list,
        description="List of patient identifiers from various systems"
    )
    demographics: PatientDemographics = Field(
        default_factory=PatientDemographics,
        description="Patient demographic information"
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When the patient record was created"
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When the patient record was last updated"
    )
    active: bool = Field(default=True, description="Whether the patient record is active")

    # Metadata
    metadata: dict[str, Any] = Field(default_factory=dict)
    provenance: dict[str, Any] = Field(default_factory=dict)

    def get_display_id(self) -> str:
        """Get a display-friendly patient identifier."""
        if self.identifiers:
            return self.identifiers[0].id
        return str(self.id)


# =============================================================================
# CLINICAL ENTITIES
# =============================================================================


class ClinicalEncounter(BaseModel):
    """Clinical encounter/visit (FHIR Encounter)."""

    id: UUID = Field(default_factory=uuid4)
    patient_id: UUID = Field(default=..., description="Reference to Patient")

    # Encounter details
    encounter_type: str = Field(default=..., description="Type of encounter (inpatient, outpatient, etc.)")
    start_date: datetime | None = Field(default=None, description="Encounter start datetime")
    end_date: datetime | None = Field(default=None, description="Encounter end datetime")
    status: str = Field(default="completed", description="Encounter status")

    # Location
    location: str | None = Field(default=None, description="Location of encounter")
    facility: str | None = Field(default=None, description="Healthcare facility")

    # Associated data
    chief_complaint: str | None = Field(default=None, description="Chief complaint")
    reason_for_visit: str | None = Field(default=None, description="Reason for visit")

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    provenance: dict[str, Any] = Field(default_factory=dict)


class ClinicalObservation(BaseModel):
    """Clinical observation (FHIR Observation).

    Represents any clinical measurement or finding.
    """

    id: UUID = Field(default_factory=uuid4)
    patient_id: UUID = Field(default=..., description="Reference to Patient")
    encounter_id: UUID | None = Field(default=None, description="Reference to ClinicalEncounter")

    # Observation details
    code: str = Field(default=..., description="LOINC or other coding system code")
    code_system: str = Field(default="LOINC", description="Coding system (LOINC, SNOMED, etc.)")
    display_name: str = Field(default=..., description="Human-readable observation name")

    # Value
    value: float | str | bool | None = Field(default=None, description="Observation value")
    value_type: str = Field(default="quantity", description="Type of value (quantity, string, boolean)")
    unit: str | None = Field(default=None, description="Unit of measurement")

    # Timing
    effective_datetime: datetime | None = Field(default=None, description="When the observation was taken")
    issued_datetime: datetime | None = Field(default=None, description="When the observation was recorded")

    # Status and reliability
    status: str = Field(default="final", description="Observation status (final, preliminary, amended)")
    reliability: str = Field(default="ok", description="Reliability assessment")

    # Interpretation
    interpretation: str | None = Field(default=None, description="Clinical interpretation")
    reference_range: dict[str, Any] | None = Field(default=None, description="Reference range")

    # Provenance
    performer: str | None = Field(default=None, description="Who performed the observation")
    device: str | None = Field(default=None, description="Device used for observation")
    provenance: DataProvenance = Field(
        default=DataProvenance.REAL_OBSERVATION,
        description="Data provenance category"
    )

    # Evidence tracking
    evidence_id: UUID | None = Field(default=None, description="Reference to EvidenceArtifact")

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    metadata: dict[str, Any] = Field(default_factory=dict)


# =============================================================================
# CARDIOVASCULAR-SPECIFIC ENTITIES
# =============================================================================


class ECGStudy(BaseModel):
    """ECG study with multi-lead data."""

    id: UUID = Field(default_factory=uuid4)
    patient_id: UUID = Field(default=..., description="Reference to Patient")
    encounter_id: UUID | None = Field(default=None, description="Reference to ClinicalEncounter")

    # Study metadata
    study_date: datetime = Field(default=..., description="Date and time of ECG recording")
    duration_seconds: float = Field(default=..., description="Duration of recording in seconds")
    sampling_rate_hz: float = Field(default=..., description="Sampling rate in Hz")
    num_leads: int = Field(default=12, description="Number of ECG leads")
    lead_types: list[str] = Field(
        default_factory=lambda: ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"],
        description="Types of leads recorded"
    )

    # Device information
    device_manufacturer: str | None = Field(default=None, description="ECG device manufacturer")
    device_model: str | None = Field(default=None, description="ECG device model")
    device_serial: str | None = Field(default=None, description="Device serial number")

    # Signal quality
    signal_quality: str = Field(default="good", description="Overall signal quality assessment")
    noise_level: float = Field(default=0.0, description="Estimated noise level (0-1)")
    baseline_wander: float = Field(default=0.0, description="Baseline wander magnitude")

    # Clinical context
    indication: str | None = Field(default=None, description="Indication for ECG")
    patient_position: str = Field(default="supine", description="Patient position during recording")

    # Processing status
    processed: bool = Field(default=False, description="Whether ECG has been processed")
    processing_status: str | None = Field(default=None, description="Current processing status")

    # Analysis results
    analysis_results: dict[str, Any] = Field(default_factory=dict)

    # Embedding for similarity search
    embedding: list[float] | None = Field(default=None, description="Vector embedding for similarity")

    # Provenance
    provenance: DataProvenance = Field(
        default=DataProvenance.REAL_OBSERVATION,
        description="Data provenance"
    )

    # Evidence tracking
    evidence_id: UUID | None = Field(default=None, description="Reference to EvidenceArtifact")

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    metadata: dict[str, Any] = Field(default_factory=dict)

    # Relationships to other evidence
    related_imaging: list[UUID] = Field(
        default_factory=list,
        description="Related imaging studies"
    )
    related_reports: list[UUID] = Field(
        default_factory=list,
        description="Related diagnostic reports"
    )


class ImagingStudy(BaseModel):
    """Cardiac imaging study (FHIR ImagingStudy).

    Supports CMR (Cardiac MRI), Echocardiography, CT, Angiography, etc.
    """

    id: UUID = Field(default_factory=uuid4)
    patient_id: UUID = Field(default=..., description="Reference to Patient")
    encounter_id: UUID | None = Field(default=None, description="Reference to ClinicalEncounter")

    # Study metadata
    study_date: datetime = Field(default=..., description="Date and time of imaging study")
    modality: ModalityType = Field(default=..., description="Imaging modality type")
    study_description: str = Field(default=..., description="Description of the study")

    # Technical details
    series_count: int = Field(default=0, description="Number of series in study")
    instance_count: int = Field(default=0, description="Number of instances (slices/images)")

    # Spatial information
    pixel_spacing: list[float] | None = Field(default=None, description="Pixel spacing in mm")
    slice_thickness: float | None = Field(default=None, description="Slice thickness in mm")
    spacing_between_slices: float | None = Field(default=None, description="Spacing between slices in mm")

    # Image dimensions
    rows: int | None = Field(default=None, description="Number of rows")
    columns: int | None = Field(default=None, description="Number of columns")

    # DICOM metadata
    study_instance_uid: str | None = Field(default=None, description="DICOM Study Instance UID")
    series_instance_uid: str | None = Field(default=None, description="DICOM Series Instance UID")
    sop_instance_uid: str | None = Field(default=None, description="DICOM SOP Instance UID")

    # Processing
    processed: bool = Field(default=False, description="Whether imaging has been processed")
    processing_status: str | None = Field(default=None, description="Current processing status")

    # Segmentation and analysis
    segmentations: list[UUID] = Field(
        default_factory=list,
        description="Cardiac segmentations derived from this study"
    )

    # Embedding for similarity search
    embedding: list[float] | None = Field(default=None, description="Vector embedding for similarity")

    # File references
    file_paths: list[str] = Field(
        default_factory=list,
        description="Paths to original imaging files (NIfTI, DICOM, etc.)"
    )

    # Provenance
    provenance: DataProvenance = Field(
        default=DataProvenance.REAL_OBSERVATION,
        description="Data provenance"
    )

    # Evidence tracking
    evidence_id: UUID | None = Field(default=None, description="Reference to EvidenceArtifact")

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    metadata: dict[str, Any] = Field(default_factory=dict)


class CardiacSegmentation(BaseModel):
    """Cardiac anatomical segmentation from imaging."""

    id: UUID = Field(default_factory=uuid4)
    imaging_study_id: UUID = Field(default=..., description="Reference to ImagingStudy")
    patient_id: UUID = Field(default=..., description="Reference to Patient")

    # Segmentation metadata
    segmentation_date: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When segmentation was performed"
    )
    segmentation_method: str = Field(default=..., description="Method used (manual, automatic, AI)")
    algorithm: str | None = Field(default=None, description="Algorithm or tool used")
    algorithm_version: str | None = Field(default=None, description="Version of algorithm")

    # Segmentation type
    segmentation_type: str = Field(default=..., description="Type of segmentation (chamber, vessel, lesion, etc.)")
    anatomical_structure: str = Field(default=..., description="Anatomical structure segmented")

    # Quantitative measurements
    volume_ml: float | None = Field(default=None, description="Volume in milliliters")
    surface_area_mm2: float | None = Field(default=None, description="Surface area in square millimeters")
    mass_g: float | None = Field(default=None, description="Mass in grams")
    ejection_fraction: float | None = Field(default=None, description="Ejection fraction percentage")

    # Mesh geometry
    mesh_vertices: list[list[float]] | None = Field(default=None, description="3D mesh vertices")
    mesh_faces: list[list[int]] | None = Field(default=None, description="3D mesh faces")
    mesh_file_path: str | None = Field(default=None, description="Path to mesh file")

    # Region statistics
    min_intensity: float | None = Field(default=None, description="Minimum intensity in region")
    max_intensity: float | None = Field(default=None, description="Maximum intensity in region")
    mean_intensity: float | None = Field(default=None, description="Mean intensity in region")

    # Quality metrics
    segmentation_quality: float | None = Field(default=None, description="Quality score (0-1)")
    confidence: float | None = Field(default=None, description="Confidence in segmentation")

    # Provenance
    performer: str | None = Field(default=None, description="Who performed the segmentation")
    provenance: DataProvenance = Field(
        default=DataProvenance.AI_GENERATED,
        description="Data provenance"
    )

    # Evidence tracking
    evidence_id: UUID | None = Field(default=None, description="Reference to EvidenceArtifact")

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    metadata: dict[str, Any] = Field(default_factory=dict)


class DiagnosticReport(BaseModel):
    """Diagnostic report (FHIR DiagnosticReport).

    Can be generated by clinicians or AI systems.
    """

    id: UUID = Field(default_factory=uuid4)
    patient_id: UUID = Field(default=..., description="Reference to Patient")
    encounter_id: UUID | None = Field(default=None, description="Reference to ClinicalEncounter")

    # Report metadata
    report_type: str = Field(default=..., description="Type of report (ECG, Echo, CMR, etc.)")
    report_date: datetime = Field(default=..., description="Date and time of report")
    status: str = Field(default="final", description="Report status")

    # Author
    author: str = Field(default=..., description="Author of the report")
    author_role: str = Field(default="clinician", description="Role of author")
    author_specialty: str | None = Field(default=None, description="Specialty of author")

    # Report content
    title: str = Field(default=..., description="Report title")
    findings: str = Field(default=..., description="Main findings")
    impression: str = Field(default="", description="Clinical impression")
    conclusion: str = Field(default="", description="Conclusion")
    recommendations: list[str] = Field(default_factory=list, description="Recommendations")

    # Structured findings
    structured_findings: dict[str, Any] = Field(default_factory=dict)

    # References
    based_on: list[UUID] = Field(
        default_factory=list,
        description="Observations, studies, or other resources this report is based on"
    )

    # Provenance
    provenance: DataProvenance = Field(
        default=DataProvenance.MANUAL_ENTRY,
        description="Data provenance"
    )
    is_ai_generated: bool = Field(default=False, description="Whether report was AI-generated")
    ai_model: str | None = Field(default=None, description="AI model used if AI-generated")

    # Evidence tracking
    evidence_id: UUID | None = Field(default=None, description="Reference to EvidenceArtifact")

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    metadata: dict[str, Any] = Field(default_factory=dict)


# =============================================================================
# CENTRAL CARDIAC CASE ENTITY
# =============================================================================


class CardiacCase(BaseModel):
    """Central CardiacCase entity.

    This is the primary entity that ties together all patient data,
    evidence, analyses, and workflows for a cardiovascular case.

    A CardiacCase:
    - Belongs to one Patient
    - Can have multiple ClinicalEncounters
    - Can reference multiple ECGs, ImagingStudies, DiagnosticReports
    - Tracks AI inferences, digital twin states, agent executions
    - Maintains evidence continuity and temporal consistency
    """

    id: UUID = Field(default_factory=uuid4)
    case_identifier: str = Field(default=..., description="Human-readable case identifier")
    patient_id: UUID = Field(default=..., description="Reference to Patient")

    # Case metadata
    case_type: str = Field(default=..., description="Type of cardiovascular case")
    presenting_problem: str | None = Field(default=None, description="Primary presenting problem")

    # Status
    status: str = Field(default="active", description="Case status (active, closed, archived)")
    priority: str = Field(default="routine", description="Case priority (routine, urgent, emergency)")

    # Timing
    onset_date: datetime | None = Field(default=None, description="Date of symptom onset")
    presentation_date: datetime | None = Field(default=None, description="Date of presentation")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    closed_at: datetime | None = Field(default=None, description="When case was closed")

    # Associated entities
    encounters: list[UUID] = Field(
        default_factory=list,
        description="List of ClinicalEncounter IDs"
    )
    ecg_studies: list[UUID] = Field(
        default_factory=list,
        description="List of ECGStudy IDs"
    )
    imaging_studies: list[UUID] = Field(
        default_factory=list,
        description="List of ImagingStudy IDs"
    )
    observations: list[UUID] = Field(
        default_factory=list,
        description="List of ClinicalObservation IDs"
    )
    diagnostic_reports: list[UUID] = Field(
        default_factory=list,
        description="List of DiagnosticReport IDs"
    )

    # AI and analysis
    digital_twin_instances: list[UUID] = Field(
        default_factory=list,
        description="List of DigitalTwinInstance IDs"
    )
    simulations: list[UUID] = Field(
        default_factory=list,
        description="List of SimulationRun IDs"
    )
    inferences: list[UUID] = Field(
        default_factory=list,
        description="List of ModelInference IDs"
    )

    # Evidence and workflow
    evidence_artifacts: list[UUID] = Field(
        default_factory=list,
        description="List of EvidenceArtifact IDs"
    )
    agent_executions: list[UUID] = Field(
        default_factory=list,
        description="List of AgentExecution IDs"
    )
    clinical_reviews: list[UUID] = Field(
        default_factory=list,
        description="List of ClinicalReview IDs"
    )
    follow_up_tasks: list[UUID] = Field(
        default_factory=list,
        description="List of FollowUpTask IDs"
    )

    # Evidence continuity tracking
    current_twin_state_id: UUID | None = Field(
        default=None,
        description="Current DigitalTwinInstance ID"
    )
    evidence_continuity_status: TemporalConsistencyStatus = Field(
        default=TemporalConsistencyStatus.UNRESOLVED,
        description="Overall evidence continuity status"
    )

    # Metadata
    metadata: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list, description="Case tags")


# =============================================================================
# AI AND SIMULATION ENTITIES
# =============================================================================


class ModelInference(BaseModel):
    """AI model inference result.

    Tracks all AI predictions, classifications, and analyses.
    """

    id: UUID = Field(default_factory=uuid4)
    cardiac_case_id: UUID = Field(default=..., description="Reference to CardiacCase")

    # Model information
    model_name: str = Field(default=..., description="Name of the model")
    model_version: str = Field(default=..., description="Version of the model")
    model_type: str = Field(default=..., description="Type of model (classification, regression, etc.)")

    # Input
    input_modality: ModalityType | None = Field(default=None, description="Input modality type")
    input_data_reference: UUID | None = Field(
        default=None,
        description="Reference to source data (ECGStudy, ImagingStudy, etc.)"
    )
    input_metadata: dict[str, Any] = Field(default_factory=dict)

    # Output
    predictions: dict[str, Any] = Field(default_factory=dict, description="Model predictions")
    confidence_scores: dict[str, float] = Field(
        default_factory=dict,
        description="Confidence scores for each prediction"
    )
    uncertainty: UncertaintyLevel = Field(
        default=UncertaintyLevel.UNKNOWN,
        description="Overall uncertainty level"
    )

    # Timing
    inference_date: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When inference was performed"
    )

    # Performance
    processing_time_ms: float | None = Field(default=None, description="Inference processing time")

    # Status
    status: str = Field(default="completed", description="Inference status")
    error_message: str | None = Field(default=None, description="Error message if failed")

    # Evidence tracking
    evidence_id: UUID | None = Field(default=None, description="Reference to EvidenceArtifact")

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    metadata: dict[str, Any] = Field(default_factory=dict)


class DigitalTwinInstance(BaseModel):
    """Digital twin instance for a patient.

    Represents a computational model of the patient's cardiovascular system.
    """

    id: UUID = Field(default_factory=uuid4)
    cardiac_case_id: UUID = Field(default=..., description="Reference to CardiacCase")
    patient_id: UUID = Field(default=..., description="Reference to Patient")

    # Twin metadata
    twin_name: str = Field(default="default", description="Name of the twin instance")
    twin_version: str = Field(default="1.0", description="Version of the twin")

    # State
    state: DigitalTwinState = Field(
        default=DigitalTwinState.INITIALIZED,
        description="Current state of the twin"
    )

    # Configuration
    configuration: dict[str, Any] = Field(
        default_factory=dict,
        description="Twin configuration parameters"
    )

    # Input data references
    based_on_evidence: list[UUID] = Field(
        default_factory=list,
        description="Evidence this twin is based on"
    )

    # Validity
    is_valid: bool = Field(default=False, description="Whether twin is valid")
    validity_reasons: list[str] = Field(
        default_factory=list,
        description="Reasons for validity status"
    )
    validity_checked_at: datetime | None = Field(
        default=None,
        description="When validity was last checked"
    )

    # Versioning
    created_from: UUID | None = Field(default=None, description="Parent twin if versioned")
    version_sequence: int = Field(default=1, description="Version sequence number")

    # Temporal information
    evidence_time_window: tuple[datetime, datetime] | None = Field(
        default=None,
        description="Time window of evidence used"
    )
    latest_evidence_time: datetime | None = Field(
        default=None,
        description="Latest evidence timestamp"
    )

    # Uncertainty
    overall_uncertainty: UncertaintyLevel = Field(
        default=UncertaintyLevel.UNKNOWN,
        description="Overall uncertainty of twin state"
    )

    # Provenance
    provenance: DataProvenance = Field(
        default=DataProvenance.SIMULATION_OUTPUT,
        description="Data provenance"
    )

    # Evidence tracking
    evidence_id: UUID | None = Field(default=None, description="Reference to EvidenceArtifact")

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    metadata: dict[str, Any] = Field(default_factory=dict)


class SimulationRun(BaseModel):
    """Simulation run for a digital twin.

    Represents a computational simulation of cardiovascular physiology.
    """

    id: UUID = Field(default_factory=uuid4)
    digital_twin_id: UUID = Field(default=..., description="Reference to DigitalTwinInstance")
    cardiac_case_id: UUID = Field(default=..., description="Reference to CardiacCase")

    # Simulation metadata
    simulation_type: str = Field(default=..., description="Type of simulation (hemodynamic, electromechanical, etc.)")
    scenario: str = Field(default=..., description="Simulation scenario")

    # Parameters
    parameters: dict[str, Any] = Field(default_factory=dict)
    initial_conditions: dict[str, Any] = Field(default_factory=dict)

    # Results
    results: dict[str, Any] = Field(default_factory=dict)
    time_series: dict[str, list[dict[str, Any]]] = Field(
        default_factory=dict,
        description="Time series results"
    )

    # Validity
    validity: dict[str, Any] = Field(
        default_factory=dict,
        description="Validity assessment"
    )
    is_valid: bool = Field(default=False, description="Whether simulation is valid")
    validity_explanation: str | None = Field(default=None, description="Explanation of validity")

    # Status
    status: str = Field(default="pending", description="Simulation status")

    # Timing
    start_time: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When simulation started"
    )
    end_time: datetime | None = Field(default=None, description="When simulation ended")

    # Provenance
    provenance: DataProvenance = Field(
        default=DataProvenance.SIMULATION_OUTPUT,
        description="Data provenance"
    )

    # Evidence tracking
    evidence_id: UUID | None = Field(default=None, description="Reference to EvidenceArtifact")

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    metadata: dict[str, Any] = Field(default_factory=dict)


# =============================================================================
# EVIDENCE AND CONTINUITY ENTITIES
# =============================================================================


class EvidenceArtifact(BaseModel):
    """Evidence artifact in the continuity graph.

    Represents any piece of evidence (observation, measurement, finding, prediction)
    that can be used to support or challenge a cardiac case assessment.
    """

    id: UUID = Field(default_factory=uuid4)
    cardiac_case_id: UUID = Field(default=..., description="Reference to CardiacCase")

    # Evidence metadata
    artifact_type: str = Field(default=..., description="Type of evidence artifact")
    modality: ModalityType | None = Field(default=None, description="Modality type if applicable")

    # Content
    data: dict[str, Any] = Field(default_factory=dict, description="Evidence data")
    summary: str | None = Field(default=None, description="Human-readable summary")

    # Temporal information
    observation_time: datetime | None = Field(
        default=None,
        description="When the evidence was observed/collected"
    )
    valid_time_window: tuple[datetime, datetime] | None = Field(
        default=None,
        description="Time window during which evidence is valid"
    )

    # Source
    source: str = Field(default=..., description="Source of the evidence")
    source_id: str | None = Field(default=None, description="Source identifier")
    provenance: DataProvenance = Field(
        default=DataProvenance.REAL_OBSERVATION,
        description="Data provenance"
    )

    # Status and reliability
    status: EvidenceStatus = Field(
        default=EvidenceStatus.PENDING,
        description="Evidence status"
    )
    confidence: float = Field(
        default=0.0,
        description="Confidence score (0-1)"
    )
    uncertainty: UncertaintyLevel = Field(
        default=UncertaintyLevel.UNKNOWN,
        description="Uncertainty level"
    )

    # Quality
    quality_score: float = Field(
        default=1.0,
        description="Quality score (0-1)"
    )
    quality_issues: list[str] = Field(
        default_factory=list,
        description="Quality issues identified"
    )

    # Relationships
    derived_from: list[UUID] = Field(
        default_factory=list,
        description="Evidence artifacts this was derived from"
    )
    supports: list[UUID] = Field(
        default_factory=list,
        description="Evidence artifacts or conclusions this supports"
    )
    contradicts: list[UUID] = Field(
        default_factory=list,
        description="Evidence artifacts this contradicts"
    )
    supersedes: list[UUID] = Field(
        default_factory=list,
        description="Evidence artifacts this supersedes"
    )
    superseded_by: list[UUID] = Field(
        default_factory=list,
        description="Evidence artifacts that supersede this"
    )

    # Temporal consistency
    temporal_consistency: TemporalConsistencyStatus = Field(
        default=TemporalConsistencyStatus.UNRESOLVED,
        description="Temporal consistency with other evidence"
    )
    consistency_notes: list[str] = Field(
        default_factory=list,
        description="Notes about temporal consistency"
    )

    # Clinical relevance
    clinical_relevance: float = Field(
        default=1.0,
        description="Clinical relevance score (0-1)"
    )

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    created_by: str | None = Field(default=None, description="Who created this evidence")
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentExecution(BaseModel):
    """Agent execution record.

    Tracks all multi-agent workflow executions for a cardiac case.
    """

    id: UUID = Field(default_factory=uuid4)
    cardiac_case_id: UUID = Field(default=..., description="Reference to CardiacCase")

    # Agent information
    agent_name: str = Field(default=..., description="Name of the agent")
    agent_role: str = Field(default=..., description="Role of the agent")
    agent_type: str = Field(default=..., description="Type of agent (LLM, tool, hybrid)")

    # Task information
    task_id: str = Field(default=..., description="Unique task identifier")
    task_description: str = Field(default=..., description="Description of the task")
    task_input: dict[str, Any] = Field(default_factory=dict, description="Task input")

    # Execution
    status: AgentExecutionStatus = Field(
        default=AgentExecutionStatus.QUEUED,
        description="Execution status"
    )

    # Dependencies
    dependencies: list[str] = Field(
        default_factory=list,
        description="Task IDs this depends on"
    )
    dependent_tasks: list[str] = Field(
        default_factory=list,
        description="Task IDs that depend on this"
    )

    # Output
    output: dict[str, Any] = Field(default_factory=dict, description="Agent output")
    error: str | None = Field(default=None, description="Error message if failed")

    # Tool execution
    tool_executions: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Tools called during execution"
    )

    # Provenance
    started_at: datetime | None = Field(default=None, description="When execution started")
    completed_at: datetime | None = Field(default=None, description="When execution completed")

    # Retry
    retry_count: int = Field(default=0, description="Number of retry attempts")
    max_retries: int = Field(default=3, description="Maximum number of retries")

    # Evidence tracking
    evidence_generated: list[UUID] = Field(
        default_factory=list,
        description="Evidence artifacts generated by this execution"
    )
    evidence_used: list[UUID] = Field(
        default_factory=list,
        description="Evidence artifacts used as input"
    )

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    metadata: dict[str, Any] = Field(default_factory=dict)


class ClinicalReview(BaseModel):
    """Clinical review of evidence or analysis.

    Tracks human review of AI-generated outputs and clinical decisions.
    """

    id: UUID = Field(default_factory=uuid4)
    cardiac_case_id: UUID = Field(default=..., description="Reference to CardiacCase")

    # Review metadata
    review_type: str = Field(default=..., description="Type of review (AI_output, diagnosis, treatment_plan, etc.)")
    reviewer: str = Field(default=..., description="Who performed the review")
    reviewer_role: str = Field(default=..., description="Role of reviewer")

    # What is being reviewed
    target_type: str = Field(default=..., description="Type of target (EvidenceArtifact, ModelInference, etc.)")
    target_id: UUID = Field(default=..., description="ID of target being reviewed")

    # Review content
    decision: str = Field(default=..., description="Review decision")
    comments: str = Field(default="", description="Review comments")
    recommendations: list[str] = Field(default_factory=list, description="Recommendations")

    # Status
    status: ReviewStatus = Field(
        default=ReviewStatus.PENDING,
        description="Review status"
    )

    # Assessment
    agreement_level: str | None = Field(default=None, description="Level of agreement with AI")
    confidence_in_decision: str = Field(
        default="medium",
        description="Reviewer confidence in decision"
    )

    # Changes
    changes_made: list[str] = Field(
        default_factory=list,
        description="Changes made based on review"
    )

    # Timing
    review_date: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When review was performed"
    )

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    metadata: dict[str, Any] = Field(default_factory=dict)


class FollowUpTask(BaseModel):
    """Follow-up task for a cardiac case.

    Tracks diagnostic workflows, tests, consultations, and other follow-ups.
    """

    id: UUID = Field(default_factory=uuid4)
    cardiac_case_id: UUID = Field(default=..., description="Reference to CardiacCase")

    # Task metadata
    task_type: str = Field(default=..., description="Type of follow-up task")
    title: str = Field(default=..., description="Task title")
    description: str = Field(default="", description="Task description")

    # Status
    status: str = Field(default="pending", description="Task status")
    priority: str = Field(default="routine", description="Task priority")

    # Timing
    due_date: datetime | None = Field(default=None, description="When task is due")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = Field(default=None, description="When task was completed")

    # Assignment
    assigned_to: str | None = Field(default=None, description="Who task is assigned to")
    assigned_role: str | None = Field(default=None, description="Role of assignee")

    # Context
    triggering_evidence: list[UUID] = Field(
        default_factory=list,
        description="Evidence that triggered this task"
    )
    related_agents: list[UUID] = Field(
        default_factory=list,
        description="Agent executions related to this task"
    )

    # Results
    results: dict[str, Any] = Field(default_factory=dict, description="Task results")
    outcome: str | None = Field(default=None, description="Task outcome")

    # Metadata
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    metadata: dict[str, Any] = Field(default_factory=dict)


class AuditEvent(BaseModel):
    """Audit event for tracking all system activities.

    Provides full provenance and audit trail for the cardiac case.
    """

    id: UUID = Field(default_factory=uuid4)
    cardiac_case_id: UUID | None = Field(default=None, description="Reference to CardiacCase if applicable")

    # Event metadata
    event_type: str = Field(default=..., description="Type of audit event")
    event_category: str = Field(default=..., description="Category of event (create, update, delete, access)")

    # Actor
    actor: str | None = Field(default=None, description="Who performed the action")
    actor_role: str | None = Field(default=None, description="Role of actor")

    # Target
    target_type: str | None = Field(default=None, description="Type of target")
    target_id: str | None = Field(default=None, description="ID of target")

    # Details
    action: str = Field(default=..., description="Specific action performed")
    details: dict[str, Any] = Field(default_factory=dict, description="Event details")

    # Timing
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When event occurred"
    )

    # Outcome
    outcome: str = Field(default="success", description="Event outcome")
    error_message: str | None = Field(default=None, description="Error message if failed")

    # Metadata
    ip_address: str | None = Field(default=None, description="IP address of actor")
    user_agent: str | None = Field(default=None, description="User agent")
    metadata: dict[str, Any] = Field(default_factory=dict)


# =============================================================================
# FACTORY FUNCTIONS
# =============================================================================


def create_patient(
    identifiers: list[PatientIdentifier] | None = None,
    demographics: PatientDemographics | None = None,
    **kwargs
) -> Patient:
    """Factory function to create a Patient instance."""
    return Patient(
        identifiers=identifiers or [],
        demographics=demographics or PatientDemographics(),
        **kwargs
    )


def create_cardiac_case(
    patient_id: UUID,
    case_identifier: str,
    case_type: str,
    **kwargs
) -> CardiacCase:
    """Factory function to create a CardiacCase instance."""
    return CardiacCase(
        patient_id=patient_id,
        case_identifier=case_identifier,
        case_type=case_type,
        **kwargs
    )


def create_evidence_artifact(
    cardiac_case_id: UUID,
    artifact_type: str,
    source: str,
    **kwargs
) -> EvidenceArtifact:
    """Factory function to create an EvidenceArtifact instance."""
    return EvidenceArtifact(
        cardiac_case_id=cardiac_case_id,
        artifact_type=artifact_type,
        source=source,
        **kwargs
    )


# =============================================================================
# EXPORT ALL MODELS
# =============================================================================

__all__ = [
    # Enums
    "ModalityType",
    "EvidenceStatus",
    "TemporalConsistencyStatus",
    "UncertaintyLevel",
    "DataProvenance",
    "AgentExecutionStatus",
    "ReviewStatus",
    "DigitalTwinState",

    # Patient and clinical entities
    "PatientIdentifier",
    "PatientDemographics",
    "Patient",
    "ClinicalEncounter",
    "ClinicalObservation",

    # Cardiovascular-specific entities
    "ECGStudy",
    "ImagingStudy",
    "CardiacSegmentation",
    "DiagnosticReport",

    # Central case entity
    "CardiacCase",

    # AI and simulation entities
    "ModelInference",
    "DigitalTwinInstance",
    "SimulationRun",

    # Evidence and continuity entities
    "EvidenceArtifact",
    "AgentExecution",
    "ClinicalReview",
    "FollowUpTask",
    "AuditEvent",

    # Factory functions
    "create_patient",
    "create_cardiac_case",
    "create_evidence_artifact",
]
