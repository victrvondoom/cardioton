"""Conservative FHIR R4 source adapter; exact codes, explicit knowledge time.

This is an application contract, not full HL7 profile/terminology validation.
Source resources are preserved. No text mining or imported twin feedback occurs.
"""

from __future__ import annotations

import copy
from datetime import UTC, datetime
from typing import Any, cast

from pydantic import TypeAdapter, ValidationError
from pydantic.types import AwareDatetime

from app.onehealth.passport import digest

from .schema import Evidence, EvidenceKind

LOCAL_SYSTEM = "urn:clincase:cardio-hemo"
LOINC = "http://loinc.org"
UCUM = "http://unitsofmeasure.org"
OBSERVATION_CODES = {
    "29463-7": "weight",
    "3141-9": "weight",
    "10230-1": "lvef",
    "8867-4": "heart_rate",
    "8480-6": "systolic_bp",
    "8462-4": "diastolic_bp",
    "59408-5": "spo2",
    "2708-6": "spo2",
    "30934-4": "bnp",
    "33762-6": "ntprobnp",
    "2160-0": "creatinine",
    "33914-3": "egfr",
    "62238-1": "egfr",
    "2951-2": "sodium",
    "2823-3": "potassium",
}
LOCAL_CODES = {
    "edema",
    "dyspnea",
    "rhythm",
    "functional_capacity",
    "oxygen_requirement",
    "diuretic_change",
    "medication",
}
UNITS: dict[str, dict[str, tuple[str, float]]] = {
    "weight": {"kg": ("kg", 1), "[lb_av]": ("kg", 0.45359237)},
    "lvef": {"%": ("%", 1)},
    "heart_rate": {"/min": ("/min", 1)},
    "systolic_bp": {"mm[Hg]": ("mmHg", 1)},
    "diastolic_bp": {"mm[Hg]": ("mmHg", 1)},
    "spo2": {"%": ("%", 1)},
    "bnp": {"pg/mL": ("pg/mL", 1), "ng/L": ("pg/mL", 1)},
    "ntprobnp": {"pg/mL": ("pg/mL", 1), "ng/L": ("pg/mL", 1)},
    "creatinine": {"mg/dL": ("mg/dL", 1), "umol/L": ("mg/dL", 1 / 88.4)},
    "egfr": {"mL/min/{1.73_m2}": ("mL/min/1.73m2", 1)},
    "sodium": {"mmol/L": ("mmol/L", 1)},
    "potassium": {"mmol/L": ("mmol/L", 1)},
    "oxygen_requirement": {"L/min": ("L/min", 1)},
}


def parse_time(value: Any) -> datetime:
    """Reject date-only, naive dates and numeric epochs instead of guessing."""
    if not isinstance(value, str | datetime):
        raise ValueError("Explicit timezone-aware timestamp required")
    if isinstance(value, str) and "T" not in value:
        raise ValueError("Date-only timestamps have ambiguous availability")
    return TypeAdapter(AwareDatetime).validate_python(value).astimezone(UTC)


def _reference(value: Any) -> str | None:
    ref = value.get("reference") if isinstance(value, dict) else None
    return ref if isinstance(ref, str) and ref else None


def _kind(concept: Any) -> str | None:
    if not isinstance(concept, dict):
        return None
    kinds = set()
    codings = concept.get("coding", [])
    for coding in codings if isinstance(codings, list) else []:
        if not isinstance(coding, dict):
            continue
        if not isinstance(coding.get("code"), str):
            continue
        if coding.get("system") == LOINC and coding.get("code") in OBSERVATION_CODES:
            kinds.add(OBSERVATION_CODES[coding["code"]])
        if coding.get("system") == LOCAL_SYSTEM and coding.get("code") in LOCAL_CODES:
            kinds.add(coding["code"])
    return next(iter(kinds)) if len(kinds) == 1 else None


