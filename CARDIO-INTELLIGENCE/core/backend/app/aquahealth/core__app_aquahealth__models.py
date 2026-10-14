"""AquaHealth domain models (Pydantic v2).

Mirrors the layout of `app/models/*.py`: plain Pydantic models, no ORM. The
store (`app/aquahealth/store.py`) owns persistence.

Measurement values are all `float | None` and every qualitative field is a
`Presence`, so an observation from a citizen who only noticed floating waste
is exactly as valid a record as one from a volunteer with a probe kit. The
agents report data quality rather than rejecting sparse records.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.aquahealth.vocab import (
    Confidence,
    DataQuality,
    DataSource,
    EcosystemStatus,
    Presence,
    ReviewDecision,
    ReviewStatus,
    VerificationState,
)


def _now() -> datetime:
    return datetime.now(UTC)


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# =============================================================================
# Waterbody
# =============================================================================


class GeoPoint(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


WaterbodyKind = Literal["stream", "river", "lake", "pond", "canal", "wetland", "other"]


class Waterbody(BaseModel):
    """An urban freshwater feature that citizens report against."""

    id: str = Field(default_factory=lambda: _new_id("wb"))
    organization_id: str
    name: str = Field(..., min_length=1, max_length=200)
    kind: WaterbodyKind = "stream"
    locality: str | None = Field(default=None, max_length=200)
    location: GeoPoint | None = None
    description: str | None = Field(default=None, max_length=1000)
    is_demo: bool = False
    created_at: datetime = Field(default_factory=_now)


# =============================================================================
# Observation
# =============================================================================


class Measurements(BaseModel):
    """Optional instrument readings. Every field may be omitted.

    Ranges are generous physical plausibility bounds, not quality gates. The
    EnvironmentalValidationAgent flags implausible-but-parseable values
    rather than the API rejecting them, so a citizen's typo becomes a
    reviewable data-quality finding instead of a lost observation.
    """

    model_config = ConfigDict(extra="forbid")

    ph: float | None = Field(default=None, ge=0, le=14)
    water_temperature_c: float | None = Field(default=None, ge=-5, le=60)
    turbidity_ntu: float | None = Field(default=None, ge=0, le=5000)
    dissolved_oxygen_mgl: float | None = Field(default=None, ge=0, le=25)

    def present(self) -> dict[str, float]:
        """Only the measurements that were actually supplied."""
        return {k: v for k, v in self.model_dump().items() if v is not None}


class WaterAppearance(BaseModel):
    model_config = ConfigDict(extra="forbid")

    floating_waste: Annotated[Presence, Field(description="Floating waste or litter")] = Presence.NOT_AVAILABLE
    foam: Annotated[Presence, Field(description="Foam or froth")] = Presence.NOT_AVAILABLE
    algae: Annotated[Presence, Field(description="Algal bloom or green scum")] = Presence.NOT_AVAILABLE
    oily_film: Annotated[Presence, Field(description="Oil-like film or sheen")] = Presence.NOT_AVAILABLE
    unusual_colour: Annotated[Presence, Field(description="Unusual water colour")] = Presence.NOT_AVAILABLE
    unusual_odour: Annotated[Presence, Field(description="Unusual or strong odour")] = Presence.NOT_AVAILABLE

    #: Free-text descriptor the citizen picked from a simple list.
    colour_note: str | None = Field(default=None, max_length=120)
    clarity: Literal["clear", "slightly_cloudy", "cloudy", "opaque", "unknown"] = "unknown"


class Biodiversity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fish: Annotated[Presence, Field(description="Fish")] = Presence.NOT_AVAILABLE
    birds: Annotated[Presence, Field(description="Water birds")] = Presence.NOT_AVAILABLE
    insects: Annotated[Presence, Field(description="Insects above the water")] = Presence.NOT_AVAILABLE
    aquatic_plants: Annotated[Presence, Field(description="Aquatic plants")] = Presence.NOT_AVAILABLE
    macroinvertebrates: Annotated[Presence, Field(description="Macroinvertebrates")] = Presence.NOT_AVAILABLE
    dead_organisms: Annotated[Presence, Field(description="Dead fish or other dead organisms")] = Presence.NOT_AVAILABLE
    unusual_organisms: Annotated[Presence, Field(description="Unusual or unfamiliar organisms")] = Presence.NOT_AVAILABLE
    note: str | None = Field(default=None, max_length=500)


class EnvironmentalContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recent_rainfall: Annotated[Presence, Field(description="Heavy rainfall in the last 48h")] = Presence.NOT_AVAILABLE
    flooding: Annotated[Presence, Field(description="Flooding")] = Presence.NOT_AVAILABLE
    drought: Annotated[Presence, Field(description="Drought or unusually low water")] = Presence.NOT_AVAILABLE
    construction: Annotated[Presence, Field(description="Construction work nearby")] = Presence.NOT_AVAILABLE
    waste_accumulation: Annotated[Presence, Field(description="Waste accumulation on the bank")] = Presence.NOT_AVAILABLE
    suspected_discharge: Annotated[Presence, Field(description="Suspected discharge or outflow")] = Presence.NOT_AVAILABLE
    unusual_activity: Annotated[Presence, Field(description="Other unusual human activity")] = Presence.NOT_AVAILABLE
    note: str | None = Field(default=None, max_length=500)


class PhotoAILabel(BaseModel):
    label: str
    confidence: Confidence
    note: str | None = None


class PhotoEvidence(BaseModel):
    """A photo attached to an observation.

    `ai_labels` are AI-assisted candidate labels. They are ALWAYS rendered
    behind the "AI-assisted observation — human verification required"
    disclaimer and never treated as ground truth by the agents: they
    contribute to evidence only after a reviewer confirms them.
    """

    id: str = Field(default_factory=lambda: _new_id("photo"))
    filename: str = Field(..., max_length=260)
    content_type: str = Field(default="image/jpeg", max_length=100)
    size_bytes: int = Field(default=0, ge=0)
    caption: str | None = Field(default=None, max_length=300)
    #: Data URI or object-store key. Demo data carries neither (metadata only).
    uri: str | None = None
    ai_labels: list[PhotoAILabel] = Field(default_factory=list)
    ai_disclaimer: str = "AI-assisted observation — human verification required."
    human_confirmed: bool | None = None
    created_at: datetime = Field(default_factory=_now)


class ObservationCreate(BaseModel):
    """Request body for POST /aquahealth/observations."""

    model_config = ConfigDict(extra="forbid")

    waterbody_id: str | None = Field(
        default=None, description="Existing waterbody; omit to create one inline."
    )
    waterbody_name: str | None = Field(default=None, max_length=200)
    waterbody_kind: WaterbodyKind = "stream"
    locality: str | None = Field(default=None, max_length=200)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    observed_at: datetime | None = Field(default=None, description="Defaults to now when omitted.")
    observer_note: str | None = Field(default=None, max_length=2000)

    appearance: WaterAppearance = Field(default_factory=WaterAppearance)
    biodiversity: Biodiversity = Field(default_factory=Biodiversity)
    context: EnvironmentalContext = Field(default_factory=EnvironmentalContext)
    measurements: Measurements = Field(default_factory=Measurements)
    photos: list[PhotoEvidence] = Field(default_factory=list)

    source: DataSource = DataSource.CITIZEN

    @field_validator("observed_at")
    @classmethod
    def _not_far_future(cls, v: datetime | None) -> datetime | None:
        """Reject impossible timestamps but tolerate clock skew.

        A future date is a data-entry error rather than an observation, so it
        is refused at the edge; 24h of tolerance covers device clock skew and
        timezone confusion without accepting next month's date.
        """
        if v is None:
            return v
        if v.tzinfo is None:
            v = v.replace(tzinfo=UTC)
        if (v - _now()).total_seconds() > 86_400:
            raise ValueError("observed_at is more than 24h in the future")
        return v


# =============================================================================
# Assessment (AI) — explainable by construction
# =============================================================================


class Evidence(BaseModel):
    """One concrete observation that supports a finding.

    Evidence is always traceable to a field the citizen filled in. The agents
    may not invent evidence, and `field` is what the UI links back to on the
    observation record.
    """

    field: str
    label: str
    value: str
    interpretation: str


class AgentFinding(BaseModel):
    """A single explainable finding from one environmental agent.

    This is the explainability contract: a finding carries its evidence, its
    confidence, its data quality and its recommended next step. It never
    carries chain-of-thought.
    """

    agent: str
    finding: str
    evidence: list[Evidence] = Field(default_factory=list)
    confidence: Confidence = Confidence.LOW
    data_quality: DataQuality = DataQuality.LIMITED
    uncertainty: str | None = None
    recommended_next_step: str | None = None


class EarlyWarning(BaseModel):
    """Prototype early-warning signal. Informational, never autonomous."""

    active: bool = False
    headline: str = ""
    reason: str = ""
    confidence: Confidence = Confidence.LOW
    recommended_next_step: str = "Human field verification."
    notice: str = "Informational prototype signal — not a real-time emergency alert."


class EnvironmentalAssessment(BaseModel):
    """Aggregate AI assessment of one observation.

    `status` is the Prototype Ecosystem Observation Status; `status_reason`
    names the observations that produced it so a reviewer can audit the call
    rather than trusting a label.
    """

    id: str = Field(default_factory=lambda: _new_id("assess"))
    observation_id: str
    run_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:16])
    created_at: datetime = Field(default_factory=_now)

    status: EcosystemStatus = EcosystemStatus.INSUFFICIENT_DATA
    status_reason: str = ""
    confidence: Confidence = Confidence.LOW
    data_quality: DataQuality = DataQuality.INSUFFICIENT
    completeness: float = Field(default=0.0, ge=0.0, le=1.0)

    findings: list[AgentFinding] = Field(default_factory=list)
    one_health_note: str | None = None
    early_warning: EarlyWarning | None = None

    human_verification: Literal["required", "reviewed"] = "required"
    disclaimer: str = (
        "Prototype AI-assisted environmental assessment. Not a validated "
        "environmental index and not a public-health determination. "
        "Human verification required."
    )


# =============================================================================
# Human-in-the-loop review
# =============================================================================


class ReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: ReviewDecision
    comment: str | None = Field(default=None, max_length=2000)
    #: Reviewer's corrected status, only honoured when decision == modified.
    corrected_status: EcosystemStatus | None = None
    #: Findings the reviewer explicitly rejected, by agent name.
    rejected_findings: list[str] = Field(default_factory=list)


class HumanReview(BaseModel):
    id: str = Field(default_factory=lambda: _new_id("rev"))
    observation_id: str
    decision: ReviewDecision
    reviewer_id: str
    reviewer_label: str
    comment: str | None = None
    corrected_status: EcosystemStatus | None = None
    rejected_findings: list[str] = Field(default_factory=list)
    reviewed_at: datetime = Field(default_factory=_now)

    @property
    def final_status_override(self) -> EcosystemStatus | None:
        if self.decision == ReviewDecision.MODIFIED:
            return self.corrected_status
        return None


class Observation(BaseModel):
    """A stored citizen/sensor freshwater observation."""

    id: str = Field(default_factory=lambda: _new_id("obs"))
    #: Human-facing identifier, e.g. AQUA-000001. Parallels ClinCase case ids.
    reference: str
    organization_id: str
    waterbody_id: str
    waterbody_name: str
    location: GeoPoint | None = None
    locality: str | None = None

    observed_at: datetime
    created_at: datetime = Field(default_factory=_now)
    observer_id: str | None = None
    observer_label: str | None = None
    observer_note: str | None = None

    appearance: WaterAppearance = Field(default_factory=WaterAppearance)
    biodiversity: Biodiversity = Field(default_factory=Biodiversity)
    context: EnvironmentalContext = Field(default_factory=EnvironmentalContext)
    measurements: Measurements = Field(default_factory=Measurements)
    photos: list[PhotoEvidence] = Field(default_factory=list)

    source: DataSource = DataSource.CITIZEN
    is_demo: bool = False
    verification: VerificationState = VerificationState.UNVERIFIED
    review_status: ReviewStatus = ReviewStatus.PENDING

    assessment: EnvironmentalAssessment | None = None
    review: HumanReview | None = None

    #: Environmental case type — coexists with ClinCase's CLINICAL cases.
    case_type: Literal["ENVIRONMENTAL_OBSERVATION"] = "ENVIRONMENTAL_OBSERVATION"

    @property
    def effective_status(self) -> EcosystemStatus:
        """Status after any reviewer override.

        The reviewer's correction wins over the AI status — that is the point
        of human-in-the-loop. Read this rather than `assessment.status`
        anywhere a status is displayed or aggregated.
        """
        if self.review is not None:
            override = self.review.final_status_override
            if override is not None:
                return override
        if self.assessment is not None:
            return self.assessment.status
        return EcosystemStatus.INSUFFICIENT_DATA


# =============================================================================
# Read models
# =============================================================================


class ObservationSummary(BaseModel):
    """Compact row for lists, the map and trends."""

    id: str
    reference: str
    waterbody_id: str
    waterbody_name: str
    location: GeoPoint | None
    observed_at: datetime
    status: EcosystemStatus
    confidence: Confidence
    data_quality: DataQuality
    source: DataSource
    verification: VerificationState
    review_status: ReviewStatus
    is_demo: bool
    headline: str | None = None


class Badge(BaseModel):
    code: str
    label: str
    description: str
    earned: bool
    progress: int = 0
    target: int = 1


class CommunityStats(BaseModel):
    """Citizen engagement panel. Never feeds the scientific assessment."""

    observations_contributed: int
    waterbodies_explored: int
    reviewed_contributions: int
    community_observers: int
    community_observations: int
    badges: list[Badge]
    note: str = (
        "Participation metrics only — gamification never influences the "
        "environmental assessment."
    )


class DashboardOverview(BaseModel):
    waterbody_count: int
    observation_count: int
    awaiting_review: int
    demo_observation_count: int
    status_distribution: dict[str, int]
    confidence_distribution: dict[str, int]
    data_quality_distribution: dict[str, int]
    source_distribution: dict[str, int]
    recent: list[ObservationSummary]
    active_warnings: list[ObservationSummary]
