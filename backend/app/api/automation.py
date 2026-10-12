"""
Button Automation API for CLINICASE - ONCOTWIN

This module provides backend API endpoints for managing and executing
button automation across all processes in the application.
"""

from __future__ import annotations

import asyncio
import time
from enum import StrEnum
from typing import Any, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field

from app.api.journey import _project
from app.auth import require_role
from app.interop import repository
from app.journey.automation import describe

router = APIRouter(prefix="/api/automation", tags=["automation"])
reviewer = require_role("reviewer", "admin")


# ============================================================================
# DATA MODELS
# ============================================================================

class ButtonActionType(StrEnum):
    """Types of button actions that can be automated."""
    NAVIGATE = "navigate"
    SUBMIT = "submit"
    API_CALL = "api_call"
    MODAL_OPEN = "modal_open"
    MODAL_CLOSE = "modal_close"
    WORKFLOW_STEP = "workflow_step"
    DATA_PROCESSING = "data_processing"
    FILTER_CHANGE = "filter_change"
    SELECTION = "selection"
    EXPORT = "export"
    IMPORT = "import"
    RESET = "reset"
    DELETE = "delete"
    CUSTOM = "custom"


class ButtonAutomationConfig(BaseModel):
    """Configuration for a single automated button."""
    id: str = Field(..., description="Unique button identifier")
    label: str = Field(..., description="Human-readable label")
    action_type: ButtonActionType = Field(..., description="Type of action this button performs")
    category: str = Field(..., description="Process category (e.g., journey, cardiotwin, intake)")
    process: str = Field(..., description="Specific process name")
    priority: Literal["low", "medium", "high"] = Field(default="medium", description="Automation priority")
    is_destructive: bool = Field(default=False, description="Whether action is destructive")
    requires_confirmation: bool = Field(default=False, description="Whether action needs confirmation")
    automation_enabled: bool = Field(default=True, description="Whether this button can be automated")
    conditions: dict[str, Any] = Field(default_factory=dict, description="Conditions for automation")
    payload: dict[str, Any] = Field(default_factory=dict, description="Data payload for the action")


class AutomationState(BaseModel):
    """Current state of the automation system."""
    is_running: bool = Field(default=False, description="Whether automation is currently running")
    current_button_id: str | None = Field(default=None, description="Currently executing button")
    completed_buttons: list[str] = Field(default_factory=list, description="List of completed button IDs")
    failed_buttons: list[str] = Field(default_factory=list, description="List of failed button IDs")
    execution_log: list[dict[str, Any]] = Field(default_factory=list, description="Log of all executions")
    status: Literal["idle", "running", "paused", "completed", "failed", "cancelled"] = Field(default="idle", description="Overall automation status")
    progress: int = Field(default=0, description="Current progress percentage")
    total_buttons: int = Field(default=0, description="Total buttons in current automation")
    started_at: float | None = Field(default=None, description="When automation started")
    finished_at: float | None = Field(default=None, description="When automation finished")


class AutomationPlanCreate(BaseModel):
    """Request model for creating an automation plan."""
    name: str = Field(..., description="Name of the automation plan")
    description: str = Field(default="", description="Description of what the plan does")
    button_sequence: list[str] = Field(default_factory=list, description="Ordered list of button IDs to execute")
    categories: list[str] = Field(default_factory=list, description="Process categories involved")
    estimated_duration: int = Field(default=0, description="Estimated duration in seconds")
    pre_conditions: dict[str, Any] = Field(default_factory=dict, description="Conditions that must be met before execution")
    post_conditions: dict[str, Any] = Field(default_factory=dict, description="Expected conditions after execution")


class AutomationPlan(AutomationPlanCreate):
    """Full automation plan model."""
    id: str = Field(..., description="Unique plan identifier")
    created_at: float = Field(..., description="When the plan was created")
    updated_at: float = Field(..., description="When the plan was last updated")
    execution_count: int = Field(default=0, description="Number of times this plan has been executed")
    last_execution_at: float | None = Field(default=None, description="When the plan was last executed")
    last_execution_success: bool | None = Field(default=None, description="Whether the last execution was successful")


