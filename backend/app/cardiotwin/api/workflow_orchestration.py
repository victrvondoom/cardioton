"""CardioTwin Workflow Orchestration API.

Provides endpoints for workflow execution, monitoring, and management,
inspired by SafetyConnect-main's event-driven orchestration system.

Original source: SafetyConnect-main/src/inngest/
License: MIT (Copyright (c) 2026 SafetyConnect Contributors)

Endpoints:
- POST /workflows: Create a new workflow
- POST /workflows/{workflow_id}/start: Start a workflow execution
- GET /workflows/{workflow_id}: Get workflow details
- GET /workflows: List all workflows
- POST /workflows/{workflow_id}/cancel: Cancel a workflow
- GET /workflows/{workflow_id}/events: Get workflow events
- POST /events: Emit a workflow event
"""

from __future__ import annotations

import asyncio
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.cardiotwin.services.workflow_orchestration import (
    CardioTwinWorkflows,
    WorkflowEvent,
    WorkflowEventType,
    WorkflowExecution,
    WorkflowOrchestrator,
    WorkflowStage,
    WorkflowStatus,
    get_workflow_orchestrator,
)

router = APIRouter(prefix="/workflows", tags=["cardiotwin-workflows"])


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class WorkflowDefinitionRequest(BaseModel):
    """Request to define a new workflow."""

    name: str = Field(
        ...,
        description="Human-readable name for the workflow",
        max_length=200
    )
    stages: list[str] = Field(
        ...,
        description="List of stage names (WorkflowStage values)",
        min_length=1
    )


class WorkflowDefinitionResponse(BaseModel):
    """Response with workflow definition."""

    workflow_id: str
    name: str
    stages: list[str]
    status: str
    message: str


class WorkflowStartRequest(BaseModel):
    """Request to start a workflow."""

    input_data: dict[str, Any] = Field(
        default_factory=dict,
        description="Input data for the workflow"
    )


class WorkflowStartResponse(BaseModel):
    """Response with workflow start result."""

    workflow_id: str
    execution_id: str
    status: str
    trace_id: str
    message: str


class WorkflowResponse(BaseModel):
    """Response with workflow details."""

    workflow_id: str
    name: str
    status: str
    current_stage: str | None
    current_stage_index: int
    total_stages: int
    start_time: str | None
    end_time: str | None
    error: str | None
    trace_id: str

    class Config:
        from_attributes = True


class WorkflowEventResponse(BaseModel):
    """Response with workflow event."""

    event_id: str
    event_type: str
    workflow_id: str
    stage: str | None
    data: dict[str, Any]
    timestamp: str
    provenance: str

    class Config:
        from_attributes = True


class EmitEventRequest(BaseModel):
    """Request to emit a workflow event."""

    event_type: str = Field(
        ...,
        description="Type of event (WorkflowEventType value)"
    )
    workflow_id: str = Field(
        ...,
        description="ID of the workflow"
    )
    stage: str | None = Field(
        default=None,
        description="Stage (WorkflowStage value)"
    )
    data: dict[str, Any] = Field(
        default_factory=dict,
        description="Event data"
    )


class EmitEventResponse(BaseModel):
    """Response with emitted event."""

    event_id: str
    event_type: str
    workflow_id: str
    timestamp: str
    message: str


class WorkflowListResponse(BaseModel):
    """Response with list of workflows."""

    workflows: list[WorkflowResponse]
    total: int


# =============================================================================
# ENDPOINTS
# =============================================================================


@router.post("/", response_model=WorkflowDefinitionResponse)
async def define_workflow(
    request: WorkflowDefinitionRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> WorkflowDefinitionResponse:
    """Define a new workflow.

    Creates a new workflow definition that can be started later.

    Args:
        name: Human-readable name for the workflow
        stages: List of stage names (WorkflowStage values)

    Returns:
        Workflow definition with ID
    """
    try:
        orchestrator = get_workflow_orchestrator()

        # Convert stage strings to WorkflowStage enums
        try:
            stages = [WorkflowStage(s) for s in request.stages]
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid stage name: {str(e)}"
            )

        workflow_id = orchestrator.define_workflow(
            name=request.name,
            stages=stages
        )

        return WorkflowDefinitionResponse(
            workflow_id=workflow_id,
            name=request.name,
            stages=request.stages,
            status="defined",
            message=f"Workflow {request.name} defined successfully"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to define workflow: {str(e)}"
        ) from e


