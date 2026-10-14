"""Verify frozen bytes without fitting, decoding targets or running holdout inference."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def verify(root: Path = ROOT) -> dict:
    manifest = root / "docs/product/IMMUTABLE_INPUTS.json"
    records = json.loads(manifest.read_text())
    bad = [
        p
        for p, sha in records.items()
        if not (root / p).is_file() or hashlib.sha256((root / p).read_bytes()).hexdigest() != sha
    ]
    if bad:
        raise SystemExit(
            "Frozen inputs missing or changed: "
            + ", ".join(bad)
            + ". Restore them from cardioscope-v1.0.0; do not regenerate models/splits."
        )
    return {
        "protected_files": len(records),
        "byte_identical": True,
        "manifest_sha256": hashlib.sha256(manifest.read_bytes()).hexdigest(),
    }


if __name__ == "__main__":
    print(json.dumps(verify(), indent=2))
