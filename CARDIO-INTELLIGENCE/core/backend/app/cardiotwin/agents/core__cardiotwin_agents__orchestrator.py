"""One bounded deterministic research orchestrator over persisted public evidence.

External text is stored as data, never interpreted as instructions or executable
code. These are logical tools, not independently autonomous LLM agents.
"""
from __future__ import annotations

import time
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.cardiotwin.agents.core__cardiotwin_agents__contracts import (
    AgentRole,
    AgentTaskContract,
    TaskStatus,
)
from app.cardiotwin.analytics.core__cardiotwin_analytics__repository import ResearchRepository
from app.cardiotwin.connectors.adapters import (
    ClinicalTrialsConnector,
    PubMedConnector,
    SourceRetrievalError,
)
from app.cardiotwin.cross5 import core__cardiotwin_cross5__agent_tools as cross5_agent_tools
from app.cardiotwin.evidence.core__cardiotwin_evidence__passport import compute_content_sha256
from app.cardiotwin.mapping.core__cardiotwin_mapping__engine import EvidenceMappingEngine
from app.core__backend_app__config import settings
from app.integrations.slicerheart import (
    core__integrations_slicerheart__agent_tools as slicerheart_agent_tools,
)


def now() -> str:
    return datetime.now(UTC).isoformat()


def evidence_gaps(records: list[Any]) -> list[dict[str, Any]]:
    """Priority is a transparent category order, not a scientific quality score."""
    gaps = []
    if not records:
        return [{"category": "insufficient_evidence", "priority": 1,
                 "description": "No matching records in the configured corpus.",
                 "next_action": "Refine the question or configure authoritative discovery sources."}]
    for record in records:
        if not record.human_verified:
            gaps.append({"record_id": record.id, "category": "unreviewed_mapping", "priority": 1,
                         "description": "Category relationships have not been independently reviewed.",
                         "next_action": "Inspect the source and mapping rationale with a research reviewer."})
        if record.record_type == "trial" and not record.trial_metadata.get("reported_results"):
            gaps.append({"record_id": record.id, "category": "unavailable_outcomes", "priority": 2,
                         "description": "No reported trial results were retrieved.",
                         "next_action": "Check the original registry and linked results publications."})
        if record.sample_size is None:
            gaps.append({"record_id": record.id, "category": "missing_metadata", "priority": 3,
                         "description": "Sample size was not extracted or reported.",
                         "next_action": "Inspect the study methods; record the population and sample size if available."})
    return sorted(gaps, key=lambda gap: (gap["priority"], gap.get("record_id", "")))


class ResearchExecutionError(RuntimeError):
    def __init__(self, task_id: str, code: str) -> None:
        self.task_id, self.code = task_id, code
        super().__init__(code)


