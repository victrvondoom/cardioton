"""Explicit adapters; raw waveforms/media are never classified as diagnoses."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from app.cardiotwin.hemodynamics.schema import Evidence, EvidenceKind

from .schema import Source

LABELS = {
    "ecg": "ECG",
    "imaging": "Echo / imaging",
    "labs": "Laboratory",
    "symptoms": "Patient symptoms",
    "wearables": "Wearables",
    "fhir": "FHIR",
    "environment": "Environmental context",
    "interventions": "Interventions",
    "clinical_text": "Clinical text",
    "voice": "Voice / transcript",
}
KIND_MODALITY = {
    "lvef": "imaging",
    "rhythm": "ecg",
    "bnp": "labs",
    "ntprobnp": "labs",
    "creatinine": "labs",
    "egfr": "labs",
    "sodium": "labs",
    "potassium": "labs",
    "edema": "symptoms",
    "dyspnea": "symptoms",
    "diuretic_change": "interventions",
    "medication": "interventions",
    "hospitalization": "interventions",
    "emergency": "interventions",
    "procedure": "interventions",
    "condition": "clinical_text",
    "diagnostic_report": "clinical_text",
}


def modality_of(e: dict[str, Any]) -> str:
    candidate = e.get("provenance", {}).get("atlas_modality")
    return candidate if candidate in LABELS else KIND_MODALITY.get(e["kind"], "wearables")


def known(source: Any, at: datetime) -> bool:
    return bool(source.event_at <= at and source.available_at <= at)


def patient_report(text: str) -> list[tuple[EvidenceKind, str]]:
    """Small, disclosed phrase parser. Ambiguity/negation abstains by clause.

    Never extracts diagnoses, numbers, medication recommendations or severity.
    A positive phrase is a source assertion, not a confirmed physical finding.
    """
    result: dict[EvidenceKind, str] = {}
    patterns: dict[EvidenceKind, str] = {
        "dyspnea": r"\b(breathless|breathlessness|short of breath|dyspnea)\b",
        "edema": r"\b(swollen (?:legs|ankles)|(?:legs|ankles) (?:feel |are )?swollen|leg swelling)\b",
        "functional_capacity": r"\b(difficulty walking|less able to walk|reduced exercise tolerance)\b",
    }
    for clause in re.split(r"[.!?;\n]|\bbut\b", text.lower()):
        if re.search(
            r"\b(no|not|never|denies|without|unsure|maybe|might|if|history|previously|will|would|don't|doesn't|can't|isn't|wasn't)\b",
            clause,
        ):
            continue
        for kind, pattern in patterns.items():
            if re.search(pattern, clause):
                result[kind] = "reduced" if kind == "functional_capacity" else "present"
    return sorted(result.items())


def normalize(
    sources: list[Source], at: datetime, patient: str
) -> tuple[list[Evidence], list[dict[str, Any]]]:
    evidence, descriptors = [], []
    eligible = [s for s in sources if known(s, at)]
    identities: dict[str, dict[str, Any]] = {}
    for source in eligible:
        raw = source.model_dump(mode="json")
        if source.id in identities:
            if identities[source.id] != raw:
                raise ValueError("Conflicting modality identity")
            continue
        identities[source.id] = source.model_dump(mode="json")
        refs = list(source.evidence_refs)
        transformation = "Manually supplied structured finding; unverified source assertion"
        findings = [(f.kind, f.value, f.unit) for f in source.observations]
        if source.text and source.modality in {"voice", "symptoms", "clinical_text"}:
            findings += [
                (k, v, None)
                for k, v in patient_report(source.text)
                if k not in {f[0] for f in findings}
            ]
            transformation = (
                "Conservative phrase parser v1; patient-reported, negation-aware; no diagnosis"
            )
        if source.status != "AVAILABLE" or source.provider_mode == "UNAVAILABLE":
            findings = []
        # Environment, waveform and media alone cannot feed physiological state.
        if source.modality == "environment":
            findings = []
        for i, (kind, value, unit) in enumerate(findings):
            identifier = f"atlas-source:{source.id}:{i}"
            refs.append(identifier)
            evidence.append(
                Evidence(
                    id=identifier,
                    patient_ref=patient,
                    kind=kind,
                    value=value,
                    unit=unit,
                    event_at=source.event_at,
                    available_at=source.available_at,
                    source_ref=f"AtlasSource/{source.id}",
                    original_record=raw,
                    provenance={
                        "atlas_modality": source.modality,
                        "provider": source.provider,
                        "version": source.version,
                        "provider_mode": source.provider_mode,
                        "transformation": transformation,
                        "review_status": "UNREVIEWED",
                        "source_assertions_verified": False,
                        "patient_reported": bool(source.text),
                    },
                )
            )
        raw["evidence_refs"] = sorted(set(refs))
        raw["review_status"] = "UNREVIEWED"
        raw["transformation"] = transformation
        descriptors.append(raw)
    return evidence, descriptors


def modality_status(
    evidence: list[dict[str, Any]], sources: list[dict[str, Any]], synthetic: bool
) -> list[dict[str, Any]]:
    rows = []
    for key, label in LABELS.items():
        refs = [e["id"] for e in evidence if modality_of(e) == key]
        if key == "fhir":
            refs = [e["id"] for e in evidence if e["original_record"].get("resourceType")]
        matches = [s for s in sources if s["modality"] == key]
        available = bool(refs or any(s["status"] == "AVAILABLE" for s in matches))
        modes = {s["provider_mode"] for s in matches}
        modes.update(
            e["provenance"]["provider_mode"]
            for e in evidence
            if e["id"] in refs
            and e.get("provenance", {}).get("provider_mode") in {"REAL", "SYNTHETIC", "DEMO"}
        )
        status = (
            "AVAILABLE"
            if available
            else next(
                (s["status"] for s in matches if s["status"] in {"FAILED", "PROCESSING"}),
                "UNAVAILABLE",
            )
        )
        mode = (
            "SYNTHETIC"
            if synthetic
            else (
                "MIXED_SOURCE_MODES"
                if len(modes) > 1
                else "DEMO"
                if "DEMO" in modes
                else "SYNTHETIC"
                if "SYNTHETIC" in modes
                else "REAL"
                if available
                else "UNAVAILABLE"
            )
        )
        rows.append(
            {
                "id": key,
                "label": label,
                "status": status,
                "provider_mode": mode,
                "provider": " + ".join(sorted({s["provider"] for s in matches}))
                or (
                    "Existing FHIR / structured adapter" if refs else "No evidence provider loaded"
                ),
                "version": "atlas-adapters-1.0",
                "evidence_refs": sorted(set(refs)),
                "uncertainties": sorted({u for s in matches for u in s["uncertainties"]})
                + (["This group contains mixed synthetic/demo and submitted source assertions."] if len(modes) > 1 else [])
                + (
                    [
                        "Clinical waveform/image classification and audio transcription providers are not installed. Structured findings require review."
                    ]
                    if key in {"ecg", "imaging", "voice"}
                    else []
                ),
                "sources": matches,
            }
        )
    return rows
