"""CardioTwin Models Package.

This package contains the canonical domain models for CardioTwin.

Models are organized by domain:
- cardiac_case.py: Core cardiovascular domain entities (Patient, CardiacCase, etc.)
- evidence_graph.py: Evidence graph models for continuity engine
- ecg/models.py: ECG-specific models
- evidence/schema.py: Evidence and intelligence models
- schema.py: Feature specifications and dataset schemas
- model.py: ML model artifacts and prediction models
"""

from app.cardiotwin.models.cardiac_case import (
    AgentExecution,
    AgentExecutionStatus,
    AuditEvent,
    # Central case entity
    CardiacCase,
    CardiacSegmentation,
    ClinicalEncounter,
    ClinicalObservation,
    ClinicalReview,
    DataProvenance,
    DiagnosticReport,
    DigitalTwinInstance,
    DigitalTwinState,
    # Cardiovascular-specific entities
    ECGStudy,
    # Evidence and continuity entities
    EvidenceArtifact,
    EvidenceStatus,
    FollowUpTask,
    ImagingStudy,
    # Enums
    ModalityType,
    # AI and simulation entities
    ModelInference,
    Patient,
    PatientDemographics,
    # Patient and clinical entities
    PatientIdentifier,
    ReviewStatus,
    SimulationRun,
    TemporalConsistencyStatus,
    UncertaintyLevel,
    create_cardiac_case,
    create_evidence_artifact,
    # Factory functions
    create_patient,
)

try:
    from app.cardiotwin.models.evidence_graph import (
        # Scoring models
        ConfidenceScore,
        ConfidenceScoringMethod,
        ConsistencyStatus,
        CrossModalityContradiction,
        EvidenceEdge,
        EvidenceEdgeMetadata,
        EvidenceGraph,
        # Graph models
        EvidenceGraphStatistics,
        EvidenceNode,
        # Node and edge models
        EvidenceNodeMetadata,
        # Enums
        EvidenceNodeType,
        EvidenceRelationship,
        EvidenceValidationResult,
        ProvenanceChain,
        # Consistency and validation models
        TemporalAlignmentIssue,
        create_evidence_edge,
        create_evidence_graph,
        # Factory functions
        create_evidence_node,
    )
    _evidence_graph_available = True
except ImportError:
    _evidence_graph_available = False

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

if _evidence_graph_available:
    __all__.extend([
        # Enums
        "EvidenceNodeType",
        "EvidenceRelationship",
        "ConsistencyStatus",
        "ConfidenceScoringMethod",

        # Node and edge models
        "EvidenceNodeMetadata",
        "EvidenceNode",
        "EvidenceEdgeMetadata",
        "EvidenceEdge",

        # Graph models
        "EvidenceGraphStatistics",
        "EvidenceGraph",

        # Consistency and validation models
        "TemporalAlignmentIssue",
        "CrossModalityContradiction",
        "ProvenanceChain",
        "EvidenceValidationResult",

        # Scoring models
        "ConfidenceScore",

        # Factory functions
        "create_evidence_node",
        "create_evidence_edge",
        "create_evidence_graph",
    ])
