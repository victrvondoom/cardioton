"""CardioTwin Clinical Extraction API.

Provides endpoints for cardiovascular-specific clinical information extraction,
adapted from Epicast-main's syndromic surveillance system.

Original source: Epicast-main/src/agents/intake_agent.py
License: MIT (Copyright (c) 2026 EpiCast Contributors)

Endpoints:
- POST /clinical-extraction/extract: Extract structured cardiac observations from clinical text
- POST /clinical-extraction/batch: Batch extraction for multiple texts
- GET /clinical-extraction/health: Health check endpoint
"""

from __future__ import annotations

import time
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.cardiotwin.services.core__cardiotwin_services__clinical_extraction import (
    ClinicalExtractionError,
    StructuredCardiacSignal,
    extract_cardio_from_text,
    get_clinical_extractor,
)

router = APIRouter(prefix="/clinical-extraction", tags=["cardiotwin-clinical-extraction"])


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class ExtractionRequest(BaseModel):
    """Request for clinical text extraction."""

    clinical_text: str = Field(
        ...,
        description="Clinical narrative text to extract from",
        min_length=1,
        max_length=10000,
    )

    # Optional patient context
    patient_id: UUID | None = Field(
        default=None,
        description="Patient identifier if available"
    )
    patient_age: int | None = Field(
        default=None,
        description="Patient age in years",
        ge=0,
        le=150
    )
    patient_sex: str | None = Field(
        default=None,
        description="Patient sex (M/F/Other)"
    )
    encounter_date: str | None = Field(
        default=None,
        description="Date of clinical encounter (ISO format)"
    )
    modality: str | None = Field(
        default=None,
        description="Source modality (ECG, Echo, Clinical Note, etc.)"
    )


class ExtractionResponse(BaseModel):
    """Response with extracted cardiovascular information."""

    extraction_id: str
    signal: StructuredCardiacSignal
    processing_time_ms: float
    model_version: str
    status: str
    error: str | None = None


class BatchExtractionRequest(BaseModel):
    """Request for batch clinical text extraction."""

    texts: list[str] = Field(
        ...,
        description="List of clinical texts to extract from",
        min_length=1,
        max_length=100
    )
    patient_contexts: list[dict[str, Any]] | None = Field(
        default=None,
        description="Optional patient contexts for each text"
    )


class BatchExtractionResponse(BaseModel):
    """Response with batch extraction results."""

    extraction_id: str
    results: list[ExtractionResponse]
    num_processed: int
    num_errors: int
    total_processing_time_ms: float


# =============================================================================
# ENDPOINTS
# =============================================================================


@router.post("/extract", response_model=ExtractionResponse)
async def extract_clinical_text(
    request: ExtractionRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> ExtractionResponse:
    """Extract structured cardiovascular information from clinical text.

    This endpoint provides cardiovascular-specific clinical information extraction,
    adapted from Epicast-main's syndromic surveillance system. It processes
    clinical narratives and returns structured cardiac observations.

    Capabilities:
    - Extract ECG findings
    - Extract echocardiography findings
    - Identify cardiac symptoms
    - Classify by cardiac category
    - Assess severity
    - Extract temporal information
    - Identify urgent conditions
    - Generate ICD-10 codes

    Args:
        clinical_text: The clinical narrative to process
        patient_id: Optional patient identifier
        patient_age: Optional patient age
        patient_sex: Optional patient sex
        encounter_date: Optional encounter date
        modality: Optional source modality

    Returns:
        StructuredCardiacSignal with extracted information
    """
    start_time = time.time()

    try:
        # Build patient context
        patient_context = {
            "patient_id": str(request.patient_id) if request.patient_id else None,
            "age": request.patient_age,
            "sex": request.patient_sex,
            "encounter_date": request.encounter_date,
            "modality": request.modality,
        }

        # Perform extraction
        signal = extract_cardio_from_text(
            request.clinical_text,
            patient_context
        )

        processing_time = (time.time() - start_time) * 1000

        return ExtractionResponse(
            extraction_id=str(UUID()),
            signal=signal,
            processing_time_ms=processing_time,
            model_version="1.0",
            status="success",
            error=None
        )

    except ClinicalExtractionError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Extraction failed: {str(e)}"
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal error: {str(e)}"
        ) from e


@router.post("/batch", response_model=BatchExtractionResponse)
async def batch_extract_clinical_text(
    request: BatchExtractionRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> BatchExtractionResponse:
    """Batch extraction for multiple clinical texts.

    Process multiple clinical narratives in a single request.

    Args:
        texts: List of clinical texts to extract from
        patient_contexts: Optional patient contexts for each text

    Returns:
        BatchExtractionResponse with results for all texts
    """
    start_time = time.time()

    try:
        results = []
        errors = 0

        for i, text in enumerate(request.texts):
            patient_context = request.patient_contexts[i] if request.patient_contexts and i < len(request.patient_contexts) else None

            try:
                text_start = time.time()
                signal = extract_cardio_from_text(text, patient_context)
                processing_time = (time.time() - text_start) * 1000

                results.append(ExtractionResponse(
                    extraction_id=str(UUID()),
                    signal=signal,
                    processing_time_ms=processing_time,
                    model_version="1.0",
                    status="success",
                    error=None
                ))

            except Exception as e:
                errors += 1
                results.append(ExtractionResponse(
                    extraction_id=str(UUID()),
                    signal=StructuredCardiacSignal(),
                    processing_time_ms=0,
                    model_version="1.0",
                    status="error",
                    error=str(e)
                ))

        total_time = (time.time() - start_time) * 1000

        return BatchExtractionResponse(
            extraction_id=str(UUID()),
            results=results,
            num_processed=len(request.texts),
            num_errors=errors,
            total_processing_time_ms=total_time
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Batch extraction failed: {str(e)}"
        ) from e


@router.get("/health")
async def health_check(
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Health check endpoint."""
    try:
        extractor = get_clinical_extractor()
        return {
            "status": "ok",
            "service": "cardiotwin-clinical-extraction",
            "model_loaded": extractor.is_loaded,
            "model_name": extractor.model_name,
            "device": extractor.device,
            "endpoints": [
                "/clinical-extraction/extract",
                "/clinical-extraction/batch",
                "/clinical-extraction/health",
            ]
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "model_loaded": False,
        }


@router.get("/status")
async def get_status(
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Get detailed service status."""
    return {
        "status": "ok",
        "service": "cardiotwin-clinical-extraction",
        "version": "1.0",
        "capabilities": [
            "ecg_finding_extraction",
            "echo_finding_extraction",
            "symptom_extraction",
            "cardiac_category_classification",
            "severity_assessment",
            "icd10_code_generation",
            "urgent_condition_detection",
            "temporal_information_extraction",
        ],
        "adapted_from": "Epicast-main",
        "license": "MIT",
    }


__all__ = ["router"]
