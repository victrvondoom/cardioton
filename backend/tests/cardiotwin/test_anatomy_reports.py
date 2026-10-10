"""Report source scope, human review, ownership, bounded intake and replay proof."""

from __future__ import annotations

import copy
import io
import json
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject
from reportlab.pdfgen import canvas

from app.api.cardio_anatomy import router
from app.auth import get_current_user
from app.cardiotwin.anatomy import repository
from app.cardiotwin.anatomy.models import Normalized, Report, ReviewRequest
from app.cardiotwin.anatomy.service import (
    apply_review,
    build_report,
    export_passport,
    project_report,
)
from app.cardiotwin.anatomy.validation import MAX_BYTES, MAX_STREAM_BYTES, parse_upload
from app.config import settings
from app.db import db
from app.onehealth.passport import verify_package

STUDY = datetime(2026, 8, 1, 10, tzinfo=UTC)
RECEIVED = datetime(2026, 8, 2, 10, tzinfo=UTC)
REVIEWED = datetime(2026, 8, 3, 10, tzinfo=UTC)
TEXT = "Study date: 2026-08-01T10:00:00Z\nCoronary angiography\nLAD stenosis, 70%. Segment unspecified.\nLVEF 30%."


def build(text=TEXT, **kwargs):
    return build_report(text.encode(), filename="synthetic.txt", media_type="text/plain", case_ref="case/synthetic", patient_ref="Patient/synthetic", organization_id="org-a", owner_user_id="reviewer-a", synthetic=True, storage_mode="sqlite_synthetic_demo_only", received_at=RECEIVED, **kwargs)


def review(report, index=0, action="approve", normalized=None, now=REVIEWED, **kwargs):
    request = ReviewRequest(finding_id=report.findings[index].id, action=action, expected_version=report.version, normalized=normalized, **kwargs)
    return apply_review(report, request, "reviewer-a", now=now)


def pdf(text=TEXT):
    output = io.BytesIO()
    document = canvas.Canvas(output)
    for index, line in enumerate(text.splitlines()):
        document.drawString(72, 760 - 18 * index, line)
    document.save()
    return output.getvalue()


def observation(value=30, **kwargs):
    return {"resourceType": "Observation", "id": "ef-a", "status": "final", "subject": {"reference": "Patient/synthetic"}, "code": {"coding": [{"system": "http://loinc.org", "code": "10230-1"}]}, "effectiveDateTime": STUDY.isoformat(), "issued": RECEIVED.isoformat(), "valueQuantity": {"value": value, "system": "http://unitsofmeasure.org", "code": "%", "unit": "%"}, **kwargs}


def fhir_report(document):
    return build_report(json.dumps(document).encode(), filename="report.json", media_type="application/fhir+json", case_ref="case/synthetic", patient_ref="Patient/synthetic", organization_id="org-a", owner_user_id="reviewer-a", synthetic=True, storage_mode="sqlite_synthetic_demo_only", received_at=RECEIVED)


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "dev")
    monkeypatch.setattr(settings, "TRACK7_DEMO_DB", str(tmp_path / "synthetic.sqlite"))
    monkeypatch.setattr(settings, "PASSPORT_SIGNING_KEY", "")
    monkeypatch.setattr(db, "_pool", None)
    identity = {"id": "reviewer-a", "organization_id": "org-a", "role": "reviewer"}
    application = FastAPI()
    application.include_router(router, prefix="/api/v1")
    application.dependency_overrides[get_current_user] = lambda: dict(identity)
    with TestClient(application, raise_server_exceptions=False) as session:
        yield session, identity, application


def upload(client, text=TEXT, **kwargs):
    return client.post("/api/v1/cardiotwin/anatomy/reports", data={"case_ref": "case/synthetic", "patient_ref": "Patient/synthetic", "synthetic": "true", **kwargs}, files={"file": ("synthetic.txt", text.encode(), "text/plain")})


def test_direct_findings_preserve_source_and_do_not_invent_geometry():
    report = build()
    stenosis, ef = report.findings
    assert stenosis.normalized.structure_id == "LAD"
    assert stenosis.normalized.value == 70
    assert stenosis.normalized.segment is None
    assert stenosis.status == "pending" and not stenosis.active_annotation
    assert stenosis.mapping.no_lesion_geometry and stenosis.mapping.reference_anatomy
    assert "exact lesion location not established" in stenosis.mapping.location_status
    assert ef.normalized.structure_id == "LV" and ef.normalized.value == 30
    assert "does not simulate" in ef.mapping.explanation
    assert report.source["sha256"] and report.source["text"] == TEXT
    assert not report.source["original_file_retained"]