@router.post("/{workflow_id}/start", response_model=WorkflowStartResponse)
async def start_workflow(
    workflow_id: str,
    request: WorkflowStartRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> WorkflowStartResponse:
    """Start a workflow execution.

    Starts an existing workflow with the provided input data.

    Args:
        workflow_id: ID of the workflow to start
        input_data: Input data for the workflow

    Returns:
        Workflow start response with execution details
    """
    try:
        orchestrator = get_workflow_orchestrator()

        workflow = orchestrator.get_workflow(workflow_id)
        if workflow is None:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow {workflow_id} not found"
            )

        # Start the workflow asynchronously
        workflow = await orchestrator.start_workflow(
            workflow_id,
            request.input_data
        )

        return WorkflowStartResponse(
            workflow_id=workflow_id,
            execution_id=workflow.workflow_id,
            status=workflow.status.value,
            trace_id=workflow.trace_id,
            message=f"Workflow {workflow.name} started"
        )

    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start workflow: {str(e)}"
        ) from e


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: str,
    _: dict[str, Any] = Depends(get_current_user)
) -> WorkflowResponse:
    """Get workflow details.

    Retrieves details about a specific workflow execution.

    Args:
        workflow_id: ID of the workflow

    Returns:
        Workflow details
    """
    try:
        orchestrator = get_workflow_orchestrator()
        workflow = orchestrator.get_workflow(workflow_id)

        if workflow is None:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow {workflow_id} not found"
            )

        return WorkflowResponse(
            workflow_id=workflow.workflow_id,
            name=workflow.name,
            status=workflow.status.value,
            current_stage=workflow.current_stage.value if workflow.current_stage else None,
            current_stage_index=workflow.current_stage_index,
            total_stages=len(workflow.stages),
            start_time=workflow.start_time.isoformat() if workflow.start_time else None,
            end_time=workflow.end_time.isoformat() if workflow.end_time else None,
            error=workflow.error,
            trace_id=workflow.trace_id
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get workflow: {str(e)}"
        ) from e


@router.get("/", response_model=WorkflowListResponse)
async def list_workflows(
    _: dict[str, Any] = Depends(get_current_user)
) -> WorkflowListResponse:
    """List all workflows.

    Returns a list of all defined workflows.

    Returns:
        List of workflows
    """
    try:
        orchestrator = get_workflow_orchestrator()
        workflows = orchestrator.list_workflows()

        responses = []
        for w in workflows:
            responses.append(WorkflowResponse(
                workflow_id=w.workflow_id,
                name=w.name,
                status=w.status.value,
                current_stage=w.current_stage.value if w.current_stage else None,
                current_stage_index=w.current_stage_index,
                total_stages=len(w.stages),
                start_time=w.start_time.isoformat() if w.start_time else None,
                end_time=w.end_time.isoformat() if w.end_time else None,
                error=w.error,
                trace_id=w.trace_id
            ))

        return WorkflowListResponse(
            workflows=responses,
            total=len(responses)
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list workflows: {str(e)}"
        ) from e


@router.post("/{workflow_id}/cancel", response_model=WorkflowStartResponse)
async def cancel_workflow(
    workflow_id: str,
    _: dict[str, Any] = Depends(get_current_user)
) -> WorkflowStartResponse:
    """Cancel a workflow execution.

    Cancels a running or pending workflow.

    Args:
        workflow_id: ID of the workflow to cancel

    Returns:
        Response with cancellation result
    """
    try:
        orchestrator = get_workflow_orchestrator()

        workflow = orchestrator.get_workflow(workflow_id)
        if workflow is None:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow {workflow_id} not found"
            )

        await orchestrator.cancel_workflow(workflow_id)

        return WorkflowStartResponse(
            workflow_id=workflow_id,
            execution_id=workflow.workflow_id,
            status=workflow.status.value,
            trace_id=workflow.trace_id,
            message=f"Workflow {workflow.name} cancelled"
        )

    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to cancel workflow: {str(e)}"
        ) from e


