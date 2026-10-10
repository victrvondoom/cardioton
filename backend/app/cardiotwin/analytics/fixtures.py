"""Small invented records for offline workflow tests and demonstrations.

IDs never impersonate a PMID or NCT record. URLs inspect the local fixture,
not an unrelated real study. No efficacy or safety outcomes are fabricated.
"""

from app.cardiotwin.evidence.passport import compute_content_sha256
from app.cardiotwin.evidence.schema import (
    ClinicalArea,
    DataMode,
    EvidenceModality,
    EvidenceRecord,
    EvidenceTaskCategory,
)

FIXTURE_VERSION = "cardiotwin-research-fixtures-v1"
FIXTURE_DATE = "2026-01-01T00:00:00Z"


def demo_records() -> list[EvidenceRecord]:
    rows = [
        ("trial-cad", "trial", "Synthetic coronary CT assessment study", ClinicalArea.CORONARY_SYNDROME,
         EvidenceModality.CT, EvidenceTaskCategory.DIAGNOSTIC, "Coronary artery disease", "CT assessment", "Interventional (randomized)", 120),
        ("trial-hf", "trial", "Synthetic heart failure SGLT2 research study", ClinicalArea.HEART_FAILURE,
         EvidenceModality.EHR, EvidenceTaskCategory.THERAPEUTIC, "Heart failure", "SGLT2 inhibitor", "Interventional (randomized)", None),
        ("publication-cad", "publication", "Synthetic CT coronary evidence methods paper", ClinicalArea.IMAGING,
         EvidenceModality.SIMULATION, EvidenceTaskCategory.DIAGNOSTIC, "Coronary artery disease", "CT assessment", "Methods paper", None),
        ("publication-ecg", "publication", "Synthetic ECG atrial fibrillation monitoring cohort", ClinicalArea.ELECTROPHYSIOLOGY,
         EvidenceModality.ECG, EvidenceTaskCategory.MONITORING, "Atrial fibrillation", "ECG monitoring", "Prospective cohort", 80),
    ]
    records = []
    for name, kind, title, area, modality, task, indication, intervention, design, size in rows:
        raw = {"fixture_version": FIXTURE_VERSION, "name": name, "title": title, "kind": kind,
               "area": area.value, "modality": modality.value, "task": task.value,
               "indication": indication, "intervention": intervention, "design": design, "sample_size": size}
        record_id = f"demo-{name}"
        records.append(EvidenceRecord(
            id=record_id, source_name="CardioTwin synthetic fixtures", source_identifier=f"DEMO-{name.upper()}",
            source_url=f"/api/cardiotwin/global/records/{record_id}", title=title,
            authors_or_sponsor="Synthetic demonstration organization", publication_or_start_date="2026-01-01",
            clinical_area=area, modality=modality, task_category=task, target_indication=indication,
            intervention_or_device=intervention, study_design=design, sample_size=size,
            summary_findings="Invented metadata for workflow demonstration. No clinical findings or treatment conclusions are available.",
            source_version_hash=compute_content_sha256(raw), retrieved_at=FIXTURE_DATE, last_updated_at=FIXTURE_DATE,
            mapping_status="proposed", human_verified=False, data_mode=DataMode.SYNTHETIC_DEMO,
            record_type=kind,
            trial_metadata={"phase": "Not applicable", "recruitment_status": "SYNTHETIC", "enrollment": size,
                            "primary_outcomes": [], "reported_results": None} if kind == "trial" else {},
            provenance={"parser_version": FIXTURE_VERSION, "access": "synthetic fixture; no external retrieval",
                        "raw_snapshot": raw, "retrieval_url": f"fixture://{FIXTURE_VERSION}/{name}"},
            mapping_rationale=["Fixture categories supplied by fixture author; awaiting review; no external verification."],
        ))
    return records
