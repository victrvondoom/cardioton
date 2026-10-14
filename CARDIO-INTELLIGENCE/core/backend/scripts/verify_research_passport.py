"""Offline research verifier: python scripts/verify_research_passport.py export.json."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.cardiotwin.analytics.global_service import verify_research_artifact  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Independently verify a CardioTwin research passport; no network or stored passport required")
    parser.add_argument("file", type=Path)
    args = parser.parse_args()
    try:
        data = json.loads(args.file.read_text(encoding="utf-8-sig"))
        if not isinstance(data, dict):
            raise ValueError
        result = verify_research_artifact(data)
    except (OSError, ValueError):
        result = {"verified": False, "status": "INVALID_ARTIFACT"}
    print(json.dumps(result, sort_keys=True))
    return 0 if result["verified"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
