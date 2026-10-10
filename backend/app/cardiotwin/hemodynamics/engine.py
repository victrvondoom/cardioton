"""Versioned, deterministic reconstruction of evidence-supported hemodynamic proxies.

The thresholds below are transparent research heuristics, not validated clinical
cutoffs, diagnostic rules, predictions or prescribing advice. Event time and
knowledge time are both enforced before deduplication, interpretation and replay.
"""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any

from app.cardiotwin.hemodynamics.schema import Evidence

ENGINE_VERSION = "cardio-hemo-research-1.0"
RESEARCH_LABEL = "Research / clinical-support inference"
SAFETY_NOTICE = (
    "Deterministic research heuristics, not a medically validated diagnosis or prediction. "
    "Clinician review is required. Temporal associations do not establish causality; "
    "the twin cannot prescribe, approve a clinical state or change patient records."
)
AXES = (
    "pump_function",
    "volume_status",
    "filling_pressure_proxy",
    "rhythm_stability",
    "vascular_load",
    "renal_interaction",
    "respiratory_interaction",
    "functional_capacity",
)
# Bounded, versioned evidence windows. All values remain visible as observed
# evidence after expiry, but stale values do not silently describe current state.
RECENT_DAYS = 14
ECHO_DAYS = 90
TREND_DAYS = 14
UNITS: dict[str, set[str]] = {
    "weight": {"kg"},
    "lvef": {"%"},
    "heart_rate": {"bpm", "/min", "{beats}/min"},
    "systolic_bp": {"mmhg", "mm[hg]"},
    "diastolic_bp": {"mmhg", "mm[hg]"},
    "spo2": {"%"},
    "oxygen_requirement": {"l/min"},
    "bnp": {"pg/ml", "ng/l"},
    "ntprobnp": {"pg/ml", "ng/l"},
    "creatinine": {"mg/dl"},
    "egfr": {"ml/min/1.73m2", "ml/min/{1.73_m2}"},
    "sodium": {"mmol/l", "meq/l"},
    "potassium": {"mmol/l", "meq/l"},
    "functional_capacity": {"m"},
}
LIMITS: dict[str, tuple[float, float]] = {
    "weight": (1, 500),
    "lvef": (0, 100),
    "heart_rate": (10, 350),
    "systolic_bp": (30, 350),
    "diastolic_bp": (10, 250),
    "spo2": (0, 100),
    "oxygen_requirement": (0, 100),
    "bnp": (0, 1_000_000),
    "ntprobnp": (0, 1_000_000),
    "creatinine": (0.01, 50),
    "egfr": (0, 250),
    "sodium": (80, 220),
    "potassium": (1, 12),
    "functional_capacity": (0, 2000),
}


def _iso(at: datetime) -> str:
    return at.astimezone(UTC).isoformat()


def _hash(value: Any) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()
    ).hexdigest()


def _refs(items: list[Evidence]) -> list[str]:
    return sorted({item.id for item in items})


def _issue(code: str, refs: list[str], message: str) -> dict[str, Any]:
    return {"code": code, "evidence_refs": sorted(set(refs)), "message": message}


def _numeric_valid(item: Evidence) -> bool:
    """The same quantity contract applies to state AND response derivations."""
    if not isinstance(item.value, float) or item.kind not in LIMITS:
        return False
    unit = (item.unit or "").lower().replace(" ", "")
    low, high = LIMITS[item.kind]
    return unit in UNITS[item.kind] and low <= item.value <= high


def _documented_intervention(item: Evidence) -> bool:
    return (
        item.kind == "diuretic_change"
        and isinstance(item.value, str)
        and item.value.lower()
        in {
            "documented_change",
            "changed",
            "escalated",
            "increased",
            "started",
            "reduced",
            "stopped",
        }
    )


def _unconflicted_latest(candidates: list[Evidence]) -> Evidence | None:
    if not candidates:
        return None
    last = max(candidates, key=lambda e: (e.event_at, e.available_at, e.id))
    current = [e for e in candidates if e.event_at == last.event_at]
    if len({(e.value, (e.unit or "").lower().replace(" ", "")) for e in current}) > 1:
        return None
    return last