@pytest.mark.parametrize("text,expected", [
    ("No LAD stenosis.", "negated"), ("Possible LAD stenosis, 70%.", "uncertain"),
    ("Cannot exclude atrial fibrillation.", "uncertain"), ("History of myocardial infarction.", "uncertain"),
    ("LAD stenosis 60-70%.", "uncertain"), ("LAD stenosis 170%.", "unsupported"),
    ("LVEF 30-35%.", "uncertain"), ("LVEF >30%.", "uncertain"),
])
def test_uncertain_negated_or_unsupported_never_silently_approved(text, expected):
    report = build(text, study_at=STUDY)
    assert report.findings[0].certainty == expected
    with pytest.raises(HTTPException) as error:
        review(report)
    assert error.value.status_code == 409


def test_mixed_vessels_keep_values_and_negation_local():
    report = build("No LAD stenosis; RCA stenosis 40%; LCX stenosis 20%.", study_at=STUDY)
    assert [(f.normalized.structure_id, f.normalized.value, f.certainty) for f in report.findings] == [("LAD", None, "negated"), ("RCA", 40, "documented"), ("LCX", 20, "documented")]


def test_named_segment_only_maps_reported_segment():
    report = build("Proximal LAD stenosis 70%.", study_at=STUDY)
    assert report.findings[0].normalized.segment == "proximal"
    assert "proximal" in report.findings[0].mapping.location_status
    assert report.findings[0].mapping.no_lesion_geometry


def test_general_disease_stays_unresolved_and_rhythm_is_atrial_context():
    report = build("Myocardial infarction; heart failure; congestion; atrial fibrillation; mitral regurgitation; aortic stenosis.", study_at=STUDY)
    assert all(f.normalized.structure_id is None for f in report.findings[:3])
    assert all("Location not established" in f.mapping.location_status for f in report.findings[:3])
    af = next(f for f in report.findings if f.normalized.kind == "atrial_fibrillation")
    assert af.mapping.structure_ids == ["LA", "RA"]
    assert "not a claim of structural tissue damage" in af.mapping.explanation
    assert {f.normalized.structure_id for f in report.findings[-2:]} == {"MITRAL", "AORTIC_VALVE"}


def test_unsupported_report_has_no_guessed_findings():
    report = build("Cardiac disease documented. Anatomical location unspecified.", study_at=STUDY)
    assert len(report.findings) == 1
    assert report.findings[0].normalized.structure_id is None
    assert report.findings[0].normalized.kind == "general_cardiac_disease"
    approved = review(report)
    assert approved.findings[0].status == "approved" and not approved.findings[0].active_annotation


@pytest.mark.parametrize("text,state", [("No LAD stenosis or RCA stenosis.", "negated"), ("Possible LAD stenosis, RCA stenosis 40%.", "uncertain")])
def test_shared_qualifiers_cannot_be_lost_for_later_vessels(text, state):
    report = build(text, study_at=STUDY)
    assert len(report.findings) == 2
    assert all(finding.certainty == state for finding in report.findings)
    with pytest.raises(HTTPException):
        review(report, index=1)


def test_conflicts_require_source_supported_correction_then_separate_approval():
    report = build("LVEF 30%. LVEF 40%.", study_at=STUDY)
    assert all(f.certainty == "conflicting" for f in report.findings)
    with pytest.raises(HTTPException):
        review(report)
    corrected = review(report, action="correct", normalized=report.findings[0].normalized, note="Selected the explicit first measurement pending source reconciliation")
    assert corrected.findings[0].status == "pending"
    assert corrected.findings[0].certainty == "documented"
    assert corrected.findings[0].extracted_certainty == "conflicting"
    assert not corrected.findings[0].active_annotation
    approved = review(corrected, now=REVIEWED + timedelta(seconds=1))
    assert approved.findings[0].active_annotation
    assert approved.findings[0].reviewer_id == "reviewer-a"
    assert report.findings[0].status == "pending"  # Source input is untouched.


@pytest.mark.parametrize("changes", [
    {"value": 99}, {"structure_id": "RCA"}, {"segment": "proximal"},
    {"kind": "calcification", "value": None, "unit": None},
])
def test_correction_cannot_fabricate_measurement_vessel_segment_or_finding_kind(changes):
    report = build()
    normalized = Normalized.model_validate({**report.findings[0].normalized.model_dump(), **changes})
    with pytest.raises(HTTPException) as error:
        review(report, action="correct", normalized=normalized, note="Reviewer note cannot invent absent evidence")
    assert error.value.status_code == 422


