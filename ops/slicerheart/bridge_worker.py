"""SlicerHeart bridge worker — runs INSIDE a 3D Slicer runtime (not in CardioTon).

This script is the Slicer-side half of the CardioTon <-> SlicerHeart bridge:

    CardioTon FastAPI  --writes-->  bridge job directory  <--polls--  this worker
                  <--reads--  <job_id>.json results/status  <--writes--

Usage (inside 3D Slicer's python environment, with the SlicerHeart extension
installed):

    slicer --python-script ops/slicerheart/bridge_worker.py -- --bridge-dir <dir>

Or from an already-running Slicer's Python console:

    exec(open(r"ops/slicerheart/bridge_worker.py").read(), {"bridge_dir": r"<dir>"})

The worker only executes job types backed by SlicerHeart modules that accept
scripted inputs. It writes explicit status files; it never invents outputs.
If a job's inputs are missing or a module fails, the job file is marked
``failed`` with the error message, and CardioTon surfaces that honestly.

Deployment note: this script requires a 3D Slicer installation with the
SlicerHeart extension; it is NOT executed by the CardioTon backend, CI or
tests. See docs/SLICERHEART_INTEGRATION.md for the full setup.
"""

import argparse
import json
import sys
import time
import traceback
from pathlib import Path

POLL_SECONDS = 5


def _write_job(job_path: Path, job: dict) -> None:
    job_path.write_text(json.dumps(job, indent=2), encoding="utf-8")


def _run_valve_quantification(job: dict) -> dict:
    """SlicerHeart ValveBatchExport --export_quantification_results over an .mrb study.

    Inputs (job["inputs"]):
      input_mrb: path to a SlicerHeart .mrb valve study (segmented valve volumes)
      output_directory: where export results must be written
      phases: cardiac cycle phase shortnames to export (default: MS ES)
    """
    import ValveBatchExport  # SlicerHeart ValveBatchExport module

    input_mrb = job["inputs"].get("input_mrb")
    output_directory = job["inputs"].get("output_directory")
    phases = job["inputs"].get("phases") or ["MS", "ES"]
    if not input_mrb or not output_directory:
        raise ValueError("valve_quantification requires inputs.input_mrb and inputs.output_directory")
    argv = [
        "--input_mrb", str(input_mrb),
        "--output_directory", str(output_directory),
        "--phases", *phases,
        "--export_quantification_results",
    ]
    ValveBatchExport.main(argv)
    return {
        "tool": "SlicerHeart ValveBatchExport --export_quantification_results",
        "output_directory": str(output_directory),
    }


def _run_annulus_contour_export(job: dict) -> dict:
    """SlicerHeart ValveBatchExport --export_annulus_coordinates (contour point CSV).

    The emitted AnnulusContourPoints.csv is directly consumable by CardioTon's
    POST /integrations/slicerheart/research/annulus-shape statistics endpoint.

    Inputs:
      input_mrb: path to a SlicerHeart .mrb valve study
      output_directory: where the contour CSV must be written
      phases: cardiac cycle phase shortnames to export (default: MS ES)
    """
    import ValveBatchExport  # SlicerHeart ValveBatchExport module

    input_mrb = job["inputs"].get("input_mrb")
    output_directory = job["inputs"].get("output_directory")
    phases = job["inputs"].get("phases") or ["MS", "ES"]
    if not input_mrb or not output_directory:
        raise ValueError("annulus_contour_export requires inputs.input_mrb and inputs.output_directory")
    argv = [
        "--input_mrb", str(input_mrb),
        "--output_directory", str(output_directory),
        "--phases", *phases,
        "--export_annulus_coordinates",
    ]
    ValveBatchExport.main(argv)
    return {
        "tool": "SlicerHeart ValveBatchExport --export_annulus_coordinates",
        "output_directory": str(output_directory),
        "produced_files": [
            str(Path(output_directory) / name
                for name in ("AnnulusContourPoints.csv", "QuantificationResults.csv"))
            if (Path(output_directory) / name).exists()
        ],
    }


JOB_RUNNERS = {
    "valve_quantification": _run_valve_quantification,
    "annulus_contour_export": _run_annulus_contour_export,
}


def process_once(bridge_dir: Path) -> int:
    processed = 0
    for job_path in sorted(bridge_dir.glob("shj_*.json")):
        try:
            job = json.loads(job_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if job.get("status") != "queued_for_slicer_worker":
            continue
        runner = JOB_RUNNERS.get(job["job_type"])
        job["status"] = "running"
        job["started_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        _write_job(job_path, job)
        try:
            if runner is None:
                raise NotImplementedError(
                    f"Job type {job['job_type']} is catalogued but not yet implemented in the worker; "
                    "it requires manual execution inside 3D Slicer."
                )
            job["results"] = runner(job)
            job["status"] = "completed"
        except Exception as exc:  # noqa: BLE001 - worker must record every failure
            job["status"] = "failed"
            job["error"] = f"{type(exc).__name__}: {exc}"
            job["traceback"] = traceback.format_exc()
        job["completed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        _write_job(job_path, job)
        processed += 1
    return processed


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CardioTon SlicerHeart bridge worker")
    parser.add_argument("--bridge-dir", required=True, help="Bridge job directory shared with CardioTon")
    parser.add_argument("--once", action="store_true", help="Process queued jobs once and exit")
    args = parser.parse_args(argv)
    bridge_dir = Path(args.bridge_dir)
    bridge_dir.mkdir(parents=True, exist_ok=True)
    if args.once:
        process_once(bridge_dir)
        return 0
    while True:
        process_once(bridge_dir)
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    if "--bridge-dir" in sys.argv:
        sys.exit(main())
    print(
        "This script must run inside a 3D Slicer runtime. See the module docstring "
        "and docs/SLICERHEART_INTEGRATION.md for setup instructions."
    )
