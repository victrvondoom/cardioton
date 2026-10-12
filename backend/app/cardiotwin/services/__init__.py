"""CardioTwin Services Package.

This package contains the service layer for CardioTwin.

Services are organized by domain:
- imaging_embedding.py: Cardiac imaging embedding generation (from heartAI-main)
- vector_search.py: Vector search for similar cases (from case-twin-main)
- case_matching.py: Hybrid case matching (from case-twin-main)
- evidence_continuity.py: Cardiac Evidence Continuity Engine
- clinical_extraction.py: Clinical text extraction (from Epicast-main)
- workflow_orchestration.py: Event-driven workflow orchestration (from SafetyConnect-main)
- cardiac_agents.py: Multi-agent orchestration (from case-twin-main)
"""

# Import key services as they are created
try:
    from app.cardiotwin.services.imaging_embedding import (
        CardiacImagingEmbedder,
        ImagingEmbeddingError,
        ImagingEmbeddingMetadata,
        ImagingEmbeddingResult,
        generate_cardiac_embedding,
        get_imaging_embedder,
    )
    _imaging_available = True
except ImportError:
    _imaging_available = False

try:
    from app.cardiotwin.services.vector_search import (
        CaseMatcher,
        SearchParameters,
        SearchResult,
        SearchResultItem,
        SearchStrategy,
        SimilarCaseSearchService,
        VectorDatabaseClient,
        VectorDatabaseType,
        VectorSearchService,
        get_similar_case_service,
        get_vector_search_service,
    )
    _vector_search_available = True
except ImportError:
    _vector_search_available = False

try:
    from app.cardiotwin.services.evidence_continuity import (
        CrossModalityContradictionError,
        DigitalTwinValidationError,
        EvidenceContinuityEngine,
        EvidenceContinuityError,
        EvidenceValidationError,
        ProvenanceError,
        TemporalConsistencyError,
        clear_evidence_continuity_engines,
        get_evidence_continuity_engine,
    )
    _evidence_continuity_available = True
except ImportError:
    _evidence_continuity_available = False


try:
    from app.cardiotwin.services.clinical_extraction import (
        CardiacCategory,
        CardiacExtractionEngine,
        CardiacObservation,
        CardiacSeverity,
        CardiacSymptom,
        ClinicalExtractionError,
        ECGFinding,
        EchocardiographyFinding,
        StructuredCardiacSignal,
        extract_cardio_from_text,
        get_clinical_extractor,
    )
    _clinical_extraction_available = True
except ImportError:
    _clinical_extraction_available = False


try:
    from app.cardiotwin.services.workflow_orchestration import (
        CardioTwinWorkflows,
        StageResult,
        WorkflowEvent,
        WorkflowEventType,
        WorkflowExecution,
        WorkflowOrchestrator,
        WorkflowStage,
        WorkflowStatus,
        get_async_workflow_orchestrator,
        get_workflow_orchestrator,
    )
    _workflow_orchestration_available = True
except ImportError:
    _workflow_orchestration_available = False


__all__ = []

if _imaging_available:
    __all__.extend([
        "CardiacImagingEmbedder",
        "ImagingEmbeddingError",
        "get_imaging_embedder",
        "generate_cardiac_embedding",
        "ImagingEmbeddingMetadata",
        "ImagingEmbeddingResult",
    ])

if _vector_search_available:
    __all__.extend([
        "VectorDatabaseType",
        "SearchStrategy",
        "SearchParameters",
        "SearchResult",
        "SearchResultItem",
        "VectorDatabaseClient",
        "CaseMatcher",
        "VectorSearchService",
        "SimilarCaseSearchService",
        "get_vector_search_service",
        "get_similar_case_service",
    ])

if _evidence_continuity_available:
    __all__.extend([
        "EvidenceContinuityEngine",
        "EvidenceContinuityError",
        "EvidenceValidationError",
        "TemporalConsistencyError",
        "CrossModalityContradictionError",
        "ProvenanceError",
        "DigitalTwinValidationError",
        "get_evidence_continuity_engine",
        "clear_evidence_continuity_engines",
    ])

if _clinical_extraction_available:
    __all__.extend([
        "CardiacExtractionEngine",
        "ClinicalExtractionError",
        "CardiacSeverity",
        "CardiacCategory",
        "ECGFinding",
        "EchocardiographyFinding",
        "CardiacSymptom",
        "CardiacObservation",
        "StructuredCardiacSignal",
        "get_clinical_extractor",
        "extract_cardio_from_text",
    ])

if _workflow_orchestration_available:
    __all__.extend([
        "WorkflowOrchestrator",
        "WorkflowExecution",
        "WorkflowEvent",
        "WorkflowEventType",
        "WorkflowStage",
        "WorkflowStatus",
        "StageResult",
        "CardioTwinWorkflows",
        "get_workflow_orchestrator",
        "get_async_workflow_orchestrator",
    ])
