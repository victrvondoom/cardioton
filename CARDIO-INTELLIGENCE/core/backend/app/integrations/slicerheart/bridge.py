"""Bridge between CardioTon and a 3D Slicer runtime running SlicerHeart.

Architecture:

    SlicerHeart / 3D Slicer runtime          (ops/slicerheart/bridge_worker.py)
                ↑ job files / ↓ result files
    bridge job directory
                ↑
    CardioTon FastAPI (this module)          POST /integrations/slicerheart/bridge/jobs
                ↑
    CardioTon React frontend / agents

SlicerHeart's computational modules import `slicer`/`vtk`/`qt`, so they cannot
run inside the FastAPI process. The bridge therefore never *pretends* to run
them: job submission validates the request, writes an explicit job
specification for the Slicer-side worker, and reports honest status. When no
runtime is configured, submissions fail with an explicit
``slicer_runtime_unavailable`` error and setup instructions — no placeholders,
no fabricated results.
"""

from __future__ import annotations

import json
import os
import time
import uuid
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

JobType = Literal[
    "valve_quantification",
    "valve_segmentation",
    "leaflet_analysis",
    "orifice_area",
    "ea_map_import",
    "annulus_contour_export",
]
OutputFormat = Literal["DICOM", "NIfTI", "NRRD", "VTK", "GLB", "JSON", "CSV"]
JobStatus = Literal["queued_for_slicer_worker", "running", "completed", "failed", "rejected"]

JOB_OUTPUTS: dict[str, list[OutputFormat]] = {
    "valve_quantification": ["JSON", "CSV"],
    "valve_segmentation": ["NRRD", "VTK"],
    "leaflet_analysis": ["VTK", "JSON"],
    "orifice_area": ["JSON"],
    "ea_map_import": ["VTK", "JSON"],
    "annulus_contour_export": ["CSV", "JSON"],
}

JOB_DESCRIPTIONS: dict[str, str] = {
    "valve_quantification": "SlicerHeart ValveQuantification: annulus, leaflet and papillary metrics from segmented valves.",
    "valve_segmentation": "SlicerHeart ValveSegmentation: volumetric valve segmentation from an image volume.",
    "leaflet_analysis": "SlicerHeart LeafletAnalysis: leaflet surface models from a segmented valve volume.",
    "orifice_area": "SlicerHeart OrificeArea: cross-sectional area of an opening in a model.",
    "ea_map_import": "SlicerHeart EAMapReader: electroanatomical map import (NavX/Carto3/Rhythmia).",
    "annulus_contour_export": "SlicerHeart ValveBatchExport: export annulus contour points for cohort shape analysis.",
}

SETUP_INSTRUCTIONS = (
    "Install 3D Slicer (https://download.slicer.org/) and the SlicerHeart extension, set the "
    "SLICER_HOME environment variable to the Slicer installation directory, and run the "
    "ops/slicerheart/bridge_worker.py script inside Slicer's python environment. The worker "
    "polls the bridge job directory and executes queued jobs with SlicerHeart."
)


class SlicerHeartJobRequest(BaseModel):
    job_type: JobType
    description: str = Field(default="", max_length=500)
    inputs: dict[str, Any] = Field(
        default_factory=dict,
        description="References to input data (e.g. uploaded volume file id, segmentation id).",
    )
    requested_outputs: list[OutputFormat] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_outputs(self) -> SlicerHeartJobRequest:
        allowed = JOB_OUTPUTS[self.job_type]
        if self.requested_outputs and any(fmt not in allowed for fmt in self.requested_outputs):
            raise ValueError(
                f"Output formats not valid for job type {self.job_type}; allowed: {allowed}"
            )
        return self

    def allowed_outputs(self) -> list[OutputFormat]:
        allowed = JOB_OUTPUTS.get(self.job_type, [])
        if not self.requested_outputs:
            return allowed
        return [fmt for fmt in self.requested_outputs if fmt in allowed]