def test_correction_does_not_erase_uncertain_source_qualifier():
    report = build("Possible LAD stenosis 70%.", study_at=STUDY)
    corrected = review(report, action="correct", normalized=report.findings[0].normalized, note="Confirm source extraction, qualifier remains possible")
    assert corrected.findings[0].certainty == "uncertain"
    with pytest.raises(HTTPException):
        review(corrected, now=REVIEWED + timedelta(seconds=1))


def test_rejection_and_stale_review_transitions_are_explicit():
    report = build()
    approved = review(report)
    rejected = review(approved, action="reject", now=REVIEWED + timedelta(seconds=1))
    assert rejected.findings[0].status == "rejected" and not rejected.findings[0].active_annotation
    with pytest.raises(HTTPException):
        review(rejected, now=REVIEWED + timedelta(seconds=2))
    with pytest.raises(HTTPException) as error:
        apply_review(approved, ReviewRequest(finding_id=report.findings[0].id, action="reject", expected_version=1), "reviewer-b", now=REVIEWED)
    assert error.value.status_code == 409


def test_three_clock_replay_filters_availability_and_review_decision():
    report = build()
    approved = review(report)
    assert project_report(approved, STUDY + timedelta(hours=1)) is None
    pending = project_report(approved, RECEIVED + timedelta(hours=1))
    assert pending.findings[0].status == "pending" and not pending.findings[0].active_annotation
    assert pending.findings[0].decisions == [] and pending.findings[0].reviewer_id is None
    assert pending.version == 1 and len(pending.audit) == 1
    visible = project_report(approved, REVIEWED)
    assert visible.findings[0].status == "approved" and visible.findings[0].active_annotation
    rejected = review(approved, action="reject", now=REVIEWED + timedelta(days=1))
    assert project_report(rejected, REVIEWED).findings[0].status == "approved"


def test_future_correction_does_not_leak_normalization_or_audit():
    report = build()
    normalized = report.findings[0].normalized.model_copy(update={"label": "Human arbitrary label is not trusted"})
    corrected = review(report, action="correct", normalized=normalized, note="Correction recorded later")
    historical = project_report(corrected, RECEIVED)
    assert historical.findings[0].normalized == report.findings[0].extracted
    assert "Correction recorded later" not in historical.model_dump_json()


def test_date_only_records_conservative_interval_without_claiming_observation_hour():
    report = build("Study date: 2026-08-01\nLAD stenosis 70%.")
    assert report.source["date_precision"] == "date_only"
    assert report.event_at == datetime(2026, 8, 2, 11, 59, 59, 999999, tzinfo=UTC)
    assert report.source["study_interval_start"] == "2026-07-31T10:00:00+00:00"
    assert "not a claimed observation hour" in report.source["date_replay_rationale"]


def test_unknown_event_time_remains_reviewable_but_cannot_activate_annotation():
    report = build("LAD stenosis 70%.")
    assert report.event_at is None
    approved = review(report)
    current = project_report(approved, REVIEWED)
    assert current.findings[0].status == "approved"
    assert not current.findings[0].active_annotation


def test_additive_certainty_field_reads_existing_local_report_revisions():
    report = review(build())
    payload = report.model_dump(mode="json")
    for finding in payload["findings"]:
        finding.pop("extracted_certainty")
    restored = Report.model_validate(payload)
    assert restored.findings[0].extracted_certainty == "documented"
    assert restored.source["sha256"] == report.source["sha256"]


def test_pdf_text_extracts_actual_signature_and_metadata():
    parsed = parse_upload(pdf(), "source.pdf", "application/pdf", False)
    assert parsed["source"]["page_count"] == 1
    assert "LAD stenosis" in parsed["text"]
    assert len(parsed["source"]["sha256"]) == 64


@pytest.mark.parametrize("data,filename,mime,synthetic,status", [
    (b"pretend pdf", "fake.pdf", "application/pdf", True, 422),
    (b"%PDF-1.7\nnot a PDF\n%%EOF", "bad.pdf", "application/pdf", True, 422),
    (b"DICOM", "study.dcm", "application/dicom", False, 415),
    (b"LVEF 30%", "real.txt", "text/plain", False, 422),
    (b"", "empty.txt", "text/plain", True, 422),
    (b"a" * (MAX_BYTES + 1), "huge.txt", "text/plain", True, 413),
    (b"{}", "empty.json", "application/json", False, 422),
], ids=["spoofed", "malformed", "dicom", "real-text", "empty", "oversize", "non-fhir"])
def test_upload_validation_rejects_spoofed_unsupported_empty_and_oversized_files(data, filename, mime, synthetic, status):
    with pytest.raises(HTTPException) as error:
        parse_upload(data, filename, mime, synthetic)
    assert error.value.status_code == status


