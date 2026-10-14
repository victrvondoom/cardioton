"""SlicerHeart integration: provenance, catalog, adapted statistics, bridge honesty, API contract."""

from __future__ import annotations

import pydantic
import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.integrations.slicerheart import annulus_shape, bridge, catalog, provenance, valve_metrics
from app.main import app

BASE = "/api/v1/integrations/slicerheart"


def _user(role: str = "coordinator") -> dict:
    return {
        "id": f"user_{role}",
        "email": f"{role}@clincase.health",
        "full_name": role,
        "organization_id": "org_slicerheart_test",
        "role": role,
    }


@pytest.fixture()
def client():
    app.dependency_overrides[get_current_user] = lambda: _user()
    yield TestClient(app)
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture()
def anon():
    app.dependency_overrides.pop(get_current_user, None)
    client = TestClient(app)
    yield client
    app.dependency_overrides.pop(get_current_user, None)


# --- provenance ---------------------------------------------------------------


def test_vendor_snapshot_is_present_and_pinned():
    summary = provenance.provenance_summary()
    assert summary["vendor_present"] is True
    assert summary["license"] == "BSD 3-Clause License (SlicerHeart Contributors)"
    assert summary["upstream_repository"].startswith("https://github.com/SlicerHeart")
    assert provenance.license_path().is_file()
    assert provenance.readme_path().is_file()
    fingerprint = provenance.snapshot_fingerprint()
    assert len(fingerprint) == 64
    assert provenance.snapshot_fingerprint() == fingerprint  # deterministic
    assert summary["hashed_source_files"] > 50


# --- catalog ------------------------------------------------------------------


def test_catalog_classifies_all_upstream_module_groups():
    matrix = catalog.integration_matrix()
    module_rows = " ".join(entry["module"] for entry in matrix)
    upstream_root = provenance.vendor_root()
    upstream_dirs = {
        entry.name for entry in upstream_root.iterdir() if entry.is_dir() and not entry.name.startswith(".")
    }
    missing = sorted(
        name
        for name in upstream_dirs - {"Docs", "SuperBuild"}
        if name not in module_rows and f"{name}/" not in module_rows
    )
    assert not missing, f"Unclassified upstream modules: {missing}"
    assert len(matrix) >= 20
    summary = catalog.catalog_summary()
    assert summary["modules_classified"] == len(matrix)
    assert "adapt" in summary["by_classification"]
    assert summary["wired_into_cardioton"]


def test_catalog_classifications_are_valid():
    valid = {"reuse_directly", "adapt", "bridge", "convert", "reference_only", "exclude"}
    for entry in catalog.integration_matrix():
        assert entry["classification"] in valid
        assert entry["runtime"] in {"fastapi_python", "slicer_runtime", "static_assets", "slicer_cpp_build"}
        assert entry["status"] in {"wired", "available_via_bridge", "documented_only", "not_integrated"}
        assert entry["cardiotwin_touchpoints"] is not None
        assert entry["notes"]


# --- valve metric vocabulary ----------------------------------------------------


def test_valve_metric_vocabulary_is_reference_only():
    data = valve_metrics.metric_catalog()
    assert set(data["metrics_by_valve"]) <= set(valve_metrics.VALVE_TYPES)
    assert "mitral" in data["metrics_by_valve"]
    assert len(data["all_metric_ids"]) >= 6
    for metric_id in data["all_metric_ids"]:
        metric = valve_metrics.explain_metric(metric_id)
        assert metric is not None
        assert metric["unit"]
        assert metric["definition"]
    assert "does not produce these values" in data["notice"]
    assert valve_metrics.explain_metric("not_a_metric") is None


def test_probe_position_presets_match_upstream_ids():
    ids = {preset["id"] for preset in valve_metrics.PROBE_POSITIONS}
    assert "TTE_APICAL" in ids
    assert "PATIENT_ANATOMICAL_AXES" in ids


# --- adapted annulus shape statistics ------------------------------------------


