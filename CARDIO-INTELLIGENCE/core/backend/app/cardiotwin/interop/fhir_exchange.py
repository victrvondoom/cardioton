"""CardioTwin FHIR R4 Interoperability — Bundle Export & Semantic Round-Trip.

Implements Pillar D:
- Exports CardioTwin evidence passports as structured FHIR R4 Bundles
  (Patient, Observation, DiagnosticReport, Condition, Provenance)
- Imports a FHIR Bundle back and reconstructs the CardioTwin assessment
- Computes field-level Semantic Integrity Score:
  denominator = total exportable fields,
  preserved = fields surviving the round-trip intact,
  dropped = fields lost or mutated.
"""

from __future__ import annotations

import json
import math
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.cardiotwin.evidence.core__cardiotwin_evidence__passport import canonical_json_bytes

# LOINC codes for CardioTwin-relevant observations
LOINC_MAP: dict[str, dict[str, str]] = {
    "age": {"code": "30525-0", "display": "Age", "unit": "a"},
    "trestbps": {"code": "8480-6", "display": "Systolic blood pressure", "unit": "mm[Hg]"},
    "chol": {"code": "2093-3", "display": "Total Cholesterol", "unit": "mg/dL"},
}
LOCAL_SYSTEM = "urn:cardiotwin:research-observation"
LOCAL_FEATURES = {
    "fbs": "Encoded fasting blood sugar threshold flag; not a glucose concentration",
    "thalach": "Dataset maximum achieved heart rate",
    "oldpeak": "Dataset exercise ST depression encoding; unit unverified",
}

# ICD-10-CM codes for conditions
ICD10_MAP: dict[str, dict[str, str]] = {
    "cad": {"code": "I25.10", "display": "Atherosclerotic heart disease of native coronary artery without angina pectoris"},
    "lad_stenosis": {"code": "I25.11", "display": "Atherosclerotic heart disease of native coronary artery with angina pectoris"},
    "lcx_stenosis": {"code": "I25.11", "display": "Atherosclerotic heart disease of native coronary artery with angina pectoris"},
    "rca_stenosis": {"code": "I25.11", "display": "Atherosclerotic heart disease of native coronary artery with angina pectoris"},
}


def _resource_id() -> str:
    return str(uuid4())


