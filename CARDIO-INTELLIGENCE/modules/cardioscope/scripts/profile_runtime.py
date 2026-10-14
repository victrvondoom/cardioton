"""Local public-development-example timings; no holdout or model fitting."""

import gzip
import json
import statistics
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen


def run(base: str) -> dict:
    def request(path, body=None):
        started = time.perf_counter()
        data = None if body is None else json.dumps(body).encode()
        with urlopen(
            Request(base + path, data=data, headers={"Content-Type": "application/json"})
        ) as r:
            payload = r.read()
        return json.loads(payload), round((time.perf_counter() - started) * 1000, 3)

    started = time.perf_counter()
    with urlopen(base + "/") as r:
        r.read()
    html_ms = (time.perf_counter() - started) * 1000
    manifest, manifest_ms = request("/api/anatomy")
    started = time.perf_counter()
    for mesh in manifest["meshes"].values():
        with urlopen(base + "/anatomy/meshes/" + Path(mesh["path"]).name) as r:
            r.read()
    mesh_ms = (time.perf_counter() - started) * 1000
    examples, _ = request("/api/examples")
    features = examples["examples"][0]["features"]
    samples = [request("/api/predict", {"features": features}) for _ in range(10)]
    p = samples[0][0]
    explanations = {}
    for target in ("CAD", "LAD", "LCX", "RCA"):
        body = dict(
            features=features,
            target=target,
            probability=p["outputs"][target]["probability"],
            profile_fingerprint=p["profile_fingerprint"],
            model_version=p["model_version"],
            schema_fingerprint=p["schema_fingerprint"],
            model_sha256=p["outputs"][target]["model_sha256"],
        )
        first, first_ms = request("/api/explain", body)
        _, warm_ms = request("/api/explain", body)
        explanations[target] = {
            "first_ms": first_ms,
            "warm_ms": warm_ms,
            "residual": first["reconstruction_residual"],
        }
    bundles = {
        str(f.relative_to("frontend/dist")): {
            "bytes": f.stat().st_size,
            "gzip_bytes": len(gzip.compress(f.read_bytes())),
        }
        for f in Path("frontend/dist").rglob("*")
        if f.is_file()
    }
    return dict(
        html_ms=html_ms,
        manifest_ms=manifest_ms,
        sequential_mesh_http_ms=mesh_ms,
        prediction_median_ms=statistics.median([t for _, t in samples]),
        explanations=explanations,
        probabilities={k: v["probability"] for k, v in p["outputs"].items()},
        bundles=bundles,
        note=(
            "Loopback HTTP; sequential mesh transfer differs from browser parallel loading. "
            "First explanation includes lazy initialization only in a fresh server."
        ),
    )


if __name__ == "__main__":
    print(json.dumps(run(sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8003"), indent=2))
