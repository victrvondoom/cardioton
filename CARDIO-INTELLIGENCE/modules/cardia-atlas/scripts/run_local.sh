#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ ! -x .venv/bin/python ]]; then python3 -m venv .venv; fi
.venv/bin/python -m pip install -r requirements.txt
if [[ ! -f artifacts/cardia_models.joblib ]]; then
  .venv/bin/python scripts/cardia_atlas__scripts__prepare_data.py
  .venv/bin/python scripts/build_ui_schema.py
  .venv/bin/python scripts/cardia_atlas__scripts__train.py
fi
exec .venv/bin/python -m uvicorn app.cardia_atlas__app__main:app --host 127.0.0.1 --port 8000
