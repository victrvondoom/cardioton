"""Task contracts and models for the CardioTwin Multi-Agent Intelligence System."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class AgentRole(str, Enum):
    DISCOVERY = "Discovery Agent"
    INGESTION = "Ingestion & Normalization Agent"
    SEMANTIC_MAPPING = "Semantic Mapping Agent"
    VERIFICATION = "Evidence Verification Agent"
    TRIAL_ANALYSIS = "Clinical Trial Analysis Agent"
    EVIDENCE_GAP = "Evidence Gap Agent"
    MONITORING = "Monitoring Agent"
    RESEARCH_SYNTHESIS = "Research Synthesis Agent"
    PHYSICS_UNCERTAINTY = "CardioTwin Physics & Uncertainty Tool"
    EVIDENCE_PASSPORT = "Evidence Passport & Audit Service"
    ORCHESTRATOR = "Master Orchestrator"


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    AWAITING_HUMAN_REVIEW = "awaiting_human_review"


class AgentTaskContract(BaseModel):
    task_id: str
    agent_role: AgentRole
    task_type: str
    inputs: dict[str, Any]
    expected_output_schema: str
    allowed_tools: list[str]
    timeout_seconds: int = 30
    retry_count: int = Field(0, ge=0, description="Total retries actually scheduled across all configured sources")
    max_retries: int = Field(3, ge=0, description="Total retry budget across configured sources")
    source_retry_limit: int = Field(1, ge=0, description="Maximum retries for any one configured source")
    status: TaskStatus = TaskStatus.PENDING
    result_artifacts: dict[str, Any] = Field(default_factory=dict)
    error_message: str | None = None
    confidence_score: float | None = None
    requires_human_review: bool = False
    human_review_reason: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    source_provenance_hash: str | None = None
    authorization_context: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = None
    error: dict[str, Any] | None = None
    source_references: list[str] = Field(default_factory=list)


class AgentTraceLog(BaseModel):
    task_id: str
    agent_role: AgentRole
    step_description: str
    timestamp: str
    tool_invoked: str | None = None
    input_snapshot: dict[str, Any] | None = None
    output_snapshot: dict[str, Any] | None = None
    status: str = "info"
