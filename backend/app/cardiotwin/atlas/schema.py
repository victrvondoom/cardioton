"""Bounded research inputs. Review and tenant identity cannot be supplied."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import AwareDatetime, Field, StrictFloat, StrictStr, model_validator

from app.cardiotwin.hemodynamics.schema import Evidence, EvidenceKind, StrictModel

Modality = Literal[
    "ecg",
    "imaging",
    "labs",
    "symptoms",
    "wearables",
    "fhir",
    "environment",
    "interventions",
    "clinical_text",
    "voice",
]


class Finding(StrictModel):
    kind: EvidenceKind
    value: StrictFloat | StrictStr | None
    unit: str | None = Field(default=None, max_length=80)


class Waveform(StrictModel):
    samples: list[float] = Field(min_length=2, max_length=10000)
    sampling_rate_hz: float = Field(gt=0, le=5000)
    lead: str = Field(default="Unspecified", max_length=40)


class Media(StrictModel):
    kind: Literal["image", "video", "metadata"]
    filename: str = Field(max_length=180)
    mime_type: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=1500)


class Source(StrictModel):
    id: str = Field(min_length=1, max_length=120)
    modality: Modality
    event_at: AwareDatetime
    available_at: AwareDatetime
    provider_mode: Literal["REAL", "SYNTHETIC", "DEMO", "UNAVAILABLE"] = "REAL"
    status: Literal["AVAILABLE", "PROCESSING", "UNAVAILABLE", "FAILED"] = "AVAILABLE"
    provider: str = Field(default="Structured source adapter", max_length=180)
    version: str = Field(default="1.0", max_length=60)
    evidence_refs: list[str] = Field(default_factory=list, max_length=3000)
    observations: list[Finding] = Field(default_factory=list, max_length=100)
    text: str | None = Field(default=None, max_length=12000)
    waveform: Waveform | None = None
    media: Media | None = None
    uncertainties: list[str] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def clocks(self) -> Source:
        if self.available_at < self.event_at:
            raise ValueError("Source availability cannot precede its event")
        if self.provider_mode == "UNAVAILABLE" and self.status == "AVAILABLE":
            raise ValueError("An unavailable provider cannot claim available output")
        return self


class Place(StrictModel):
    id: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=180)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    event_at: AwareDatetime
    available_at: AwareDatetime
    synthetic: bool = False
    evidence_refs: list[str] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def clocks(self) -> Place:
        if self.available_at < self.event_at:
            raise ValueError("Spatial availability cannot precede its event")
        return self


class Facility(Place):
    capabilities: dict[str, Literal["YES", "NO", "UNKNOWN"]] = Field(
        default_factory=dict, max_length=12
    )


class Environment(Place):
    kind: str = Field(max_length=80)
    value: float | str | None = None
    unit: str | None = Field(default=None, max_length=40)


class Spatial(StrictModel):
    consent: bool = False
    location: Place | None = None
    events: list[Place] = Field(default_factory=list, max_length=200)
    facilities: list[Facility] = Field(default_factory=list, max_length=200)
    environment: list[Environment] = Field(default_factory=list, max_length=200)
    radius_km: float = Field(default=15, gt=0, le=100)


class AtlasInput(StrictModel):
    as_of: AwareDatetime
    patient_ref: str = Field(default="Patient/atlas-input", min_length=1, max_length=180)
    demo: bool = False
    evidence: list[Evidence] = Field(default_factory=list, max_length=3000)
    bundle: dict[str, Any] | None = None
    received_at: AwareDatetime | None = None
    modalities: list[Source] = Field(default_factory=list, max_length=100)
    spatial: Spatial | None = None

    @model_validator(mode="after")
    def isolated_demo(self) -> AtlasInput:
        if self.demo and (self.evidence or self.bundle or self.modalities or self.spatial):
            raise ValueError("Demo mode cannot mix with submitted patient evidence")
        return self


class ScenarioRequest(StrictModel):
    input: AtlasInput
    changes: list[Finding] = Field(min_length=1, max_length=12)


class ExplainRequest(StrictModel):
    input: AtlasInput
    question: str = Field(min_length=1, max_length=1000)
    compare_as_of: AwareDatetime | None = None
    use_ai: bool = False
