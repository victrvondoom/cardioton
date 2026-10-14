# Finished v1 installation and distribution

Use **Python 3.12.14 exactly**, uv 0.12.1, Node 22.13+ in the 22.x line or Node 24+, npm and make. The frozen provenance rejects other Python patch versions. Tests on macOS use Python 3.12.14 / Node 25.3.0 / npm 11.7.0. Install uv using [its official instructions](https://docs.astral.sh/uv/getting-started/installation/) and Node from [nodejs.org](https://nodejs.org/).

From a fresh checkout:

```sh
make install prepare verify build
make run
```

Open `http://127.0.0.1:8000`. `make setup` adds all tests/lint/build to installation. `make run PORT=8004` selects an alternative loopback port. The server serves the production frontend/API together. For Vite development run `make dev` and `cd frontend && npm run dev` in separate terminals (the proxy expects backend port 8000).

### Exact Python on Ubuntu

uv 0.12.1's embedded downloads offer Linux Python 3.12.13, which the frozen application correctly rejects. Use the container below, an already installed trusted Python 3.12.14, or build the exact [official CPython source release](https://www.python.org/downloads/release/python-31214/):

```sh
sudo apt-get update
sudo apt-get install -y build-essential curl xz-utils libssl-dev zlib1g-dev libbz2-dev liblzma-dev libffi-dev libsqlite3-dev libreadline-dev
sh scripts/install_python_linux.sh "$PWD/.runtime/python"
export UV_PYTHON="$PWD/.runtime/python/bin/python3.12"
make setup
make run
```

The script checks the official tarball SHA-256 before compiling, fails on missing required standard-library modules, and uses two build jobs. It does not change dependency locks or weaken provenance checks. Keep `UV_PYTHON` set for later `make install` commands with this interpreter. The same script is used in Ubuntu Docker and CI; no macOS binaries or package caches are copied into Linux.

`make install` syncs the original **unchanged** uv.lock, then installs the original hash-locked SHAP add-on without resolving/replacing core dependencies. `make runtime-check` verifies all 53 expected core/add-on package versions. Subsequent Make commands use `.venv/bin/python` directly; `uv run`/`uv sync` can prune the supplemental SHAP installation. Do not use `uv sync --extra explanations`. After manually running `uv sync`, rerun `make install`.

`make prepare` and `make verify` check the included immutable v1 sources/meshes, split and byte manifest. They do not create/rebuild the split or overwrite caches. If a protected asset is missing/corrupt, restore its exact bytes from public tag `v1.0.0` (the historical verifier message names the archival tag); the command names it and fails. The historical `ml.data prepare`/`ml.anatomy prepare` remain available for an explicitly separate initial acquisition, not the finished-app or CI workflow. The pinned upstream LATEST archive can change; a future public clone uses committed verified files and does not depend on its continued availability.

## Container

```sh
docker build -t cardioscope:v1 .
docker run --rm --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges \
  -p 127.0.0.1:8000:8000 cardioscope:v1
```

This Ubuntu container includes the identical frozen sources/models/configuration. The build installs packages, verifies immutable bytes, runs tests/lint/build and reconstructs all four explanations using the public development example. It never fits real models or evaluates the real holdout. The runtime runs as uid 10001, accepts no persistent profile volume, and can use a read-only filesystem with `/tmp` for library caches. A host browser renders WebGL; the backend needs no GPU. An image healthcheck verifies frozen-model availability. The image cannot create alternative evaluation evidence.

Base image tags identify versioned toolchain components, but registry tags/apt repositories are not content-addressed full OS locks. Python/scientific/npm resolutions are locked; rebuilding can receive OS security updates. Record tested image digests in the hardening report. No image is published by this phase.

## Artifact availability and privacy

The Git snapshot includes all four joblib models, source/schema/split/search manifests, saved aggregate evidence plus existing receipts/pairs, explanation configuration/background, mapping tables/license and all 83 meshes. Existing saved pair evidence remains preserved for reproducibility, but the API exposes aggregate results only; clinical POST bodies/results are not written to disk or sent to analytics. The public development example is explicitly labeled. Models must be loaded only from this trusted, checksum-verified repository, because joblib/pickle is executable serialization.

The prepared raw source/subset were originally ignored; they are now intentionally tracked. Largest single file in the full public snapshot is ~21.4 MB (development-only V2 results), well below GitHub's ordinary file limit; no separate artifact hosting or Git LFS is required for this subset. Do not ship `.venv`, `node_modules`, `dist`, caches, `.env` or editor files. Intentional public-example verification screenshots are retained; no personal patient screenshot is included. See [third-party notices](../THIRD_PARTY_NOTICES.md) for licensing/public-export caveats.