def _contour_rows(cases: int = 3, phase: str = "ED", valve: str = "mitral", seed: int = 1) -> list[dict]:
    """Synthetic annulus contour export rows in the SlicerHeart ValveBatchExport format."""
    import math

    rows: list[dict] = []
    for case in range(cases):
        scale = 1.0 + 0.15 * case
        offset_x = 2.0 * case
        for i in range(40):
            angle = 2 * math.pi * i / 40
            x = offset_x + scale * (10.0 + 2.0 * math.cos(angle)) * math.cos(angle)
            y = scale * 10.0 * math.sin(angle)
            z = scale * 1.5 * math.sin(2 * angle)
            label = ""
            if i == 0:
                label = "S"
            elif i == 10:
                label = "A"
            elif i == 20:
                label = "L"
            elif i == 30:
                label = "P"
            rows.append(
                {
                    "Filename": f"case_{case}.mrb",
                    "Phase": phase,
                    "Valve": valve,
                    "AnnulusContourX": f"{x:.4f}",
                    "AnnulusContourY": f"{y:.4f}",
                    "AnnulusContourZ": f"{z:.4f}",
                    "AnnulusContourLabel": label,
                }
            )
    return rows


def test_annulus_shape_cohort_mean():
    rows = _contour_rows()
    result = annulus_shape.analyze_cohort(rows, ["S", "A", "L", "P"], number_of_points_per_segment=20)
    assert result["valve_type"] == "mitral"
    assert len(result["phases"]) == 1
    phase = result["phases"][0]
    assert phase["cases"] == 3
    assert not result["skipped_cases"]
    points = phase["mean_contour_points"]
    assert len(points) == 4 * 20
    assert all(len(p) == 3 for p in points)
    # Landmarks survive at segment boundaries.
    assert [landmark["label"] for landmark in phase["landmark_positions"]] == ["S", "A", "L", "P"]
    # Mean contour is closed-ish: first and last points are both near the S landmark ring.
    import math

    def dist(a, b):
        return math.dist(a, b)

    assert dist(points[0], points[-1]) < 6.0


def test_annulus_shape_size_normalization_produces_scale_factors():
    rows = _contour_rows()
    result = annulus_shape.analyze_cohort(
        rows, ["S", "A", "L", "P"], number_of_points_per_segment=10, normalize_size=True
    )
    assert result["size_normalized"] is True
    assert result["scale_factors"] is not None
    factors = list(result["scale_factors"].values())
    assert all(f > 0 for f in factors)
    # Factors are relative to the cohort mean size: the smallest contour is
    # scaled up (factor > 1) and the largest is scaled down (factor < 1).
    assert factors[0] > 1.0 > factors[-1]


def test_annulus_shape_skips_invalid_cases_like_upstream():
    rows = _contour_rows(cases=3)
    # Corrupt case 2: drop the labels so ordering must fail and the case is skipped.
    for row in rows:
        if row["Filename"] == "case_2.mrb":
            row["AnnulusContourLabel"] = ""
    result = annulus_shape.analyze_cohort(rows, ["S", "A", "L", "P"], number_of_points_per_segment=10)
    assert result["phases"][0]["cases"] == 2
    assert result["skipped_cases"] == ["case_2.mrb"]


def test_annulus_shape_rejects_bad_input():
    rows = _contour_rows()
    with pytest.raises(annulus_shape.ContourDataError):
        annulus_shape.analyze_cohort(rows, ["S", "A", "L", "P", "A"])  # duplicates
    with pytest.raises(annulus_shape.ContourDataError):
        annulus_shape.analyze_cohort(rows, ["S", "A"])  # too few labels
    with pytest.raises(annulus_shape.ContourDataError):
        annulus_shape.analyze_cohort([], ["S", "A", "L", "P"])  # no rows


# --- bridge honesty -------------------------------------------------------------


def test_bridge_reports_unavailable_without_runtime(monkeypatch):
    monkeypatch.delenv("SLICER_HOME", raising=False)
    status = bridge.detect_runtime()
    assert status.configured is False
    assert status.available is False
    assert status.reason
    assert status.setup_instructions
    request = bridge.SlicerHeartJobRequest(job_type="valve_quantification")
    with pytest.raises(bridge.BridgeUnavailableError):
        bridge.submit_job(request)


