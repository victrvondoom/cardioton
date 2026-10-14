.PHONY: prerequisites install runtime-check prepare verify test lint build run serve dev setup
.NOTPARALLEL:
PYTHON := .venv/bin/python
PORT ?= 8000
UV_PYTHON ?= 3.12.14
export UV_PYTHON

prerequisites:
	@command -v uv >/dev/null || { echo 'Install uv: https://docs.astral.sh/uv/getting-started/installation/'; exit 1; }
	@command -v node >/dev/null && command -v npm >/dev/null || { echo 'Install Node 22.13+ (22.x) or Node 24+ with npm.'; exit 1; }
	@node -e 'const [v,m]=process.versions.node.split(".").map(Number); if (!(v>=24 || (v===22 && m>=13))) { console.error("Use Node 22.13+ (22.x) or Node 24+."); process.exit(1); }'

install: prerequisites
	uv sync --locked
	uv pip install --python $(PYTHON) --no-deps --require-hashes -r config/explanations-runtime.lock.txt
	$(PYTHON) scripts/check_runtime.py
	cd frontend && npm ci

runtime-check:
	@test -x $(PYTHON) || { echo 'Missing .venv. Run make install first.'; exit 1; }
	$(PYTHON) scripts/check_runtime.py

# Finished v1 ships verified sources. These targets never regenerate a split/cache.
prepare: verify

verify: runtime-check
	$(PYTHON) scripts/verify_immutable.py
	$(PYTHON) -m ml.data verify
	$(PYTHON) -m ml.anatomy verify

test: runtime-check
	$(PYTHON) -m pytest -q
	cd frontend && npm test

lint: runtime-check
	$(PYTHON) -m ruff check backend ml tests scripts
	$(PYTHON) -m ruff format --check backend ml tests scripts
	cd frontend && npm run typecheck

build:
	@test -d frontend/node_modules || { echo 'Missing frontend dependencies. Run make install first.'; exit 1; }
	cd frontend && npm run build

run: verify
	@test -f frontend/dist/index.html || { echo 'Missing production frontend. Run make build first.'; exit 1; }
	$(PYTHON) -m uvicorn backend.app:app --host 127.0.0.1 --port $(PORT) --no-access-log

serve: run

dev: verify
	$(PYTHON) -m uvicorn backend.app:app --host 127.0.0.1 --port $(PORT) --reload --no-access-log

setup: install prepare test lint build
