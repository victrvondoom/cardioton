"""Finite deterministic extraction, retaining negation, uncertainty and source scope."""

from __future__ import annotations

import copy
import re
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException

from app.cardiotwin.hemodynamics.core__cardiotwin_hemodynamics__fhir import parse_time

from .core__cardiotwin_anatomy__mapping import map_finding
from .core__cardiotwin_anatomy__models import Certainty, Finding, Normalized

VESSELS = re.compile(r"\b(LAD|LCX|RCA|left anterior descending(?: artery)?|left circumflex(?: artery)?|right coronary(?: artery)?)\b", re.I)
NEGATIVE = re.compile(r"\b(no|not|without|negative for|absence of|absent|denies|ruled out)\b", re.I)
UNCERTAIN = re.compile(r"\b(possible|possibly|probable|suspected|suggestive|may|might|cannot exclude|can(?:not|'t) rule out|rule out|question of|history of|historical|prior|resolved)\b|\?", re.I)
RANGE = re.compile(r"\d(?:\.\d+)?\s*[-–]\s*\d|[<>≤≥]|\b(?:about|approximately|less than|greater than|at least|up to)\b", re.I)
PERCENT = re.compile(r"(?<![\d.])(\d{1,3}(?:\.\d+)?)\s*%")


def certainty(text: str) -> Certainty:
    # "Cannot exclude" is uncertain, rather than a negative assertion.
    if UNCERTAIN.search(text):
        return "uncertain"
    return "negated" if NEGATIVE.search(text) else "documented"


def _time(value: Any) -> datetime | None:
    try:
        return parse_time(value)
    except (ValueError, TypeError):
        return None


def _finding(
    index: int, normalized: Normalized, excerpt: str, original: dict[str, Any],
    event_at: datetime | None, available_at: datetime, state: Certainty | None = None,
) -> Finding:
    return Finding(
        id=f"finding-{index + 1}", source_excerpt=excerpt[:2000],
        original_observation=copy.deepcopy(original), extracted=normalized, normalized=normalized,
        certainty=state or certainty(excerpt), extracted_certainty=state or certainty(excerpt), event_at=event_at, available_at=available_at,
        mapping=map_finding(normalized),
    )


