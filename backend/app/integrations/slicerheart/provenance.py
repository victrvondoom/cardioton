"""Upstream provenance for the vendored SlicerHeart snapshot.

The snapshot was added to this repository as a plain directory download of the
GitHub `master` branch (no `.git` metadata), so no commit hash is available.
Provenance therefore records the upstream repository, license, and a
deterministic content fingerprint over the upstream source inventory.
"""

from __future__ import annotations

import hashlib
from functools import lru_cache
from pathlib import Path

UPSTREAM_REPO = "https://github.com/SlicerHeart/SlicerHeart"
UPSTREAM_SNAPSHOT = "master branch snapshot (zip download; no VCS metadata included)"
UPSTREAM_AUTHORS = (
    "Matthew Jolley (CHOP/UPenn), Andras Lasso (Perk Lab, Queen's University), "
    "Christian Herz (CHOP), Csaba Pinter (Pixel Medical), Anna Ilina (Perk Lab), "
    "Steve Pieper (Isomics), Adam Rankin (Robarts)"
)
UPSTREAM_CITATION = (
    "Lasso, A., Herz, C., Nam, H., Cianciulli, A., Pieper, S., Drouin, S., Pinter, C., "
    "St-Onge, S., Vigil, C., Ching, S., Sunderland, K., Fichtinger, G., Kikinis, R., "
    "& Jolley, M. A. (2022). SlicerHeart: An open-source computing platform for cardiac "
    "image analysis and modeling. Frontiers in Cardiovascular Medicine, 9. "
    "https://doi.org/10.3389/fcvm.2022.886549"
)
UPSTREAM_LICENSE = "BSD 3-Clause License (SlicerHeart Contributors)"
ADAPTED_COMPONENTS = (
    "annulus_shape: cohort annulus-shape statistics ported from "
    "ValveBatchExport/HeartValveBatchAnalysis/annulus_shape_analysis.py "
    "(pure numpy/csv core; rigid Procrustes alignment re-implemented with numpy Kabsch "
    "instead of vtkProcrustesAlignmentFilter; Slicer scene/model outputs omitted).",
    "valve_metrics: metric vocabulary adapted from ValveQuantificationLib measurement "
    "presets and ValveAnnulusAnalysis/HeartValveLib/Constants.py (probe position presets).",
)
INTEGRATION_NOTICE = (
    "SlicerHeart components are integrated as attributed adaptations and runtime bridges. "
    "Upstream files are never modified. Computed imaging metrics require a 3D Slicer "
    "runtime (see bridge status); CardioTon never fabricates them."
)


def vendor_root() -> Path:
    """Absolute path of the vendored SlicerHeart snapshot."""
    return Path(__file__).resolve().parents[4] / "SlicerHeart-master"


def license_path() -> Path:
    return vendor_root() / "LICENSE"


def readme_path() -> Path:
    return vendor_root() / "README.md"


@lru_cache(maxsize=1)
def _fingerprint_files() -> tuple[tuple[str, str], ...]:
    """Deterministic (relative path, sha256) inventory of upstream source files.

    Covers the files whose content defines behaviour and licensing (Python,
    CMake, docs, license). Binary assets are intentionally excluded from the
    per-file hash list but counted, keeping the fingerprint cheap to compute
    while still pinning the source snapshot.
    """
    root = vendor_root()
    hashed: list[tuple[str, str]] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        if path.suffix.lower() in {".py", ".txt", ".md", ".cmake", ".json", ".html", ".xml"}:
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            hashed.append((rel, digest))
    return tuple(hashed)


@lru_cache(maxsize=1)
def snapshot_fingerprint() -> str:
    """Stable sha256 over the upstream source inventory."""
    accumulator = hashlib.sha256()
    for rel, digest in _fingerprint_files():
        accumulator.update(rel.encode())
        accumulator.update(digest.encode())
    return accumulator.hexdigest()


def provenance_summary() -> dict:
    root = vendor_root()
    files = _fingerprint_files()
    return {
        "upstream_repository": UPSTREAM_REPO,
        "snapshot": UPSTREAM_SNAPSHOT,
        "authors": UPSTREAM_AUTHORS,
        "citation": UPSTREAM_CITATION,
        "license": UPSTREAM_LICENSE,
        "license_file": "SlicerHeart-master/LICENSE",
        "vendor_root": "SlicerHeart-master/",
        "snapshot_source_fingerprint": snapshot_fingerprint(),
        "hashed_source_files": len(files),
        "adapted_components": list(ADAPTED_COMPONENTS),
        "notice": INTEGRATION_NOTICE,
        "vendor_present": root.is_dir(),
    }