@router.get("/{workflow_id}/events")
async def get_workflow_events(
    workflow_id: str,
    _: dict[str, Any] = Depends(get_current_user)
) -> list[WorkflowEventResponse]:
    """Get workflow events.

    Retrieves all events associated with a workflow.

    Args:
        workflow_id: ID of the workflow

    Returns:
        List of workflow events
    """
    try:
        orchestrator = get_workflow_orchestrator()
        workflow = orchestrator.get_workflow(workflow_id)

        if workflow is None:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow {workflow_id} not found"
            )

        events = []
        for event in workflow.events:
            events.append(WorkflowEventResponse(
                event_id=event.event_id,
                event_type=event.event_type.value,
                workflow_id=event.workflow_id,
                stage=event.stage.value if event.stage else None,
                data=event.data,
                timestamp=event.timestamp.isoformat(),
                provenance=event.provenance
            ))

        return events

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get workflow events: {str(e)}"
        ) from e


@router.post("/events", response_model=EmitEventResponse)
async def emit_event(
    request: EmitEventRequest,
    _: dict[str, Any] = Depends(get_current_user)
) -> EmitEventResponse:
    """Emit a workflow event.

    Emits a custom workflow event for processing.

    Args:
        event_type: Type of event to emit
        workflow_id: ID of the workflow
        stage: Optional stage
        data: Event data

    Returns:
        Response with emitted event details
    """
    try:
        orchestrator = get_workflow_orchestrator()

        # Convert to enum
        try:
            event_type = WorkflowEventType(request.event_type)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid event type: {str(e)}"
            )

        stage = None
        if request.stage:
            try:
                stage = WorkflowStage(request.stage)
            except ValueError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid stage: {str(e)}"
                )

        event = await orchestrator.emit_event(
            event_type=event_type,
            workflow_id=request.workflow_id,
            stage=stage,
            data=request.data
        )

        return EmitEventResponse(
            event_id=event.event_id,
            event_type=event.event_type.value,
            workflow_id=event.workflow_id,
            timestamp=event.timestamp.isoformat(),
            message="Event emitted successfully"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to emit event: {str(e)}"
        ) from e


@router.post("/cardiac-case", response_model=WorkflowStartResponse)
async def start_cardiac_case_workflow(
    _: dict[str, Any] = Depends(get_current_user)
) -> WorkflowStartResponse:
    """Start the primary cardiac case workflow.

    This is a convenience endpoint that creates and starts the standard
    cardiac case workflow with predefined stages.

    Returns:
        Response with workflow start details
    """
    try:
        orchestrator = get_workflow_orchestrator()

        # Define and start the cardiac case workflow
        workflow_id = CardioTwinWorkflows.define_cardiac_case_workflow(orchestrator)
        workflow = await orchestrator.start_workflow(workflow_id, {})

        return WorkflowStartResponse(
            workflow_id=workflow_id,
            execution_id=workflow.workflow_id,
            status=workflow.status.value,
            trace_id=workflow.trace_id,
            message="Cardiac case workflow started"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start cardiac case workflow: {str(e)}"
        ) from e


@router.get("/health")
async def health_check(
    _: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    """Health check endpoint."""
    try:
        orchestrator = get_workflow_orchestrator()
        return {
            "status": "ok",
            "service": "cardiotwin-workflow-orchestration",
            "is_running": orchestrator.is_running,
            "num_workflows": len(orchestrator.list_workflows()),
            "adapted_from": "SafetyConnect-main",
            "license": "MIT",
            "endpoints": [
                "/workflows",
                "/workflows/{workflow_id}/start",
                "/workflows/{workflow_id}",
                "/workflows",
                "/workflows/{workflow_id}/cancel",
                "/workflows/{workflow_id}/events",
                "/workflows/events",
                "/workflows/cardiac-case",
            ]
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }


__all__ = ["router"]
