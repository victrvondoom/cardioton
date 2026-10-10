"""Strict source-evidence contracts: clients cannot submit approved twin states."""

from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StrictFloat,
    StrictStr,
    model_validator,
)

EvidenceKind = Literal[
    "weight",
    "edema",
    "dyspnea",
    "bnp",
    "ntprobnp",
    "lvef",
    "heart_rate",
    "systolic_bp",
    "diastolic_bp",
    "spo2",
    "oxygen_requirement",
    "creatinine",
    "egfr",
    "sodium",
    "potassium",
    "rhythm",
    "functional_capacity",
    "diuretic_change",
    "medication",
    "hospitalization",
    "emergency",
    "procedure",
    "condition",
    "diagnostic_report",
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


class Evidence(StrictModel):
    """Observed source facts with separate event time and availability time.

    `available_at` is when this version became knowable, rather than an assumed
    measurement time. Missing availability cannot be silently backdated.
    """

    id: str = Field(min_length=1, max_length=180)
    patient_ref: str = Field(min_length=1, max_length=180)
    kind: EvidenceKind
    value: StrictFloat | StrictStr | None
    unit: str | None = Field(default=None, max_length=80)
    event_at: AwareDatetime
    available_at: AwareDatetime
    source_ref: str = Field(min_length=1, max_length=1000)
    original_record: dict[str, Any]
    provenance: dict[str, Any] = Field(default_factory=dict)
    classification: Literal["OBSERVED"] = "OBSERVED"

    @model_validator(mode="after")
    def ordered_times(self) -> Evidence:
        if self.available_at < self.event_at:
            raise ValueError("Evidence availability cannot precede the observed event")
        try:
            json.dumps(
                {"original_record": self.original_record, "provenance": self.provenance},
                allow_nan=False,
            )
        except (ValueError, TypeError, RecursionError) as exc:
            raise ValueError("Source record and provenance require finite JSON values") from exc
        return self


class ReconstructionRequest(StrictModel):
    patient_ref: str = Field(min_length=1, max_length=180)
    as_of: AwareDatetime
    evidence: list[Evidence] = Field(default_factory=list, max_length=3000)