def _value(resource: dict[str, Any], kind: str) -> tuple[Any, str | None, dict[str, Any]]:
    if "dataAbsentReason" in resource:
        return None, None, {"operation": "dataAbsentReason retained; no imputation"}
    quantity = resource.get("valueQuantity")
    if isinstance(quantity, dict):
        raw = quantity.get("value")
        if isinstance(raw, bool) or not isinstance(raw, int | float) or quantity.get("comparator"):
            raise ValueError("Unsupported quantity or comparator; measurement not inferred")
        if quantity.get("system") != UCUM:
            raise ValueError("Explicit UCUM units required")
        code = quantity.get("code")
        canonical = UNITS.get(kind, {}).get(code) if isinstance(code, str) else None
        if canonical is None:
            raise ValueError("Unsupported unit; measurement not inferred")
        # Display text is optional, but a known contradictory unit is unsafe.
        display = quantity.get("unit")
        labels = {
            "lb": "[lb_av]",
            "lbs": "[lb_av]",
            "mmHg": "mm[Hg]",
            "mL/min/1.73m2": "mL/min/{1.73_m2}",
        }
        display_code = labels.get(display, display) if isinstance(display, str) else None
        if display_code in UNITS.get(kind, {}) and display_code != quantity.get("code"):
            raise ValueError("Conflicting quantity unit label and UCUM code")
        unit, factor = canonical
        return (
            float(raw) * factor,
            unit,
            {
                "operation": "exact UCUM conversion",
                "factor": factor,
                "source_quantity": copy.deepcopy(quantity),
                "output_unit": unit,
            },
        )
    if kind in LOCAL_CODES:
        raw = resource.get("valueString")
        if isinstance(raw, str):
            return raw, None, {"operation": "explicit local qualitative observation"}
        coded = resource.get("valueCodeableConcept", {})
        if isinstance(coded, dict):
            codes = {
                c.get("code")
                for c in coded.get("coding", [])
                if isinstance(c, dict)
                and c.get("system") == LOCAL_SYSTEM
                and isinstance(c.get("code"), str)
            }
            if len(codes) == 1:
                return next(iter(codes)), None, {"operation": "explicit local qualitative code"}
    raise ValueError("Missing or unsupported observation value; no text interpretation")