def test_pdf_page_count_and_decompression_bomb_rejected_before_text_extraction():
    writer = PdfWriter()
    for _ in range(31):
        writer.add_blank_page(width=100, height=100)
    buffer = io.BytesIO()
    writer.write(buffer)
    with pytest.raises(HTTPException) as error:
        parse_upload(buffer.getvalue(), "pages.pdf", "application/pdf", True)
    assert error.value.status_code == 413
    writer = PdfWriter()
    page = writer.add_blank_page(width=100, height=100)
    stream = DecodedStreamObject()
    stream.set_data(b" " * (MAX_STREAM_BYTES + 1000))
    page[NameObject("/Contents")] = writer._add_object(stream.flate_encode())
    buffer = io.BytesIO()
    writer.write(buffer)
    assert len(buffer.getvalue()) < 10_000
    with pytest.raises(HTTPException) as error:
        parse_upload(buffer.getvalue(), "bomb.pdf", "application/pdf", True)
    assert error.value.status_code in (413, 422)


def test_encrypted_and_active_content_pdfs_are_rejected():
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.encrypt("synthetic-password")
    buffer = io.BytesIO()
    writer.write(buffer)
    with pytest.raises(HTTPException):
        parse_upload(buffer.getvalue(), "encrypted.pdf", "application/pdf", True)
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.add_js("app.alert('synthetic')")
    buffer = io.BytesIO()
    writer.write(buffer)
    with pytest.raises(HTTPException) as error:
        parse_upload(buffer.getvalue(), "active.pdf", "application/pdf", True)
    assert error.value.status_code == 422


def test_fhir_exact_code_unit_subject_and_original_observation_retained():
    original = observation()
    report = fhir_report(original)
    finding = report.findings[0]
    assert finding.normalized.value == 30 and finding.normalized.structure_id == "LV"
    assert finding.original_observation == original
    with pytest.raises(HTTPException) as error:
        fhir_report(observation(subject={"reference": "Patient/other"}))
    assert error.value.status_code == 422
    wrong = observation()
    wrong["valueQuantity"]["code"] = "mg/dL"
    assert fhir_report(wrong).findings[0].certainty == "unsupported"
    unknown = observation(code={"text": "LAD stenosis 70%"})
    assert fhir_report(unknown).findings[0].normalized.structure_id is None


def test_fhir_diagnostic_report_explicit_conclusion_extracts_pending():
    source = {"resourceType": "DiagnosticReport", "status": "final", "subject": {"reference": "Patient/synthetic"}, "effectiveDateTime": STUDY.isoformat(), "conclusion": "RCA calcification; mitral regurgitation."}
    report = fhir_report(source)
    assert [f.normalized.structure_id for f in report.findings] == ["RCA", "MITRAL"]
    assert all(f.status == "pending" for f in report.findings)


def test_fhir_preliminary_status_does_not_become_confirmed_after_correction():
    report = fhir_report(observation(status="preliminary"))
    assert report.findings[0].certainty == "uncertain"
    corrected = review(report, action="correct", normalized=report.findings[0].normalized, note="Preliminary remains preliminary")
    with pytest.raises(HTTPException):
        review(corrected)


def test_fhir_future_event_cannot_leak_via_original_bundle_or_passport():
    future = observation(99, id="future-ef", effectiveDateTime="2027-01-01T10:00:00Z")
    original = {"resourceType": "Bundle", "type": "collection", "entry": [{"resource": observation()}, {"resource": future}]}
    report = fhir_report(original)
    visible = project_report(report, REVIEWED)
    assert len(visible.findings) == 1
    assert "original_fhir" not in visible.source
    assert "future-ef" not in visible.model_dump_json()
    package = export_passport(report, "reviewer-a", REVIEWED)
    assert "future-ef" not in json.dumps(package)
    assert verify_package(package)["hash_chain"]["valid"]


def test_fhir_future_availability_and_future_review_are_not_backdated():
    report = fhir_report(observation(issued="2027-01-01T10:00:00Z"))
    assert project_report(report, REVIEWED) is None
    with pytest.raises(HTTPException):
        review(report)