class SlicerRuntimeStatus(BaseModel):
    configured: bool
    available: bool
    slicer_home: str | None
    bridge_dir: str
    reason: str | None = None
    setup_instructions: str | None = None


def _default_bridge_dir() -> Path:
    return Path(__file__).resolve().parents[4] / "output" / "slicer-heart-bridge" / "jobs"


def bridge_dir() -> Path:
    return Path(os.environ.get("SLICER_HEART_BRIDGE_DIR", str(_default_bridge_dir())))


def slicer_home() -> Path | None:
    home = os.environ.get("SLICER_HOME")
    return Path(home) if home else None


def detect_runtime() -> SlicerRuntimeStatus:
    """Detect a configured 3D Slicer runtime. Honest by construction."""
    home = slicer_home()
    bridge = bridge_dir()
    if home is None:
        return SlicerRuntimeStatus(
            configured=False,
            available=False,
            slicer_home=None,
            bridge_dir=str(bridge),
            reason="SLICER_HOME is not set; no 3D Slicer runtime is configured.",
            setup_instructions=SETUP_INSTRUCTIONS,
        )
    candidates = [home / "Slicer.exe", home / "Slicer", home / "Slicer.app"]
    if not any(candidate.exists() for candidate in candidates):
        return SlicerRuntimeStatus(
            configured=False,
            available=False,
            slicer_home=str(home),
            bridge_dir=str(bridge),
            reason=f"No Slicer executable found under {home}.",
            setup_instructions=SETUP_INSTRUCTIONS,
        )
    return SlicerRuntimeStatus(
        configured=True,
        available=True,
        slicer_home=str(home),
        bridge_dir=str(bridge),
    )


class BridgeUnavailableError(RuntimeError):
    """Raised when a job is requested but no Slicer runtime is configured."""

    def __init__(self, status: SlicerRuntimeStatus) -> None:
        super().__init__(status.reason or "Slicer runtime unavailable")
        self.status = status


def submit_job(request: SlicerHeartJobRequest) -> dict[str, Any]:
    """Validate and queue a SlicerHeart job for the Slicer-side worker.

    Raises ``BridgeUnavailableError`` when no runtime is configured — the API
    layer turns that into an explicit 503 response. Jobs are never executed by
    the FastAPI process.
    """
    status = detect_runtime()
    if not status.available:
        raise BridgeUnavailableError(status)

    outputs = request.allowed_outputs()
    if not outputs:
        raise ValueError(
            f"Requested output formats are not valid for job type {request.job_type}; "
            f"allowed: {JOB_OUTPUTS[request.job_type]}"
        )

    job_id = f"shj_{time.strftime('%Y%m%dT%H%M%S')}_{uuid.uuid4().hex[:8]}"
    job = {
        "job_id": job_id,
        "job_type": request.job_type,
        "description": JOB_DESCRIPTIONS[request.job_type]
        + (f" — {request.description}" if request.description else ""),
        "inputs": request.inputs,
        "requested_outputs": outputs,
        "status": "queued_for_slicer_worker",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "bridge_dir": str(bridge_dir()),
    }
    target = bridge_dir()
    target.mkdir(parents=True, exist_ok=True)
    (target / f"{job_id}.json").write_text(json.dumps(job, indent=2), encoding="utf-8")
    return job


def job_status(job_id: str) -> dict[str, Any] | None:
    """Read a job file (worker-maintained status), if present."""
    safe_id = Path(job_id).name
    path = bridge_dir() / f"{safe_id}.json"
    if not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def job_catalog() -> dict[str, Any]:
    return {
        "job_types": {
            job_type: {"description": JOB_DESCRIPTIONS[job_type], "allowed_outputs": JOB_OUTPUTS[job_type]}
            for job_type in JOB_OUTPUTS
        },
        "setup_instructions": SETUP_INSTRUCTIONS,
    }