def extract_text(text: str, event_at: datetime | None, available_at: datetime, original: dict[str, Any] | None = None) -> list[Finding]:
    findings: list[Finding] = []
    clauses = re.split(r"[\r\n;]+|(?<=[.!?])\s+", text, flags=re.I)

    def add(kind: str, label: str, excerpt: str, structure: str | None = None, value: float | None = None, unit: str | None = None, segment: str | None = None, state: Certainty | None = None) -> None:
        model = Normalized.model_validate({"kind": kind, "label": label, "structure_id": structure, "value": value, "unit": unit, "segment": segment})
        findings.append(_finding(len(findings), model, excerpt, original or {"text": excerpt}, event_at, available_at, state))

    for raw in clauses:
        clause = raw.strip()
        if not clause:
            continue
        vessels = list(VESSELS.finditer(clause))
        shared_qualifier = certainty(clause[:vessels[0].start()]) if vessels else "documented"
        for index, match in enumerate(vessels):
            end = vessels[index + 1].start() if index + 1 < len(vessels) else len(clause)
            start = 0 if index == 0 else match.start()
            excerpt = clause[start:end].strip(" ,")
            name = match.group().lower()
            vessel = {"lad": "LAD", "lcx": "LCX", "rca": "RCA"}.get(name)
            if vessel is None:
                vessel = "LAD" if "descending" in name else "LCX" if "circumflex" in name else "RCA"
            segment_match = re.search(r"\b(proximal|mid|distal|ostial)\b", excerpt, re.I)
            segment = segment_match.group().lower() if segment_match else None
            if re.search(r"\b(stenosis|stenotic|narrowing)\b", excerpt, re.I):
                # Limit percent attribution to the coronary subclause. An EF or
                # other measurement later in the line must not become stenosis.
                coronary_text = re.split(r"\b(?:LVEF|EF|ejection fraction|heart rate|BP)\b", excerpt, flags=re.I)[0]
                percentages = {float(m.group(1)) for m in PERCENT.finditer(coronary_text)}
                state = shared_qualifier if shared_qualifier != "documented" else certainty(excerpt)
                value = next(iter(percentages)) if len(percentages) == 1 and not RANGE.search(coronary_text) else None
                if len(percentages) > 1:
                    state = "conflicting"
                elif RANGE.search(coronary_text):
                    state = "uncertain"
                if value is not None and not 0 <= value <= 100:
                    value, state = None, "unsupported"
                add("stenosis", f"{vessel} stenosis" + (f", {value:g}% reported" if value is not None else " reported"), clause if shared_qualifier != "documented" else excerpt, vessel, value, "%" if value is not None else None, segment, state)
            if re.search(r"\b(calcification|calcified)\b", excerpt, re.I):
                add("calcification", f"{vessel} calcification reported", clause if shared_qualifier != "documented" else excerpt, vessel, segment=segment, state=shared_qualifier if shared_qualifier != "documented" else None)
        ef = re.search(r"\b(?:LVEF|left ventricular ejection fraction|ejection fraction)\b\s*(?:is|of|:|=|approximately)?\s*(\d{1,3}(?:\.\d+)?)\s*%", clause, re.I)
        if ef:
            value = float(ef.group(1))
            add("lvef", f"LVEF {value:g}% reported" if value <= 100 else "LVEF outside supported range", clause, "LV", value if value <= 100 else None, "%" if value <= 100 else None, state="unsupported" if value > 100 else ("uncertain" if RANGE.search(ef.group()) else certainty(clause)))
        # A range must remain a range: do not silently use its upper endpoint.
        elif re.search(r"\b(?:LVEF|ejection fraction)\b", clause, re.I):
            add("lvef", "LVEF mentioned; exact percentage unresolved", clause, "LV", state="uncertain")
        if re.search(r"\batrial fibrillation\b|\bAFib\b", clause, re.I):
            add("atrial_fibrillation", "Atrial fibrillation reported", clause, "LA")
        for pattern, structure in (("mitral", "MITRAL"), ("tricuspid", "TRICUSPID"), ("aortic", "AORTIC_VALVE"), ("pulmon(?:ic|ary)", "PULMONARY_VALVE")):
            for condition, kind in (("regurgitation", "regurgitation"), ("stenosis", "valve_stenosis")):
                if re.search(rf"\b{pattern}\s+(?:valve\s+)?(?:mild\s+|moderate\s+|severe\s+)?{condition}\b", clause, re.I):
                    add(kind, f"{structure.replace('_', ' ').title()} {condition} reported", clause, structure)
        for pattern, kind, general_structure, label in (
            (r"\bpulmonary hypertension\b", "pulmonary_hypertension", "PULMONARY_ARTERY", "Pulmonary hypertension reported"),
            (r"\bheart failure\b", "heart_failure", None, "Heart failure reported"),
            (r"\bcongestion\b", "congestion", None, "Congestion reported"),
            (r"\bmyocardial infarction\b|\bNSTEMI\b|\bSTEMI\b", "myocardial_infarction", None, "Myocardial infarction reported; location unresolved"),
            (r"\b(?:cardiac|cardiovascular|heart) disease\b", "general_cardiac_disease", None, "Cardiac disease reported; location unresolved"),
        ):
            if re.search(pattern, clause, re.I):
                add(kind, label, clause, general_structure)
        if len(findings) > 200:
            raise HTTPException(413, "Report exceeds 200 proposed findings")
    return findings


