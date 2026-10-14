"""Resume preparation from persisted gateway state without crossing human review gates."""

from __future__ import annotations

from typing import Any, Literal

from app.interop.core__app_interop__models import Job
from app.onehealth import passport

AutomationStep = Literal["map", "generate", "validate"]
AutomationStatus = Literal["running", "waiting_review", "ready_for_exchange", "blocked", "complete"]


def describe(job: Job, view: dict[str, Any]) -> dict[str, Any]:
    """Choose one legal preparation action; no browser-submitted action is trusted.

    The normal journey projection already applies consent, evidence-version and
    exact-bundle validation rules. Automation follows those same gates and never
    approves mappings, sends records, or retries a failed exact-bundle validation.
    """
    stages = {stage["id"]: stage for stage in view["stages"]}
    state: dict[str, Any] = {
        "job_id": job.id,
        "job_version": job.version,
        "status": "blocked",
        "next_step": None,
        "steps": [
            {
                "id": step_id,
                "label": label,
                "status": "complete" if stages[stage_id]["status"] == "complete" else
                "blocked" if stages[stage_id]["status"] in {"blocked", "failed"} else "pending",
            }
            for step_id, stage_id, label in (
                ("map", "map", "Propose source mappings"),
                ("review", "review", "Human mapping review"),
                ("generate", "standardize", "Generate FHIR package"),
                ("validate", "validate", "Validate exact package"),
            )
        ],
        "message": "Preparation is blocked. Open the journey to resolve its requirements.",
        "view": view,
    }

    def stop(status: AutomationStatus, message: str) -> dict[str, Any]:
        state.update(status=status, message=message)
        return state

    def advance(step: AutomationStep, message: str) -> dict[str, Any]:
        state.update(status="running", next_step=step, message=message)
        return state

    if view.get("consent_status") == "WITHDRAWN":
        return stop("blocked", "Consent was withdrawn. Preparation and sharing are disabled.")
    if not passport.verify(job.model_dump(mode="json"))["valid"]:
        return stop("blocked", "The evidence integrity chain failed. Review the source before continuing.")
    if stages["understand"]["status"] != "complete":
        return stop("blocked", stages["understand"]["summary"])
    # Bound evidence bypasses mapping only when the existing projection records a
    # reviewed-evidence source. Never remap a bound or previously reviewed job.
    if not job.mappings and stages["map"]["status"] != "complete":
        if job.exposure_id:
            return stop("blocked", "This source is bound to evidence. Review it in the workbench.")
        return advance("map", "Ready to discover deterministic mappings for human review.")
    if any(mapping.decision == "pending" for mapping in job.mappings):
        return stop("waiting_review", "Mapping suggestions are ready. A reviewer must accept or reject each decision.")
    if stages["review"]["status"] != "complete":
        return stop("blocked", stages["review"]["summary"])
    if stages["standardize"]["status"] == "ready":
        return advance("generate", "Ready to generate and check the package from reviewed evidence.")
    if stages["standardize"]["status"] != "complete":
        return stop("blocked", stages["standardize"]["summary"])
    if stages["validate"]["status"] == "ready":
        return advance("validate", "Ready to validate the exact package stored by the server.")
    if stages["validate"]["status"] != "complete":
        return stop("blocked", stages["validate"]["summary"])
    if stages["exchange"]["status"] == "complete":
        return stop("complete", "Preparation is complete. The separately requested exchange is already recorded.")
    return stop("ready_for_exchange", "The package is prepared and validated. Sending it remains an explicit user action.")
