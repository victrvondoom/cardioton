"""Immutable source facts, explicit review transitions and three-clock replay."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from app.cardiotwin.hemodynamics.core__cardiotwin_hemodynamics__fhir import parse_time
from app.onehealth.passport import portable, seal_artifact

from .core__cardiotwin_anatomy__extract import (
    PERCENT,
    RANGE,
    certainty,
    detect_conflicts,
    extract_fhir,
    extract_text,
    report_metadata,
)
from .core__cardiotwin_anatomy__mapping import map_finding
from .core__cardiotwin_anatomy__models import Decision, Report, ReviewRequest
from .core__cardiotwin_anatomy__validation import parse_upload

LIMITATIONS = [
    "Reference anatomy only. Text reports do not reconstruct patient anatomy, exact lesions or lumen geometry.",
    "New findings are pending review. Negated, uncertain or unsupported evidence cannot become confirmed annotations. Exact source-supported extraction conflicts require correction and separate approval.",
    "Local deterministic extraction covers a finite vocabulary and is not comprehensive clinical interpretation; no external model or OCR service receives reports.",
    "Original uploaded files are not retained. Source excerpts, original FHIR resources, source metadata and SHA-256 are retained until deletion.",
    "PostgreSQL persistence uses application-level tenant and owner predicates. SQLite is opt-in synthetic development only; production migration, backup and RLS verification remain deployment work.",
]


def build_report(
    data: bytes, *, filename: str, media_type: str, case_ref: str, patient_ref: str,
    organization_id: str, owner_user_id: str, synthetic: bool, storage_mode: str,
    study_at: datetime | None = None, received_at: datetime | None = None,
) -> Report:
    received = received_at or datetime.now(UTC)
    parsed = parse_upload(data, filename, media_type, synthetic)
    source = parsed["source"]
    event_at = study_at
    available_at = received
    if parsed["fhir"] is not None:
        findings, metadata, event_at, available_at = extract_fhir(parsed["fhir"], patient_ref, study_at, received)
        source.update(metadata)
    else:
        source.update(report_metadata(parsed["text"]))
        explicit_date = source.get("study_at")
        if explicit_date:
            extracted_date = parse_time(explicit_date)
            if study_at is not None and source.get("date_precision") == "timestamp" and study_at != extracted_date:
                raise HTTPException(422, "Supplied study timestamp conflicts with explicit report timestamp")
            event_at = study_at or extracted_date
        source["text"] = parsed["text"]
        findings = extract_text(parsed["text"], event_at, received)
    detect_conflicts(findings)
    warnings = []
    if event_at is None:
        warnings.append("Study time is unresolved. A date without timezone is retained as text; findings are excluded from historical replay until a supported timestamp is supplied.")
    if source.get("date_precision") == "date_only":
        warnings.append("Study date has no timezone or observation hour. Replay uses the conservative end of its possible date interval; this is not an asserted measurement timestamp.")
    if not findings:
        warnings.append("No supported cardiovascular finding was extracted. The report has not established a mapped abnormality.")
    if any(f.certainty != "documented" for f in findings):
        warnings.append("Source contains negation, uncertainty, conflict or unsupported values; inspect excerpts and correct before approval.")
    if synthetic:
        warnings.append("Explicitly synthetic example; not a clinical patient record.")
    return Report(
        id="cardio-report-" + uuid4().hex, organization_id=organization_id, owner_user_id=owner_user_id,
        case_ref=case_ref, patient_ref=patient_ref, source=source, event_at=event_at,
        available_at=available_at, synthetic=synthetic, findings=findings, warnings=warnings,
        storage_mode=storage_mode,
        audit=[{"action": "uploaded", "actor_id": owner_user_id, "at": received.isoformat(), "source_sha256": source["sha256"]}],
    )


def apply_review(report: Report, request: ReviewRequest, reviewer_id: str, *, now: datetime | None = None) -> Report:
    if report.version != request.expected_version:
        raise HTTPException(409, "Report changed; reload before reviewing")
    result = report.model_copy(deep=True)
    finding = next((f for f in result.findings if f.id == request.finding_id), None)
    if finding is None:
        raise HTTPException(404, "Finding not found")
    reviewed_at = now or datetime.now(UTC)
    if reviewed_at < result.available_at:
        raise HTTPException(409, "Source availability is in the future; review cannot precede evidence availability")
    if finding.decisions and reviewed_at < finding.decisions[-1].reviewed_at:
        raise HTTPException(409, "Review time cannot precede its audit history")
    if request.action == "approve":
        if finding.status == "approved":
            raise HTTPException(409, "Finding is already approved")
        if finding.status == "rejected":
            raise HTTPException(409, "A rejected finding requires explicit correction before approval")
        if finding.normalized.kind == "unsupported":
            raise HTTPException(409, "Unsupported findings cannot become authoritative annotations")
        if finding.certainty != "documented":
            raise HTTPException(409, "Negated, uncertain or conflicting source evidence cannot become a confirmed annotation; correction must resolve a source-supported extraction conflict")
    if request.action == "reject" and finding.status == "rejected":
        raise HTTPException(409, "Finding is already rejected")
    if request.action == "correct":
        assert request.normalized is not None
        normalized = request.normalized.model_copy(deep=True)
        if normalized.kind != finding.extracted.kind or normalized.structure_id != finding.extracted.structure_id:
            raise HTTPException(422, "Correction cannot introduce a finding kind or anatomical structure absent from the extracted source scope")
        if request.normalized.segment and not re.search(rf"\b{request.normalized.segment}\b", finding.source_excerpt, re.I):
            raise HTTPException(422, "An exact coronary segment cannot be introduced when absent from the supplied source excerpt")
        if normalized.value is not None and normalized.value != finding.extracted.value:
            supported = {float(m.group(1)) for m in PERCENT.finditer(finding.source_excerpt)} if normalized.unit == "%" else set()
            if normalized.value not in supported or RANGE.search(finding.source_excerpt):
                raise HTTPException(422, "A corrected measurement must be explicitly documented in the supplied source excerpt")
        if normalized.unit != finding.extracted.unit and finding.extracted.unit is not None:
            raise HTTPException(422, "Correction cannot introduce an unsupported measurement unit")
        # The source qualifier survives review. A conflict between exact,
        # positive source statements can be resolved by explicit selection;
        # a possible or negated statement cannot become a confirmed diagnosis.
        original_status = finding.original_observation.get("status")
        source_state = certainty(finding.source_excerpt)
        finding.certainty = "documented" if finding.extracted_certainty == "conflicting" and source_state == "documented" and original_status in (None, "final", "amended", "corrected") else finding.extracted_certainty
        label = {
            "stenosis": f"{normalized.structure_id} stenosis", "calcification": f"{normalized.structure_id} calcification",
            "lvef": "LVEF", "atrial_fibrillation": "Atrial fibrillation", "regurgitation": f"{normalized.structure_id} regurgitation",
            "valve_stenosis": f"{normalized.structure_id} stenosis", "pulmonary_hypertension": "Pulmonary hypertension",
            "heart_failure": "Heart failure", "congestion": "Congestion", "myocardial_infarction": "Myocardial infarction; location unresolved",
            "general_cardiac_disease": "Cardiac disease; location unresolved",
            "heart_rate": "Heart rate", "systolic_bp": "Systolic blood pressure", "diastolic_bp": "Diastolic blood pressure", "unsupported": "Unsupported source finding",
        }[normalized.kind]
        normalized.label = label + (f", {normalized.value:g} {normalized.unit} reported" if normalized.value is not None else " reported")
        finding.normalized = normalized
        finding.mapping = map_finding(finding.normalized)
    finding.status = "approved" if request.action == "approve" else "rejected" if request.action == "reject" else "pending"
    finding.reviewer_id = reviewer_id
    finding.reviewed_at = reviewed_at
    finding.active_annotation = finding.status == "approved" and finding.event_at is not None and bool(finding.mapping.structure_ids)
    finding.decisions.append(Decision(action=request.action, reviewer_id=reviewer_id, reviewed_at=reviewed_at, note=request.note, normalized=finding.normalized.model_copy(deep=True)))
    result.version += 1
    result.clinical_approval = bool(result.findings) and all(f.status in ("approved", "rejected") for f in result.findings)
    result.audit.append({"action": request.action, "actor_id": reviewer_id, "at": reviewed_at.isoformat(), "finding_id": finding.id, "note": request.note, "version": result.version})
    return result


def project_report(report: Report, as_of: datetime | None) -> Report | None:
    if as_of is None:
        return report.model_copy(deep=True)
    if report.available_at > as_of or (report.event_at is not None and report.event_at > as_of):
        return None
    result = report.model_copy(deep=True)
    result.findings = []
    for original in report.findings:
        if (original.event_at is not None and original.event_at > as_of) or original.available_at > as_of:
            continue
        finding = original.model_copy(deep=True)
        decisions = [d for d in original.decisions if d.reviewed_at <= as_of]
        finding.decisions = decisions
        latest = decisions[-1] if decisions else None
        finding.normalized = (latest.normalized if latest else original.extracted).model_copy(deep=True)
        finding.certainty = original.certainty if any(d.action == "correct" for d in decisions) else original.extracted_certainty
        finding.status = "approved" if latest and latest.action == "approve" else "rejected" if latest and latest.action == "reject" else "pending"
        finding.reviewer_id = latest.reviewer_id if latest else None
        finding.reviewed_at = latest.reviewed_at if latest else None
        finding.mapping = map_finding(finding.normalized)
        finding.active_annotation = finding.status == "approved" and finding.event_at is not None and bool(finding.mapping.structure_ids)
        result.findings.append(finding)
    result.audit = [a for a in result.audit if parse_time(a["at"]) <= as_of]
    if "original_fhir" in result.source:
        # An uploaded bundle may contain future observations. Its unfiltered
        # source must never escape through replay metadata or a Passport.
        result.source.pop("original_fhir")
        result.source["original_fhir_omitted_at_replay"] = True
        result.source["authors"] = []
    result.version = max((a.get("version", 1) for a in result.audit), default=1)
    result.clinical_approval = bool(result.findings) and all(f.status in ("approved", "rejected") for f in result.findings)
    return result


def export_passport(report: Report, actor: str, as_of: datetime | None = None) -> dict[str, Any]:
    visible = project_report(report, as_of)
    if visible is None:
        raise HTTPException(404, "Report not available at this replay boundary")
    timestamp = datetime.now(UTC).isoformat()
    artifact = {
        "id": "cardio-anatomy-export-" + uuid4().hex, "version": 1,
        "kind": "reviewed-cardiovascular-report", "report": visible.model_dump(mode="json"),
        "as_of": as_of.isoformat() if as_of else None, "limitations": LIMITATIONS,
    }
    sealed = seal_artifact(artifact, actor=actor, action="cardiovascular_report_exported", timestamp=timestamp,
        trust_states={"reference_anatomy": True, "patient_geometry_reconstructed": False,
                      "human_review_complete": visible.clinical_approval, "synthetic": visible.synthetic,
                      "approval_scope": "Individual findings only; no autonomous diagnosis or treatment"})
    return portable(sealed)