def _resources(document: dict[str, Any]) -> list[dict[str, Any]]:
    if document.get("resourceType") != "Bundle":
        return [document]
    entries = document.get("entry", [])
    if not isinstance(entries, list) or len(entries) > 200:
        raise HTTPException(422, "FHIR Bundle requires at most 200 entries")
    resources: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get("resource"), dict):
            raise HTTPException(422, "FHIR entries require resource objects")
        resources.append(entry["resource"])
    if not any(r.get("resourceType") in ("DiagnosticReport", "Observation") for r in resources):
        raise HTTPException(422, "FHIR document contains no DiagnosticReport or Observation")
    return resources


def extract_fhir(document: dict[str, Any], patient_ref: str, study_at: datetime | None, received_at: datetime) -> tuple[list[Finding], dict[str, Any], datetime | None, datetime]:
    resources = _resources(document)
    relevant = [r for r in resources if r.get("resourceType") in ("DiagnosticReport", "Observation")]
    if not relevant:
        raise HTTPException(422, "FHIR document contains no supported reports or observations")
    for resource in relevant:
        subject = resource.get("subject", {})
        if not isinstance(subject, dict) or subject.get("reference") != patient_ref:
            raise HTTPException(422, "Every FHIR clinical resource must explicitly reference the selected patient")
        if len(str(resource)) > 60_000:
            raise HTTPException(413, "FHIR resource exceeds 60000-character limit")
    findings: list[Finding] = []
    source_event = study_at
    source_available = received_at
    authors: list[Any] = []
    for resource in relevant:
        period = resource.get("effectivePeriod", {})
        effective = resource.get("effectiveDateTime") or (period.get("end") if isinstance(period, dict) else None)
        event_at = _time(effective) or study_at
        if source_event is None:
            source_event = event_at
        elif event_at is not None:
            source_event = min(source_event, event_at)
        meta = resource.get("meta", {})
        updated = meta.get("lastUpdated") if isinstance(meta, dict) else None
        available = max([received_at] + [t for t in (_time(resource.get("issued")), _time(updated)) if t])
        source_available = max(source_available, available)
        authors.extend(resource.get("performer", []) if isinstance(resource.get("performer", []), list) else [])
        status = resource.get("status")
        supported_status = status in ("final", "amended", "corrected")
        if status in ("entered-in-error", "cancelled"):
            continue
        if resource["resourceType"] == "DiagnosticReport":
            conclusion = resource.get("conclusion", "")
            if isinstance(conclusion, str):
                findings.extend(extract_text(conclusion, event_at, available, resource))
        else:
            raw_code = resource.get("code", {})
            code = raw_code if isinstance(raw_code, dict) else {}
            raw_codings = code.get("coding", [])
            codings = raw_codings if isinstance(raw_codings, list) else []
            kinds: set[str] = {str(c["code"]) for c in codings if isinstance(c, dict) and c.get("system") == "http://loinc.org" and c.get("code") in ("10230-1", "8867-4", "8480-6", "8462-4")}
            quantity = resource.get("valueQuantity", {})
            definitions = {"10230-1": ("lvef", "LV", "%", "%", "LVEF"), "8867-4": ("heart_rate", None, "/min", "/min", "Heart rate"), "8480-6": ("systolic_bp", None, "mm[Hg]", "mmHg", "Systolic blood pressure"), "8462-4": ("diastolic_bp", None, "mm[Hg]", "mmHg", "Diastolic blood pressure")}
            numeric = quantity.get("value") if isinstance(quantity, dict) else None
            if len(kinds) == 1 and isinstance(numeric, int | float) and not isinstance(numeric, bool) and "dataAbsentReason" not in resource:
                kind, structure, ucum, unit, label = definitions[next(iter(kinds))]
                valid_unit = quantity.get("system") == "http://unitsofmeasure.org" and quantity.get("code") == ucum and quantity.get("unit", unit) in (unit, ucum)
                comparator = quantity.get("comparator")
                if valid_unit and not comparator and 0 <= numeric <= (100 if kind == "lvef" else 500):
                    normalized = Normalized.model_validate({"kind": kind, "structure_id": structure, "value": numeric, "unit": unit, "label": f"{label} {numeric:g} {unit} reported"})
                    findings.append(_finding(len(findings), normalized, f"{label}: {numeric:g} {unit}; LOINC {next(iter(kinds))}", resource, event_at, available, "documented"))
                else:
                    normalized = Normalized(kind="unsupported", label="Structured measurement has unsupported units, comparator or range")
                    findings.append(_finding(len(findings), normalized, str(code.get("text", "Unsupported structured quantity")), resource, event_at, available, "unsupported"))
            else:
                # A display string is not an exact terminology match or an
                # observation value, so it cannot silently become a diagnosis.
                normalized = Normalized(kind="unsupported", label="Observation retained; exact supported code/value not established")
                findings.append(_finding(len(findings), normalized, str(code.get("text", "Unsupported FHIR Observation")), resource, event_at, available, "unsupported"))
        if not supported_status:
            for finding in findings:
                if finding.original_observation == resource and finding.certainty == "documented":
                    finding.certainty = "uncertain"
                    finding.extracted_certainty = "uncertain"
    for index, finding in enumerate(findings):
        finding.id = f"finding-{index + 1}"
    return findings, {"report_type": "FHIR cardiovascular evidence", "authors": authors, "original_fhir": document}, source_event, source_available


