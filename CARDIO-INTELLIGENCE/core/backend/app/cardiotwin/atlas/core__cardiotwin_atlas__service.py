"""Atlas composition. All derived views use the same eligible evidence frontier."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from app.cardiotwin.hemodynamics.core__cardiotwin_hemodynamics__engine import (
    AXES,
    LIMITS,
    UNITS,
    evaluate_state,
    reconstruct,
)
from app.cardiotwin.hemodynamics.core__cardiotwin_hemodynamics__service import (
    from_fhir,
    snapshot_fhir,
)
from app.cardiotwin.hemodynamics.demo import DEMO_DATES, DEMO_END
from app.cardiotwin.hemodynamics.diagnostics import inspect_reconstruction
from app.cardiotwin.hemodynamics.schema import Evidence
from app.onehealth.passport import portable, seal_artifact

from . import ATLAS_VERSION
from .core__cardiotwin_atlas__fusion import LABELS, modality_status, normalize
from .core__cardiotwin_atlas__graph import graph
from .core__cardiotwin_atlas__spatial import compose_spatial
from .demo import demo_input
from .schema import AtlasInput, ExplainRequest, ScenarioRequest

SANDBOX_NOTICE = "RESEARCH / EDUCATIONAL SIMULATION. NOT A TREATMENT RECOMMENDATION. NOT CLINICALLY VALIDATED FOR PATIENT CARE. Hypothetical observations are isolated from the original twin."


def reconstruct_atlas(request: AtlasInput, *, scenario: bool = False) -> dict[str, Any]:
    synthetic = request.demo
    body = demo_input(request.as_of.isoformat()) if synthetic else request
    base = list(body.evidence)
    fhir_result = None
    if body.bundle is not None:
        fhir_result = from_fhir(
            body.bundle,
            as_of=body.as_of,
            patient_ref=body.patient_ref if body.patient_ref != "Patient/atlas-input" else None,
            received_at=body.received_at or datetime.now(UTC),
        )
        base += [Evidence.model_validate(e) for e in fhir_result["evidence"]]
    patient = fhir_result["patient_ref"] if fhir_result else body.patient_ref
    if not scenario and any(
        (e.provenance.get("hypothetical") or e.original_record.get("hypothetical"))
        and e.patient_ref == patient
        and e.event_at <= body.as_of
        and e.available_at <= body.as_of
        for e in base
    ):
        raise ValueError("Hypothetical evidence belongs only in an isolated scenario")
    extra, sources = normalize(body.modalities, body.as_of, patient)
    if len(base) + len(extra) > 3000:
        raise ValueError("Combined evidence exceeds 3000 records")
    twin = reconstruct(base + extra, body.as_of, patient)
    twin.update(inspect_reconstruction(twin))
    if fhir_result:
        twin["issues"].extend(fhir_result["issues"])
        twin["fhir_contract"] = fhir_result["fhir_contract"]
    ids = {e["id"] for e in twin["evidence"]}
    for evidence in twin["evidence"]:
        if synthetic:
            evidence["provenance"]["provider_mode"] = "SYNTHETIC"
        if evidence["source_ref"].startswith("AtlasSource/"):
            record = evidence["original_record"]
            evidence["original_record"] = {
                **record,
                "evidence_refs": [r for r in record.get("evidence_refs", []) if r in ids],
            }
            evidence["provenance"]["reference_projection"] = (
                "Source metadata references projected to this replay's admitted evidence"
            )
    for source in sources:
        source["evidence_refs"] = [r for r in source["evidence_refs"] if r in ids]
    spatial = compose_spatial(body.spatial, body.as_of, ids)
    modalities = modality_status(twin["evidence"], sources, synthetic)
    environment = next(m for m in modalities if m["id"] == "environment")
    if spatial["environment"]:
        environment.update(
            status="AVAILABLE",
            provider_mode="SYNTHETIC" if spatial["synthetic"] else "REAL",
            provider="Retained spatial context; no live service",
        )
    dimensions = []
    for axis in AXES:
        state = twin["snapshot"][axis]
        changes = [t for t in twin["transitions"] if t["axis"] == axis]
        refs = state["evidence_refs"]
        dimensions.append(
            {
                "axis": axis,
                "label": axis.replace("_", " ").title(),
                "state": state["level"],
                "confidence": state["confidence"],
                "trend": f"{changes[-1]['from_level']} → {changes[-1]['to_level']}"
                if changes
                else "No observed category transition",
                "evidence_count": len(refs),
                "last_updated": max(
                    (e["available_at"] for e in twin["evidence"] if e["id"] in refs),
                    default=None,
                    key=datetime.fromisoformat,
                ),
                "uncertainties": state["uncertainties"],
                "review_status": "REQUIRED",
            }
        )
    sensitivity = []
    observed = [Evidence.model_validate(e) for e in twin["evidence"]]
    for modality in modalities:
        refs = set(modality["evidence_refs"])
        if not refs and modality["status"] != "AVAILABLE":
            continue
        reduced = evaluate_state([e for e in observed if e.id not in refs], body.as_of, patient)
        sensitivity.append(
            {
                "modality": modality["id"],
                "label": modality["label"],
                "evidence_refs": sorted(refs),
                "original_stage": twin["snapshot"]["congestion"]["stage"],
                "withheld_stage": reduced["congestion"]["stage"],
                "original_confidence": twin["snapshot"]["confidence"],
                "withheld_confidence": reduced["confidence"],
                "changed_axes": [
                    {
                        "axis": axis,
                        "with_all_evidence": twin["snapshot"][axis]["level"],
                        "with_modality_withheld": reduced[axis]["level"],
                    }
                    for axis in AXES
                    if twin["snapshot"][axis]["level"] != reduced[axis]["level"]
                ],
                "classification": "DERIVED",
                "review_required": True,
                "notice": "Same-engine evidence withholding, not a physiological counterfactual. FHIR is a transport group and overlaps clinical modalities.",
            }
        )
    groups = {
        "Cardiac": AXES[:5],
        "Renal": ("renal_interaction",),
        "Respiratory": ("respiratory_interaction",),
        "Functional / systemic": ("functional_capacity",),
    }
    system = [
        {
            "id": label.lower().split()[0],
            "label": label,
            "axes": list(axes),
            "evidence_refs": sorted(
                {r for a in axes for r in twin["snapshot"][a]["evidence_refs"]}
            ),
            "classification": "INFERRED",
            "review_status": "REQUIRED",
        }
        for label, axes in groups.items()
    ]
    result = {
        "version": ATLAS_VERSION,
        "as_of": twin["as_of"],
        "twin": twin,
        "evidence_graph": graph(twin, sources, spatial),
        "modalities": modalities,
        "spatial": spatial,
        "dimensions": dimensions,
        "system_twin": {
            "groups": system,
            "relationships": [
                {"source": "cardiac", "target": "renal", "relationship": "temporal association"},
                {
                    "source": "cardiac",
                    "target": "respiratory",
                    "relationship": "compatible evidence patterns",
                },
                {
                    "source": "respiratory",
                    "target": "functional",
                    "relationship": "temporal association",
                },
            ],
            "notice": "Presentation of existing state axes; no independent organ simulator and no proven causal relationship.",
        },
        "sensitivity": sensitivity,
        "review": {"status": "REQUIRED", "clinical_approval": False, "source_review": "UNREVIEWED"},
        "scenario": scenario,
        "processing": [
            {
                "stage": "FHIR / observed evidence",
                "status": "COMPLETE",
                "count": sum(e["id"] in {b.id for b in base} for e in twin["evidence"]),
            },
            {"stage": "Known modality sources", "status": "COMPLETE", "count": len(sources)},
            {
                "stage": "Deterministic reconstruction",
                "status": "COMPLETE",
                "count": len(twin["transitions"]),
            },
            {"stage": "Clinical imaging / ECG / audio models", "status": "UNAVAILABLE", "count": 0},
        ],
        "safety_notice": twin["safety_notice"],
    }
    if synthetic:
        result["demo"] = {
            "label": "One entirely synthetic cardiovascular story",
            "start_at": "2026-08-01T00:00:00Z",
            "end_at": DEMO_END,
            "replay_dates": DEMO_DATES,
            "guide": [
                "Replay 10 August: delayed BNP and later encounters are absent.",
                "Replay 12 August: inspect result arrival and WHY.",
                "Compare 17 and 21 August: observations after a documented intervention.",
            ],
        }
    return result


def sandbox(request: ScenarioRequest) -> dict[str, Any]:
    current = reconstruct_atlas(request.input)
    kinds = [f.kind for f in request.changes]
    allowed = {
        "heart_rate",
        "systolic_bp",
        "diastolic_bp",
        "spo2",
        "weight",
        "functional_capacity",
        "creatinine",
        "bnp",
        "edema",
        "dyspnea",
        "rhythm",
    }
    if len(set(kinds)) != len(kinds) or any(k not in allowed for k in kinds):
        raise ValueError(
            "Scenario requires unique supported physiological variables; medication changes are forbidden"
        )
    hypothetical = []
    for i, finding in enumerate(request.changes):
        if finding.kind in LIMITS:
            unit = (finding.unit or "").lower().replace(" ", "")
            low, high = LIMITS[finding.kind]
            if (
                not isinstance(finding.value, float)
                or unit not in UNITS[finding.kind]
                or not low <= finding.value <= high
            ):
                raise ValueError(
                    "Hypothetical quantity requires a supported unit and bounded value"
                )
        elif finding.value not in {
            "absent",
            "present",
            "mild",
            "moderate",
            "severe",
            "sinus",
            "unstable",
            "unknown",
        }:
            raise ValueError("Unsupported hypothetical qualitative value")
        hypothetical.append(
            Evidence(
                id=f"hypothetical:{i}:{finding.kind}",
                patient_ref=current["twin"]["patient_ref"],
                kind=finding.kind,
                value=finding.value,
                unit=finding.unit,
                event_at=request.input.as_of,
                available_at=request.input.as_of,
                source_ref=f"Scenario/{i}",
                original_record={"hypothetical": True, "finding": finding.model_dump(mode="json")},
                provenance={
                    "hypothetical": True,
                    "atlas_modality": "symptoms"
                    if finding.kind in {"edema", "dyspnea"}
                    else "labs"
                    if finding.kind in {"bnp", "creatinine"}
                    else "ecg"
                    if finding.kind == "rhythm"
                    else "wearables",
                    "transformation": "User-authored hypothetical value; not an actual patient observation",
                    "review_status": "REQUIRED",
                },
            )
        )
    # Copy eligible data only. Same-instant operands for replaced kinds are excluded
    # solely inside the scenario to prevent contradictory duplicate timestamps.
    baseline_evidence = [
        Evidence.model_validate(e)
        for e in current["twin"]["evidence"]
        if not (e["kind"] in kinds and datetime.fromisoformat(e["event_at"]) == request.input.as_of)
    ]
    scenario_input = AtlasInput(
        patient_ref=current["twin"]["patient_ref"],
        as_of=request.input.as_of,
        evidence=baseline_evidence + hypothetical,
    )
    simulated = reconstruct_atlas(scenario_input, scenario=True)
    simulated["safety_notice"] = SANDBOX_NOTICE
    return {
        "current": current,
        "simulated": simulated,
        "scenario_status": "ISOLATED_HYPOTHETICAL",
        "safety_notice": SANDBOX_NOTICE,
        "changes": [f.model_dump(mode="json") for f in request.changes],
    }


def explain(request: ExplainRequest) -> dict[str, Any]:
    result = reconstruct_atlas(request.input)
    twin, question = result["twin"], request.question.lower()
    refs: set[str] = set()
    if request.compare_as_of:
        if request.compare_as_of > request.input.as_of:
            raise ValueError("Comparison cannot exceed the active knowledge boundary")
        previous = reconstruct_atlas(
            request.input.model_copy(update={"as_of": request.compare_as_of})
        )
        changes = [
            f"{a.replace('_', ' ')}: {previous['twin']['snapshot'][a]['level']} → {twin['snapshot'][a]['level']}"
            for a in AXES
            if previous["twin"]["snapshot"][a]["level"] != twin["snapshot"][a]["level"]
        ]
        answer = f"From {previous['as_of']} to {result['as_of']}: " + (
            "; ".join(changes) or "no qualitative axis change."
        )
        refs.update(twin["snapshot"]["evidence_refs"])
    elif any(
        word in question for word in ("dose", "prescri", "treat", "diagnos", "medication should")
    ):
        answer = "Atlas cannot diagnose, prescribe or recommend treatment. It can inspect documented interventions and subsequent evidence for clinician review."
    elif "missing" in question or "conflict" in question or "unknown" in question:
        answer = (
            " ".join(twin["snapshot"]["uncertainties"])
            or "No additional uncertainty flags in this evidence window. Research limitations and human review still apply."
        )
        refs.update(twin["snapshot"]["evidence_refs"])
    elif "before" in question and "bnp" in question:
        arrivals = [
            e
            for e in twin["evidence"]
            if e["kind"] in {"bnp", "ntprobnp"}
            and datetime.fromisoformat(e["available_at"]) - datetime.fromisoformat(e["event_at"])
            >= timedelta(days=1)
        ]
        if arrivals:
            arrival = max(arrivals, key=lambda e: datetime.fromisoformat(e["available_at"]))
            boundary = datetime.fromisoformat(arrival["available_at"]) - timedelta(microseconds=1)
            earlier = reconstruct_atlas(request.input.model_copy(update={"as_of": boundary}))
            answer = f"At {earlier['as_of']}, before the known delayed result became available, congestion proxy was {earlier['twin']['snapshot']['congestion']['stage']}. Later sources were excluded."
            refs.update(earlier["twin"]["snapshot"]["evidence_refs"])
        else:
            answer = "No delayed BNP result is available within this replay. The system cannot disclose future results."
    elif "map" in question or "spatial" in question or "care" in question:
        s = result["spatial"]
        answer = f"The retained context contains {len(s['events'])} spatial events, {len(s['facilities'])} care facilities and {len(s['environment'])} environmental records. Consent-gated context is excluded from clinical-state rules. Distances are straight-line estimates; live capacity is UNKNOWN."
    elif "intervention" in question or "after" in question:
        rows = twin["intervention_responses"]
        answer = (
            " ".join(r["interpretation"] for r in rows)
            or "No comparable intervention response is available at this knowledge boundary."
        )
        refs.update(r for row in rows for r in row["evidence_refs"])
    elif "modality" in question or "contribut" in question:
        rows = sorted(result["sensitivity"], key=lambda r: (-len(r["changed_axes"]), r["modality"]))
        answer = (
            "; ".join(
                f"Withholding {r['label']} changes {len(r['changed_axes'])} axis categories and congestion {r['original_stage']} → {r['withheld_stage']}"
                for r in rows[:4]
            )
            or "Insufficient evidence for modality sensitivity."
        )
        refs.update(r for row in rows[:4] for r in row["evidence_refs"])
    elif "changed" in question or "yesterday" in question:
        recent = [
            t
            for t in twin["transitions"]
            if datetime.fromisoformat(t["timestamp"]) >= request.input.as_of - timedelta(days=1)
        ]
        answer = (
            "; ".join(
                f"{t['axis'].replace('_', ' ')}: {t['from_level']} → {t['to_level']}. {t['explanation']}"
                for t in recent
            )
            or "No qualitative state transition was recorded in the preceding 24-hour knowledge window."
        )
        refs.update(r for t in recent for r in t["evidence_refs"])
    else:
        axis = next((a for a in AXES if a.split("_")[0] in question), "volume_status")
        state = twin["snapshot"][axis]
        answer = (
            f"{axis.replace('_', ' ').title()}: {state['level']}; evidence-support confidence {state['confidence']}. {state['explanation']} "
            + " ".join(state["uncertainties"])
        )
        refs.update(state["evidence_refs"])
    ids = {e["id"] for e in twin["evidence"]}
    return {
        "answer": answer,
        "evidence_refs": sorted(refs & ids),
        "as_of": result["as_of"],
        "mode": "DETERMINISTIC_RETRIEVAL",
        "provider": "Existing twin evidence; no generative model called",
        "ai_status": "NOT_REQUESTED; deterministic retrieved answer",
        "review_status": "REQUIRED",
        "clinical_approval": False,
        "notice": "Grounded research explanation, not medical advice. Only active as-of evidence is retrieved.",
    }


def passport(request: AtlasInput, *, actor: str, organization_id: str) -> dict[str, Any]:
    result = reconstruct_atlas(request)
    sealed = seal_artifact(
        {
            "id": "atlas-research-export",
            "version": 1,
            "organization_id": organization_id,
            "reconstruction": result,
            "scenario": False,
            "clinical_review": {"status": "REQUIRED", "clinical_approval": False},
        },
        actor=actor,
        action="atlas_research_snapshot_exported",
        timestamp=datetime.now(UTC).isoformat(),
        trust_states={
            "interpretation": "RESEARCH_INFERENCE",
            "clinical_review": "REQUIRED",
            "clinical_approval": False,
            "source": "SOURCE_ASSERTIONS_UNVERIFIED",
        },
    )
    return portable(sealed, derived_fhir=snapshot_fhir(result["twin"]))


def provider_catalog() -> dict[str, Any]:
    return {
        "version": ATLAS_VERSION,
        "providers": [
            {
                "modality": key,
                "label": label,
                "structured_adapter": "AVAILABLE",
                "clinical_model": "UNAVAILABLE"
                if key in {"ecg", "imaging", "voice"}
                else "NOT_REQUIRED",
                "patient_record_mutation": False,
            }
            for key, label in LABELS.items()
        ],
        "copilot": "Deterministic retrieved answers available; optional verbatim passage ordering requires the configured audited gateway",
    }
