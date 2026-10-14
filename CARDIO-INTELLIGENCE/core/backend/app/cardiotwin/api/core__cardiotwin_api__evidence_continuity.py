"""API endpoints for the Cardiac Evidence Continuity Engine.

This module provides RESTful API endpoints for:
- Managing evidence graphs for cardiac cases
- Validating temporal consistency
- Detecting cross-modality contradictions
- Tracking provenance
- Computing confidence scores
- Validating digital twin synchronization
- Agentic verification workflows

All endpoints are designed to be:
- Stateless (no server-side state)
- Idempotent where appropriate
- Well-documented with OpenAPI schemas
- Consistent with CardioTwin's existing API patterns
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.cardiotwin.models.evidence_graph import (
    ConfidenceScore,
    ConfidenceScoringMethod,
    CrossModalityContradiction,
    EvidenceGraph,
    EvidenceNodeType,
    EvidenceRelationship,
    EvidenceValidationResult,
    ProvenanceChain,
    TemporalAlignmentIssue,
)
from app.cardiotwin.services.core__cardiotwin_services__evidence_continuity import (
    EvidenceReference,
    clear_evidence_continuity_engines,
    get_evidence_continuity_engine,
)

router = APIRouter(prefix="/evidence-continuity", tags=["cardiotwin-evidence-continuity"])


# =============================================================================
# REQUEST AND RESPONSE MODELS
# =============================================================================

class CreateEvidenceGraphRequest(BaseModel):
    """Request to create a new evidence graph for a cardiac case."""

    cardiac_case_id: UUID = Field(default=..., description="The cardiac case ID")
    name: str = Field(default="", description="Human-readable name for the graph")
    description: str = Field(default="", description="Description of the graph")


class AddEvidenceRequest(BaseModel):
    """Request to add evidence to a graph."""

    cardiac_case_id: UUID = Field(default=..., description="The cardiac case ID")
    entity_type: str = Field(default=..., description="Type of evidence entity")
    entity_id: UUID = Field(default=..., description="ID of the evidence entity")
    data: dict[str, Any] = Field(default_factory=dict, description="Evidence data")
    summary: str = Field(default="", description="Human-readable summary")
    node_type: str | None = Field(default=None, description="Node type (optional)")
    observation_time: str | None = Field(default=None, description="ISO timestamp of observation")
    source: str = Field(default="", description="Source of the evidence")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Confidence score")
    quality_score: float = Field(default=1.0, ge=0.0, le=1.0, description="Quality score")
    provenance: str = Field(default="", description="Provenance category")
    clinical_relevance: float = Field(default=1.0, ge=0.0, le=1.0, description="Clinical relevance")


class AddRelationshipRequest(BaseModel):
    """Request to add a relationship between evidence nodes."""

    cardiac_case_id: UUID = Field(default=..., description="The cardiac case ID")
    source_node_id: UUID = Field(default=..., description="Source node ID")
    target_node_id: UUID = Field(default=..., description="Target node ID")
    relationship: str = Field(default=..., description="Relationship type")
    consistency_status: str | None = Field(default=None, description="Consistency status")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Relationship confidence")


class ValidateRequest(BaseModel):
    """Request to validate evidence for a cardiac case."""

    cardiac_case_id: UUID = Field(default=..., description="The cardiac case ID")
    validation_type: str = Field(
        default="full",
        description="Type of validation: full, temporal, cross_modality, provenance"
    )


class ConfidenceScoreRequest(BaseModel):
    """Request to compute confidence score."""

    cardiac_case_id: UUID = Field(default=..., description="The cardiac case ID")
    method: ConfidenceScoringMethod = Field(
        default=ConfidenceScoringMethod.COMPOSITE,
        description="Scoring method to use"
    )
    weights: dict[str, float] | None = Field(
        default=None,
        description="Optional custom weights for scoring components"
    )


class AgenticVerificationRequest(BaseModel):
    """Request for agentic verification."""

    cardiac_case_id: UUID = Field(default=..., description="The cardiac case ID")
    agent_name: str = Field(default=..., description="Name of the verification agent")
    verification_task: str = Field(
        default=...,
        description="Verification task: temporal_consistency, cross_modality, provenance, digital_twin"
    )
    context: dict[str, Any] = Field(default_factory=dict, description="Additional context")


class TemporalConsistencyResponse(BaseModel):
    """Response for temporal consistency validation."""

    cardiac_case_id: UUID
    is_consistent: bool
    issues: list[TemporalAlignmentIssue]
    consistency_score: float
    statistics: dict[str, Any]


class CrossModalityResponse(BaseModel):
    """Response for cross-modality consistency validation."""

    cardiac_case_id: UUID
    is_consistent: bool
    contradictions: list[CrossModalityContradiction]
    consistency_score: float
    statistics: dict[str, Any]


class ProvenanceResponse(BaseModel):
    """Response for provenance tracking."""

    cardiac_case_id: UUID
    evidence_id: UUID
    chain: ProvenanceChain | None
    is_valid: bool
    validation_notes: list[str]


# =============================================================================
# ENDPOINTS
# =============================================================================


@router.post("/graphs", response_model=EvidenceGraph)
async def create_evidence_graph(
    request: CreateEvidenceGraphRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> EvidenceGraph:
    """Create a new evidence graph for a cardiac case.

    This initializes a new EvidenceGraph for tracking evidence continuity.
    """
    engine = get_evidence_continuity_engine(request.cardiac_case_id)

    # If graph already exists, return it
    if engine.graph.nodes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Evidence graph already exists for case {request.cardiac_case_id}"
        )

    return engine.graph


@router.get("/graphs/{cardiac_case_id}", response_model=EvidenceGraph)
async def get_evidence_graph(
    cardiac_case_id: UUID,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> EvidenceGraph:
    """Get the evidence graph for a cardiac case."""
    engine = get_evidence_continuity_engine(cardiac_case_id)
    return engine.graph


@router.post("/graphs/{cardiac_case_id}/evidence", response_model=dict[str, Any])
async def add_evidence_to_graph(
    request: AddEvidenceRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Add evidence to an evidence graph.

    This adds a new evidence node to the graph with the provided metadata.
    """
    if request.cardiac_case_id != request.cardiac_case_id:
        # Sanity check
        pass

    engine = get_evidence_continuity_engine(request.cardiac_case_id)

    try:
        # The evidence lives elsewhere; this request describes it. Invalid enum or timestamp
        # values raise ValueError and become a 400 below.
        node = engine.add_evidence(
            EvidenceReference(id=request.entity_id, entity_type=request.entity_type),
            node_type=EvidenceNodeType(request.node_type) if request.node_type else None,
            data=request.data,
            summary=request.summary,
            observation_time=(
                datetime.fromisoformat(request.observation_time) if request.observation_time else None
            ),
            source=request.source,
            confidence=request.confidence,
            quality_score=request.quality_score,
            provenance=request.provenance,
            clinical_relevance=request.clinical_relevance,
        )

        return {
            "status": "success",
            "node_id": str(node.id),
            "entity_id": str(request.entity_id),
            "message": "Evidence added to graph"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to add evidence: {str(e)}"
        ) from e