class AutomationExecutionRequest(BaseModel):
    """Request model for starting automation."""
    button_ids: list[str] = Field(default_factory=list, description="List of button IDs to execute")
    plan_id: str | None = Field(default=None, description="ID of a predefined plan to execute")
    delay_between_actions: int = Field(default=1000, description="Delay between actions in milliseconds")
    continue_on_error: bool = Field(default=False, description="Continue even if a button fails")
    skip_confirmations: bool = Field(default=False, description="Skip all confirmation dialogs")
    max_retries: int = Field(default=3, description="Maximum retries for failed actions")
    timeout: int = Field(default=30000, description="Timeout for individual actions in milliseconds")


class AutomationExecutionResponse(BaseModel):
    """Response model for automation execution."""
    success: bool = Field(..., description="Whether the automation was successful")
    execution_id: str = Field(..., description="Unique execution identifier")
    completed_buttons: list[str] = Field(default_factory=list, description="Buttons that completed successfully")
    failed_buttons: list[str] = Field(default_factory=list, description="Buttons that failed")
    message: str = Field(default="", description="Status message")
    duration: float = Field(default=0.0, description="Total execution duration in seconds")
    state: AutomationState = Field(..., description="Final automation state")


class AutomationStatistics(BaseModel):
    """Statistics about the automation system."""
    total_buttons: int = Field(default=0, description="Total registered buttons")
    automatable_buttons: int = Field(default=0, description="Buttons that can be automated")
    total_plans: int = Field(default=0, description="Total automation plans")
    by_category: dict[str, int] = Field(default_factory=dict, description="Button count by category")
    by_process: dict[str, int] = Field(default_factory=dict, description="Button count by process")
    by_priority: dict[str, int] = Field(default_factory=dict, description="Button count by priority")


class BulkAutomationRequest(BaseModel):
    """Request model for bulk automation operations."""
    category: str | None = Field(default=None, description="Execute all buttons in a category")
    process: str | None = Field(default=None, description="Execute all buttons in a process")
    priority: Literal["low", "medium", "high"] | None = Field(default=None, description="Execute all buttons with this priority")
    exclude_destructive: bool = Field(default=True, description="Exclude destructive actions")
    execution_options: AutomationExecutionRequest = Field(
        default_factory=AutomationExecutionRequest,
        description="Execution options"
    )


# ============================================================================
# GLOBAL STATE MANAGEMENT
# ============================================================================