def detect_conflicts(findings: list[Finding]) -> None:
    groups: dict[tuple[Any, ...], list[Finding]] = {}
    for finding in findings:
        n = finding.normalized
        groups.setdefault((n.kind, n.structure_id, n.segment, finding.event_at), []).append(finding)
    for rows in groups.values():
        values = {(r.normalized.value, r.normalized.unit) for r in rows if r.normalized.value is not None}
        states = {r.certainty for r in rows}
        if len(values) > 1 or ("negated" in states and "documented" in states):
            for row in rows:
                row.certainty = "conflicting"
                row.extracted_certainty = "conflicting"


def report_metadata(text: str) -> dict[str, Any]:
    report_type = "Cardiovascular report"
    for token, label in (("echocardi", "Echocardiography"), ("angiograph", "Coronary angiography"), ("ECG", "ECG interpretation"), ("MRI", "MRI report; no segmentation"), ("CT ", "CT report; no segmentation")):
        if token.lower() in text.lower():
            report_type = label
            break
    dates = re.findall(r"\b(?:Study date|Report date|Date)\s*:\s*(\d{4}-\d{2}-\d{2}(?:T[0-9:.]+(?:Z|[+-]\d{2}:\d{2}))?)", text, re.I)
    parsed = [_time(date) for date in dates]
    authored = re.search(r"(?:Author|Reported by)\s*:\s*([^\r\n]{1,180})", text, re.I)
    interval: dict[str, Any] = {}
    if dates and not any(parsed):
        try:
            date = datetime.strptime(dates[0], "%Y-%m-%d").replace(tzinfo=UTC)
            interval = {
                "study_interval_start": (date - timedelta(hours=14)).isoformat(),
                "study_interval_end": (date + timedelta(hours=36) - timedelta(microseconds=1)).isoformat(),
                "study_at": (date + timedelta(hours=36) - timedelta(microseconds=1)).isoformat(),
                "date_replay_rationale": "Calendar date without timezone: replay uses the latest possible end of that local date across UTC+14 through UTC-12. This is a conservative availability boundary, not a claimed observation hour.",
            }
        except ValueError:
            pass
    return {"report_type": report_type, "study_date_text": dates[0] if dates else None,
            "study_at": next((t.isoformat() for t in parsed if t), None),
            "date_precision": "timestamp" if any(parsed) else "date_only" if dates else "unknown",
            "author": authored.group(1).strip() if authored else None, **interval}
