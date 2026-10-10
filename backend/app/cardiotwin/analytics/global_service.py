"""Persisted cardiovascular public evidence analytics; no invented live metrics."""
from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.cardiotwin.agents.orchestrator import MultiAgentOrchestrator
from app.cardiotwin.analytics.repository import ResearchRepository
from app.cardiotwin.connectors.adapters import public_retrieval_url
from app.cardiotwin.evidence.passport import compute_content_sha256
from app.cardiotwin.mapping.engine import EvidenceMappingEngine
from app.config import settings

COUNTING_RULE = "Deduplicate by (source_name, source_identifier). Each distinct record contributes once to each of four category transitions; do not sum transitions as unique studies."


def public_record_projection(record: dict[str, Any]) -> dict[str, Any]:
    """Redact search parameters from old stored provenance without rewriting history.

    Hashes continue to identify the original retained snapshots. The public
    projection explicitly documents any redaction rather than pretending the
    projected bytes are the original hashed record.
    """
    result = deepcopy(record)
    changed = False

    def redact(value: Any) -> None:
        nonlocal changed
        if isinstance(value, dict):
            for key, child in value.items():
                if key == "retrieval_url" and isinstance(child, str):
                    try:
                        clean = public_retrieval_url(child)
                    except ValueError:
                        clean = None
                    if clean != child:
                        value[key] = clean
                        changed = True
                else:
                    redact(child)
        elif isinstance(value, list):
            for child in value:
                redact(child)

    redact(result)
    if changed:
        result.setdefault("provenance", {})["public_projection"] = {
            "redacted_fields": ["retrieval_url query, fragment, or malformed URL"],
            "snapshot_hashes_reference": "Original retained snapshot; this public projection redacts search parameters.",
        }
    return result


def verify_research_artifact(artifact: dict[str, Any]) -> dict[str, Any]:
    """Offline, store-independent digest verification; no scientific truth claim."""
    digest = artifact.get("passport_hash")
    payload = artifact.get("payload")
    valid = False
    try:
        valid = isinstance(payload, dict) and payload.get("schema_version") == "cardiotwin-research-passport-v1" and compute_content_sha256(payload) == digest
        records = payload.get("records", []) if isinstance(payload, dict) else []
        valid = valid and isinstance(records, list)
        for record in records:
            valid = valid and compute_content_sha256(record["provenance"]["raw_snapshot"]) == record["source_version_hash"]
    except (KeyError, TypeError, ValueError):
        valid = False
    return {"passport_hash": digest, "status": "INTEGRITY_VERIFIED" if valid else "INTEGRITY_FAILURE",
            "integrity_check": "PASSED" if valid else "FAILED", "tamper_detected": not valid,
            "verified": bool(valid), "notes": "Digest and retained source snapshots checked. This does not establish scientific truth, author identity or human approval."}