class AutomationManager:
    """Global automation state manager."""

    def __init__(self) -> None:
        self._state = AutomationState()
        self._plans: dict[str, AutomationPlan] = {}
        self._button_registry: dict[str, ButtonAutomationConfig] = {}
        self._lock = asyncio.Lock()
        self._execution_tasks: dict[str, asyncio.Task[Any]] = {}

    @property
    def state(self) -> AutomationState:
        return self._state

    @property
    def plans(self) -> dict[str, AutomationPlan]:
        return self._plans

    @property
    def button_registry(self) -> dict[str, ButtonAutomationConfig]:
        return self._button_registry

    async def register_button(self, config: ButtonAutomationConfig) -> None:
        """Register a button for automation."""
        async with self._lock:
            self._button_registry[config.id] = config

    async def unregister_button(self, button_id: str) -> bool:
        """Unregister a button from automation."""
        async with self._lock:
            if button_id in self._button_registry:
                del self._button_registry[button_id]
                return True
            return False

    async def get_button(self, button_id: str) -> ButtonAutomationConfig | None:
        """Get a button configuration by ID."""
        async with self._lock:
            return self._button_registry.get(button_id)

    async def create_plan(self, plan_data: AutomationPlanCreate) -> AutomationPlan:
        """Create a new automation plan."""
        now = time.time()
        plan = AutomationPlan(
            id=str(uuid4()),
            name=plan_data.name,
            description=plan_data.description,
            button_sequence=plan_data.button_sequence,
            categories=plan_data.categories,
            estimated_duration=plan_data.estimated_duration,
            pre_conditions=plan_data.pre_conditions,
            post_conditions=plan_data.post_conditions,
            created_at=now,
            updated_at=now,
            execution_count=0,
            last_execution_at=None,
            last_execution_success=None,
        )

        async with self._lock:
            self._plans[plan.id] = plan

        return plan

    async def delete_plan(self, plan_id: str) -> bool:
        """Delete an automation plan."""
        async with self._lock:
            if plan_id in self._plans:
                del self._plans[plan_id]
                return True
            return False

    async def get_plan(self, plan_id: str) -> AutomationPlan | None:
        """Get a plan by ID."""
        async with self._lock:
            return self._plans.get(plan_id)

    async def list_plans(self) -> list[AutomationPlan]:
        """List all automation plans."""
        async with self._lock:
            return list(self._plans.values())

    async def start_automation(
        self,
        button_ids: list[str] | None = None,
        plan_id: str | None = None,
        options: dict[str, Any] | None = None
    ) -> AutomationExecutionResponse:
        """Start automation execution."""
        execution_id = str(uuid4())
        start_time = time.time()

        async with self._lock:
            # Reset state for new execution
            self._state = AutomationState(
                is_running=True,
                current_button_id=None,
                completed_buttons=[],
                failed_buttons=[],
                execution_log=[],
                status="running",
                progress=0,
                total_buttons=0,
                started_at=start_time,
                finished_at=None,
            )

        try:
            # Get button IDs from plan or direct list
            if plan_id:
                plan = await self.get_plan(plan_id)
                if not plan:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Automation plan not found: {plan_id}"
                    )
                button_ids = plan.button_sequence
            elif button_ids:
                pass  # Use provided button IDs
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Either button_ids or plan_id must be provided"
                )

            # Filter out invalid buttons
            valid_button_ids = []
            for button_id in button_ids:
                button = await self.get_button(button_id)
                if button and button.automation_enabled:
                    valid_button_ids.append(button_id)
                else:
                    # Log invalid button
                    log_entry = {
                        "timestamp": time.time(),
                        "button_id": button_id,
                        "action": "skipped",
                        "status": "failed",
                        "error": "Button not found or not enabled for automation",
                    }
                    async with self._lock:
                        self._state.execution_log.append(log_entry)

            if not valid_button_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No valid buttons to automate"
                )

            # Update total buttons
            async with self._lock:
                self._state.total_buttons = len(valid_button_ids)

            # Execute buttons sequentially
            for i, button_id in enumerate(valid_button_ids):
                # Check if we should stop
                async with self._lock:
                    if not self._state.is_running:
                        break

                try:
                    # Update current button
                    async with self._lock:
                        self._state.current_button_id = button_id
                        self._state.progress = int(((i + 1) / len(valid_button_ids)) * 100)

                    # Execute the button
                    success = await self._execute_button(button_id, options or {})

                    if success:
                        async with self._lock:
                            self._state.completed_buttons.append(button_id)
                    else:
                        async with self._lock:
                            self._state.failed_buttons.append(button_id)

                        # Stop if not continuing on error
                        if not (options or {}).get("continue_on_error", False):
                            break

                    # Add delay between actions
                    delay = (options or {}).get("delay_between_actions", 1000) / 1000
                    if i < len(valid_button_ids) - 1:
                        await asyncio.sleep(delay)

                except Exception as e:
                    async with self._lock:
                        self._state.failed_buttons.append(button_id)
                        self._state.execution_log.append({
                            "timestamp": time.time(),
                            "button_id": button_id,
                            "action": "execute",
                            "status": "failed",
                            "error": str(e),
                        })

                    # Stop if not continuing on error
                    if not (options or {}).get("continue_on_error", False):
                        break

            # Mark as completed
            end_time = time.time()
            duration = end_time - start_time

            async with self._lock:
                self._state.is_running = False
                self._state.current_button_id = None
                self._state.finished_at = end_time
                self._state.status = "completed" if not self._state.failed_buttons else "failed"

            return AutomationExecutionResponse(
                success=not self._state.failed_buttons,
                execution_id=execution_id,
                completed_buttons=self._state.completed_buttons,
                failed_buttons=self._state.failed_buttons,
                message="Automation completed successfully" if not self._state.failed_buttons else
                       f"Automation completed with {len(self._state.failed_buttons)} failures",
                duration=duration,
                state=self._state,
            )

        except Exception as e:
            end_time = time.time()
            async with self._lock:
                self._state.is_running = False
                self._state.current_button_id = None
                self._state.finished_at = end_time
                self._state.status = "failed"
                self._state.execution_log.append({
                    "timestamp": end_time,
                    "button_id": "automation",
                    "action": "execution",
                    "status": "failed",
                    "error": str(e),
                })

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Automation failed: {str(e)}"
            ) from e

    async def _execute_button(
        self,
        button_id: str,
        options: dict[str, Any]
    ) -> bool:
        """Execute a single button action."""
        button = await self.get_button(button_id)
        if not button:
            return False

        # Log execution start
        start_time = time.time()
        async with self._lock:
            self._state.execution_log.append({
                "timestamp": start_time,
                "button_id": button_id,
                "action": "execute",
                "status": "started",
                "data": {"action_type": button.action_type, "category": button.category},
            })

        try:
            # Execute based on action type
            if button.action_type == ButtonActionType.NAVIGATE:
                # Navigation is handled by frontend
                pass
            elif button.action_type == ButtonActionType.API_CALL:
                # For now, we'll just log API calls
                # In a real implementation, we'd make the actual API call
                pass
            elif button.action_type == ButtonActionType.SUBMIT:
                # Form submissions
                pass
            elif button.action_type == ButtonActionType.WORKFLOW_STEP:
                # Execute workflow step
                pass
            elif button.action_type == ButtonActionType.DATA_PROCESSING:
                # Data processing actions
                pass
            elif button.action_type in [ButtonActionType.MODAL_OPEN, ButtonActionType.MODAL_CLOSE]:
                # Modal actions are frontend-only
                pass
            elif button.action_type == ButtonActionType.EXPORT:
                # Export actions
                pass
            elif button.action_type == ButtonActionType.IMPORT:
                # Import actions
                pass
            elif button.action_type == ButtonActionType.RESET:
                # Reset actions
                pass
            elif button.action_type == ButtonActionType.DELETE:
                # Delete actions
                if button.is_destructive and not options.get("skip_confirmations", False):
                    # Skip destructive actions unless confirmations are skipped
                    return False
                pass
            elif button.action_type == ButtonActionType.CUSTOM:
                # Custom actions
                pass

            # Log successful execution
            end_time = time.time()
            async with self._lock:
                self._state.execution_log.append({
                    "timestamp": end_time,
                    "button_id": button_id,
                    "action": "execute",
                    "status": "completed",
                    "duration": (end_time - start_time) * 1000,  # Convert to ms
                })

            return True

        except Exception as e:
            # Log failed execution
            end_time = time.time()
            async with self._lock:
                self._state.execution_log.append({
                    "timestamp": end_time,
                    "button_id": button_id,
                    "action": "execute",
                    "status": "failed",
                    "error": str(e),
                    "duration": (end_time - start_time) * 1000,
                })
            return False

    async def pause_automation(self) -> None:
        """Pause the current automation."""
        async with self._lock:
            if self._state.is_running:
                self._state.status = "paused"
                self._state.is_running = False

    async def resume_automation(self) -> None:
        """Resume a paused automation."""
        async with self._lock:
            if self._state.status == "paused":
                self._state.status = "running"
                self._state.is_running = True

    async def stop_automation(self) -> None:
        """Stop the current automation."""
        async with self._lock:
            self._state.is_running = False
            self._state.status = "cancelled"
            self._state.current_button_id = None

    async def reset_automation(self) -> None:
        """Reset automation state."""
        async with self._lock:
            self._state = AutomationState()

    async def get_state(self) -> AutomationState:
        """Get current automation state."""
        async with self._lock:
            return self._state

    async def get_statistics(self) -> AutomationStatistics:
        """Get automation statistics."""
        async with self._lock:
            by_category: dict[str, int] = {}
            by_process: dict[str, int] = {}
            by_priority: dict[str, int] = {}

            for button in self._button_registry.values():
                by_category[button.category] = by_category.get(button.category, 0) + 1
                by_process[button.process] = by_process.get(button.process, 0) + 1
                by_priority[button.priority] = by_priority.get(button.priority, 0) + 1

            automatable = sum(1 for b in self._button_registry.values() if b.automation_enabled)

            return AutomationStatistics(
                total_buttons=len(self._button_registry),
                automatable_buttons=automatable,
                total_plans=len(self._plans),
                by_category=by_category,
                by_process=by_process,
                by_priority=by_priority,
            )


