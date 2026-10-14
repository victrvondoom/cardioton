"""Build the inherited projects' Vite web apps so the Intelligence Hub can embed them.

Each app is installed from its own lockfile and built with relative asset paths into
``modules/<slug>/.hub-build/``, which the backend serves at ``/api/v1/hub/apps/<slug>/``.
The projects' own type-check step is skipped: the hub embeds what the authors shipped,
and an inherited type error must not block the bundle.

Usage (from ``core/``)::

    python scripts/build_hub_apps.py              # every app
    python scripts/build_hub_apps.py cardiotwin   # selected modules
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

MODULES_ROOT = Path(__file__).resolve().parents[2] / "modules"
NPM = shutil.which("npm") or "npm"

# module slug -> (app folder relative to the module, extra vite arguments)
APPS: dict[str, tuple[str, list[str]]] = {
    "aortavision-3d": ("frontend", []),
    "arterylens": ("frontend", []),
    "cardio": ("frontend", []),
    "cardioscope": ("frontend", []),
    "cardiotwin": ("frontend", []),
    "cardiovascular-risk-viz-and-prediction": (".", ["--config", "apps/web/vite.config.ts"]),
    "cardiovision-3d": ("frontend", []),
    "case-twin": (".", []),
    "coronarytwin": ("web", []),
    "cortwin": ("web", []),
    "cv-risk-viz-prediction": ("frontend", []),
    "multimodal-ai-hackathon-project": ("frontend", []),
}


def run(command: list[str], cwd: Path) -> bool:
    print(f"  $ {' '.join(command)}", flush=True)
    return subprocess.run(command, cwd=cwd, check=False).returncode == 0


def build(slug: str) -> bool:
    folder, vite_args = APPS[slug]
    app_dir = (MODULES_ROOT / slug / folder).resolve()
    out_dir = MODULES_ROOT / slug / ".hub-build"
    if not (app_dir / "package.json").is_file():
        print(f"  no package.json in {app_dir}")
        return False
    if not (app_dir / "node_modules").is_dir():
        install = "ci" if (app_dir / "package-lock.json").is_file() else "install"
        if not run([NPM, install, "--no-audit", "--no-fund"], app_dir):
            return False
    if out_dir.exists():
        shutil.rmtree(out_dir)
    command = [NPM, "exec", "--", "vite", "build", *vite_args, "--base=./", "--outDir", str(out_dir), "--emptyOutDir"]
    return run(command, app_dir) and (out_dir / "index.html").is_file()


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the inherited Vite apps for the Intelligence Hub.")
    parser.add_argument("slugs", nargs="*", metavar="slug", help=f"modules to build (default: all of {', '.join(APPS)})")
    slugs = parser.parse_args().slugs or list(APPS)
    unknown = [s for s in slugs if s not in APPS]
    if unknown:
        parser.error(f"unknown module(s): {', '.join(unknown)}")
    results: dict[str, bool] = {}
    for slug in slugs:
        print(f"\n== {slug}", flush=True)
        results[slug] = build(slug)
    summary = {"built": [s for s, ok in results.items() if ok], "failed": [s for s, ok in results.items() if not ok]}
    print("\n" + json.dumps(summary, indent=2))
    return 0 if all(results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
