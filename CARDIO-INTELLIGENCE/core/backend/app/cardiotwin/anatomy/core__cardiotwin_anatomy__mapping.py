"""Explainable reference-anatomy associations; no patient geometry inference."""

from .core__cardiotwin_anatomy__models import Mapping, Normalized

VERSION = "cardio-anatomy-1.0"
LABELS = {
    "LA": "Left atrium", "RA": "Right atrium", "LV": "Left ventricle", "RV": "Right ventricle",
    "SEPTUM": "Interventricular septum", "MITRAL": "Mitral valve", "TRICUSPID": "Tricuspid valve",
    "PULMONARY_VALVE": "Pulmonary valve", "AORTIC_VALVE": "Aortic valve", "AORTA": "Aorta",
    "PULMONARY_ARTERY": "Pulmonary artery", "VENA_CAVA": "Vena cava",
    "PULMONARY_VEINS": "Pulmonary veins", "LAD": "Left anterior descending artery",
    "LCX": "Left circumflex artery", "RCA": "Right coronary artery",
}
EXPLANATIONS = {
    "stenosis": "Stenosis describes reported narrowing of a blood vessel. The percentage does not reconstruct its lumen or exact lesion position.",
    "calcification": "Calcification describes calcium reported in a vessel. A text report does not establish the shape or extent of calcium.",
    "lvef": "Ejection fraction is the reported fraction of blood pumped from the left ventricle per beat. The reference animation does not simulate this patient's contraction.",
    "atrial_fibrillation": "Atrial fibrillation is a reported rhythm finding associated with the atria; this is an electrical context, not a claim of structural tissue damage.",
    "regurgitation": "Regurgitation describes reported backflow through a valve. The model does not reproduce the patient's measured flow.",
    "valve_stenosis": "Valve stenosis describes reported valve narrowing. The reference valve is not a patient-specific reconstruction.",
    "pulmonary_hypertension": "Pulmonary hypertension is associated with elevated pressure in the pulmonary circulation; this provides vascular context without inventing a lesion.",
    "heart_failure": "Heart failure is a documented clinical syndrome. It does not establish a single damaged anatomical site; consult the linked Cardio-Hemo evidence.",
    "congestion": "Congestion is a documented clinical finding. Anatomical location and cause require further evidence; consult the linked Cardio-Hemo evidence.",
    "myocardial_infarction": "The report mentions myocardial infarction. No precise injury location is inferred from an unspecified description.",
    "general_cardiac_disease": "The source mentions cardiac disease without naming a structure. The finding remains a general evidence card; no lesion or damaged location is inferred.",
}


def map_finding(value: Normalized) -> Mapping:
    structures = [value.structure_id] if value.structure_id else []
    if value.kind == "atrial_fibrillation":
        structures = ["LA", "RA"]
    label = LABELS.get(value.structure_id or "", "General cardiovascular finding")
    if not structures:
        rationale = "No supported structure is explicitly established; retain a general evidence card."
        location = "Location not established from supplied evidence"
    elif value.kind == "lvef":
        rationale = "Explicit LVEF is associated with LV functional context; motion remains illustrative."
        location = "Functional association only; no lesion location established"
    elif value.kind == "atrial_fibrillation":
        rationale = "Explicit atrial fibrillation maps to atrial rhythm context, without structural damage inference."
        location = "Atrial rhythm context; no structural lesion established"
    elif value.kind in ("stenosis", "calcification"):
        rationale = "Explicitly named coronary vessel maps to its reference structure. Percentage never determines physical lumen geometry."
        location = (f"Reported {value.segment} segment; reference anatomy only" if value.segment else "Vessel identified; exact lesion location not established from supplied evidence")
    else:
        rationale = "The explicitly documented finding is associated with this reference structure; no patient-specific geometry is inferred."
        location = "Structure association only; patient geometry not established"
    return Mapping(
        version=VERSION, structure_id=value.structure_id, structure_ids=structures, label=label,
        rationale=rationale, location_status=location,
        explanation=EXPLANATIONS.get(value.kind, "Documented measurement retained without inferring anatomical pathology."),
    )
