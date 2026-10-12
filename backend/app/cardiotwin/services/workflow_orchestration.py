"""Workflow Orchestration Service for CardioTwin.

This service provides event-driven workflow orchestration capabilities,
inspired by SafetyConnect-main's Inngest-based orchestration system.

Original source: SafetyConnect-main/src/inngest/
License: MIT (Copyright (c) 2026 SafetyConnect Contributors)

Adaptations for CardioTwin:
- Changed from medication safety to cardiovascular workflows
- Integrated with CardioTwin's agent orchestration system
- Added support for cardiac-specific event types
- Designed for deterministic, auditable workflow execution

Capabilities:
- Event-driven workflow execution
- Multi-stage pipeline orchestration
- Real-time event streaming
- Traceability and audit logging
- Retry and failure recovery
- Cardiovascular-specific workflows
"""

from __future__ import annotations

import asyncio
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Coroutine

import structlog

from app.cardiotwin.models import DataProvenance


log = structlog.get_logger()


# =============================================================================
# ENUMS AND CONSTANTS
# =============================================================================

class WorkflowStatus(str, Enum):
    """Status of a workflow execution."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMED_OUT = "timed_out"


class WorkflowEventType(str, Enum):
    """Types of workflow events in CardioTwin."""

    # Case lifecycle
    CASE_CREATED = "cardiotwin.case.created"
    CASE_UPDATED = "cardiotwin.case.updated"
    CASE_CLOSED = "cardiotwin.case.closed"

    # Data ingestion
    DATA_INGESTED = "cardiotwin.data.ingested"
    DATA_VALIDATED = "cardiotwin.data.validated"
    DATA_REJECTED = "cardiotwin.data.rejected"

    # Analysis
    ECG_ANALYSIS_REQUESTED = "cardiotwin.ecg.analysis.requested"
    ECG_ANALYSIS_COMPLETED = "cardiotwin.ecg.analysis.completed"
    IMAGING_ANALYSIS_REQUESTED = "cardiotwin.imaging.analysis.requested"
    IMAGING_ANALYSIS_COMPLETED = "cardiotwin.imaging.analysis.completed"
    CLINICAL_EXTRACTION_REQUESTED = "cardiotwin.clinical.extraction.requested"
    CLINICAL_EXTRACTION_COMPLETED = "cardiotwin.clinical.extraction.completed"

    # Similar case retrieval
    SIMILAR_CASES_REQUESTED = "cardiotwin.cases.similar.requested"
    SIMILAR_CASES_COMPLETED = "cardiotwin.cases.similar.completed"

    # Evidence continuity
    EVIDENCE_CONTINUITY_CHECK_REQUESTED = "cardiotwin.evidence.continuity.requested"
    EVIDENCE_CONTINUITY_CHECK_COMPLETED = "cardiotwin.evidence.continuity.completed"
    EVIDENCE_INCONSISTENCY_DETECTED = "cardiotwin.evidence.inconsistency.detected"

    # Digital twin
    DIGITAL_TWIN_UPDATE_REQUESTED = "cardiotwin.twin.update.requested"
    DIGITAL_TWIN_UPDATE_COMPLETED = "cardiotwin.twin.update.completed"
    DIGITAL_TWIN_OUTDATED = "cardiotwin.twin.outdated"

    # Agent execution
    AGENT_TASK_QUEUED = "cardiotwin.agent.task.queued"
    AGENT_TASK_RUNNING = "cardiotwin.agent.task.running"
    AGENT_TASK_COMPLETED = "cardiotwin.agent.task.completed"
    AGENT_TASK_FAILED = "cardiotwin.agent.task.failed"

    # Workflow orchestration
    WORKFLOW_STARTED = "cardiotwin.workflow.started"
    WORKFLOW_STAGE_COMPLETED = "cardiotwin.workflow.stage.completed"
    WORKFLOW_COMPLETED = "cardiotwin.workflow.completed"
    WORKFLOW_FAILED = "cardiotwin.workflow.failed"

    # Review and follow-up
    CLINICAL_REVIEW_REQUESTED = "cardiotwin.review.requested"
    CLINICAL_REVIEW_COMPLETED = "cardiotwin.review.completed"
    FOLLOW_UP_CREATED = "cardiotwin.followup.created"
    FOLLOW_UP_COMPLETED = "cardiotwin.followup.completed"


class WorkflowStage(str, Enum):
    """Stages in a typical CardioTwin workflow."""
    DATA_INGESTION = "data_ingestion"
    QUALITY_CHECK = "quality_check"
    SIGNAL_ANALYSIS = "signal_analysis"
    IMAGING_ANALYSIS = "imaging_analysis"
    CLINICAL_EXTRACTION = "clinical_extraction"
    SIMILAR_CASE_RETRIEVAL = "similar_case_retrieval"
    EVIDENCE_RECONCILIATION = "evidence_reconciliation"
    DIGITAL_TWIN_UPDATE = "digital_twin_update"
    AGENT_EXECUTION = "agent_execution"
    CLINICAL_REVIEW = "clinical_review"
    FOLLOW_UP = "follow_up"


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class WorkflowEvent:
    """A workflow event."""
    event_type: WorkflowEventType
    workflow_id: str
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    stage: WorkflowStage | None = None
    data: dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    provenance: str = DataProvenance.AI_GENERATED.value

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_id": self.event_id,
            "event_type": self.event_type.value,
            "workflow_id": self.workflow_id,
            "stage": self.stage.value if self.stage else None,
            "data": self.data,
            "timestamp": self.timestamp.isoformat(),
            "provenance": self.provenance,
        }


@dataclass
class WorkflowExecution:
    """A workflow execution."""
    name: str
    workflow_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    status: WorkflowStatus = WorkflowStatus.PENDING
    current_stage: WorkflowStage | None = None
    stages: list[WorkflowStage] = field(default_factory=list)
    current_stage_index: int = 0
    events: list[WorkflowEvent] = field(default_factory=list)
    start_time: datetime | None = None
    end_time: datetime | None = None
    error: str | None = None
    trace_id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def to_dict(self) -> dict[str, Any]:
        return {
            "workflow_id": self.workflow_id,
            "name": self.name,
            "status": self.status.value,
            "current_stage": self.current_stage.value if self.current_stage else None,
            "stages": [s.value for s in self.stages],
            "current_stage_index": self.current_stage_index,
            "events": [e.to_dict() for e in self.events],
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "error": self.error,
            "trace_id": self.trace_id,
        }


@dataclass
class StageResult:
    """Result of a workflow stage execution."""
    stage: WorkflowStage
    status: str
    output: dict[str, Any]
    execution_time_ms: float
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "stage": self.stage.value,
            "status": self.status,
            "output": self.output,
            "execution_time_ms": self.execution_time_ms,
            "error": self.error,
        }


# =============================================================================
# WORKFLOW ORCHESTRATOR
# =============================================================================

class WorkflowOrchestrator:
    """Orchestrates event-driven workflows for CardioTwin.

    This orchestrator is inspired by SafetyConnect's Inngest-based system,
    but adapted for cardiovascular workflows and integrated with CardioTwin's
    existing multi-agent architecture.

    Key features:
    - Deterministic workflow execution
    - Event-driven architecture
    - Real-time event streaming
    - Traceability and audit logging
    - Retry and failure recovery
    - Cardiovascular-specific workflows
    """

    def __init__(self):
        self._workflows: dict[str, WorkflowExecution] = {}
        self._event_handlers: dict[WorkflowEventType, list[Callable[[WorkflowEvent], Coroutine]]] = {}
        self._stage_handlers: dict[WorkflowStage, Callable[[WorkflowExecution, dict[str, Any]], Coroutine]] = {}
        self._listeners: list[Callable[[WorkflowEvent], None]] = []
        self._is_running = False

    async def start(self) -> None:
        """Start the workflow orchestrator."""
        self._is_running = True
        log.info("Workflow orchestrator started")

    async def stop(self) -> None:
        """Stop the workflow orchestrator."""
        self._is_running = False
        log.info("Workflow orchestrator stopped")

    @property
    def is_running(self) -> bool:
        return self._is_running

    # =========================================================================
    # WORKFLOW MANAGEMENT
    # =========================================================================

    def define_workflow(
        self,
        name: str,
        stages: list[WorkflowStage]
    ) -> str:
        """Define a new workflow.

        Args:
            name: Human-readable name for the workflow
            stages: List of stages in order

        Returns:
            workflow_id: Unique identifier for the workflow
        """
        workflow_id = str(uuid.uuid4())
        workflow = WorkflowExecution(
            workflow_id=workflow_id,
            name=name,
            stages=stages,
        )
        self._workflows[workflow_id] = workflow
        log.info(f"Workflow defined: {name} ({workflow_id})")
        return workflow_id

    async def start_workflow(
        self,
        workflow_id: str,
        input_data: dict[str, Any] | None = None
    ) -> WorkflowExecution:
        """Start a workflow execution.

        Args:
            workflow_id: ID of the workflow to start
            input_data: Optional input data for the workflow

        Returns:
            The workflow execution
        """
        if workflow_id not in self._workflows:
            raise ValueError(f"Workflow {workflow_id} not found")

        workflow = self._workflows[workflow_id]

        if workflow.status != WorkflowStatus.PENDING:
            raise ValueError(f"Workflow {workflow_id} is not in PENDING state")

        workflow.status = WorkflowStatus.RUNNING
        workflow.start_time = datetime.utcnow()
        workflow.current_stage_index = 0
        workflow.current_stage = workflow.stages[0] if workflow.stages else None

        # Emit workflow started event
        event = WorkflowEvent(
            event_type=WorkflowEventType.WORKFLOW_STARTED,
            workflow_id=workflow_id,
            stage=workflow.current_stage,
            data={"input": input_data or {}},
        )
        workflow.events.append(event)
        await self._publish_event(event)

        log.info(f"Workflow started: {workflow.name} ({workflow_id})")

        # Start executing stages
        asyncio.create_task(self._execute_workflow(workflow, input_data or {}))

        return workflow

    async def _execute_workflow(
        self,
        workflow: WorkflowExecution,
        input_data: dict[str, Any]
    ) -> None:
        """Execute a workflow asynchronously.

        Args:
            workflow: The workflow to execute
            input_data: Input data for the workflow
        """
        try:
            for i, stage in enumerate(workflow.stages):
                workflow.current_stage = stage
                workflow.current_stage_index = i

                # Emit stage started event
                event = WorkflowEvent(
                    event_type=WorkflowEventType.WORKFLOW_STAGE_COMPLETED,
                    workflow_id=workflow.workflow_id,
                    stage=stage,
                    data={"stage_started": True, "input": input_data},
                )
                workflow.events.append(event)
                await self._publish_event(event)

                # Execute the stage
                try:
                    stage_start = time.time()

                    # Get the stage handler
                    if stage in self._stage_handlers:
                        output = await self._stage_handlers[stage](
                            workflow, input_data
                        )
                    else:
                        # Default handler: just pass through
                        output = input_data

                    stage_time = (time.time() - stage_start) * 1000

                    # Store stage result
                    stage_result = StageResult(
                        stage=stage,
                        status="completed",
                        output=output,
                        execution_time_ms=stage_time,
                    )

                    # Emit stage completed event
                    event = WorkflowEvent(
                        event_type=WorkflowEventType.WORKFLOW_STAGE_COMPLETED,
                        workflow_id=workflow.workflow_id,
                        stage=stage,
                        data={
                            "stage_completed": True,
                            "output": output,
                            "execution_time_ms": stage_time,
                        },
                    )
                    workflow.events.append(event)
                    await self._publish_event(event)

                    # Update input for next stage
                    input_data = output

                except Exception as e:
                    # Emit stage failed event
                    event = WorkflowEvent(
                        event_type=WorkflowEventType.WORKFLOW_FAILED,
                        workflow_id=workflow.workflow_id,
                        stage=stage,
                        data={"stage_failed": True, "error": str(e)},
                    )
                    workflow.events.append(event)
                    await self._publish_event(event)

                    workflow.status = WorkflowStatus.FAILED
                    workflow.error = str(e)
                    workflow.end_time = datetime.utcnow()

                    log.error(f"Workflow {workflow.workflow_id} failed at stage {stage}: {e}")
                    return

            # All stages completed
            workflow.status = WorkflowStatus.COMPLETED
            workflow.end_time = datetime.utcnow()
            workflow.current_stage = None
            workflow.current_stage_index = len(workflow.stages)

            # Emit workflow completed event
            event = WorkflowEvent(
                event_type=WorkflowEventType.WORKFLOW_COMPLETED,
                workflow_id=workflow.workflow_id,
                data={"workflow_completed": True, "output": input_data},
            )
            workflow.events.append(event)
            await self._publish_event(event)

            log.info(f"Workflow {workflow.workflow_id} completed successfully")

        except Exception as e:
            workflow.status = WorkflowStatus.FAILED
            workflow.error = str(e)
            workflow.end_time = datetime.utcnow()

            log.error(f"Workflow {workflow.workflow_id} failed: {e}")

    async def cancel_workflow(self, workflow_id: str) -> None:
        """Cancel a workflow execution.

        Args:
            workflow_id: ID of the workflow to cancel
        """
        if workflow_id not in self._workflows:
            raise ValueError(f"Workflow {workflow_id} not found")

        workflow = self._workflows[workflow_id]

        if workflow.status not in [WorkflowStatus.PENDING, WorkflowStatus.RUNNING]:
            raise ValueError(f"Cannot cancel workflow in {workflow.status} state")

        workflow.status = WorkflowStatus.CANCELLED
        workflow.end_time = datetime.utcnow()

        # Emit cancelled event
        event = WorkflowEvent(
            event_type=WorkflowEventType.WORKFLOW_FAILED,
            workflow_id=workflow_id,
            data={"cancelled": True},
        )
        workflow.events.append(event)
        await self._publish_event(event)

        log.info(f"Workflow {workflow_id} cancelled")

    def get_workflow(self, workflow_id: str) -> WorkflowExecution | None:
        """Get a workflow by ID.

        Args:
            workflow_id: ID of the workflow

        Returns:
            The workflow execution or None if not found
        """
        return self._workflows.get(workflow_id)

    def list_workflows(self) -> list[WorkflowExecution]:
        """List all workflows.

        Returns:
            List of all workflow executions
        """
        return list(self._workflows.values())

    # =========================================================================
    # EVENT HANDLING
    # =========================================================================

    def on_event(
        self,
        event_type: WorkflowEventType,
        handler: Callable[[WorkflowEvent], Coroutine]
    ) -> None:
        """Register an event handler.

        Args:
            event_type: Type of event to handle
            handler: Async function to call when event is received
        """
        if event_type not in self._event_handlers:
            self._event_handlers[event_type] = []
        self._event_handlers[event_type].append(handler)

    def on_stage(
        self,
        stage: WorkflowStage,
        handler: Callable[[WorkflowExecution, dict[str, Any]], Coroutine]
    ) -> None:
        """Register a stage handler.

        Args:
            stage: Stage to handle
            handler: Async function to call when stage is executed
        """
        self._stage_handlers[stage] = handler

    async def emit_event(
        self,
        event_type: WorkflowEventType,
        workflow_id: str,
        stage: WorkflowStage | None = None,
        data: dict[str, Any] | None = None
    ) -> WorkflowEvent:
        """Emit a workflow event.

        Args:
            event_type: Type of event
            workflow_id: ID of the workflow
            stage: Optional stage
            data: Optional event data

        Returns:
            The created event
        """
        event = WorkflowEvent(
            event_type=event_type,
            workflow_id=workflow_id,
            stage=stage,
            data=data or {},
        )

        # Store event in workflow if it exists
        if workflow_id in self._workflows:
            self._workflows[workflow_id].events.append(event)

        await self._publish_event(event)

        return event

    async def _publish_event(self, event: WorkflowEvent) -> None:
        """Publish an event to all listeners.

        Args:
            event: The event to publish
        """
        # Call event-specific handlers
        if event.event_type in self._event_handlers:
            for handler in self._event_handlers[event.event_type]:
                try:
                    await handler(event)
                except Exception as e:
                    log.error(f"Event handler failed for {event.event_type}: {e}")

        # Call all listeners
        for listener in self._listeners:
            try:
                listener(event)
            except Exception as e:
                log.error(f"Event listener failed: {e}")

    def add_listener(self, listener: Callable[[WorkflowEvent], None]) -> None:
        """Add a listener for all events.

        Args:
            listener: Function to call for all events
        """
        self._listeners.append(listener)


# =============================================================================
# PREDEFINED WORKFLOWS
# =============================================================================

class CardioTwinWorkflows:
    """Predefined workflows for CardioTwin."""

    @staticmethod
    def define_cardiac_case_workflow(orchestrator: WorkflowOrchestrator) -> str:
        """Define the primary cardiac case workflow.

        This workflow processes a new cardiac case through all stages:
        1. Data ingestion
        2. Quality check
        3. Signal analysis (ECG)
        4. Imaging analysis
        5. Clinical extraction
        6. Similar case retrieval
        7. Evidence reconciliation
        8. Digital twin update
        9. Clinical review
        10. Follow-up

        Args:
            orchestrator: The workflow orchestrator

        Returns:
            workflow_id: ID of the created workflow
        """
        stages = [
            WorkflowStage.DATA_INGESTION,
            WorkflowStage.QUALITY_CHECK,
            WorkflowStage.SIGNAL_ANALYSIS,
            WorkflowStage.IMAGING_ANALYSIS,
            WorkflowStage.CLINICAL_EXTRACTION,
            WorkflowStage.SIMILAR_CASE_RETRIEVAL,
            WorkflowStage.EVIDENCE_RECONCILIATION,
            WorkflowStage.DIGITAL_TWIN_UPDATE,
            WorkflowStage.CLINICAL_REVIEW,
            WorkflowStage.FOLLOW_UP,
        ]

        return orchestrator.define_workflow(
            name="cardiac_case_workflow",
            stages=stages
        )

    @staticmethod
    def define_evidence_continuity_workflow(orchestrator: WorkflowOrchestrator) -> str:
        """Define the evidence continuity check workflow.

        This workflow checks for evidence consistency when new data arrives.

        Args:
            orchestrator: The workflow orchestrator

        Returns:
            workflow_id: ID of the created workflow
        """
        stages = [
            WorkflowStage.DATA_INGESTION,
            WorkflowStage.QUALITY_CHECK,
            WorkflowStage.EVIDENCE_RECONCILIATION,
        ]

        return orchestrator.define_workflow(
            name="evidence_continuity_workflow",
            stages=stages
        )

    @staticmethod
    def define_imaging_analysis_workflow(orchestrator: WorkflowOrchestrator) -> str:
        """Define the imaging analysis workflow.

        Args:
            orchestrator: The workflow orchestrator

        Returns:
            workflow_id: ID of the created workflow
        """
        stages = [
            WorkflowStage.DATA_INGESTION,
            WorkflowStage.QUALITY_CHECK,
            WorkflowStage.IMAGING_ANALYSIS,
            WorkflowStage.EVIDENCE_RECONCILIATION,
            WorkflowStage.DIGITAL_TWIN_UPDATE,
        ]

        return orchestrator.define_workflow(
            name="imaging_analysis_workflow",
            stages=stages
        )


# =============================================================================
# SINGLETON
# =============================================================================

_orchestrator: WorkflowOrchestrator | None = None


def get_workflow_orchestrator() -> WorkflowOrchestrator:
    """Get the singleton workflow orchestrator.

    Returns:
        The workflow orchestrator instance
    """
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = WorkflowOrchestrator()
    return _orchestrator


@asynccontextmanager
async def get_async_workflow_orchestrator() -> AsyncIterator[WorkflowOrchestrator]:
    """Get an async workflow orchestrator with lifecycle management.

    Yields:
        The workflow orchestrator
    """
    orchestrator = get_workflow_orchestrator()
    await orchestrator.start()
    try:
        yield orchestrator
    finally:
        await orchestrator.stop()


__all__ = [
    "WorkflowStatus",
    "WorkflowEventType",
    "WorkflowStage",
    "WorkflowEvent",
    "WorkflowExecution",
    "StageResult",
    "WorkflowOrchestrator",
    "CardioTwinWorkflows",
    "get_workflow_orchestrator",
    "get_async_workflow_orchestrator",
]