def _intervention_pair(
    items: list[Evidence], intervention: Evidence, as_of: datetime, kind: str
) -> tuple[Evidence | None, Evidence | None]:
    """Comparable pre/post records, bounded and known at their respective times."""
    before = [
        e
        for e in items
        if e.kind == kind
        and e.event_at <= intervention.event_at
        and e.available_at <= intervention.available_at
        and intervention.event_at - e.event_at <= timedelta(days=TREND_DAYS)
    ]
    after = [
        e
        for e in items
        if e.kind == kind
        and e.event_at > intervention.event_at
        and e.event_at <= as_of
        and e.available_at <= as_of
        and e.event_at - intervention.event_at <= timedelta(days=TREND_DAYS)
        and as_of - e.event_at <= timedelta(days=RECENT_DAYS)
    ]
    return _unconflicted_latest(before), _unconflicted_latest(after)


def _prepare(
    evidence: list[Evidence], as_of: datetime, patient_ref: str
) -> tuple[list[Evidence], list[dict[str, Any]]]:
    # CRITICAL: filter before inspecting conflicts, duplicate counts or issues.
    # A future version of an old record must not affect ANY historical output.
    eligible = [
        e
        for e in evidence
        if e.patient_ref == patient_ref and e.event_at <= as_of and e.available_at <= as_of
    ]
    grouped: dict[str, dict[str, Evidence]] = defaultdict(dict)
    for item in eligible:
        grouped[item.id][_hash(item.model_dump(mode="json"))] = item
    issues: list[dict[str, Any]] = []
    known = []
    for evidence_id in sorted(grouped):
        versions = grouped[evidence_id]
        if len(versions) > 1:
            # An ID must resolve to one original record in every WHY view.
            # Failing closed preserves that invariant and never picks a version.
            raise ValueError(
                "Conflicting versions share an evidence ID; reconstruction was rejected"
            )
        else:
            known.append(next(iter(versions.values())))
    # Same source fact re-imported with a different ID is not an independent
    # corroborating modality. Keep a deterministic representative.
    dedup: dict[str, Evidence] = {}
    for item in sorted(known, key=lambda e: e.id):
        key = _hash(
            {
                "source_ref": item.source_ref,
                "kind": item.kind,
                "event_at": _iso(item.event_at),
                "available_at": _iso(item.available_at),
                "value": item.value,
                "unit": item.unit,
                "original_record": item.original_record,
            }
        )
        dedup.setdefault(key, item)
    return sorted(dedup.values(), key=lambda e: (e.available_at, e.event_at, e.id)), issues


def _state(
    level: str = "UNKNOWN",
    explanation: str = "No recent supporting evidence.",
    items: list[Evidence] | None = None,
    confidence: str = "LOW",
    uncertainties: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "level": level,
        "classification": "UNKNOWN" if level == "UNKNOWN" else "INFERRED",
        "confidence": confidence if level != "UNKNOWN" else "LOW",
        "evidence_refs": _refs(items or []),
        "explanation": explanation,
        "uncertainties": uncertainties or ([] if level != "UNKNOWN" else [explanation]),
    }


def _severity(item: Evidence | None) -> int | None:
    if item is None or item.value is None:
        return None
    if isinstance(item.value, float):
        return int(item.value) if item.value in (0, 1, 2, 3) else None
    value = item.value.lower().replace("_", " ").strip()
    if value in {
        "none",
        "absent",
        "no",
        "normal",
        "stable",
        "asymptomatic",
        "unlimited",
        "preserved",
    }:
        return 0
    if value in {"present", "yes", "mild", "new", "limited", "reduced", "worsening"}:
        return 1
    if value in {"moderate", "increased", "marked", "very limited"}:
        return 2
    if value in {"severe", "at rest", "unable"}:
        return 3
    return None