def test_passport_integrity_covers_source_mapping_review_and_tampering():
    report = review(build())
    package = export_passport(report, "reviewer-a")
    assert verify_package(package)["hash_chain"]["valid"]
    altered = copy.deepcopy(package)
    altered["content"]["record"]["report"]["findings"][0]["normalized"]["value"] = 99
    assert not verify_package(altered)["hash_chain"]["valid"]


def test_api_durable_upload_owner_and_tenant_isolation_review_and_delete(client):
    session, identity, _ = client
    response = upload(session)
    assert response.status_code == 201, response.text
    report = response.json()
    assert response.headers["cache-control"] == "no-store"
    identifier = report["id"]
    base = f"/api/v1/cardiotwin/anatomy/reports/{identifier}"
    listing = session.get("/api/v1/cardiotwin/anatomy/reports", params={"case_ref": "case/synthetic"})
    assert len(listing.json()["reports"]) == 1
    identity["organization_id"] = "org-b"
    assert session.get(base).status_code == 404
    assert session.get(base + "/passport").status_code == 404
    assert session.delete(base).status_code == 404
    identity["organization_id"] = "org-a"
    identity["id"] = "other-reviewer"
    assert session.get(base).status_code == 404
    assert session.get("/api/v1/cardiotwin/anatomy/reports", params={"case_ref": "case/synthetic"}).json()["reports"] == []
    identity["id"] = "reviewer-a"
    reviewed = session.post(base + "/review", json={"finding_id": "finding-1", "action": "approve", "expected_version": 1})
    assert reviewed.status_code == 200, reviewed.text
    assert reviewed.json()["findings"][0]["reviewer_id"] == identity["id"]
    assert reviewed.json()["findings"][0]["active_annotation"]
    assert session.post(base + "/review", json={"finding_id": "finding-1", "action": "reject", "expected_version": 1}).status_code == 409
    assert verify_package(session.get(base + "/passport").json())["hash_chain"]["valid"]
    assert session.delete(base).status_code == 200
    assert session.get(base).status_code == 404
    assert session.get(base + "/passport").status_code == 404
    assert session.delete(base).status_code == 404


def test_api_auth_role_and_reviewer_spoofing_fail_closed(client):
    session, identity, application = client
    report = upload(session).json()
    endpoint = f"/api/v1/cardiotwin/anatomy/reports/{report['id']}/review"
    identity["role"] = "coordinator"
    assert session.post(endpoint, json={"finding_id": "finding-1", "action": "approve", "expected_version": 1}).status_code == 403
    identity["role"] = "reviewer"
    spoof = session.post(endpoint, json={"finding_id": "finding-1", "action": "approve", "expected_version": 1, "reviewer_id": "admin-other"})
    assert spoof.status_code == 422 and "admin-other" not in spoof.text
    application.dependency_overrides.clear()
    assert session.get("/api/v1/cardiotwin/anatomy/reports", params={"case_ref": "case/synthetic"}).status_code == 401
    assert session.get(f"/api/v1/cardiotwin/anatomy/reports/{report['id']}/passport").status_code == 401


def test_api_without_durable_storage_rejects_real_and_synthetic_data(client, monkeypatch):
    session, _, _ = client
    monkeypatch.setattr(settings, "TRACK7_DEMO_DB", "")
    assert upload(session).status_code == 503
    monkeypatch.setattr(settings, "TRACK7_DEMO_DB", "unused.sqlite")
    assert upload(session, synthetic="false").status_code == 503
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    assert upload(session).status_code == 503


def test_api_rejects_naive_replay_and_oversized_request(client):
    session, _, _ = client
    assert session.get("/api/v1/cardiotwin/anatomy/reports", params={"case_ref": "case/synthetic", "as_of": "2026-08-03"}).status_code == 422
    result = session.post("/api/v1/cardiotwin/anatomy/reports", content=b"x", headers={"content-type": "multipart/form-data", "content-length": str(MAX_BYTES + 100_000)})
    assert result.status_code == 413


@pytest.mark.asyncio
async def test_repository_compare_and_swap_is_atomic_and_survives_reload(client):
    report = build()
    await repository.save(report)
    approved = review(report)
    await repository.save(approved, expected=1)
    with pytest.raises(HTTPException) as error:
        await repository.save(approved, expected=1)
    assert error.value.status_code == 409
    loaded = await repository.get("org-a", "reviewer-a", report.id)
    assert loaded.version == 2 and loaded.findings[0].status == "approved"
