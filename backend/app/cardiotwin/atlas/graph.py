"""Deterministic evidence graph; relationship labels never assert causality."""

from __future__ import annotations

from typing import Any

from app.cardiotwin.hemodynamics.engine import AXES

from .fusion import modality_of


def graph(
    twin: dict[str, Any], sources: list[dict[str, Any]], spatial: dict[str, Any]
) -> dict[str, Any]:
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    ids: set[str] = set()

    def add(identifier: str, kind: str, label: str, classification: str, **metadata: Any) -> None:
        if identifier in ids:
            raise ValueError("Conflicting graph identity")
        ids.add(identifier)
        nodes.append(
            {
                "id": identifier,
                "type": kind,
                "label": label,
                "classification": classification,
                "modality": "fhir",
                "review_status": "REQUIRED",
                "evidence_refs": [],
                "dependencies": [],
                "uncertainties": [],
                **metadata,
            }
        )

    def link(source: str, target: str, relation: str) -> None:
        edges.append(
            {
                "id": f"edge-{len(edges)}",
                "source": source,
                "target": target,
                "relationship": relation,
            }
        )

    # Prefix graph artifact IDs to avoid collisions with arbitrary source IDs.
    def ev(identifier: str) -> str:
        return "evidence:" + identifier

    add(
        "atlas:patient",
        "Patient",
        "Patient source reference",
        "OBSERVED",
        source_ref=twin["patient_ref"],
        value=twin["patient_ref"],
        event_at=twin["as_of"],
        available_at=twin["as_of"],
        transformation="Request-scoped patient reference; identity not independently verified",
    )
    for e in twin["evidence"]:
        add(
            ev(e["id"]),
            "Observation",
            e["kind"].replace("_", " "),
            "OBSERVED",
            modality=modality_of(e),
            evidence_refs=[e["id"]],
            value=e["value"],
            unit=e["unit"],
            source_ref=e["source_ref"],
            source_record=e["original_record"],
            event_at=e["event_at"],
            available_at=e["available_at"],
            confidence="SOURCE ASSERTION",
            provenance=e["provenance"],
            transformation=e["provenance"].get(
                "transformation",
                "Source evidence normalized by existing FHIR / observed-evidence adapter",
            ),
            review_status="UNREVIEWED",
        )
        link("atlas:patient", ev(e["id"]), "has_source_evidence")
    eligible_ids = {e["id"] for e in twin["evidence"]}
    for s in sources:
        identifier = "source:" + s["id"]
        refs = [r for r in s["evidence_refs"] if r in eligible_ids]
        add(
            identifier,
            "ModalitySource",
            s["id"],
            "OBSERVED",
            modality=s["modality"],
            source_ref=f"AtlasSource/{s['id']}",
            source_record=s,
            event_at=s["event_at"],
            available_at=s["available_at"],
            evidence_refs=refs,
            transformation=s["transformation"],
            uncertainties=s["uncertainties"],
            provenance={
                "provider": s["provider"],
                "version": s["version"],
                "provider_mode": s["provider_mode"],
            },
            review_status="UNREVIEWED",
        )
        for r in refs:
            link(identifier, ev(r), "documents")
    for measure in twin["derived_measures"]:
        identifier = "derived:" + measure["id"]
        add(
            identifier,
            "DerivedMeasure",
            measure["kind"],
            "DERIVED",
            modality="wearables",
            value=measure["value"],
            unit=measure["unit"],
            evidence_refs=measure["evidence_refs"],
            dependencies=[ev(r) for r in measure["evidence_refs"]],
            transformation=measure["transformation"],
            event_at=measure["timestamp"],
            available_at=measure["timestamp"],
        )
        for r in measure["evidence_refs"]:
            link(ev(r), identifier, "derived_from")
    for axis in AXES:
        state = twin["snapshot"][axis]
        identifier = "state:" + axis
        add(
            identifier,
            "TwinState",
            axis.replace("_", " "),
            state["classification"],
            modality="twin_states",
            axis=axis,
            value=state["level"],
            evidence_refs=state["evidence_refs"],
            dependencies=[ev(r) for r in state["evidence_refs"]],
            confidence=state["confidence"],
            transformation=state["explanation"],
            uncertainties=state["uncertainties"],
            event_at=twin["as_of"],
            available_at=twin["as_of"],
        )
        for r in state["evidence_refs"]:
            link(ev(r), identifier, "supports_research_inference")
    for transition in twin["transitions"]:
        identifier = "transition:" + transition["id"]
        add(
            identifier,
            "TwinTransition",
            f"{transition['axis']}: {transition['from_level']} → {transition['to_level']}",
            "INFERRED",
            modality="twin_states",
            evidence_refs=transition["evidence_refs"],
            event_at=transition["timestamp"],
            available_at=transition["timestamp"],
            transformation=transition["explanation"],
            confidence=transition["confidence"],
        )
        for r in transition["evidence_refs"]:
            link(ev(r), identifier, "supports_transition")
        if transition["axis"] in AXES:
            link(identifier, "state:" + transition["axis"], "historical_transition")
    for item in spatial["events"] + spatial["environment"]:
        identifier = "context:" + item["id"]
        add(
            identifier,
            "SpatialContext",
            item["label"],
            "OBSERVED",
            modality="environment",
            source_record=item,
            event_at=item["event_at"],
            available_at=item["available_at"],
            evidence_refs=item["evidence_refs"],
            transformation="Context only; excluded from physiological state rules",
        )
        for r in item["evidence_refs"]:
            link(identifier, ev(r), "contextualizes")
    add(
        "atlas:review",
        "ClinicalReview",
        "Human review REQUIRED",
        "UNKNOWN",
        modality="twin_states",
        transformation="No clinical approval is granted by Atlas",
    )
    for axis in AXES:
        link("state:" + axis, "atlas:review", "requires_review")
    if any(e["source"] not in ids or e["target"] not in ids for e in edges):
        raise ValueError("Unresolved evidence graph reference")
    return {"nodes": nodes, "edges": edges}