def _compute(
    known: list[Evidence], at: datetime
) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    items = [e for e in known if e.available_at <= at and e.event_at <= at]
    by_kind: dict[str, list[Evidence]] = defaultdict(list)
    for item in items:
        by_kind[item.kind].append(item)
    issues: list[dict[str, Any]] = []
    derived: list[dict[str, Any]] = []
    conflicts: set[str] = set()

    def recent(kind: str, days: int = RECENT_DAYS) -> list[Evidence]:
        return sorted(
            [e for e in by_kind[kind] if at - e.event_at <= timedelta(days=days)],
            key=lambda e: (e.event_at, e.available_at, e.id),
        )

    def latest(kind: str, days: int = RECENT_DAYS) -> Evidence | None:
        candidates = recent(kind, days)
        if not candidates:
            return None
        current = [e for e in candidates if e.event_at == candidates[-1].event_at]
        values = {(e.value, (e.unit or "").lower()) for e in current}
        if len(values) > 1:
            conflicts.add(kind)
            issues.append(
                _issue(
                    "CONTRADICTORY_OBSERVATIONS",
                    _refs(current),
                    f"Conflicting {kind.replace('_', ' ')} observations share an event timestamp; the value remains UNKNOWN.",
                )
            )
            return None
        return current[-1]

    def number(item: Evidence | None) -> float | None:
        if item is None or not isinstance(item.value, float):
            return None
        unit = (item.unit or "").lower().replace(" ", "")
        if unit not in UNITS.get(item.kind, set()):
            issues.append(
                _issue(
                    "UNSUPPORTED_OR_MISSING_UNIT",
                    [item.id],
                    f"{item.kind.replace('_', ' ')} was retained but not interpreted without a supported unit.",
                )
            )
            return None
        low, high = LIMITS[item.kind]
        if not low <= item.value <= high:
            issues.append(
                _issue(
                    "OUT_OF_RANGE_VALUE",
                    [item.id],
                    f"{item.kind.replace('_', ' ')} is outside this research engine's input bounds and was not interpreted.",
                )
            )
            return None
        return item.value

    def trend(kind: str) -> tuple[float | None, list[Evidence], float | None]:
        latest_item = latest(kind, TREND_DAYS)
        current = number(latest_item)
        if current is None or latest_item is None:
            return None, [], None
        earlier = [e for e in recent(kind, TREND_DAYS) if e.event_at < latest_item.event_at]
        if not earlier:
            return None, [latest_item], None
        earliest_time = earlier[0].event_at
        baseline_items = [e for e in earlier if e.event_at == earliest_time]
        if len({(e.value, e.unit) for e in baseline_items}) > 1:
            conflicts.add(kind)
            issues.append(
                _issue(
                    "CONTRADICTORY_BASELINE",
                    _refs(baseline_items),
                    f"Conflicting {kind} baseline; trend remains UNKNOWN.",
                )
            )
            return None, [latest_item], None
        baseline = baseline_items[0]
        initial = number(baseline)
        if initial is None:
            return None, [latest_item], None
        delta = round(current - initial, 6)
        percent = round(delta / initial * 100, 3) if initial else None
        operands = [baseline, latest_item]
        derived.append(
            {
                "id": f"{kind}-delta-{baseline.id}-{latest_item.id}",
                "kind": f"{kind}_change",
                "classification": "DERIVED",
                "value": delta,
                "unit": latest_item.unit,
                "percent_change": percent,
                "timestamp": _iso(at),
                "evidence_refs": _refs(operands),
                "transformation": "latest value minus earliest unconflicted value in the 14-day evidence window",
                "baseline": initial,
                "latest": current,
                "window_days": round(
                    (latest_item.event_at - baseline.event_at).total_seconds() / 86400, 3
                ),
            }
        )
        return delta, operands, percent

    axes = {name: _state() for name in AXES}
    uncertainties: list[str] = []
    signals: dict[str, list[Evidence]] = {}
    weight_delta, weight_refs, _ = trend("weight")
    if weight_delta is not None and weight_delta >= 1:
        signals["weight"] = weight_refs
    edema, dyspnea = latest("edema"), latest("dyspnea")
    edema_level, dyspnea_level = _severity(edema), _severity(dyspnea)
    if edema is not None and edema_level is not None and edema_level > 0:
        signals["edema"] = [edema]
    if dyspnea is not None and dyspnea_level is not None and dyspnea_level > 0:
        signals["dyspnea"] = [dyspnea]
    for kind, threshold in (("bnp", 100), ("ntprobnp", 300)):
        marker = latest(kind)
        marker_value = number(marker)
        _, operands, percent = trend(kind)
        if marker is not None and marker_value is not None:
            if percent is not None and percent >= 20:
                signals[kind] = operands
            elif marker_value >= threshold:
                signals[kind] = [marker]
        else:
            uncertainties.append(
                f"{kind.upper() if kind == 'bnp' else 'NT-proBNP'} = UNKNOWN; no usable recent measurement."
            )
    # BNP and NT-proBNP are kept distinct, but together count as one natriuretic
    # peptide modality; correlated markers must not inflate corroboration.
    oxygen, saturation = latest("oxygen_requirement"), latest("spo2")
    oxygen_value, saturation_value = number(oxygen), number(saturation)
    respiratory_signals: list[Evidence] = []
    if oxygen is not None and oxygen_value is not None and oxygen_value > 0:
        respiratory_signals.append(oxygen)
    if saturation is not None and saturation_value is not None and saturation_value < 94:
        respiratory_signals.append(saturation)
    if respiratory_signals:
        signals["respiratory"] = respiratory_signals
    modalities = set(signals)
    if "bnp" in modalities and "ntprobnp" in modalities:
        modalities.remove("ntprobnp")
    score = len(modalities)
    signal_items = [e for refs in signals.values() for e in refs]
    negative_volume = [
        e
        for e, severity in ((edema, edema_level), (dyspnea, dyspnea_level))
        if e is not None and severity == 0
    ]
    stable_weight = weight_delta is not None and abs(weight_delta) < 1
    conflict_notes = [
        f"Evidence window contains conflicting {kind.replace('_', ' ')} observations."
        for kind in sorted(conflicts)
    ]
    support_confidence = "HIGH" if score >= 3 else "MODERATE" if score >= 2 else "LOW"
    if conflicts:
        support_confidence = "LOW"
    if score:
        signal_names = ", ".join(sorted(name.replace("_", " ") for name in signals))
        axes["volume_status"] = _state(
            "HIGH" if score >= 3 else "ELEVATED",
            f"Evidence is consistent with a possible worsening congestion trajectory ({signal_names}). These are proxies, not measured volume.",
            signal_items,
            support_confidence,
            conflict_notes,
        )
    elif negative_volume and (stable_weight or len(negative_volume) >= 2) and not conflicts:
        axes["volume_status"] = _state(
            "NORMAL",
            "Available negative symptom evidence supports a stable volume-status proxy; it does not exclude congestion.",
            negative_volume + (weight_refs if stable_weight else []),
            "MODERATE",
        )
    elif "weight" in conflicts or "edema" in conflicts:
        axes["volume_status"] = _state(
            explanation="Volume status is uncertain because observations conflict.",
            uncertainties=conflict_notes,
        )
    if score >= 2:
        axes["filling_pressure_proxy"] = _state(
            "HIGH" if score >= 3 else "ELEVATED",
            "Multiple observations are compatible with rising filling-pressure suspicion. Filling pressure was not directly measured.",
            signal_items,
            support_confidence,
            ["No direct filling-pressure measurement."] + conflict_notes,
        )
    else:
        axes["filling_pressure_proxy"] = _state(
            explanation="Insufficient independent evidence to infer a filling-pressure proxy."
        )

    echo = latest("lvef", ECHO_DAYS)
    ef = number(echo)
    if echo is not None and ef is not None:
        axes["pump_function"] = _state(
            "LOW" if ef < 50 else "NORMAL",
            f"Observed LVEF {ef:g}% supports a {'reduced' if ef < 50 else 'preserved'} systolic-function proxy; this does not measure complete pump function.",
            [echo],
            "MODERATE",
            ["LVEF alone does not describe complete hemodynamic function."],
        )
    else:
        axes["pump_function"] = _state(
            explanation="No recent echocardiogram with usable LVEF (90-day research window)."
        )
    rhythm = latest("rhythm")
    if rhythm is not None and isinstance(rhythm.value, str):
        observed_rhythm = rhythm.value.lower().replace("_", " ")
        if observed_rhythm in {"sinus", "sinus rhythm", "normal sinus rhythm", "stable"}:
            axes["rhythm_stability"] = _state(
                "NORMAL",
                "Documented rhythm supports a stable rhythm proxy at the observation time.",
                [rhythm],
                "MODERATE",
                ["A single rhythm observation does not establish continuous rhythm stability."],
            )
        elif observed_rhythm in {
            "atrial fibrillation",
            "af",
            "afib",
            "irregular",
            "unstable",
            "atrial flutter",
            "tachyarrhythmia",
            "ventricular tachycardia",
        }:
            axes["rhythm_stability"] = _state(
                "ELEVATED",
                "Documented rhythm irregularity supports an instability signal; no new rhythm diagnosis is made.",
                [rhythm],
                "MODERATE",
            )
        else:
            axes["rhythm_stability"] = _state(
                explanation="Rhythm description is not mapped by the deterministic rules."
            )
    else:
        axes["rhythm_stability"] = _state(
            explanation="Rhythm status uncertain; heart rate alone cannot establish rhythm stability."
        )
    sbp, dbp = latest("systolic_bp"), latest("diastolic_bp")
    sbp_value, dbp_value = number(sbp), number(dbp)
    bp_items = [
        e
        for e, value in ((sbp, sbp_value), (dbp, dbp_value))
        if e is not None and value is not None
    ]
    if bp_items:
        high_bp = (sbp_value is not None and sbp_value >= 140) or (
            dbp_value is not None and dbp_value >= 90
        )
        low_bp = (sbp_value is not None and sbp_value < 90) or (
            dbp_value is not None and dbp_value < 60
        )
        axes["vascular_load"] = _state(
            "UNKNOWN"
            if high_bp and low_bp
            else "ELEVATED"
            if high_bp
            else "LOW"
            if low_bp
            else "NORMAL",
            "Blood-pressure observations describe a vascular-load proxy; vascular resistance was not measured.",
            bp_items,
            "MODERATE",
        )
    elif "systolic_bp" in conflicts or "diastolic_bp" in conflicts:
        axes["vascular_load"] = _state(
            explanation="Conflicting blood-pressure observations; vascular load is UNKNOWN."
        )

    creatinine_delta, creatinine_refs, creatinine_percent = trend("creatinine")
    egfr_delta, egfr_refs, egfr_percent = trend("egfr")
    renal_changed = (
        creatinine_delta is not None
        and (creatinine_delta >= 0.3 or (creatinine_percent or 0) >= 25)
    ) or (egfr_delta is not None and (egfr_percent or 0) <= -20)
    renal_items = creatinine_refs + egfr_refs
    if renal_changed:
        axes["renal_interaction"] = _state(
            "ELEVATED",
            "Renal markers changed during this evidence window. Any concurrence with congestion is a temporal association; cause is not established.",
            renal_items + signal_items,
            "MODERATE" if score and not conflicts else "LOW",
            [
                "Renal markers cannot establish whether cardiac state or an intervention caused the change."
            ],
        )
    elif creatinine_delta is not None or egfr_delta is not None:
        axes["renal_interaction"] = _state(
            "NORMAL",
            "Available serial renal markers show no worsening signal under these research rules; renal interaction remains observational.",
            renal_items,
            "MODERATE",
        )
    else:
        axes["renal_interaction"] = _state(
            explanation="Renal interaction confidence reduced: comparable serial renal markers are missing."
        )
    respiratory_items = respiratory_signals + (
        [dyspnea] if dyspnea and dyspnea_level and dyspnea_level > 0 else []
    )
    if respiratory_items:
        axes["respiratory_interaction"] = _state(
            "ELEVATED",
            "Symptoms, oxygen support or oxygen saturation support a respiratory-burden proxy; this does not establish a cardiac cause.",
            respiratory_items,
            "MODERATE" if len(respiratory_items) >= 2 else "LOW",
        )
    elif saturation is not None and saturation_value is not None and saturation_value >= 94:
        axes["respiratory_interaction"] = _state(
            "NORMAL",
            "Observed oxygen saturation supports a preserved oxygenation proxy at that time.",
            [saturation],
            "MODERATE",
        )
    elif dyspnea is not None and dyspnea_level == 0:
        axes["respiratory_interaction"] = _state(
            "NORMAL",
            "Dyspnea was explicitly absent; no respiratory inference beyond that symptom proxy.",
            [dyspnea],
            "LOW",
        )
    capacity = latest("functional_capacity")
    if capacity is not None and isinstance(capacity.value, str):
        capacity_level = _severity(capacity)
        if capacity_level is not None:
            axes["functional_capacity"] = _state(
                "NORMAL" if capacity_level == 0 else "LOW",
                "Documented exercise tolerance supports a functional-capacity proxy.",
                [capacity],
                "MODERATE",
            )
    elif capacity is not None:
        capacity_delta, capacity_refs, capacity_percent = trend("functional_capacity")
        if capacity_delta is not None:
            axes["functional_capacity"] = _state(
                "LOW" if (capacity_percent or 0) <= -10 else "NORMAL",
                "Serial walking-distance observations support a functional-capacity trend; test conditions may differ.",
                capacity_refs,
                "MODERATE",
                ["Comparability of walking-test conditions requires clinician review."],
            )
    # Electrolytes and heart rate are relevant observed context, but they do not
    # silently become renal diagnoses, rhythm diagnoses or congestion criteria.
    for kind in ("sodium", "potassium", "heart_rate"):
        number(latest(kind))

    stage = (
        "HIGH_CONCERN"
        if score >= 3
        else "INCREASING_CONCERN"
        if score == 2
        else "MILD_SIGNAL"
        if score == 1
        else "STABLE"
        if axes["volume_status"]["level"] == "NORMAL"
        else "UNKNOWN"
    )
    interventions = [e for e in items if _documented_intervention(e)]
    intervention = (
        max(interventions, key=lambda e: (e.available_at, e.event_at, e.id))
        if interventions
        else None
    )
    if intervention and signal_items:
        before_item, after_item = _intervention_pair(items, intervention, at, "weight")
        if at - intervention.available_at <= timedelta(days=1) and after_item is None:
            stage = "INTERVENTION"
        else:
            before_value, after_value = number(before_item), number(after_item)
            if (
                before_value is not None
                and after_value is not None
                and after_value <= before_value - 1
            ):
                stage = "IMPROVING"
            elif after_item and score >= 2:
                stage = "PERSISTENT_INSTABILITY"
    elif intervention and negative_volume and at > intervention.available_at:
        before_item, after_item = _intervention_pair(items, intervention, at, "weight")
        if before_item and after_item:
            before_value = number(before_item)
            after_value = number(after_item)
            if before_value is not None and after_value is not None and after_value < before_value:
                stage = "IMPROVING"
    stage_refs = signal_items + (
        [intervention]
        if intervention and stage in {"INTERVENTION", "IMPROVING", "PERSISTENT_INSTABILITY"}
        else []
    )
    if stage == "STABLE":
        stage_refs = negative_volume + (weight_refs if stable_weight else [])
    if stage == "IMPROVING":
        # The recovery interpretation must retain the pre/post operands, not
        # just an intervention and residual congestion observations.
        stage_refs += [
            e
            for e in items
            if e.kind in {"weight", "edema", "dyspnea"}
            and intervention
            and at - e.event_at <= timedelta(days=TREND_DAYS)
        ]
    explanation = {
        "UNKNOWN": "Insufficient or conflicting evidence to reconstruct a congestion trajectory.",
        "STABLE": "Available negative findings support a stable research congestion proxy.",
        "MILD_SIGNAL": "One evidence modality is compatible with an early congestion signal; corroboration is limited.",
        "INCREASING_CONCERN": "Multiple evidence modalities are consistent with a possible worsening congestion trajectory.",
        "HIGH_CONCERN": "Converging evidence supports high research concern for a possible congestion trajectory; this is not a diagnosis or validated prediction.",
        "INTERVENTION": "A documented diuretic change occurred after a congestion signal; the earlier concern remains and sufficient post-intervention response evidence is not yet available. No treatment recommendation or efficacy claim is made.",
        "IMPROVING": "Post-intervention observations show a lower weight signal. This is an observed temporal association, not proof of a treatment effect.",
        "PERSISTENT_INSTABILITY": "Congestion-compatible observations remain after an intervention; persistent instability requires clinician review.",
    }[stage]
    # UNKNOWN remains inspectable: link stale/conflicting/unsupported source
    # records instead of presenting an empty WHY view for a known evidence gap.
    source_kinds = {
        "pump_function": {"lvef"},
        "volume_status": {"weight", "edema", "dyspnea", "bnp", "ntprobnp"},
        "filling_pressure_proxy": {"weight", "edema", "dyspnea", "bnp", "ntprobnp"},
        "rhythm_stability": {"rhythm"},
        "vascular_load": {"systolic_bp", "diastolic_bp"},
        "renal_interaction": {"creatinine", "egfr"},
        "respiratory_interaction": {"spo2", "oxygen_requirement", "dyspnea"},
        "functional_capacity": {"functional_capacity"},
    }
    for axis, kinds in source_kinds.items():
        if axes[axis]["level"] != "UNKNOWN":
            continue
        relevant = [e for e in items if e.kind in kinds]
        if not relevant:
            continue
        axes[axis]["evidence_refs"] = _refs(relevant)
        latest_source = max(relevant, key=lambda e: e.event_at)
        age = round((at - latest_source.event_at).total_seconds() / 86400, 1)
        window = ECHO_DAYS if axis == "pump_function" else RECENT_DAYS
        if age > window:
            note = f"Most recent {latest_source.kind.replace('_', ' ')} source is {age:g} days old; outside the {window}-day research window."
            axes[axis]["uncertainties"].append(note)
    uncertainties.extend(note for axis in axes.values() for note in axis["uncertainties"])
    uncertainties.extend(conflict_notes)
    available_axes = sum(axis["level"] != "UNKNOWN" for axis in axes.values())
    overall_confidence = (
        "LOW"
        if available_axes < 4 or conflicts
        else "HIGH"
        if available_axes >= 7 and score >= 3
        else "MODERATE"
    )
    if available_axes < 4:
        uncertainties.append("Limited confidence due to sparse recent evidence.")
    snapshot = {
        "timestamp": _iso(at),
        **axes,
        "confidence": overall_confidence,
        "confidence_details": {
            "known_axes": available_axes,
            "total_axes": len(AXES),
            "congestion_modalities": sorted(modalities),
            "conflicting_kinds": sorted(conflicts),
            "unknown_axes": [axis for axis in AXES if axes[axis]["level"] == "UNKNOWN"],
            "meaning": "Coverage, freshness and corroboration under research rules; not diagnostic probability.",
        },
        "evidence_refs": sorted(
            {ref for axis in axes.values() for ref in axis["evidence_refs"]}
            | set(_refs(stage_refs))
        ),
        "uncertainties": sorted(set(uncertainties)),
        "congestion": {
            "stage": stage,
            "confidence": "LOW" if stage == "UNKNOWN" else support_confidence,
            "evidence_refs": _refs(stage_refs),
            "explanation": explanation,
        },
    }
    return snapshot, derived, issues


