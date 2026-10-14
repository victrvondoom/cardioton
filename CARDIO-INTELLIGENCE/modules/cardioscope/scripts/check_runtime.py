"""Fail clearly on incomplete installation without importing or changing models."""

import importlib.metadata
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def check() -> None:
    if sys.version_info[:3] != (3, 12, 14):
        raise SystemExit(
            "Frozen CardioScope requires Python 3.12.14 exactly. "
            "See docs/REPRODUCIBILITY.md for the Linux source/container installation."
        )
    expected = json.loads((ROOT / "docs/explanations/RUNTIME_VERIFICATION.json").read_text())[
        "current_versions"
    ]
    expected.update(shap="0.52.0", numba="0.68.0", llvmlite="0.50.0", slicer="0.0.8", tqdm="4.70.1")
    mismatches = []
    for name, version in expected.items():
        try:
            actual = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            actual = "missing"
        if actual != version:
            mismatches.append(f"{name}: expected {version}, found {actual}")
    if mismatches:
        raise SystemExit(
            "Pinned runtime incomplete: "
            + "; ".join(mismatches)
            + ". Run make install. Do not use uv sync --extra explanations."
        )
    print(f"Python {sys.version.split()[0]}: {len(expected)} pinned package versions verified.")


if __name__ == "__main__":
    check()