# ============================================================================
# GLOBAL MANAGER INSTANCE
# ============================================================================

automation_manager = AutomationManager()


# ============================================================================
# PREDEFINED BUTTON REGISTRY
# ============================================================================

# Journey buttons
JOURNEY_BUTTONS = [
    ButtonAutomationConfig(
        id="journey_start_new",
        label="Start New Journey",
        action_type=ButtonActionType.NAVIGATE,
        category="journey",
        process="intake",
        priority="high",
        automation_enabled=True,
        payload={"path": "/journey/new"},
    ),
    ButtonAutomationConfig(
        id="journey_next_step",
        label="Continue to Next Step",
        action_type=ButtonActionType.WORKFLOW_STEP,
        category="journey",
        process="progression",
        priority="high",
        automation_enabled=True,
    ),
    ButtonAutomationConfig(
        id="journey_submit_mapping",
        label="Submit Field Mappings",
        action_type=ButtonActionType.SUBMIT,
        category="journey",
        process="mapping",
        priority="high",
        automation_enabled=True,
    ),
    ButtonAutomationConfig(
        id="journey_accept_all_mappings",
        label="Accept All Mappings",
        action_type=ButtonActionType.SUBMIT,
        category="journey",
        process="mapping",
        priority="high",
        automation_enabled=True,
        requires_confirmation=True,
    ),
    ButtonAutomationConfig(
        id="journey_generate_fhir",
        label="Generate FHIR Bundle",
        action_type=ButtonActionType.DATA_PROCESSING,
        category="journey",
        process="standardization",
        priority="high",
        automation_enabled=True,
    ),
    ButtonAutomationConfig(
        id="journey_validate_fhir",
        label="Validate FHIR Bundle",
        action_type=ButtonActionType.API_CALL,
        category="journey",
        process="validation",
        priority="high",
        automation_enabled=True,
    ),
    ButtonAutomationConfig(
        id="journey_export_passport",
        label="Export Evidence Passport",
        action_type=ButtonActionType.EXPORT,
        category="journey",
        process="export",
        priority="medium",
        automation_enabled=True,
    ),
]