def _responses(known: list[Evidence], as_of: datetime) -> list[dict[str, Any]]:
    responses: list[dict[str, Any]] = []
    for intervention in [e for e in known if _documented_intervention(e)]:
        changes: list[dict[str, Any]] = []
        for kind in (
            "weight",
            "edema",
            "dyspnea",
            "creatinine",
            "egfr",
            "oxygen_requirement",
            "functional_capacity",
        ):
            pre, post = _intervention_pair(known, intervention, as_of, kind)
            if pre is None or post is None:
                continue
            numeric_pair = isinstance(post.value, float) and isinstance(pre.value, float)
            comparable = numeric_pair and _numeric_valid(pre) and _numeric_valid(post)
            if comparable and (pre.unit or "").lower() != (post.unit or "").lower():
                comparable = False
            delta = (
                round(float(post.value) - float(pre.value), 6)
                if comparable and pre.value is not None and post.value is not None
                else None
            )
            unusable = numeric_pair and not comparable
            changes.append(
                {
                    "kind": kind,
                    "before": pre.value,
                    "after": post.value,
                    "unit": post.unit,
                    "delta": delta,
                    "classification": "UNKNOWN"
                    if unusable
                    else "DERIVED"
                    if delta is not None
                    else "OBSERVED",
                    "before_at": _iso(pre.event_at),
                    "after_at": _iso(post.event_at),
                    "evidence_refs": [pre.id, post.id],
                    "transformation": "No derivation: unusable or incompatible quantitative operands"
                    if unusable
                    else "post-intervention observation compared with last observation known before the intervention",
                    "uncertainties": [
                        "Response remains UNKNOWN because units or numerical bounds are unsupported."
                    ]
                    if unusable
                    else [],
                }
            )
        responses.append(
            {
                "intervention_ref": intervention.id,
                "timestamp": _iso(intervention.available_at),
                "label": "What changed after the intervention?",
                "changes": changes,
                "evidence_refs": sorted(
                    {intervention.id}
                    | {ref for change in changes for ref in change["evidence_refs"]}
                ),
                "interpretation": "Observed temporal association only; no medication effect or causal relationship is established.",
                "status": "OBSERVATIONS_AVAILABLE"
                if changes
                else "POST_INTERVENTION_EVIDENCE_UNKNOWN",
                "review_required": True,
            }
        )
    return responses