class CardioGlobalService:
    def __init__(self, repository: ResearchRepository | None = None) -> None:
        self.repository = repository or ResearchRepository()
        self.mapping_engine = EvidenceMappingEngine(self.repository)
        self.orchestrator = MultiAgentOrchestrator(self.repository)

    def _records(self, **filters: Any) -> list[Any]:
        return self.mapping_engine.filter_records(self.mapping_engine.get_all_records(), **filters)

    @staticmethod
    def _mode(records: list[Any]) -> str:
        modes = {r.data_mode.value for r in records}
        return "synthetic_demo" if modes == {"synthetic_demo"} else "mixed" if "synthetic_demo" in modes else "public_scientific" if modes else "empty"

    def get_overview_metrics(self) -> dict[str, Any]:
        records = self._records()
        configured = {s.strip() for s in settings.CARDIOTWIN_GLOBAL_LIVE_SOURCES.split(",") if s.strip()}
        events = self.repository.sources()
        sources = [{"name": name, "status": events.get(key, {}).get("status", "configured_not_retrieved" if key in configured else "not_configured"),
                    "last_successful_refresh": events.get(key, {}).get("last_successful_refresh"),
                    "reason": events.get(key, {}).get("error") or "Public metadata search requires explicit configuration; no continuous monitoring."}
                   for key, name in [("clinicaltrials", "ClinicalTrials.gov"), ("europe_pmc", "Europe PMC")]]
        sources += [{"name": "FDA / regulatory / safety", "status": "not_configured", "reason": "No safety feed connected; empty alerts do not prove absence of events."}]
        if any(r.data_mode.value == "synthetic_demo" for r in records):
            sources += [{"name": "CardioTwin synthetic fixtures", "status": "labelled_offline_fixture", "last_successful_refresh": None, "reason": "Invented metadata; no external retrieval or clinical findings."}]
        return {"indexed_research_records": len(records),
                "evidence_sources_connected": sum(e.get("last_successful_refresh") is not None for e in events.values()),
                "clinical_trials_discovered": sum(r.record_type == "trial" for r in records),
                "interventions_mapped": len({r.intervention_or_device for r in records if r.intervention_or_device}),
                "indications_represented": len({r.target_indication for r in records if r.target_indication not in {"Not extracted", "Not reported"}}),
                "unresolved_mappings": sum(r.mapping_status == "proposed" for r in records),
                "awaiting_verification": sum(not r.human_verified for r in records),
                "open_safety_events": None, "agent_tasks_running": None,
                "last_updated_at": max((r.retrieved_at for r in records), default=None),
                "data_mode": self._mode(records), "source_configuration": sources,
                "metric_definitions": {"indexed_research_records": "Distinct retained source identities", "evidence_sources_connected": "Public adapters with a successful retained retrieval event", "clinical_trials_discovered": "Stored records whose record_type is trial", "interventions_mapped": "Distinct reported intervention labels; mapping may be proposed", "indications_represented": "Distinct extracted indication labels", "unresolved_mappings": "Records with proposed mapping status", "awaiting_verification": "Records without human verification", "open_safety_events": "Unavailable: no safety feed configured", "agent_tasks_running": "Unavailable in public overview; authenticated /agents reports the current owner's persisted task states"},
                "limitations": ["Scientific quality and applicability are unassessed; no arbitrary composite score.", "SQLite research store is single-host; clinical persistence is separate."]}

    def records_page(self, limit: int = 100, offset: int = 0, **filters: Any) -> dict[str, Any]:
        records = self._records(**filters)
        return {"records": [public_record_projection(r.model_dump(mode="json")) for r in records[offset:offset + limit]],
                "total": len(records), "limit": limit, "offset": offset, "data_mode": self._mode(records)}

    def get_record(self, record_id: str) -> dict[str, Any] | None:
        record = next((r for r in self._records() if r.id == record_id), None)
        if not record:
            return None
        history = self.repository.history(record_id)
        for version in history:
            version["record"] = public_record_projection(version["record"])
        for index, version in enumerate(history):
            prior = history[index - 1]["record"] if index else {}
            version["field_changes"] = {key: {"previous": prior.get(key), "current": value}
                for key, value in version["record"].items() if prior.get(key) != value}
        return {"record": public_record_projection(record.model_dump(mode="json")), "history": history}

    def get_evidence_map(self, **filters: Any) -> dict[str, Any]:
        records = self._records(**filters)
        graph = self.mapping_engine.build_sankey_graph(**filters).model_dump(mode="json")
        graph["data_mode"] = self._mode(records)
        graph["counting_rule"] = COUNTING_RULE
        return {"graph": graph, "screening_stats": self.mapping_engine.get_review_stats(records).model_dump(mode="json"),
                "records": [public_record_projection(r.model_dump(mode="json")) for r in records], "counting_rule": COUNTING_RULE}

    def ask_copilot(self, query: str, scope: str = "local-research", idempotency_key: str | None = None) -> dict[str, Any]:
        return self.orchestrator.execute_research_brief_workflow(query, scope, idempotency_key)

    def get_clinical_trials(self, query: str | None = None, phase: str | None = None, indication: str | None = None) -> list[dict[str, Any]]:
        records = [r for r in self._records(query=query) if r.record_type == "trial"]
        if phase:
            records = [r for r in records if phase.lower() in str(r.trial_metadata.get("phase", "")).lower()]
        if indication:
            records = [r for r in records if indication.lower() in r.target_indication.lower()]
        return [r.trial_metadata | public_record_projection(r.model_dump(mode="json"))
                | {"trial_design_info": r.trial_metadata.get("study_design", {})} for r in records]

    def get_pipeline_intelligence(self) -> list[dict[str, Any]]:
        groups: dict[str, list[Any]] = {}
        for record in self._records():
            if record.intervention_or_device:
                groups.setdefault(record.intervention_or_device, []).append(record)
        return [{"program": label, "indication": "; ".join(sorted({r.target_indication for r in records})),
                 "phase": "; ".join(sorted({r.trial_metadata.get("phase", "Not reported") for r in records})),
                 "sponsor": "; ".join(sorted({r.authors_or_sponsor for r in records})),
                 "modality": "; ".join(sorted({r.modality.value for r in records})), "evidence_count": len(records),
                 "evidence_ids": [r.id for r in records], "data_mode": self._mode(records),
                 "evidence_gap": "No comparative efficacy synthesis or independent validity assessment available.",
                 "last_milestone": "No source-backed commercial or regulatory milestone extracted."}
                for label, records in sorted(groups.items())]

    def get_safety_intelligence(self) -> list[dict[str, Any]]:
        return []

    def verify_passport(self, digest: str, scope: str = "local-research") -> dict[str, Any]:
        payload = self.repository.passport(digest, scope)
        if payload is None:
            return {"passport_hash": digest, "status": "NOT_FOUND", "integrity_check": "NOT_FOUND",
                    "tamper_detected": None, "verified": False, "notes": "No passport with this digest is available to this owner."}
        return verify_research_artifact({"passport_hash": digest, "payload": payload})