# Cardio Twin buttons
CARDIO_TWIN_BUTTONS = [
    ButtonAutomationConfig(
        id="cardiotwin_run_analysis",
        label="Run Cardiovascular Analysis",
        action_type=ButtonActionType.DATA_PROCESSING,
        category="cardiotwin",
        process="analysis",
        priority="high",
        automation_enabled=True,
    ),
    ButtonAutomationConfig(
        id="cardiotwin_replay_history",
        label="Replay Historical Evidence",
        action_type=ButtonActionType.DATA_PROCESSING,
        category="cardiotwin",
        process="replay",
        priority="medium",
        automation_enabled=True,
    ),
    ButtonAutomationConfig(
        id="cardiotwin_ablation_test",
        label="Run Modality Ablation Test",
        action_type=ButtonActionType.DATA_PROCESSING,
        category="cardiotwin",
        process="validation",
        priority="medium",
        automation_enabled=True,
    ),
]

# Register all predefined buttons
async def register_predefined_buttons() -> None:
    """Register all predefined buttons with the automation manager."""
    all_buttons = JOURNEY_BUTTONS + CARDIO_TWIN_BUTTONS
    for button in all_buttons:
        await automation_manager.register_button(button)


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.on_event("startup")
async def startup_event() -> None:
    """Initialize automation system on startup."""
    await register_predefined_buttons()