class MultiAgentOrchestrator:
    def __init__(self, repository: ResearchRepository | None = None) -> None:
        self.repository = repository or ResearchRepository()
        self.mapping_engine = EvidenceMappingEngine(self.repository)

    def get_agent_registry(self, scope: str = "local-research") -> list[dict[str, Any]]:
        tasks = self.repository.tasks(scope)
        roles = [AgentRole.DISCOVERY, AgentRole.INGESTION, AgentRole.SEMANTIC_MAPPING,
                 AgentRole.VERIFICATION, AgentRole.EVIDENCE_GAP, AgentRole.RESEARCH_SYNTHESIS,
                 AgentRole.EVIDENCE_PASSPORT, AgentRole.ORCHESTRATOR]
        registry = []
        for role in roles:
            active_tasks = sum(t["status"] == "running" and t["agent_role"] == role.value for t in tasks)
            registry.append({"role": role.value, "status": "running" if active_tasks else "idle",
                             "active_tasks": active_tasks})
        # SlicerHeart integration: deterministic imaging/anatomy reference tools,
        # always idle (lookups, not background agents). Agents can explain
        # SlicerHeart terminology and bridge status, never invent measurements.
        registry.append(slicerheart_agent_tools.registry_entry())
        # CROSS-5: deterministic five-frame reference guide. Agents can explain
        # frames, declared intersections and experiments — never invent data.
        registry.append(cross5_agent_tools.registry_entry())
        return registry

    def get_tasks(self, scope: str = "local-research") -> list[dict[str, Any]]:
        return self.repository.tasks(scope)

    def get_trace_logs(self, limit: int = 100, scope: str = "local-research") -> list[dict[str, Any]]:
        return self.repository.traces(scope, limit=limit)

    def execute_research_brief_workflow(self, query: str, scope: str = "local-research",
                                        idempotency_key: str | None = None) -> dict[str, Any]:
        query = query.strip()
        if not query or len(query) > 2000:
            raise ValueError("Research query must contain 1 to 2000 characters")
        configured = {s.strip() for s in settings.CARDIOTWIN_GLOBAL_LIVE_SOURCES.split(",") if s.strip()}
        source_retry_limit = 1
        task = AgentTaskContract(
            task_id=f"research-{uuid4().hex}", agent_role=AgentRole.ORCHESTRATOR,
            task_type="source_grounded_research_brief", inputs={"query": query},
            expected_output_schema="cardiotwin-research-brief-v1",
            allowed_tools=["public_source_search", "normalize_and_ingest", "map_categories", "verify_snapshot", "inspect_metadata_gaps", "build_passport"],
            timeout_seconds=45, retry_count=0, max_retries=len(configured) * source_retry_limit,
            source_retry_limit=source_retry_limit, requires_human_review=True,
            human_review_reason="Metadata and lexical mappings do not establish scientific validity or clinical advice.",
        ).model_dump(mode="json")
        task["authorization_context"] = {"scope": scope, "clinical_access": False}
        task["idempotency_policy"] = "Same owner and key with identical validated inputs reuses the stored task. Changed inputs conflict."
        task["retry_policy"] = "Each configured source may retry once; max_retries is the sum of those per-source retry limits."
        task, created = self.repository.reserve_task(task, scope, idempotency_key)
        if not created:
            stored_response = task["result_artifacts"].get("response")
            if isinstance(stored_response, dict):
                return stored_response
            raise ResearchExecutionError(task["task_id"], "task_in_progress_or_failed")
        started = time.monotonic()
        task.update(status=TaskStatus.RUNNING.value, started_at=now())
        self.repository.save_task(task, scope)

        def trace(role: AgentRole, step: str, tool: str, output: dict[str, Any] | None = None,
                  status: str = "completed") -> None:
            self.repository.trace({"task_id": task["task_id"], "agent_role": role.value,
                "step_description": step, "tool_invoked": tool, "timestamp": now(),
                "output_snapshot": output, "status": status}, scope)

        def check_deadline() -> None:
            if time.monotonic() - started >= task["timeout_seconds"]:
                raise TimeoutError

        try:
            if configured - {"clinicaltrials", "europe_pmc"}:
                raise SourceRetrievalError("configuration", "unsupported_source")
            for source in sorted(configured):
                for attempt in range(task["source_retry_limit"] + 1):
                    check_deadline()
                    try:
                        if source == "clinicaltrials":
                            retrieved = ClinicalTrialsConnector(live=True).search_trials(query, limit=10)
                        else:
                            retrieved = PubMedConnector(live=True).search_publications(query, limit=10)
                        check_deadline()
                        summary = self.repository.ingest(retrieved)
                        check_deadline()
                        self.repository.source_event(source, {"status": "available", "last_successful_refresh": now(), "error": None})
                        trace(AgentRole.DISCOVERY, f"Retrieved public metadata from {source}", "public_source_search", {"source": source, "count": len(retrieved)})
                        trace(AgentRole.INGESTION, "Validated and ingested stable source identities", "normalize_and_ingest", summary)
                        break
                    except SourceRetrievalError as exc:
                        self.repository.source_event(source, {"status": "unavailable", "error": exc.code, "last_attempt": now()})
                        trace(AgentRole.DISCOVERY, "Source retrieval failed", "public_source_search", {"source": source, "error": exc.code, "attempt": attempt + 1}, "failed")
                        if attempt == task["source_retry_limit"] or task["retry_count"] >= task["max_retries"]:
                            raise
                        task["retry_count"] += 1
                        self.repository.save_task(task, scope)
            if not configured:
                trace(AgentRole.DISCOVERY, "Searched labelled offline corpus; no external retrieval claimed", "public_source_search")
            check_deadline()
            records = self.mapping_engine.filter_records(self.mapping_engine.get_all_records(), query=query)
            trace(AgentRole.SEMANTIC_MAPPING, "Selected normalized category proposals", "map_categories", {"record_ids": [r.id for r in records]})
            for record in records:
                check_deadline()
                if compute_content_sha256(record.provenance["raw_snapshot"]) != record.source_version_hash:
                    raise ValueError("source_snapshot_integrity_failed")
            trace(AgentRole.VERIFICATION, "Recomputed retained raw source snapshot digests; metadata only", "verify_snapshot", {"count": len(records), "scientific_validity": "unassessed"})
            check_deadline()
            gaps = evidence_gaps(records)
            trace(AgentRole.EVIDENCE_GAP, "Ranked missing information by review, outcomes, then metadata", "inspect_metadata_gaps", {"count": len(gaps)})
            modes = {r.data_mode.value for r in records}
            mode = "synthetic_demo" if modes == {"synthetic_demo"} else "mixed" if "synthetic_demo" in modes else "public_scientific" if modes else "empty"
            summary_text = f"Found {len(records)} matching records in the {mode.replace('_', ' ')} corpus. "
            summary_text += "The brief reports stored source metadata; no efficacy, causal effect, or clinical recommendation is inferred. "
            summary_text += " | ".join(f"{r.source_identifier}: {r.title}" for r in records)
            limitations = ["Source metadata is not an independent risk-of-bias assessment.",
                           "Category proposals require human review; shared categories imply no causal relationship.",
                           "Gap priority is categorical: unreviewed mapping (1), absent trial results (2), missing sample size (3).",
                           "No clinical sign-off or digital author signature is supplied."]
            check_deadline()
            snapshots = [r.model_dump(mode="json") for r in records]
            check_deadline()
            passport_payload = {"schema_version": "cardiotwin-research-passport-v1", "query": query,
                "task_id": task["task_id"], "generated_at": now(), "records": snapshots,
                "mapping_version": "category-flow-v2", "parser_version": "public-source-metadata-v2",
                "human_review": "pending", "data_mode": mode,
                "outputs": {"brief": summary_text, "gaps": gaps, "limitations": limitations}}
            check_deadline()
            digest = self.repository.save_passport(passport_payload, scope)
            response = {"query": query, "summary_response": summary_text,
                "factual_claims": [f"{r.source_identifier}: reported study design '{r.study_design}', sample size {r.sample_size if r.sample_size is not None else 'not reported'}." for r in records],
                "model_interpretations": [], "evidence_citations": [{"title": r.title,
                    "source_id": r.source_identifier, "url": r.source_url, "grade": r.validation_grade.value} for r in records],
                "passport_hash": digest, "verified": False, "timestamp": passport_payload["generated_at"],
                "task_id": task["task_id"], "evidence_records": snapshots, "identified_gaps": gaps,
                "data_mode": mode, "limitations": limitations}
            trace(AgentRole.EVIDENCE_PASSPORT, "Persisted reproducible unsigned research passport", "build_passport", {"passport_hash": digest})
            task.update(status=TaskStatus.AWAITING_HUMAN_REVIEW.value, completed_at=now(),
                        result_artifacts={"response": response, "passport_hash": digest},
                        source_references=[r.source_identifier for r in records])
            self.repository.save_task(task, scope)
            return response
        except Exception as exc:
            code = exc.code if isinstance(exc, SourceRetrievalError) else "timeout" if isinstance(exc, TimeoutError) else "research_execution_failed"
            task.update(status=TaskStatus.FAILED.value, completed_at=now(), error_message=code,
                        error={"code": code, "recoverable": True})
            self.repository.save_task(task, scope)
            trace(AgentRole.ORCHESTRATOR, "Research workflow failed; retained trace available", "orchestrate", {"code": code}, "failed")
            raise ResearchExecutionError(task["task_id"], code) from exc