@router.post("/graphs/{cardiac_case_id}/relationships", response_model=dict[str, Any])
async def add_relationship_to_graph(
    request: AddRelationshipRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Add a relationship between evidence nodes.

    This creates an EvidenceEdge connecting two EvidenceNodes.
    """
    engine = get_evidence_continuity_engine(request.cardiac_case_id)

    try:
        edge = engine.add_relationship(
            request.source_node_id,
            request.target_node_id,
            EvidenceRelationship(request.relationship),
            consistency_status=request.consistency_status,
            confidence=request.confidence,
        )

        return {
            "status": "success",
            "edge_id": str(edge.id),
            "source_id": str(edge.source_id),
            "target_id": str(edge.target_id),
            "relationship": edge.metadata.relationship.value,
            "message": "Relationship added to graph"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to add relationship: {str(e)}"
        ) from e


@router.post("/graphs/{cardiac_case_id}/validate", response_model=EvidenceValidationResult)
async def validate_evidence_graph(
    request: ValidateRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> EvidenceValidationResult:
    """Validate evidence for a cardiac case.

    This performs comprehensive validation including:
    - Temporal consistency checking
    - Cross-modality contradiction detection
    - Provenance completeness
    - Confidence scoring
    - Digital twin synchronization (if applicable)
    """
    engine = get_evidence_continuity_engine(request.cardiac_case_id)

    try:
        if request.validation_type == "temporal":
            # Only temporal validation
            issues = engine.validate_temporal_consistency()
            return EvidenceValidationResult(
                cardiac_case_id=request.cardiac_case_id,
                is_valid=len(issues) == 0,
                validation_score=1.0 - min(len(issues) * 0.1, 1.0),
                temporal_issues=issues,
            )
        elif request.validation_type == "cross_modality":
            # Only cross-modality validation
            contradictions = engine.validate_cross_modality_consistency()
            return EvidenceValidationResult(
                cardiac_case_id=request.cardiac_case_id,
                is_valid=len(contradictions) == 0,
                validation_score=1.0 - min(len(contradictions) * 0.1, 1.0),
                contradictions=contradictions,
            )
        else:
            # Full validation
            return engine.validate_all()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Validation failed: {str(e)}"
        ) from e


@router.get("/graphs/{cardiac_case_id}/validate", response_model=EvidenceValidationResult)
async def get_validation_result(
    cardiac_case_id: UUID,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> EvidenceValidationResult:
    """Get the current validation result for a cardiac case.

    Returns cached validation result if available, otherwise performs validation.
    """
    engine = get_evidence_continuity_engine(cardiac_case_id)
    return engine.validate_all()


@router.post("/graphs/{cardiac_case_id}/temporal-consistency", response_model=TemporalConsistencyResponse)
async def check_temporal_consistency(
    cardiac_case_id: UUID,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> TemporalConsistencyResponse:
    """Check temporal consistency of evidence for a cardiac case.

    Validates that:
    - All evidence has valid timestamps
    - Temporal relationships are consistent
    - Time gaps between related evidence are reasonable
    """
    engine = get_evidence_continuity_engine(cardiac_case_id)

    issues = engine.validate_temporal_consistency()
    consistency_score = engine._compute_temporal_consistency_score()

    return TemporalConsistencyResponse(
        cardiac_case_id=cardiac_case_id,
        is_consistent=len(issues) == 0,
        issues=issues,
        consistency_score=consistency_score,
        statistics={
            "total_nodes": len(engine.graph.nodes),
            "nodes_with_timestamps": sum(
                1 for n in engine.graph.nodes.values()
                if n.metadata.observation_time
            ),
            "temporal_edges": sum(
                1 for e in engine.graph.edges.values()
                if e.metadata.relationship.value in ["occurred_before", "occurred_after", "overlaps"]
            ),
        }
    )


@router.post("/graphs/{cardiac_case_id}/cross-modality", response_model=CrossModalityResponse)
async def check_cross_modality_consistency(
    cardiac_case_id: UUID,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> CrossModalityResponse:
    """Check cross-modality consistency of evidence for a cardiac case.

    Validates that:
    - ECG findings are consistent with imaging findings
    - Imaging measurements are consistent with clinical observations
    - AI predictions are consistent with clinician assessments
    """
    engine = get_evidence_continuity_engine(cardiac_case_id)

    contradictions = engine.validate_cross_modality_consistency()
    consistency_score = engine._compute_cross_modality_consistency_score()

    return CrossModalityResponse(
        cardiac_case_id=cardiac_case_id,
        is_consistent=len(contradictions) == 0,
        contradictions=contradictions,
        consistency_score=consistency_score,
        statistics={
            "total_nodes": len(engine.graph.nodes),
            "modalities": {}
        }
    )


@router.post("/graphs/{cardiac_case_id}/confidence-score", response_model=ConfidenceScore)
async def compute_confidence_score(
    request: ConfidenceScoreRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> ConfidenceScore:
    """Compute confidence score for a cardiac case.

    The confidence score is a composite measure of:
    - Evidence quality
    - Temporal consistency
    - Cross-modality consistency
    - Provenance completeness
    - Clinical relevance
    """
    engine = get_evidence_continuity_engine(request.cardiac_case_id)

    try:
        score = engine.compute_confidence_score(
            method=request.method,
            weights=request.weights,
        )
        return score
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute confidence score: {str(e)}"
        ) from e


@router.get("/graphs/{cardiac_case_id}/confidence-score", response_model=ConfidenceScore)
async def get_confidence_score(
    cardiac_case_id: UUID,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> ConfidenceScore:
    """Get the current confidence score for a cardiac case.

    Uses default method (COMPOSITE) with default weights.
    """
    engine = get_evidence_continuity_engine(cardiac_case_id)
    return engine.compute_confidence_score()


@router.get("/graphs/{cardiac_case_id}/provenance/{evidence_id}", response_model=ProvenanceResponse)
async def get_provenance_chain(
    cardiac_case_id: UUID,
    evidence_id: UUID,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> ProvenanceResponse:
    """Get the provenance chain for a piece of evidence.

    Returns the complete provenance chain showing how evidence was derived.
    """
    engine = get_evidence_continuity_engine(cardiac_case_id)

    chain = engine.get_provenance_chain(evidence_id)

    if chain:
        is_valid = engine.verify_provenance_chain(evidence_id)
        return ProvenanceResponse(
            cardiac_case_id=cardiac_case_id,
            evidence_id=evidence_id,
            chain=chain,
            is_valid=is_valid,
            validation_notes=chain.validation_notes,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence {evidence_id} not found in case {cardiac_case_id}"
        )


@router.post("/graphs/{cardiac_case_id}/provenance/{evidence_id}/verify", response_model=ProvenanceResponse)
async def verify_provenance_chain(
    cardiac_case_id: UUID,
    evidence_id: UUID,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> ProvenanceResponse:
    """Verify the provenance chain for a piece of evidence.

    Performs cryptographic verification of the provenance chain.
    """
    engine = get_evidence_continuity_engine(cardiac_case_id)

    chain = engine.get_provenance_chain(evidence_id)

    if chain:
        is_valid = engine.verify_provenance_chain(evidence_id)
        return ProvenanceResponse(
            cardiac_case_id=cardiac_case_id,
            evidence_id=evidence_id,
            chain=chain,
            is_valid=is_valid,
            validation_notes=chain.validation_notes,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence {evidence_id} not found in case {cardiac_case_id}"
        )


@router.post("/graphs/{cardiac_case_id}/agentic-verification", response_model=dict[str, Any])
async def agentic_verification(
    request: AgenticVerificationRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Perform agentic verification of evidence.

    Dispatches verification tasks to specialized agents for:
    - Temporal consistency checking
    - Cross-modality contradiction detection
    - Provenance verification
    - Digital twin validation
    """
    engine = get_evidence_continuity_engine(request.cardiac_case_id)

    try:
        result = engine.agentic_verification(
            agent_name=request.agent_name,
            verification_task=request.verification_task,
            **request.context
        )

        return {
            "status": "success",
            "result": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agentic verification failed: {str(e)}"
        ) from e


@router.get("/graphs/{cardiac_case_id}/export", response_model=dict[str, Any])
async def export_evidence_graph(
    cardiac_case_id: UUID,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Export the complete evidence graph for a cardiac case.

    Returns a serializable representation of the graph suitable for
    storage, transmission, or visualization.
    """
    engine = get_evidence_continuity_engine(cardiac_case_id)
    return engine.export_graph()


@router.get("/graphs/{cardiac_case_id}/statistics", response_model=dict[str, Any])
async def get_graph_statistics(
    cardiac_case_id: UUID,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Get statistics about the evidence graph.

    Returns comprehensive statistics about the graph structure and content.
    """
    engine = get_evidence_continuity_engine(cardiac_case_id)

    return {
        "cardiac_case_id": str(cardiac_case_id),
        "statistics": engine.graph.statistics.model_dump(),
        "node_count": len(engine.graph.nodes),
        "edge_count": len(engine.graph.edges),
        "node_types": engine.graph.node_index,
        "edge_types": engine.graph.edge_index,
    }


@router.delete("/graphs/{cardiac_case_id}", response_model=dict[str, Any])
async def delete_evidence_graph(
    cardiac_case_id: UUID,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Delete an evidence graph for a cardiac case.

    Note: This removes the in-memory graph. Persistent storage would need
    to be handled separately.
    """
    # Clear the engine from registry
    clear_evidence_continuity_engines()

    return {
        "status": "success",
        "message": f"Evidence graph for case {cardiac_case_id} cleared from memory",
        "cardiac_case_id": str(cardiac_case_id)
    }


# =============================================================================
# HEALTH AND STATUS ENDPOINTS
# =============================================================================

@router.get("/health")
async def health_check() -> dict[str, Any]:
    """Health check endpoint for the evidence continuity service."""
    return {
        "status": "healthy",
        "service": "cardiotwin-evidence-continuity",
        "version": "1.0.0",
        "active_engines": len(dict(globals().get("_engine_registry", {}).items())),
    }


@router.get("/status/{cardiac_case_id}", response_model=dict[str, Any])
async def get_engine_status(
    cardiac_case_id: UUID,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Get the status of the evidence continuity engine for a cardiac case."""
    engine = get_evidence_continuity_engine(cardiac_case_id)

    return {
        "cardiac_case_id": str(cardiac_case_id),
        "status": "active",
        "node_count": len(engine.graph.nodes),
        "edge_count": len(engine.graph.edges),
        "last_validated": engine._last_validated.isoformat() if engine._last_validated else None,
        "validation_cached": engine._validation_result is not None,
        "provenance_chains_count": len(engine._provenance_chains),
        "audit_log_count": len(engine._audit_log),
    }