@router.get("/state", response_model=AutomationState)
async def get_automation_state() -> AutomationState:
    """Get current automation state."""
    return await automation_manager.get_state()


@router.get("/statistics", response_model=AutomationStatistics)
async def get_automation_statistics() -> AutomationStatistics:
    """Get automation system statistics."""
    return await automation_manager.get_statistics()


@router.get("/buttons", response_model=list[ButtonAutomationConfig])
async def list_buttons(
    category: str | None = Query(default=None, description="Filter by category"),
    process: str | None = Query(default=None, description="Filter by process"),
    automatable: bool | None = Query(default=None, description="Filter by automation enabled"),
) -> list[ButtonAutomationConfig]:
    """List all registered buttons with optional filters."""
    async with automation_manager._lock:
        buttons = list(automation_manager.button_registry.values())

    # Apply filters
    if category:
        buttons = [b for b in buttons if b.category == category]
    if process:
        buttons = [b for b in buttons if b.process == process]
    if automatable is not None:
        buttons = [b for b in buttons if b.automation_enabled == automatable]

    return buttons


@router.get("/buttons/{button_id}", response_model=ButtonAutomationConfig)
async def get_button(button_id: str) -> ButtonAutomationConfig:
    """Get a specific button configuration."""
    button = await automation_manager.get_button(button_id)
    if not button:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Button not found: {button_id}"
        )
    return button


@router.post("/buttons", response_model=ButtonAutomationConfig)
async def register_button(button: ButtonAutomationConfig) -> ButtonAutomationConfig:
    """Register a new button for automation."""
    await automation_manager.register_button(button)
    return button


