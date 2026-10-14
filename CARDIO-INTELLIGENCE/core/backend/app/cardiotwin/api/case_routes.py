"""CardioTwin Case API.

Provides endpoints for cardiac case management, similar case search,
and case comparison.

This API is extracted and adapted from:
- case-twin-main/backend/main.py (FastAPI endpoints)

Original source has MIT License (Copyright (c) 2026 CaseTwin Contributors).

Endpoints:
- POST /cases/search: Search for similar cardiac cases
- GET /cases/{case_id}/similar: Get similar cases for a specific case
- POST /cases/{case_id}/compare: Compare multiple cases
- GET /cases/{case_id}: Get case details
"""

from __future__ import annotations

import time
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.cardiotwin.models import ModalityType
from app.cardiotwin.services.vector_search import (
    SearchParameters,
    SearchStrategy,
    get_vector_search_service,
)

router = APIRouter(prefix="/cases", tags=["cardiotwin-cases"])


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class CaseSearchRequest(BaseModel):
    """Request for searching similar cases."""

    embedding: list[float] | None = Field(
        default=None,
        description="Query vector embedding (required if no imaging file)"
    )

    # Filtering
    modality: ModalityType | None = Field(
        default=None,
        description="Filter by imaging modality"
    )
    case_type: str | None = Field(default=None, description="Filter by case type")
    min_age: int | None = Field(default=None, description="Minimum patient age")
    max_age: int | None = Field(default=None, description="Maximum patient age")
    sex: str | None = Field(default=None, description="Filter by patient sex")

    # Search parameters
    limit: int = Field(default=10, ge=1, le=50, description="Maximum number of results")
    strategy: SearchStrategy = Field(
        default=SearchStrategy.HYBRID,
        description="Search strategy"
    )

    # Profile for hybrid search
    profile: dict[str, Any] | None = Field(
        default=None,
        description="Clinical profile for hybrid matching"
    )


class CaseSearchResponse(BaseModel):
    """Response with similar cases."""

    query_id: str
    results: list[CaseResult]
    num_results: int
    strategy: str
    execution_time_ms: float


class CaseResult(BaseModel):
    """Single case result."""

    case_id: UUID
    score: float
    similarity: float | None = None

    # Case metadata
    case_identifier: str
    case_type: str | None = None

    # Patient info
    patient_id: UUID | None = None
    patient_age: int | None = None
    patient_sex: str | None = None

    # Imaging info
    modality: str | None = None
    imaging_study_id: UUID | None = None

    # Matching details
    visual_match: float | None = None
    contextual_match: float | None = None

    # Evidence
    evidence_artifacts: list[UUID] = []
    temporal_consistency: str | None = None


class CaseComparisonRequest(BaseModel):
    """Request for comparing multiple cases."""

    case_ids: list[UUID] = Field(default=..., min_length=2, description="List of case IDs to compare")
    comparison_type: str = Field(default="pairwise", description="Type of comparison")


class CaseComparisonResponse(BaseModel):
    """Response with case comparison results."""

    comparison_id: str
    cases: list[CaseResult]
    comparison_matrix: list[list[float]] | None = None
    summary: dict[str, Any] = {}


class CaseDetailsResponse(BaseModel):
    """Response with detailed case information."""

    case_id: UUID
    case_identifier: str
    case_type: str

    # Patient
    patient_id: UUID | None = None
    patient_age: int | None = None
    patient_sex: str | None = None

    # Associated data
    imaging_studies: list[UUID] = []
    ecg_studies: list[UUID] = []
    diagnostic_reports: list[UUID] = []

    # Evidence
    evidence_artifacts: list[UUID] = []

    # AI
    digital_twin_id: UUID | None = None
    inferences: list[UUID] = []

    # Workflow
    agent_executions: list[UUID] = []
    clinical_reviews: list[UUID] = []
    follow_up_tasks: list[UUID] = []

    # Status
    evidence_continuity_status: str


# =============================================================================
# ENDPOINTS
# =============================================================================


