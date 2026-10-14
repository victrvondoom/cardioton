"""Bounded public-source adapters; live access is explicitly configured.

Contracts: https://clinicaltrials.gov/data-api/api and
https://europepmc.org/RestfulWebService (checked 2026-10-10).
No external failure is disguised as a successful fixture retrieval.
"""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from typing import Any

from app.cardiotwin.analytics.core__cardiotwin_analytics__fixtures import demo_records
from app.cardiotwin.evidence.core__cardiotwin_evidence__passport import compute_content_sha256
from app.cardiotwin.evidence.schema import (
    ClinicalArea,
    EvidenceModality,
    EvidenceRecord,
    EvidenceTaskCategory,
)

PARSER_VERSION = "public-source-metadata-v2"


def public_retrieval_url(url: str) -> str:
    """Public corpus provenance must not retain an owner's search question."""
    parsed = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


class SourceRetrievalError(RuntimeError):
    """Safe structured source error; never exposes retrieved content or credentials."""

    def __init__(self, source: str, code: str = "source_unavailable") -> None:
        self.source = source
        self.code = code
        super().__init__(f"{source}: {code}")


def _get_json(source: str, url: str) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": "CardioTwin-Research/2.0", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            raw = response.read(5_000_001)
        if len(raw) > 5_000_000:
            raise SourceRetrievalError(source, "response_too_large")
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise SourceRetrievalError(source, "invalid_response")
        return payload
    except SourceRetrievalError:
        raise
    except Exception as exc:
        raise SourceRetrievalError(source) from exc


def _matches(record: EvidenceRecord, query: str) -> bool:
    if query in ("cardiovascular", "cardiovascular AI", ""):
        return True
    tokens = [t.lower() for t in re.findall(r"[\w-]+", query) if len(t) > 2]
    haystack = " ".join([record.title, record.target_indication, record.intervention_or_device or "", record.source_identifier]).lower()
    return any(token in haystack for token in tokens)


def _categories(text: str) -> dict[str, Any]:
    """Inspectable lexical proposals, never clinical validation or human review."""
    text = text.lower()
    area = ClinicalArea.UNKNOWN
    for phrase, candidate in [("heart failure", ClinicalArea.HEART_FAILURE), ("coronary", ClinicalArea.CORONARY_SYNDROME),
                              ("atrial fibrillation", ClinicalArea.ELECTROPHYSIOLOGY), ("hypertension", ClinicalArea.HYPERTENSION),
                              ("aortic", ClinicalArea.VALVULAR)]:
        if phrase in text:
            area = candidate
            break
    modality = EvidenceModality.UNKNOWN
    for pattern, modality_candidate in [(r"\b(ecg|electrocardiogram)\b", EvidenceModality.ECG),
                               (r"\b(ct|computed tomography)\b", EvidenceModality.CT),
                               (r"\b(echocardiography|echocardiogram)\b", EvidenceModality.ECHO),
                               (r"\b(mri|cmr)\b", EvidenceModality.MRI)]:
        if re.search(pattern, text):
            modality = modality_candidate
            break
    return {"clinical_area": area, "modality": modality, "task_category": EvidenceTaskCategory.UNKNOWN,
            "mapping_rationale": [f"Lexical mapping {PARSER_VERSION}: clinical area={area.value}, modality={modality.value}; task not inferred. Requires human review."]}