def export_to_fhir_bundle(
    passport: dict[str, Any],
    patient_ref: str = "Patient/cardiotwin-synth-1",
) -> dict[str, Any]:
    """Convert a CardioTwin evidence passport into a FHIR R4 collection Bundle."""
    now_iso = datetime.now(UTC).isoformat()
    bundle_id = f"ct-bundle-{_resource_id()}"
    clinical_facts = passport.get("clinical_facts", {})
    input_features = clinical_facts.get("input_features", {})
    model_assessment = clinical_facts.get("model_assessment", {})
    hemodynamics = clinical_facts.get("hemodynamics", {})
    guidelines = clinical_facts.get("guidelines", {})

    entries: list[dict[str, Any]] = []

    # 1. Patient resource
    patient_id = _resource_id()
    age_val = input_features.get("Age", input_features.get("age"))
    sex_val = input_features.get("Sex", input_features.get("sex"))
    patient_resource = {
        "resourceType": "Patient",
        "id": patient_id,
        "meta": {"lastUpdated": now_iso},
        "identifier": [{"system": "urn:cardiotwin:patient", "value": passport.get("case_id", "unknown")}],
        "gender": "male" if sex_val in (1, "Male", "male") else ("female" if sex_val in (0, "Female", "female") else "unknown"),
    }
    if age_val is not None:
        patient_resource["extension"] = [{
            "url": "http://hl7.org/fhir/StructureDefinition/patient-age",
            "valueAge": {"value": age_val, "unit": "a", "system": "http://unitsofmeasure.org", "code": "a"},
        }]
    entries.append({"fullUrl": f"urn:uuid:{patient_id}", "resource": patient_resource})

    # 2. Observation resources for clinical inputs
    for feature_key, value in input_features.items():
        if feature_key not in LOINC_MAP and feature_key not in LOCAL_FEATURES or value is None:
            obs_id = _resource_id()
            retained = {
                "resourceType": "Observation", "id": obs_id, "status": "final",
                "code": {"coding": [{"system": LOCAL_SYSTEM, "code": f"input:{feature_key}"}],
                         "text": "Retained source feature; standardized clinical mapping unresolved"},
                "subject": {"reference": f"urn:uuid:{patient_id}"},
                "note": [{"text": "Local encoding preserves source value and type without asserting a standard clinical measurement."}],
            }
            if value is None:
                retained["dataAbsentReason"] = {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/data-absent-reason", "code": "unknown"}]}
            else:
                retained["valueString"] = canonical_json_bytes(value).decode("utf-8")
            entries.append({"fullUrl": f"urn:uuid:{obs_id}", "resource": retained})
            continue
        if feature_key in LOCAL_FEATURES and value is not None:
            obs_id = _resource_id()
            entries.append({"fullUrl": f"urn:uuid:{obs_id}", "resource": {
                "resourceType": "Observation", "id": obs_id, "status": "final",
                "code": {"coding": [{"system": LOCAL_SYSTEM, "code": feature_key}], "text": LOCAL_FEATURES[feature_key]},
                "subject": {"reference": f"urn:uuid:{patient_id}"},
                "valueString": str(value),
                "note": [{"text": "Local research encoding retained without asserting a standard clinical measurement."}],
            }})
            continue
        if feature_key in LOINC_MAP and value is not None:
            loinc = LOINC_MAP[feature_key]
            obs_id = _resource_id()
            obs = {
                "resourceType": "Observation",
                "id": obs_id,
                "meta": {"lastUpdated": now_iso},
                "status": "final",
                "category": [{
                    "coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "exam"}]
                }],
                "code": {
                    "coding": [{"system": "http://loinc.org", "code": loinc["code"], "display": loinc["display"]}],
                    "text": loinc["display"],
                },
                "subject": {"reference": f"urn:uuid:{patient_id}"},
                "valueQuantity": {
                    "value": value,
                    "unit": loinc["unit"],
                    "system": "http://unitsofmeasure.org",
                    "code": loinc["unit"],
                },
            }
            entries.append({"fullUrl": f"urn:uuid:{obs_id}", "resource": obs})

    # 3. Observation resources for model predictions (CAD probability, vessel FFRs)
    cad_risk = model_assessment.get("cad_risk", {})
    if isinstance(cad_risk, dict) and "probability" in cad_risk:
        obs_id = _resource_id()
        entries.append({"fullUrl": f"urn:uuid:{obs_id}", "resource": {
            "resourceType": "Observation",
            "id": obs_id,
            "status": "final",
            "code": {"coding": [{"system": LOCAL_SYSTEM, "code": "cad_probability", "display": "Model CAD probability"}]},
            "subject": {"reference": f"urn:uuid:{patient_id}"},
            "valueQuantity": {"value": cad_risk["probability"] * 100, "unit": "%"},
            "note": [{"text": "Model-derived risk estimate, not a clinical diagnosis"}],
        }})

    hemo_vessels = hemodynamics.get("vessels", {})
    for vessel in ("LAD", "LCX", "RCA"):
        vdata = hemo_vessels.get(vessel, {})
        ffr_val = vdata.get("ffr_physics")
        if ffr_val is not None:
            obs_id = _resource_id()
            entries.append({"fullUrl": f"urn:uuid:{obs_id}", "resource": {
                "resourceType": "Observation",
                "id": obs_id,
                "status": "final",
                "code": {"coding": [{"system": LOCAL_SYSTEM, "code": "simulated_pressure_ratio", "display": f"Simulated pressure ratio {vessel}"}]},
                "subject": {"reference": f"urn:uuid:{patient_id}"},
                "valueQuantity": {"value": ffr_val, "unit": "ratio"},
                "component": [
                    {"code": {"text": "vessel_id"}, "valueString": vessel},
                    {"code": {"text": "solver_type"}, "valueString": hemodynamics.get("solver", "0D/1D")},
                ],
            }})

    # 4. DiagnosticReport
    report_id = _resource_id()
    guideline_action = guidelines.get("primary_action") or guidelines.get("primary_recommendation", {}).get("action", "No rule outcome recorded")
    entries.append({"fullUrl": f"urn:uuid:{report_id}", "resource": {
        "resourceType": "DiagnosticReport",
        "id": report_id,
        "status": "final",
        "code": {"coding": [{"system": LOCAL_SYSTEM, "code": "cardiotwin_research_report"}], "text": "CardioTwin Cardiovascular Research Report"},
        "subject": {"reference": f"urn:uuid:{patient_id}"},
        "conclusion": (
            f"Research rule outcome: {guideline_action}. "
            f"Model version: {model_assessment.get('model_version', 'unknown')}. "
            f"This is a simulation-based decision support report, not a clinical diagnosis."
        ),
        "extension": [{
            "url": "urn:cardiotwin:passport-integrity",
            "valueString": passport.get("integrity", {}).get("content_sha256", ""),
        }],
    }})

    # 5. Provenance
    prov_id = _resource_id()
    entries.append({"fullUrl": f"urn:uuid:{prov_id}", "resource": {
        "resourceType": "Provenance",
        "id": prov_id,
        "target": [{"reference": f"urn:uuid:{report_id}"}],
        "recorded": now_iso,
        "agent": [{
            "type": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/provenance-participant-type", "code": "author"}]},
            "who": {"display": passport.get("software_release", "CardioTwin")},
        }],
        "entity": [{
            "role": "source",
            "what": {"display": f"Evidence Passport {passport.get('passport_id', 'unknown')}"},
        }],
    }})

    bundle = {
        "resourceType": "Bundle",
        "id": bundle_id,
        "type": "collection",
        "timestamp": now_iso,
        "meta": {
            "tag": [{"system": "urn:cardiotwin", "code": "synthetic" if passport.get("clinical_facts", {}).get("data_quality", {}).get("synthetic_demonstration", True) else "research"}],
        },
        "entry": entries,
    }

    return bundle


def import_from_fhir_bundle(bundle: dict[str, Any]) -> dict[str, Any]:
    """Parse a FHIR R4 Bundle back into CardioTwin assessment structure."""
    if bundle.get("resourceType") != "Bundle":
        return {"error": "Not a FHIR Bundle", "extracted": {}}
    if bundle.get("type") != "collection" or not isinstance(bundle.get("entry"), list):
        return {"error": "Supported scope requires a collection Bundle with entries", "extracted": {}}
    if len(bundle["entry"]) > 500:
        return {"error": "Bundle exceeds supported resource count", "extracted": {}}
    for entry in bundle["entry"]:
        if not isinstance(entry, dict) or not isinstance(entry.get("fullUrl"), str) or not entry["fullUrl"]:
            return {"error": "Bundle entries require a string fullUrl and a resource object", "extracted": {}}
        resource = entry.get("resource")
        if not isinstance(resource, dict):
            return {"error": "Bundle resource must be an object", "extracted": {}}
        for field in ("subject", "code", "valueQuantity", "meta", "dataAbsentReason"):
            if field in resource and not isinstance(resource[field], dict):
                return {"error": f"Resource {field} must be an object", "extracted": {}}
        for field in ("identifier", "component", "extension", "agent", "target", "entity"):
            if field in resource and (not isinstance(resource[field], list) or any(not isinstance(item, dict) for item in resource[field])):
                return {"error": f"Resource {field} must be a list of objects", "extracted": {}}
        codings = resource.get("code", {}).get("coding", [])
        if not isinstance(codings, list) or any(not isinstance(item, dict) for item in codings):
            return {"error": "Observation coding must be a list of objects", "extracted": {}}
        for component in resource.get("component", []):
            if not isinstance(component.get("code", {}), dict):
                return {"error": "Observation component code must be an object", "extracted": {}}
        for agent in resource.get("agent", []):
            if not isinstance(agent.get("who", {}), dict):
                return {"error": "Provenance agent who must be an object", "extracted": {}}
    identities = {entry["fullUrl"] for entry in bundle["entry"]}
    if None in identities or len(identities) != len(bundle["entry"]):
        return {"error": "Bundle fullUrl identities must be present and unique", "extracted": {}}
    patient_urls = {entry["fullUrl"] for entry in bundle["entry"] if entry["resource"].get("resourceType") == "Patient"}
    if len(patient_urls) != 1:
        return {"error": "Supported assessment scope requires exactly one Patient", "extracted": {}}

    extracted: dict[str, Any] = {
        "patient": {},
        "observations": {},
        "ffr_values": {},
        "diagnostic_conclusion": None,
        "provenance": None,
        "passport_sha256": None,
        "unresolved_fields": [],
        "resource_metadata": {},
    }

    for entry in bundle.get("entry", []):
        resource = entry.get("resource", {})
        rtype = resource.get("resourceType")
        if not rtype or not resource.get("id"):
            return {"error": "Resources must retain a type and identifier", "extracted": {}}
        reference = resource.get("subject", {}).get("reference")
        if reference and (not isinstance(reference, str) or reference not in patient_urls):
            return {"error": "Unresolved subject reference", "extracted": {}}
        for target in resource.get("target", []):
            target_ref = target.get("reference")
            if not isinstance(target_ref, str) or target_ref not in identities:
                return {"error": "Unresolved provenance target reference", "extracted": {}}
        extracted["resource_metadata"][entry["fullUrl"]] = {
            field: resource[field] for field in ("id", "resourceType", "identifier", "meta", "subject", "effectiveDateTime", "issued", "recorded", "dataAbsentReason", "valueQuantity", "target", "agent", "entity") if field in resource
        }

        if rtype == "Patient":
            extracted["patient"] = {
                "id": resource.get("id"),
                "gender": resource.get("gender"),
                "case_id": None,
            }
            for ident in resource.get("identifier", []):
                if ident.get("system") == "urn:cardiotwin:patient":
                    extracted["patient"]["case_id"] = ident.get("value")

        elif rtype == "Observation":
            codings = resource.get("code", {}).get("coding", [])
            coding = codings[0] if codings else {}
            loinc_code = coding.get("code")
            if coding.get("system") == LOCAL_SYSTEM and isinstance(loinc_code, str) and loinc_code.startswith("input:"):
                feature = loinc_code[6:]
                if not feature or len(feature) > 200 or feature in extracted["observations"]:
                    return {"error": "Invalid or duplicate retained feature identifier", "extracted": {}}
                try:
                    raw_value = resource.get("valueString")
                    decoded = json.loads(raw_value) if raw_value is not None else None
                    if decoded is None and not resource.get("dataAbsentReason"):
                        raise ValueError
                    if decoded is not None and not isinstance(decoded, str | int | float | bool):
                        raise ValueError
                    canonical_json_bytes(decoded)
                except (TypeError, ValueError):
                    return {"error": "Invalid retained source feature", "extracted": {}}
                extracted["observations"][feature] = decoded
                extracted["unresolved_fields"].append({"field": feature, "reason": "Source value retained with local encoding; standard clinical mapping unresolved"})
                continue
            value_qty = resource.get("valueQuantity", {})
            value = value_qty.get("value")
            if value is not None and (isinstance(value, bool) or not isinstance(value, int | float) or not math.isfinite(value)):
                return {"error": "Observation quantity must be a finite number", "extracted": {}}
            if coding.get("system") == LOCAL_SYSTEM and loinc_code in LOCAL_FEATURES:
                raw_value = resource.get("valueString")
                try:
                    decoded = float(raw_value)
                    if not math.isfinite(decoded):
                        raise ValueError
                except (TypeError, ValueError):
                    return {"error": "Invalid retained local feature encoding", "extracted": {}}
                extracted["observations"][loinc_code] = decoded
                continue

            # Check if it's an FFR observation
            components = resource.get("component", [])
            vessel_id = None
            for comp in components:
                if comp.get("code", {}).get("text") == "vessel_id":
                    vessel_id = comp.get("valueString")

            if vessel_id and value is not None and coding.get("system") == LOCAL_SYSTEM and loinc_code == "simulated_pressure_ratio":
                if vessel_id not in {"LAD", "LCX", "RCA"} or not 0 <= value <= 1 or value_qty.get("unit") != "ratio":
                    return {"error": "Invalid simulated vessel ratio", "extracted": {}}
                extracted["ffr_values"][vessel_id] = value
            elif loinc_code and value is not None and coding.get("system") == "http://loinc.org":
                # Reverse lookup
                for feat, info in LOINC_MAP.items():
                    if info["code"] == loinc_code:
                        if value_qty.get("code", value_qty.get("unit")) != info["unit"]:
                            extracted["unresolved_fields"].append({"field": feat, "reason": "Unit differs from supported mapping; no conversion inferred"})
                            break
                        extracted["observations"][feat] = value
                        break

        elif rtype == "DiagnosticReport":
            extracted["diagnostic_conclusion"] = resource.get("conclusion")
            for ext in resource.get("extension", []):
                if ext.get("url") == "urn:cardiotwin:passport-integrity":
                    extracted["passport_sha256"] = ext.get("valueString")

        elif rtype == "Provenance":
            agents = resource.get("agent", [])
            extracted["provenance"] = {
                "recorded": resource.get("recorded"),
                "software": agents[0].get("who", {}).get("display") if agents else None,
            }

    return extracted


def compute_semantic_round_trip_score(
    original_passport: dict[str, Any],
    exported_bundle: dict[str, Any],
) -> dict[str, Any]:
    """Measure field-level semantic fidelity of FHIR export-import round trip."""
    # Re-import the exported bundle
    reimported = import_from_fhir_bundle(exported_bundle)

    clinical_facts = original_passport.get("clinical_facts", {})
    original_inputs = clinical_facts.get("input_features", {})
    original_hemo = clinical_facts.get("hemodynamics", {}).get("vessels", {})

    # Field-level comparison
    field_results: list[dict[str, Any]] = []
    total_fields = 0
    preserved = 0
    lost = 0
    mutated = 0

    # Compare input features
    for key, orig_val in original_inputs.items():
        total_fields += 1
        reimported_val = reimported.get("observations", {}).get(key)
        if key in reimported.get("observations", {}) and reimported_val == orig_val:
            field_results.append({"field": key, "status": "PRESERVED", "original": orig_val, "reimported": reimported_val,
                                  "representation": "standard_quantity" if key in LOINC_MAP and orig_val is not None else "local_source_encoding"})
            preserved += 1
        elif reimported_val is None:
            if key not in LOINC_MAP:
                field_results.append({"field": key, "status": "NO_LOINC_MAPPING", "original": orig_val, "reimported": None})
                lost += 1
            else:
                field_results.append({"field": key, "status": "DROPPED", "original": orig_val, "reimported": None})
                lost += 1
        elif orig_val is not None and abs(float(reimported_val) - float(orig_val)) < 1e-6:
            field_results.append({"field": key, "status": "PRESERVED", "original": orig_val, "reimported": reimported_val})
            preserved += 1
        else:
            field_results.append({"field": key, "status": "MUTATED", "original": orig_val, "reimported": reimported_val})
            mutated += 1

    # Compare FFR values
    for vessel in ("LAD", "LCX", "RCA"):
        total_fields += 1
        orig_ffr = original_hemo.get(vessel, {}).get("ffr_physics")
        reimported_ffr = reimported.get("ffr_values", {}).get(vessel)
        if orig_ffr is None:
            total_fields -= 1
            continue
        if reimported_ffr is None:
            field_results.append({"field": f"ffr_{vessel}", "status": "DROPPED", "original": orig_ffr, "reimported": None})
            lost += 1
        elif abs(float(reimported_ffr) - float(orig_ffr)) < 1e-6:
            field_results.append({"field": f"ffr_{vessel}", "status": "PRESERVED", "original": orig_ffr, "reimported": reimported_ffr})
            preserved += 1
        else:
            field_results.append({"field": f"ffr_{vessel}", "status": "MUTATED", "original": orig_ffr, "reimported": reimported_ffr})
            mutated += 1

    # Integrity hash comparison
    total_fields += 1
    orig_hash = original_passport.get("integrity", {}).get("content_sha256")
    reimported_hash = reimported.get("passport_sha256")
    if reimported_hash == orig_hash and orig_hash is not None:
        field_results.append({"field": "passport_sha256", "status": "PRESERVED", "original": orig_hash[:16] + "...", "reimported": reimported_hash[:16] + "..."})
        preserved += 1
    else:
        field_results.append({"field": "passport_sha256", "status": "DROPPED" if reimported_hash is None else "MUTATED", "original": (orig_hash or "")[:16] + "...", "reimported": (reimported_hash or "None")[:16] + "..."})
        lost += 1

    denominator = max(total_fields, 1)
    score_pct = round((preserved / denominator) * 100, 1)

    return {
        "semantic_integrity_score": {
            "total_fields": total_fields,
            "preserved": preserved,
            "dropped": lost,
            "mutated": mutated,
            "score_pct": score_pct,
            "grade": "A" if score_pct >= 90 else ("B" if score_pct >= 70 else ("C" if score_pct >= 50 else "F")),
        },
        "field_results": field_results,
        "validation_error": reimported.get("error"),
        "unresolved_fields": reimported.get("unresolved_fields", []),
        "transformed_fields": [key for key in original_inputs if key not in LOINC_MAP or original_inputs[key] is None],
        "methodology": "Field-level exact-match comparison after FHIR R4 export and re-import",
        "known_losses": [
            "Source features without verified standard mappings retain local encodings; value preservation does not establish clinical semantic equivalence",
            "This report compares input values, vessel ratios and the passport digest; it does not validate the full FHIR standard or all model/report content",
            "Component-level metadata (vessel solver details) may not survive generic FHIR parsers",
        ],
    }
