"""CROSS-5: frames, evidence typing, intersections, microphysics, chronos, city, experiments, API."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.cardiotwin.cross5 import (
    agent_tools,
    chronos,
    city,
    earth,
    experiments,
    frames,
    intersections,
    microphysics,
)
from app.cardiotwin.cross5.evidence import (
    ConsentClass,
    EvidenceRecord,
    EvidenceStatus,
    TemporalRef,
)
from app.main import app

BASE = "/api/v1/cross5"


def _user(role: str = "coordinator") -> dict:
    return {
        "id": f"user_{role}",
        "email": f"{role}@clincase.health",
        "full_name": role,
        "organization_id": "org_cross5_test",
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


# --- frames ---------------------------------------------------------------------


def test_frame_registry_lists_five_frames():
    registry = frames.frame_registry()
    ids = [f["id"] for f in registry["frames"]]
    assert ids == ["cardiotwin", "cardioearth", "cardioflow", "cardiochronos", "cardiocity"]
    for frame in registry["frames"]:
        assert frame["scale"] and frame["coordinate_reference"] and frame["claims_policy"]


# --- evidence typing --------------------------------------------------------------


def _record(**over) -> EvidenceRecord:
    base: dict = {
        "observation_id": "obs-1",
        "frame": "cardiochronos",
        "observation_type": "heart_rate",
        "subject": "synthetic-patient-A",
        "population_level": False,
        "status": EvidenceStatus.OBSERVED,
        "quantity": "heart_rate",
        "value": 72.0,
        "unit": "bpm",
        "temporal": TemporalRef(
            start=datetime(2026, 3, 2, tzinfo=UTC), end=datetime(2026, 3, 3, tzinfo=UTC), resolution="hourly"
        ),
        "provenance": "synthetic wearable generator",
        "consent": ConsentClass.SYNTHETIC,
    }
    base.update(over)
    return EvidenceRecord(**base)


def test_evidence_record_requires_full_typing():
    record = _record()
    assert record.status is EvidenceStatus.OBSERVED
    assert record.available_at(datetime(2026, 3, 4, tzinfo=UTC)) is True
    assert record.available_at(datetime(2026, 3, 2, 6, tzinfo=UTC)) is False  # leakage rule
    with pytest.raises(ValueError):
        _record(temporal=TemporalRef(
            start=datetime(2026, 3, 3, tzinfo=UTC), end=datetime(2026, 3, 2, tzinfo=UTC), resolution="hourly"
        ))


# --- intersections -----------------------------------------------------------------


def test_supported_and_unsupported_intersections_are_declared():
    result = intersections.available_intersections(
        ["cardioflow", "cardiochronos", "cardiotwin", "cardiocity"]
    )
    supported_pairs = {tuple(s["frames"]) for s in result["supported"]}
    assert ("cardioflow", "cardiotwin") in supported_pairs or ("cardiotwin", "cardioflow") in supported_pairs
    reasons = {tuple(u["frames"]): u["reason"] for u in result["unsupported"]}
    key = ("cardiochronos", "cardioflow")
    assert key in reasons and "model time" in reasons[key]
    assert all(u["reason"] for u in result["unsupported"])


def test_pair_key_ordering_does_not_hide_registered_links():
    # (cardioearth, cardiocity) is registered; either argument order must find it.
    for a, b in (("cardioearth", "cardiocity"), ("cardiocity", "cardioearth")):
        result = intersections.available_intersections([a, b])
        assert len(result["supported"]) == 1
        assert result["supported"][0]["link"] == "spatial"
        assert not result["unsupported"]


def test_temporal_overlap_computes_interval_alignment():
    a = _record()
    b = _record(
        observation_id="obs-2",
        frame="cardioearth",
        observation_type="pm25",
        quantity="pm25",
        value=18.0,
        unit="µg/m³",
        population_level=True,
        status=EvidenceStatus.OBSERVED,
        temporal=TemporalRef(
            start=datetime(2026, 3, 2, 12, tzinfo=UTC),
            end=datetime(2026, 3, 4, tzinfo=UTC),
            resolution="daily",
        ),
        provenance="Open-Meteo",
        consent=ConsentClass.AGGREGATE_PUBLIC,
    )
    result = intersections.temporal_overlap([a, b])
    assert len(result["overlaps"]) == 1
    overlap = result["overlaps"][0]
    assert overlap["overlap_seconds"] == 12 * 3600
    assert overlap["coverage_a"] == 0.5
    assert "not a causal relation" in overlap.get("status", "") or "causal" in result["notice"]


def test_temporal_overlap_excludes_model_time_records():
    model_time = _record(
        temporal=TemporalRef(
            start=datetime(2026, 3, 2, tzinfo=UTC), end=datetime(2026, 3, 2, 0, 0, 1, tzinfo=UTC), resolution="model_time"
        )
    )
    result = intersections.temporal_overlap([model_time])
    assert result["overlaps"] == []
    assert "wall-clock" in result["note"]


# --- microphysics (CardioFlow) -------------------------------------------------------


def test_flow_simulation_is_deterministic_and_labelled():
    sim = microphysics.simulate_vessel("LAD", 70.0)
    again = microphysics.simulate_vessel("LAD", 70.0)
    assert sim == again
    assert sim["steady_state"]["ffr_index"] < 0.5
    assert len(sim["waveform"]["time_series"]) == 80
    assert len(sim["centreline"]["samples"]) == 48
    assert sim["centreline"]["min_diameter_mm"] > 0
    assert "not patient-specific" in sim["notice"].lower()
    assert "comparatively" in sim["notice"]  # calibration caveat present


def test_flow_baseline_vs_stenosis_monotonicity():
    curve = microphysics.compare_scenarios("RCA", [0, 25, 50, 75, 90])
    ffrs = [c["ffr_index"] for c in curve["scenarios"]]
    assert ffrs == sorted(ffrs, reverse=True)
    assert curve["scenarios"][0]["ffr_index"] > curve["scenarios"][-1]["ffr_index"]
    flows = [c["flow_rate_ml_min"] for c in curve["scenarios"]]
    assert flows == sorted(flows, reverse=True)


def test_flow_waveform_is_physiological():
    wave = microphysics.aortic_pressure_waveform(120.0, 80.0, samples=100)
    pressures = [w["p_aortic_mmhg"] for w in wave]
    assert max(pressures) == pytest.approx(120.0, abs=1.5)
    assert min(pressures) >= 79.0
    # Diastolic decay: pressure at 90% of the cycle is below the systolic peak.
    assert pressures[-1] < max(pressures) - 10


def test_flow_rejects_invalid_input():
    with pytest.raises(ValueError):
        microphysics.aortic_pressure_waveform(80.0, 120.0)  # reversed pressures
    with pytest.raises(ValueError):
        microphysics.simulate_vessel("LAD", 50.0, lesion_center_mm=5000)  # outside vessel


# --- chronos ------------------------------------------------------------------------


def test_chronos_timeline_deterministic_and_simulated_labelled():
    tl = chronos.synthetic_timeline("normal", hours=24)
    again = chronos.synthetic_timeline("normal", hours=24)
    assert tl == again
    assert len(tl["bands"]["hourly_wearable"]) == 24
    assert tl["notice"].startswith("Temporal alignment")
    window = tl["bands"]["hrv_windows"][0]
    assert window["rmssd_ms"] > 0 and window["sdnn_ms"] > 0


def test_chronos_hrv_formulas():
    features = chronos.hrv_features([600.0, 620.0, 640.0, 600.0])
    assert features["mean_heart_rate_bpm"] == pytest.approx(97.56, abs=0.05)
    assert features["n_beats"] == 4
    with pytest.raises(ValueError):
        chronos.hrv_features([600.0, -620.0, 640.0])


def test_chronos_replay_prevents_future_leakage():
    tl = chronos.synthetic_timeline("normal", hours=48)
    replay = chronos.replay(tl, datetime(2026, 3, 2, 6, tzinfo=UTC))
    assert replay["available"]["hourly_wearable"] == 7
    assert len(replay["excluded_future"]["hourly_wearable"]) == 41
    assert "leakage" in replay["notice"]


def test_chronos_alignment_reports_gaps_not_interpolation():
    tl = chronos.synthetic_timeline("normal", hours=48)
    aligned = chronos.align_bands(tl)
    assert aligned["missing_data_policy"] == "Gaps are reported, never interpolated."
    assert aligned["hourly_coverage_samples"] == 48


def test_chronos_anomaly_screening_is_label_not_diagnosis():
    values = [70.0 + (i % 3) for i in range(20)] + [120.0]
    flags = chronos.screening_anomalies(values, window=12)
    assert flags == [20]


# --- earth ------------------------------------------------------------------------


def test_earth_snapshot_has_provenance_and_population_label():
    payload = earth.countries()
    assert len(payload["countries"]) >= 10
    for row in payload["countries"]:
        assert row["population_level"] is True
        assert row["source_url"] == earth.WHO_GHO_URL
        assert row["status"] == "observed"
    assert "not live surveillance" in payload["notice"]


def test_earth_profile_lookup():
    profile = earth.country_profile("in")
    assert profile is not None and profile["iso"] == "IN"
    assert earth.country_profile("XX") is None


# --- city ---------------------------------------------------------------------------


def test_city_access_dijkstra_and_scenarios():
    access = city.access_analysis("n03")
    nearest = access["nearest"]
    assert nearest is not None and nearest["travel_minutes"] >= 0
    baseline = city.access_analysis()["city_wide"]["hospital"]
    improved = city.access_analysis(added_facility={"id": "h3", "name": "New", "category": "hospital", "node": "n03"})[
        "city_wide"
    ]["hospital"]
    assert improved["population_weighted_mean_minutes"] < baseline["population_weighted_mean_minutes"]
    closed = city.access_analysis(closed_edges=[("n01", "n02")])
    assert closed["closed_edges"] == [["n01", "n02"]]
    assert "not emergency dispatch guidance" in city.CITY_NOTICE


def test_city_unknown_nodes_rejected():
    with pytest.raises(ValueError):
        city.travel_times("n99")


# --- experiments ------------------------------------------------------------------------


def test_experiment_catalog_and_runs():
    assert {e["id"] for e in experiments.EXPERIMENTS} == {
        "earth_to_heart",
        "artery_to_time",
        "planet_to_city_to_heart",
    }
    a = experiments.run_earth_to_heart("IN")
    assert a["country"]["iso"] == "IN"
    assert "not apply to the individual" in " ".join(a["limitations"])
    b = experiments.run_artery_to_time("LAD", 70.0)
    assert b["simulation"]["steady_state"]["ffr_index"] < 0.5
    assert "NOT" in b["statistical_prediction_kept_separate"]["label"]
    c = experiments.run_planet_to_city_to_heart("IN")
    assert len(c["provenance_chain"]) == 5
    with pytest.raises(ValueError):
        experiments.run_experiment("not_an_experiment")


# --- agent tools ------------------------------------------------------------------------


def test_agent_tools_explain_frames_and_intersections_without_inventing_data():
    frame = agent_tools.explain_frame("cardioflow")
    assert frame["found"] is True
    assert "claims_policy" in frame
    assert "never produce measurements" in frame["agent_tool_notice"]
    miss = agent_tools.explain_frame("not_a_frame")
    assert miss["found"] is False and miss["known_frame_ids"] == list(frames.FRAMES)
    link = agent_tools.explain_intersection("cardioflow", "cardiochronos")
    assert link["found"] is True and link["unsupported"]
    supported = agent_tools.explain_intersection("cardiotwin", "cardioflow")
    assert supported["supported"] and supported["supported"][0]["link"] == "anatomical"
    catalog = agent_tools.experiment_catalog()
    assert len(catalog["experiments"]) == 3


def test_agent_registry_entry_is_static_and_honest():
    entry = agent_tools.registry_entry()
    assert entry["status"] == "idle" and entry["active_tasks"] == 0
    assert entry["role"] == "CROSS-5 Multiscale Reference Guide"
    assert "never produce measurements" in entry["notice"]
    assert "not live surveillance" in entry["population_statistics_note"]


# --- API contract ------------------------------------------------------------------------


def test_api_requires_auth(anon):
    assert anon.get(f"{BASE}/frames").status_code in (401, 403)


def test_api_frames_and_intersections(client):
    res = client.get(f"{BASE}/frames")
    assert res.status_code == 200 and len(res.json()["frames"]) == 5
    res = client.get(f"{BASE}/intersections?frames=cardioflow,cardiochronos")
    assert res.status_code == 200
    body = res.json()
    assert body["unsupported"] and "model time" in body["unsupported"][0]["reason"]
    res = client.get(f"{BASE}/intersections?frames=cardioflow,nonsense")
    assert res.status_code == 422


def test_api_flow_endpoints(client):
    res = client.get(f"{BASE}/flow/vessels")
    assert res.status_code == 200 and set(res.json()["vessels"]) == {"LAD", "LCX", "RCA"}
    res = client.post(f"{BASE}/flow/simulate", json={"vessel_id": "LAD", "stenosis_pct": 70})
    assert res.status_code == 200
    assert res.json()["steady_state"]["ffr_index"] < 0.5
    res = client.post(f"{BASE}/flow/simulate", json={"vessel_id": "Aorta", "stenosis_pct": 10})
    assert res.status_code == 422
    res = client.post(f"{BASE}/flow/compare", json={"vessel_id": "LAD", "stenosis_values": [0, 50, 90]})
    assert res.status_code == 200 and len(res.json()["scenarios"]) == 3


def test_api_chronos_endpoints(client):
    res = client.get(f"{BASE}/chronos/timeline?hours=24")
    assert res.status_code == 200
    body = res.json()
    assert len(body["bands"]["hourly_wearable"]) == 24
    assert body["alignment"]["hourly_coverage_samples"] == 24
    res = client.post(
        f"{BASE}/chronos/replay",
        json={"scenario": "normal", "hours": 48, "as_of": "2026-03-02T06:00:00Z"},
    )
    assert res.status_code == 200
    assert res.json()["available"]["hourly_wearable"] == 7


def test_api_earth_and_city_endpoints(client):
    res = client.get(f"{BASE}/earth/countries")
    assert res.status_code == 200 and len(res.json()["countries"]) >= 10
    res = client.get(f"{BASE}/earth/countries/IN")
    assert res.status_code == 200
    res = client.get(f"{BASE}/earth/countries/XX")
    assert res.status_code == 404
    res = client.get(f"{BASE}/city")
    assert res.status_code == 200
    assert res.json()["baseline_access"]["hospital"]["facilities"] == 2
    res = client.post(
        f"{BASE}/city/access",
        json={"added_facility": {"id": "c3", "name": "New Clinic", "category": "clinic", "node": "n03"}},
    )
    assert res.status_code == 200
    assert res.json()["city_wide"]["clinic"]["facilities"] == 3


def test_api_experiments(client):
    res = client.get(f"{BASE}/experiments")
    assert res.status_code == 200 and len(res.json()["experiments"]) == 3
    res = client.post(f"{BASE}/experiments/earth_to_heart/run", json={"country_iso": "IN"})
    assert res.status_code == 200
    assert res.json()["country"]["iso"] == "IN"
    res = client.post(f"{BASE}/experiments/artery_to_time/run", json={"vessel_id": "LCX", "stenosis_pct": 50})
    assert res.status_code == 200 and res.json()["vessel_id"] == "LCX"
    res = client.post(f"{BASE}/experiments/unknown/run", json={})
    assert res.status_code == 422


def test_api_earth_environment_reports_unavailable_honestly(client, monkeypatch):
    import app.cardiotwin.cross5.earth as earth_module

    # Patch environment_context to raise the provider error type the API handles.
    async def failing_context(*args, **kwargs):
        raise earth_module.environment_service.ProviderUnavailableError("provider down")

    monkeypatch.setattr(earth_module, "environment_context", failing_context)
    res = client.get(f"{BASE}/earth/environment?latitude=13.08&longitude=80.27")
    assert res.status_code == 503
    assert res.json()["detail"]["reason"] == "environmental_provider_unavailable"