def ingest_bundle(
    bundle: dict[str, Any],
    *,
    as_of: datetime,
    patient_ref: str | None = None,
    received_at: datetime | None = None,
) -> tuple[str, list[Evidence], list[dict[str, Any]]]:
    """Select one subject. Quarantine partial data; return only as-of-visible issues.

    A current resource version's later meta/provenance time is conservative: we
    cannot reconstruct an older version that the caller did not supply.
    """
    as_of = parse_time(as_of)
    if received_at is not None:
        received_at = parse_time(received_at)
    if bundle.get("resourceType") != "Bundle" or not isinstance(bundle.get("entry", []), list):
        raise ValueError("Expected a FHIR Bundle with entry array")
    entries = bundle.get("entry", [])
    if len(entries) > 1500:
        raise ValueError("Bundle exceeds 1500-resource reconstruction limit")
    resources: list[tuple[str, dict[str, Any]]] = []
    patients: dict[str, set[str]] = {}
    full_refs: dict[str, str] = {}
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get("resource"), dict):
            continue
        resource = entry["resource"]
        resource_type, identifier = resource.get("resourceType"), resource.get("id")
        if not isinstance(resource_type, str) or not isinstance(identifier, str) or not identifier:
            continue
        ref = f"{resource_type}/{identifier}"
        full_url = entry.get("fullUrl")
        if isinstance(full_url, str):
            if full_url in full_refs and full_refs[full_url] != ref:
                raise ValueError("Ambiguous Bundle fullUrl identifies multiple resources")
            full_refs[full_url] = ref
        resources.append((ref, resource))
        if resource_type == "Patient":
            full_url = entry.get("fullUrl", ref)
            patients.setdefault(ref, {ref, identifier})
            if isinstance(full_url, str):
                patients[ref].add(full_url)
    matches = [ref for ref, aliases in patients.items() if patient_ref in aliases]
    if patient_ref is None and len(patients) == 1:
        matches = list(patients)
    if len(matches) != 1:
        raise ValueError("Select exactly one Patient present in the Bundle")
    selected = matches[0]
    aliases = patients[selected]
    provenances: dict[str, list[dict[str, Any]]] = {}
    for _, resource in resources:
        if resource.get("resourceType") == "Provenance":
            targets = resource.get("target", [])
            for target in targets if isinstance(targets, list) else []:
                target_ref = _reference(target)
                if target_ref:
                    provenances.setdefault(full_refs.get(target_ref, target_ref), []).append(
                        resource
                    )
    evidence: list[Evidence] = []
    issues: list[dict[str, Any]] = []
    for ref, resource in resources:
        resource_type = resource["resourceType"]
        if resource_type in {"Patient", "Provenance"}:
            continue
        subject = _reference(resource.get("subject"))
        if subject not in aliases:
            # Don't disclose unrelated patient records in a selected-patient replay.
            continue
        try:
            event_raw = (
                resource.get("effectiveDateTime")
                or resource.get("effectivePeriod", {}).get("start")
                or resource.get("authoredOn")
                or resource.get("onsetDateTime")
                or resource.get("performedDateTime")
                or resource.get("performedPeriod", {}).get("start")
                or resource.get("period", {}).get("start")
                or resource.get("recordedDate")
            )
            event_at = parse_time(event_raw)
            if event_at > as_of:
                continue
            stamps = [resource.get("issued"), resource.get("meta", {}).get("lastUpdated")]
            if resource_type == "Condition":
                stamps.append(resource.get("recordedDate"))
            stamps += [p.get("recorded") for p in provenances.get(ref, [])]
            stamps = [parse_time(s) for s in stamps if s is not None]
            available_at = max(stamps) if stamps else received_at
            if available_at is None:
                raise ValueError(
                    "Evidence availability unknown; provide issued, lastUpdated, provenance or received_at"
                )
            if event_at > as_of or available_at > as_of:
                continue
            if available_at < event_at:
                raise ValueError("Availability precedes observation; conflicting timestamps")
            # A finished period embedded in the current version cannot leak its future end.
            for period_name in ("effectivePeriod", "performedPeriod", "period"):
                end = resource.get(period_name, {}).get("end")
                if end and parse_time(end) > available_at:
                    raise ValueError("Resource period end exceeds recorded availability")
            if resource.get("modifierExtension"):
                raise ValueError("Uninterpreted modifierExtension; source quarantined")
            tags = resource.get("meta", {}).get("tag", [])
            if any(
                isinstance(t, dict)
                and t.get("system") == LOCAL_SYSTEM
                and t.get("code") in {"twin-inference", "derived-state"}
                for t in tags
            ):
                raise ValueError("Twin inference cannot be ingested as observed source evidence")
            if resource_type in {
                "Observation",
                "DiagnosticReport",
                "Procedure",
                "MedicationAdministration",
            }:
                allowed = {
                    "Observation": {"final", "amended", "corrected"},
                    "DiagnosticReport": {"final", "amended", "corrected", "appended"},
                    "Procedure": {"completed"},
                    "MedicationAdministration": {"completed"},
                }
                if resource.get("status") not in allowed[resource_type]:
                    raise ValueError(
                        "Source status is not eligible for deterministic reconstruction"
                    )
            normalized: list[tuple[str, Any, str | None, dict[str, Any], str]] = []
            if resource_type == "Observation":
                parts = resource.get("component") or [resource]
                if not isinstance(parts, list):
                    raise ValueError("Observation component must be an array")
                for index, part in enumerate(parts):
                    if not isinstance(part, dict):
                        raise ValueError("Invalid Observation component")
                    kind = _kind(part.get("code"))
                    if kind is None:
                        raise ValueError("Unsupported or ambiguous exact observation coding")
                    value, unit, transformation = _value(part, kind)
                    normalized.append((kind, value, unit, transformation, str(index)))
            elif resource_type == "MedicationRequest":
                if (
                    resource.get("status") not in {"active", "completed"}
                    or resource.get("intent") != "order"
                ):
                    raise ValueError("MedicationRequest is not an eligible documented order")
                concept = resource.get("medicationCodeableConcept", {})
                # No dose escalation is guessed from medication text.
                kind = "diuretic_change" if _kind(concept) == "diuretic_change" else "medication"
                normalized.append(
                    (
                        kind,
                        "documented_change" if kind == "diuretic_change" else "documented_order",
                        None,
                        {"operation": "documented order; not administration or recommendation"},
                        "0",
                    )
                )
            elif resource_type == "MedicationAdministration":
                normalized.append(
                    (
                        "medication",
                        "documented_administration",
                        None,
                        {"operation": "documented administration"},
                        "0",
                    )
                )
            elif resource_type == "Encounter":
                classes = {"IMP": "hospitalization", "EMER": "emergency"}
                kind = classes.get(resource.get("class", {}).get("code"))
                if (
                    resource.get("class", {}).get("system")
                    != "http://terminology.hl7.org/CodeSystem/v3-ActCode"
                    or not kind
                ):
                    raise ValueError("Unsupported encounter class")
                if resource.get("status") not in {"in-progress", "finished"}:
                    raise ValueError("Planned/cancelled encounter is not an observed event")
                normalized.append(
                    (kind, "documented_event", None, {"operation": "observed encounter event"}, "0")
                )
            elif resource_type in {"Condition", "DiagnosticReport", "Procedure"}:
                if (
                    resource_type == "Condition"
                    and resource.get("verificationStatus", {}).get("coding")
                    and any(
                        c.get("code") in {"refuted", "entered-in-error"}
                        for c in resource["verificationStatus"]["coding"]
                        if isinstance(c, dict)
                    )
                ):
                    raise ValueError("Refuted or entered-in-error Condition quarantined")
                normalized.append(
                    (
                        {
                            "Condition": "condition",
                            "DiagnosticReport": "diagnostic_report",
                            "Procedure": "procedure",
                        }[resource_type],
                        "documented_context",
                        None,
                        {"operation": "context only; no diagnosis/report narrative inference"},
                        "0",
                    )
                )
            else:
                raise ValueError("Resource type unsupported by this cardiology contract")
            staged = []
            for kind, value, unit, transformation, suffix in normalized:
                staged.append(
                    Evidence(
                        id=f"{ref}:{suffix}",
                        patient_ref=selected,
                        kind=cast(EvidenceKind, kind),
                        value=value,
                        unit=unit,
                        event_at=event_at,
                        available_at=available_at,
                        source_ref=ref,
                        original_record=copy.deepcopy(resource),
                        provenance={
                            "source_sha256": digest(resource),
                            "source_resource_type": resource_type,
                            "mapping": "exact-code application contract; not clinical approval",
                            "transformation": transformation,
                            "source_provenance": copy.deepcopy(provenances.get(ref, [])),
                            "availability_basis": "source_version_time"
                            if stamps
                            else "explicit_received_at",
                        },
                    )
                )
            evidence.extend(staged)
        except (ValueError, TypeError, AttributeError, OverflowError, RecursionError, ValidationError) as exc:
            # Invalid source details are never echoed. Unknown-time issues cannot
            # be safely dated in a historical replay; report only at receipt.
            if received_at is not None and received_at <= as_of:
                issues.append(
                    {
                        "code": "FHIR_SOURCE_QUARANTINED",
                        "source_ref": ref,
                        "message": str(exc)
                        if type(exc) is ValueError
                        else "Source excluded: invalid or partial structure, value or timestamp. Inspect the submitted original record.",
                        "available_at": received_at.isoformat(),
                    }
                )
    return selected, evidence, sorted(issues, key=lambda i: (i["source_ref"], i["code"]))