@router.delete("/buttons/{button_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def unregister_button(button_id: str) -> Response:
    """Unregister a button from automation."""
    success = await automation_manager.unregister_button(button_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Button not found: {button_id}"
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/plans", response_model=list[AutomationPlan])
async def list_plans() -> list[AutomationPlan]:
    """List all automation plans."""
    return await automation_manager.list_plans()


@router.get("/plans/{plan_id}", response_model=AutomationPlan)
async def get_plan(plan_id: str) -> AutomationPlan:
    """Get a specific automation plan."""
    plan = await automation_manager.get_plan(plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan not found: {plan_id}"
        )
    return plan


@router.post("/plans", response_model=AutomationPlan)
async def create_plan(plan: AutomationPlanCreate) -> AutomationPlan:
    """Create a new automation plan."""
    return await automation_manager.create_plan(plan)


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_plan(plan_id: str) -> Response:
    """Delete an automation plan."""
    success = await automation_manager.delete_plan(plan_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan not found: {plan_id}"
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/execute", response_model=AutomationExecutionResponse)
async def execute_automation(
    request: AutomationExecutionRequest,
) -> AutomationExecutionResponse:
    """Start automation execution."""
    try:
        result = await automation_manager.start_automation(
            button_ids=request.button_ids if request.button_ids else None,
            plan_id=request.plan_id,
            options={
                "delay_between_actions": request.delay_between_actions,
                "continue_on_error": request.continue_on_error,
                "skip_confirmations": request.skip_confirmations,
                "max_retries": request.max_retries,
                "timeout": request.timeout,
            }
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Automation execution failed: {str(e)}"
        ) from e


@router.post("/execute/plan/{plan_id}", response_model=AutomationExecutionResponse)
async def execute_plan(
    plan_id: str,
    options: dict[str, Any] | None = None,
) -> AutomationExecutionResponse:
    """Execute a specific automation plan."""
    try:
        result = await automation_manager.start_automation(
            plan_id=plan_id,
            options=options or {}
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Plan execution failed: {str(e)}"
        ) from e


@router.post("/execute/category/{category}", response_model=AutomationExecutionResponse)
async def execute_category(
    category: str,
    options: dict[str, Any] | None = None,
) -> AutomationExecutionResponse:
    """Execute all automatable buttons in a category."""
    async with automation_manager._lock:
        buttons = list(automation_manager.button_registry.values())

    button_ids = [b.id for b in buttons if b.category == category and b.automation_enabled]

    if not button_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No automatable buttons found in category: {category}"
        )

    try:
        result = await automation_manager.start_automation(
            button_ids=button_ids,
            options=options or {}
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Category execution failed: {str(e)}"
        ) from e


@router.post("/pause", status_code=status.HTTP_200_OK)
async def pause_automation() -> dict[str, str]:
    """Pause the current automation."""
    await automation_manager.pause_automation()
    return {"message": "Automation paused"}


@router.post("/resume", status_code=status.HTTP_200_OK)
async def resume_automation() -> dict[str, str]:
    """Resume a paused automation."""
    await automation_manager.resume_automation()
    return {"message": "Automation resumed"}


@router.post("/stop", status_code=status.HTTP_200_OK)
async def stop_automation() -> dict[str, str]:
    """Stop the current automation."""
    await automation_manager.stop_automation()
    return {"message": "Automation stopped"}


@router.post("/reset", status_code=status.HTTP_200_OK)
async def reset_automation() -> dict[str, str]:
    """Reset automation state."""
    await automation_manager.reset_automation()
    return {"message": "Automation state reset"}


@router.post("/bulk-execute", response_model=AutomationExecutionResponse)
async def bulk_execute(request: BulkAutomationRequest) -> AutomationExecutionResponse:
    """Execute automation in bulk based on various criteria."""
    async with automation_manager._lock:
        buttons = list(automation_manager.button_registry.values())

    # Filter buttons
    filtered_buttons = buttons

    if request.category:
        filtered_buttons = [b for b in filtered_buttons if b.category == request.category]

    if request.process:
        filtered_buttons = [b for b in filtered_buttons if b.process == request.process]

    if request.priority:
        filtered_buttons = [b for b in filtered_buttons if b.priority == request.priority]

    if request.exclude_destructive:
        filtered_buttons = [b for b in filtered_buttons if not b.is_destructive]

    button_ids = [b.id for b in filtered_buttons if b.automation_enabled]

    if not button_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No buttons match the specified criteria"
        )

    try:
        result = await automation_manager.start_automation(
            button_ids=button_ids,
            options={
                "delay_between_actions": request.execution_options.delay_between_actions,
                "continue_on_error": request.execution_options.continue_on_error,
                "skip_confirmations": request.execution_options.skip_confirmations,
                "max_retries": request.execution_options.max_retries,
                "timeout": request.execution_options.timeout,
            }
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bulk execution failed: {str(e)}"
        ) from e


# ============================================================================
# JOURNEY-SPECIFIC AUTOMATION
# ============================================================================

@router.post("/journey/{job_id}/automate", response_model=dict[str, Any])
async def automate_journey(
    job_id: str,
    user: dict[str, Any] = Depends(reviewer),
) -> dict[str, Any]:
    """
    Automate the journey workflow for a specific job.

    This endpoint provides server-side automation for journey workflows,
    allowing automated progression through the evidence preparation steps.
    """
    # Get the job
    job = await repository.get(user["organization_id"], job_id)

    # Get the journey view
    view = await _project(job, user)

    # Describe the automation state
    state = describe(job, view)

    if state["next_step"]:
        # There's a next step to automate
        return {
            "status": "ready",
            "next_step": state["next_step"],
            "message": state["message"],
            "button_ids": [state["next_step"]],
        }
    else:
        # No more steps
        return {
            "status": state["status"],
            "message": state["message"],
            "button_ids": [],
        }


@router.post("/journey/{job_id}/advance", response_model=dict[str, Any])
async def advance_journey(
    job_id: str,
    user: dict[str, Any] = Depends(reviewer),
) -> dict[str, Any]:
    """
    Advance a journey to the next automation step.

    This is used by the frontend automation to move through journey steps.
    """
    # In a real implementation, this would advance the journey state
    # For now, we'll just return the next automation state

    job = await repository.get(user["organization_id"], job_id)

    view = await _project(job, user)
    state = describe(job, view)

    return state