def test_bridge_job_spec_validation(monkeypatch):
    monkeypatch.delenv("SLICER_HOME", raising=False)
    # Invalid output formats are rejected at the spec level, independent of runtime wiring.
    with pytest.raises(pydantic.ValidationError):
        bridge.SlicerHeartJobRequest(job_type="orifice_area", requested_outputs=["DICOM"])
    # Valid specs construct fine and default to the allowed output set.
    request = bridge.SlicerHeartJobRequest(job_type="valve_segmentation")
    assert request.allowed_outputs() == ["NRRD", "VTK"]


def test_bridge_submits_job_when_runtime_configured(tmp_path, monkeypatch):
    slicer_home = tmp_path / "Slicer"
    slicer_home.mkdir()
    (slicer_home / "Slicer.exe").write_bytes(b"")  # sentinel executable
    monkeypatch.setenv("SLICER_HOME", str(slicer_home))
    monkeypatch.setenv("SLICER_HEART_BRIDGE_DIR", str(tmp_path / "jobs"))
    job = bridge.submit_job(
        bridge.SlicerHeartJobRequest(job_type="valve_quantification", requested_outputs=["JSON"])
    )
    assert job["status"] == "queued_for_slicer_worker"
    assert job["requested_outputs"] == ["JSON"]
    job_path = tmp_path / "jobs" / f"{job['job_id']}.json"
    assert job_path.is_file()
    status = bridge.job_status(job["job_id"])
    assert status is not None and status["job_id"] == job["job_id"]
    assert bridge.job_status("does_not_exist") is None
    assert bridge.job_status("../escape") is None


# --- API contract ----------------------------------------------------------------


def test_api_requires_auth(anon):
    res = anon.get(f"{BASE}/overview")
    assert res.status_code in (401, 403)


def test_api_overview_and_catalog(client):
    res = client.get(f"{BASE}/overview")
    assert res.status_code == 200
    body = res.json()
    assert body["vendor_present"] is True
    assert body["bridge"]["available"] is False
    res = client.get(f"{BASE}/catalog")
    assert res.status_code == 200
    assert res.json()["summary"]["modules_classified"] >= 20
    for entry in res.json()["matrix"]:
        assert entry["classification"]


def test_api_valve_metrics(client):
    res = client.get(f"{BASE}/valve-metrics")
    assert res.status_code == 200
    ids = res.json()["all_metric_ids"]
    res = client.get(f"{BASE}/valve-metrics/{ids[0]}")
    assert res.status_code == 200
    assert res.json()["notice"]
    res = client.get(f"{BASE}/valve-metrics/not_a_metric")
    assert res.status_code == 404


def test_api_annulus_shape_happy_path(client):
    rows = _contour_rows()
    lines = [",".join(rows[0].keys())]
    lines += [",".join(row.values()) for row in rows]
    res = client.post(
        f"{BASE}/research/annulus-shape",
        json={"csv_text": "\n".join(lines), "label_order": ["S", "A", "L", "P"], "points_per_segment": 10},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert "no clinical interpretation" in body["notice"]
    assert body["result"]["phases"][0]["cases"] == 3
    assert body["provenance"]["adapted_from"].endswith("annulus_shape_analysis.py")


def test_api_annulus_shape_rejects_missing_columns(client):
    res = client.post(
        f"{BASE}/research/annulus-shape",
        json={"csv_text": "a,b\n1,2\n", "label_order": ["S", "A", "L", "P"]},
    )
    assert res.status_code == 422
    assert "missing required columns" in res.json()["detail"].lower()


def test_api_bridge_status_and_job_rejection(client, monkeypatch):
    monkeypatch.delenv("SLICER_HOME", raising=False)
    res = client.get(f"{BASE}/bridge/status")
    assert res.status_code == 200
    body = res.json()
    assert body["available"] is False
    assert body["setup_instructions"]
    res = client.post(f"{BASE}/bridge/jobs", json={"job_type": "valve_quantification"})
    assert res.status_code == 503
    detail = res.json()["detail"]
    assert detail["reason"] == "slicer_runtime_unavailable"
    assert detail["setup_instructions"]
