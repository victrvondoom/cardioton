"""Model loading service: loads the four saved pipelines once at startup.

- Never retrains on API calls.
- If artifacts are missing, reports service unavailability instead of
  inventing predictions.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import joblib

MODELS_DIR = Path(os.environ.get(
    "CARDIOVISION_MODELS_DIR",
    Path(__file__).resolve().parents[3] / "backend" / "models",
))
TARGETS = ["cad", "lad", "lcx", "rca"]


class ModelRegistry:
    def __init__(self) -> None:
        self.pipes: dict[str, Any] = {}
        self.manifest: dict[str, Any] = {}
        self.thresholds: dict[str, float] = {}
        self.metrics: dict[str, Any] = {}
        self.feature_schema: list[dict[str, Any]] = []
        self.loaded = False
        self.error: str | None = None

    def load(self) -> None:
        try:
            if not MODELS_DIR.exists():
                raise FileNotFoundError(f"models dir not found: {MODELS_DIR}")
            for t in TARGETS:
                path = MODELS_DIR / f"{t}.joblib"
                if not path.exists():
                    raise FileNotFoundError(f"missing artifact: {path}")
                self.pipes[t] = joblib.load(path)
            self.manifest = json.loads((MODELS_DIR / "manifest.json").read_text())
            self.thresholds = json.loads((MODELS_DIR / "thresholds.json").read_text())
            self.metrics = json.loads((MODELS_DIR / "metrics.json").read_text())
            self.feature_schema = json.loads((MODELS_DIR / "feature_schema.json").read_text())
            self.loaded = True
        except Exception as exc:  # explicit artifact absence handling
            self.error = str(exc)
            self.loaded = False

    def get(self, target: str):
        if not self.loaded:
            raise RuntimeError("models not loaded")
        return self.pipes[target]


REGISTRY = ModelRegistry()
