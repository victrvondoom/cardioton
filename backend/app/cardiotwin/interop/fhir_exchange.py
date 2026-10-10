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

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

# LOINC codes for CardioTwin-relevant observations
LOINC_MAP: dict[str, dict[str, str]] = {
    "age": {"code": "30525-0", "display": "Age", "unit": "a"},
    "trestbps": {"code": "8480-6", "display": "Systolic blood pressure", "unit": "mm[Hg]"},
    "chol": {"code": "2093-3", "display": "Total Cholesterol", "unit": "mg/dL"},
    "thalach": {"code": "8867-4", "display": "Heart rate", "unit": "/min"},
    "oldpeak": {"code": "LP7225-8", "display": "ST depression exercise relative to rest", "unit": "mm"},
    "fbs": {"code": "1558-6", "display": "Fasting glucose", "unit": "mg/dL"},
    "cad_probability": {"code": "LP172872-3", "display": "CAD risk probability", "unit": "%"},
    "ffr_lad": {"code": "LP402908-5", "display": "FFR LAD", "unit": "ratio"},
    "ffr_lcx": {"code": "LP402908-5", "display": "FFR LCX", "unit": "ratio"},
    "ffr_rca": {"code": "LP402908-5", "display": "FFR RCA", "unit": "ratio"},
}

# ICD-10-CM codes for conditions
ICD10_MAP: dict[str, dict[str, str]] = {
    "cad": {"code": "I25.10", "display": "Atherosclerotic heart disease of native coronary artery without angina pectoris"},
    "lad_stenosis": {"code": "I25.11", "display": "Atherosclerotic heart disease of native coronary artery with angina pectoris"},
    "lcx_stenosis": {"code": "I25.11", "display": "Atherosclerotic heart disease of native coronary artery with angina pectoris"},
    "rca_stenosis": {"code": "I25.11", "display": "Atherosclerotic heart disease of native coronary artery with angina pectoris"},
}


def _resource_id() -> str:
    return uuid4().hex[:12]


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
    age_val = input_features.get("age")
    sex_val = input_features.get("sex")
    patient_resource = {
        "resourceType": "Patient",
        "id": patient_id,
        "meta": {"lastUpdated": now_iso},
        "identifier": [{"system": "urn:cardiotwin:patient", "value": passport.get("case_id", "unknown")}],
        "gender": "male" if sex_val == 1 else ("female" if sex_val == 0 else "unknown"),
    }
    if age_val is not None:
        patient_resource["extension"] = [{
            "url": "http://hl7.org/fhir/StructureDefinition/patient-age",
            "valueAge": {"value": age_val, "unit": "a", "system": "http://unitsofmeasure.org", "code": "a"},
        }]
    entries.append({"fullUrl": f"urn:uuid:{patient_id}", "resource": patient_resource})

    # 2. Observation resources for clinical inputs
    for feature_key, value in input_features.items():
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
            "code": {"coding": [{"system": "http://loinc.org", "code": "LP172872-3", "display": "CAD risk probability"}]},
            "subject": {"reference": f"urn:uuid:{patient_id}"},
            "valueQuantity": {"value": round(cad_risk["probability"] * 100, 2), "unit": "%"},
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
                "code": {"coding": [{"system": "http://loinc.org", "code": "LP402908-5", "display": f"FFR {vessel}"}]},
                "subject": {"reference": f"urn:uuid:{patient_id}"},
                "valueQuantity": {"value": ffr_val, "unit": "ratio"},
                "component": [
                    {"code": {"text": "vessel_id"}, "valueString": vessel},
                    {"code": {"text": "solver_type"}, "valueString": hemodynamics.get("solver", "0D/1D")},
                ],
            }})

    # 4. DiagnosticReport
    report_id = _resource_id()
    guideline_action = guidelines.get("primary_action", "No action recorded")
    entries.append({"fullUrl": f"urn:uuid:{report_id}", "resource": {
        "resourceType": "DiagnosticReport",
        "id": report_id,
        "status": "final",
        "code": {"coding": [{"system": "http://loinc.org", "code": "18748-4", "display": "Diagnostic imaging study"}], "text": "CardioTwin Cardiovascular Evidence Report"},
        "subject": {"reference": f"urn:uuid:{patient_id}"},
        "conclusion": (
            f"Primary guideline recommendation: {guideline_action}. "
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
            "tag": [{"system": "urn:cardiotwin", "code": "synthetic"}],
        },
        "entry": entries,
    }

    return bundle


def import_from_fhir_bundle(bundle: dict[str, Any]) -> dict[str, Any]:
    """Parse a FHIR R4 Bundle back into CardioTwin assessment structure."""
    if bundle.get("resourceType") != "Bundle":
        return {"error": "Not a FHIR Bundle", "extracted": {}}

    extracted: dict[str, Any] = {
        "patient": {},
        "observations": {},
        "ffr_values": {},
        "diagnostic_conclusion": None,
        "provenance": None,
        "passport_sha256": None,
    }

    for entry in bundle.get("entry", []):
        resource = entry.get("resource", {})
        rtype = resource.get("resourceType")

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
            loinc_code = codings[0].get("code") if codings else None
            value_qty = resource.get("valueQuantity", {})
            value = value_qty.get("value")

            # Check if it's an FFR observation
            components = resource.get("component", [])
            vessel_id = None
            for comp in components:
                if comp.get("code", {}).get("text") == "vessel_id":
                    vessel_id = comp.get("valueString")

            if vessel_id and value is not None:
                extracted["ffr_values"][vessel_id] = value
            elif loinc_code and value is not None:
                # Reverse lookup
                for feat, info in LOINC_MAP.items():
                    if info["code"] == loinc_code:
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
        if reimported_val is None:
            if key not in LOINC_MAP:
                field_results.append({"field": key, "status": "NO_LOINC_MAPPING", "original": orig_val, "reimported": None})
                lost += 1
            else:
                field_results.append({"field": key, "status": "DROPPED", "original": orig_val, "reimported": None})
                lost += 1
        elif abs(float(reimported_val) - float(orig_val)) < 1e-6:
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
        "methodology": "Field-level exact-match comparison after FHIR R4 export and re-import",
        "known_losses": [
            "Features without LOINC mappings are not exportable to FHIR Observation resources",
            "Categorical/encoded features (cp, restecg, slope, thal) lack standardized LOINC codes",
            "Component-level metadata (vessel solver details) may not survive generic FHIR parsers",
        ],
    }