def evaluate_state(evidence: list[Evidence], as_of: datetime, patient_ref: str) -> dict[str, Any]:
    """The same deterministic rules without building the full replay timeline."""
    if as_of.tzinfo is None or as_of.utcoffset() is None:
        raise ValueError("State evaluation requires a timezone-aware timestamp")
    known, _ = _prepare(evidence, as_of, patient_ref)
    return _compute(known, as_of)[0]


def reconstruct(evidence: list[Evidence], as_of: datetime, patient_ref: str) -> dict[str, Any]:
    """Pure as-of reconstruction; no persistence, provider, clock or network calls.

    Replay payloads contain only versions available at or before the cutoff.
    Timeline points are knowledge timestamps so delayed records cannot rewrite
    what the system knew on an earlier day.
    """
    if as_of.tzinfo is None or as_of.utcoffset() is None:
        raise ValueError("As-of reconstruction requires a timezone-aware timestamp")
    known, preparation_issues = _prepare(evidence, as_of, patient_ref)
    timeline = []
    transitions = []
    previous: dict[str, Any] | None = None
    cutoffs = sorted({e.available_at for e in known} | {as_of})
    for cutoff in cutoffs:
        # Identity conflicts already fail closed above. Deduplication includes
        # both timestamps, so it cannot replace an earlier available version.
        # _compute gates both times for each cutoff; avoid repeatedly hashing
        # every original record while building a long historical timeline.
        state, _, _ = _compute(known, cutoff)
        timeline.append(state)
        if previous is not None:
            for axis in (*AXES, "congestion"):
                key = "stage" if axis == "congestion" else "level"
                before, after = previous[axis][key], state[axis][key]
                if before == after:
                    continue
                refs = sorted(set(previous[axis]["evidence_refs"] + state[axis]["evidence_refs"]))
                body = {
                    "timestamp": _iso(cutoff),
                    "axis": axis,
                    "from_level": before,
                    "to_level": after,
                    "evidence_refs": refs,
                    "explanation": state[axis]["explanation"],
                    "confidence": state[axis]["confidence"],
                    "review_required": True,
                }
                transitions.append({"id": "transition-" + _hash(body)[:20], **body})
        previous = state
    snapshot, derived, computation_issues = _compute(known, as_of)
    issues = preparation_issues + computation_issues
    unique_issues = {json.dumps(issue, sort_keys=True): issue for issue in issues}
    if preparation_issues:
        snapshot["confidence"] = "LOW"
        snapshot["uncertainties"] = sorted(
            set(
                snapshot["uncertainties"]
                + ["Conflicting evidence versions were quarantined; confidence is reduced."]
            )
        )
        timeline[-1] = snapshot
    return {
        "engine_version": ENGINE_VERSION,
        "as_of": _iso(as_of),
        "patient_ref": patient_ref,
        "safety_notice": SAFETY_NOTICE,
        "research_label": RESEARCH_LABEL,
        "review": {"status": "REQUIRED", "clinical_approval": False},
        "snapshot": snapshot,
        "timeline": timeline,
        "transitions": transitions,
        "evidence": [e.model_dump(mode="json") for e in known],
        "issues": [unique_issues[key] for key in sorted(unique_issues)],
        "derived_measures": derived,
        "intervention_responses": _responses(known, as_of),
        "rules": {
            "version": ENGINE_VERSION,
            "recent_days": RECENT_DAYS,
            "echo_days": ECHO_DAYS,
            "trend_days": TREND_DAYS,
            "validated_clinical_model": False,
            "congestion": "Independent modalities: weight rise >=1 kg, positive edema/dyspnea, BNP >=100 pg/mL or NT-proBNP >=300 pg/mL or >=20% rise, oxygen >0 L/min or SpO2 <94%. BNP and NT-proBNP count as one modality.",
            "confidence": "Evidence completeness and independent corroboration only; not diagnostic probability.",
            "temporal_integrity": "Both event_at and available_at <= cutoff; availability timestamps drive historical state changes.",
            "intervention_response": "Known pre-intervention and as-of post-intervention evidence within 14 days; conflicting operands, unsupported units and out-of-bounds measurements cannot produce numerical changes. INTERVENTION is shown for at most 24 hours while comparable post-intervention weight evidence is absent; preceding concern is retained.",
            "supported_units": {kind: sorted(units) for kind, units in sorted(UNITS.items())},
            "numerical_bounds": {kind: list(bounds) for kind, bounds in sorted(LIMITS.items())},
        },
    }