@router.post("/search", response_model=CaseSearchResponse)
async def search_similar_cases(
    request: CaseSearchRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> CaseSearchResponse:
    """Search for similar cardiac cases.

    This endpoint provides similar functionality to case-twin-main's /search endpoint,
    adapted for cardiovascular cases with the canonical CardiacCase domain model.

    Accepts:
    - Embedding vector for similarity search
    - Clinical profile for hybrid matching
    - Various filters (modality, case type, demographics)

    Returns:
    - List of similar cases ranked by similarity
    """
    start_time = time.time()

    try:
        # Get the vector search service
        search_service = get_vector_search_service()

        # Build search parameters
        parameters = SearchParameters(
            limit=request.limit,
            strategy=request.strategy,
        )

        # Perform search
        if request.embedding:
            import numpy as np
            query_embedding = np.array(request.embedding)

            if request.profile:
                result = search_service.search_with_profile(
                    query_embedding,
                    request.profile,
                    parameters
                )
            else:
                result = search_service.search_similar_cases(
                    query_embedding,
                    parameters
                )
        else:
            raise HTTPException(
                status_code=400,
                detail="Either embedding or imaging file must be provided"
            )

        # Convert result to response format
        execution_time = (time.time() - start_time) * 1000

        results = []
        for item in result.results:
            results.append(CaseResult(
                case_id=item.id,
                score=item.score,
                similarity=item.score,
                case_identifier=f"Case-{item.id}",
                case_type=item.case_type,
                patient_id=item.payload.get("patient_id"),
                patient_age=item.patient_age,
                patient_sex=item.patient_sex,
                modality=item.modality.value if item.modality else None,
                imaging_study_id=item.imaging_study_id,
                visual_match=item.visual_score,
                contextual_match=item.contextual_score,
                evidence_artifacts=item.payload.get("evidence_artifacts", []),
                temporal_consistency=item.temporal_consistency.value,
            ))

        return CaseSearchResponse(
            query_id=result.query_id,
            results=results,
            num_results=result.num_results,
            strategy=result.strategy.value,
            execution_time_ms=execution_time
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        ) from e


@router.get("/{case_id}/similar", response_model=CaseSearchResponse)
async def get_similar_cases(
    case_id: UUID,
    limit: int = 10,
    strategy: SearchStrategy = SearchStrategy.HYBRID,
    _: dict[str, Any] = Depends(get_current_user)
) -> CaseSearchResponse:
    """Get similar cases for a specific cardiac case.

    This endpoint finds cases similar to the specified case_id.
    """
    try:
        # In actual implementation, this would:
        # 1. Retrieve the case embedding from the database
        # 2. Perform search using the embedding
        # 3. Return similar cases

        # For now, return mock results
        search_service = get_vector_search_service()
        parameters = SearchParameters(limit=limit, strategy=strategy)

        import numpy as np
        # Mock embedding
        query_embedding = np.random.rand(512).astype(np.float32)

        result = search_service.search_similar_cases(query_embedding, parameters)

        execution_time = 100.0

        results = []
        for item in result.results:
            results.append(CaseResult(
                case_id=item.id,
                score=item.score,
                similarity=item.score,
                case_identifier=f"Case-{item.id}",
                case_type=item.case_type,
                patient_id=item.payload.get("patient_id"),
                patient_age=item.patient_age,
                patient_sex=item.patient_sex,
                modality=item.modality.value if item.modality else None,
                imaging_study_id=item.imaging_study_id,
                visual_match=item.visual_score,
                contextual_match=item.contextual_score,
                temporal_consistency=item.temporal_consistency.value,
            ))

        return CaseSearchResponse(
            query_id=result.query_id,
            results=results,
            num_results=result.num_results,
            strategy=result.strategy.value,
            execution_time_ms=execution_time
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get similar cases: {str(e)}"
        ) from e


@router.post("/{case_id}/compare", response_model=CaseComparisonResponse)
async def compare_cases(
    case_id: UUID,
    request: CaseComparisonRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> CaseComparisonResponse:
    """Compare multiple cardiac cases.

    This endpoint compares the specified case with other cases.
    """
    try:
        # In actual implementation, this would:
        # 1. Retrieve all specified cases
        # 2. Compute pairwise similarities
        # 3. Generate comparison matrix
        # 4. Return comparison results

        # For now, return mock results
        comparison_id = str(UUID())

        cases = []
        for i, compare_case_id in enumerate(request.case_ids):
            cases.append(CaseResult(
                case_id=compare_case_id,
                score=0.85 - (i * 0.1),
                similarity=0.85 - (i * 0.1),
                case_identifier=f"Case-{compare_case_id}",
                case_type="CAD",
                patient_age=55 + i,
                patient_sex="M" if i % 2 == 0 else "F",
            ))

        # Create comparison matrix
        matrix_size = len(request.case_ids)
        comparison_matrix = [[0.0 for _ in range(matrix_size)] for _ in range(matrix_size)]
        for i in range(matrix_size):
            for j in range(matrix_size):
                if i == j:
                    comparison_matrix[i][j] = 1.0
                else:
                    comparison_matrix[i][j] = 0.7 - (abs(i - j) * 0.1)

        return CaseComparisonResponse(
            comparison_id=comparison_id,
            cases=cases,
            comparison_matrix=comparison_matrix,
            summary={
                "num_cases": len(cases),
                "comparison_type": request.comparison_type,
                "mean_similarity": 0.75
            }
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Comparison failed: {str(e)}"
        ) from e


@router.get("/{case_id}", response_model=CaseDetailsResponse)
async def get_case_details(
    case_id: UUID,
    _: dict[str, Any] = Depends(get_current_user)
) -> CaseDetailsResponse:
    """Get detailed information for a cardiac case."""
    try:
        # In actual implementation, this would:
        # 1. Retrieve case from database
        # 2. Return all associated data

        # For now, return mock details
        return CaseDetailsResponse(
            case_id=case_id,
            case_identifier=f"Case-{case_id}",
            case_type="CAD",
            patient_id=UUID(int=100),
            patient_age=55,
            patient_sex="M",
            imaging_studies=[UUID(int=200), UUID(int=201)],
            ecg_studies=[UUID(int=300)],
            diagnostic_reports=[UUID(int=400)],
            evidence_artifacts=[UUID(int=500), UUID(int=501)],
            digital_twin_id=UUID(int=600),
            inferences=[UUID(int=700)],
            agent_executions=[UUID(int=800)],
            clinical_reviews=[UUID(int=900)],
            follow_up_tasks=[UUID(int=1000)],
            evidence_continuity_status="consistent"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get case details: {str(e)}"
        ) from e


@router.get("/health")
async def health_check(
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "cardiotwin-cases",
        "endpoints": [
            "/cases/search",
            "/cases/{case_id}/similar",
            "/cases/{case_id}/compare",
            "/cases/{case_id}",
        ]
    }


__all__ = ["router"]