class ClinicalTrialsConnector:
    BASE_URL = "https://clinicaltrials.gov/api/v2/studies"

    def __init__(self, live: bool = False) -> None:
        self.live = live

    def search_trials(self, query: str = "cardiovascular", limit: int = 10, status: str | None = None) -> list[EvidenceRecord]:
        limit = min(max(limit, 1), 20)
        if not self.live:
            return [r for r in demo_records() if r.record_type == "trial" and _matches(r, query)
                    and (not status or r.trial_metadata.get("recruitment_status") == status)][:limit]
        params = {"query.term": query, "pageSize": str(limit), "format": "json"}
        if status:
            params["filter.overallStatus"] = status
        url = f"{self.BASE_URL}?{urllib.parse.urlencode(params)}"
        payload = _get_json("clinicaltrials", url)
        if not isinstance(payload.get("studies"), list):
            raise SourceRetrievalError("clinicaltrials", "invalid_response")
        return [self._parse_study(study, url) for study in payload["studies"]]

    def _parse_study(self, study: dict[str, Any], retrieval_url: str = BASE_URL) -> EvidenceRecord:
        try:
            protocol = study["protocolSection"]
            ident = protocol["identificationModule"]
            nct_id = ident["nctId"]
            if not re.fullmatch(r"NCT\d{8}", nct_id):
                raise ValueError("identifier")
            title = ident.get("briefTitle") or ident["officialTitle"]
            design = protocol.get("designModule", {})
            status = protocol.get("statusModule", {})
            conditions = protocol.get("conditionsModule", {}).get("conditions", [])
            interventions = [item["name"] for item in protocol.get("armsInterventionsModule", {}).get("interventions", []) if item.get("name")]
            outcomes = protocol.get("outcomesModule", {}).get("primaryOutcomes", [])
            now = datetime.now(UTC).isoformat()
            enrollment = design.get("enrollmentInfo", {}).get("count")
            sponsor = protocol.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {}).get("name")
            return EvidenceRecord(
                id=f"trial-{nct_id.lower()}", source_name="ClinicalTrials.gov", source_identifier=nct_id,
                source_url=f"https://clinicaltrials.gov/study/{nct_id}", title=title,
                authors_or_sponsor=sponsor or "Not reported", publication_or_start_date=status.get("startDateStruct", {}).get("date"),
                target_indication="; ".join(conditions) or "Not reported", intervention_or_device="; ".join(interventions) or None,
                study_design=design.get("studyType", "Not reported"), sample_size=enrollment,
                reported_endpoints=[item["measure"] for item in outcomes if item.get("measure")],
                summary_findings=protocol.get("descriptionModule", {}).get("briefSummary") or "No summary extracted. Trial registration does not establish efficacy.",
                source_version_hash=compute_content_sha256(study), retrieved_at=now,
                last_updated_at=status.get("lastUpdatePostDateStruct", {}).get("date"), record_type="trial",
                trial_metadata={"phase": ", ".join(design.get("phases", [])) or "Not reported",
                                "recruitment_status": status.get("overallStatus", "Not reported"),
                                "enrollment": enrollment, "enrollment_type": design.get("enrollmentInfo", {}).get("type"),
                                "conditions": conditions, "interventions": interventions, "primary_outcomes": outcomes,
                                "study_design": design.get("designInfo", {}), "reported_results": study.get("resultsSection"),
                                "start_date": status.get("startDateStruct"), "completion_date": status.get("completionDateStruct")},
                provenance={"parser_version": PARSER_VERSION, "raw_snapshot": study, "retrieval_url": public_retrieval_url(retrieval_url),
                            "access": "public registry metadata; see ClinicalTrials.gov terms"},
                **_categories(" ".join([title, *conditions, *interventions])),
            )
        except Exception as exc:
            raise SourceRetrievalError("clinicaltrials", "invalid_record") from exc


class PubMedConnector:
    """Backward-compatible name for Europe PMC metadata discovery (including MED records)."""

    BASE_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"

    def __init__(self, live: bool = False) -> None:
        self.live = live

    def search_publications(self, query: str = "cardiovascular AI", limit: int = 10) -> list[EvidenceRecord]:
        limit = min(max(limit, 1), 20)
        if not self.live:
            return [r for r in demo_records() if r.record_type == "publication" and _matches(r, query)][:limit]
        url = self.BASE_URL + "?" + urllib.parse.urlencode({"query": query, "resultType": "core", "format": "json", "pageSize": limit})
        payload = _get_json("europe_pmc", url)
        rows = payload.get("resultList", {}).get("result")
        if not isinstance(rows, list):
            raise SourceRetrievalError("europe_pmc", "invalid_response")
        return [self._parse_publication(row, url) for row in rows]

    def _parse_publication(self, row: dict[str, Any], retrieval_url: str = BASE_URL) -> EvidenceRecord:
        try:
            source, identifier, title = row["source"], str(row["id"]), row["title"]
            if not re.fullmatch(r"[A-Z]+", source) or not re.fullmatch(r"[A-Za-z0-9._-]+", identifier):
                raise ValueError("identifier")
            now = datetime.now(UTC).isoformat()
            types = row.get("pubTypeList", {}).get("pubType", [])
            return EvidenceRecord(
                id=f"publication-{source.lower()}-{identifier.lower()}", source_name="Europe PMC", source_identifier=f"{source}:{identifier}",
                source_url=f"https://europepmc.org/article/{source}/{identifier}", title=title,
                authors_or_sponsor=row.get("authorString") or "Not reported", publication_or_start_date=row.get("firstPublicationDate"),
                target_indication="Not extracted", study_design="; ".join(types) or "Not reported",
                summary_findings=row.get("abstractText") or "Abstract not supplied; no findings inferred.",
                source_version_hash=compute_content_sha256(row), retrieved_at=now, record_type="publication",
                provenance={"parser_version": PARSER_VERSION, "raw_snapshot": row, "retrieval_url": public_retrieval_url(retrieval_url),
                            "access": "open_access" if row.get("isOpenAccess") == "Y" else "metadata; full text access not asserted",
                            "license": row.get("license")},
                **_categories(title),
            )
        except Exception as exc:
            raise SourceRetrievalError("europe_pmc", "invalid_record") from exc


class FDASafetyConnector:
    """Unconfigured boundary. No alerts or regulatory status are invented."""

    def get_safety_alerts(self, limit: int = 5) -> list[dict[str, Any]]:
        return []
