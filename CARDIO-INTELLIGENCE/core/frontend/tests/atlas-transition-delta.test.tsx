import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AtlasTransitionDelta from "../src/cardiotwin/atlas/AtlasTransitionDelta";
import type { AtlasResult } from "../src/cardiotwin/atlas/core__cardiotwin_atlas__types";
import { transitionWhy } from "../src/cardiotwin/HemoPanels";
import { HEMO_AXES, type HemoAxis, type HemoEvidence, type HemoSnapshot, type HemoTransition } from "../src/cardiotwin/hemoTypes";

afterEach(cleanup);
const at = (day: number) => `2026-08-0${day}T12:00:00Z`;
const evidence = (id: string, day: number, kind = "weight"): HemoEvidence => ({
  id, patient_ref: "Patient/synthetic-delta", kind, value: 72, unit: "kg", event_at: at(day), available_at: at(day),
  source_ref: `Observation/${id}`, original_record: { synthetic: true }, provenance: {}, classification: "OBSERVED",
});
function snapshot(day: number, refs: string[], level: HemoAxis["level"], confidence: HemoAxis["confidence"]): HemoSnapshot {
  const axis: HemoAxis = { level, confidence, classification: "INFERRED", evidence_refs: refs, explanation: "Synthetic evidence support", uncertainties: [] };
  return { ...Object.fromEntries(HEMO_AXES.map(([key]) => [key, { ...axis }])), timestamp: at(day), evidence_refs: refs,
    confidence, uncertainties: [], congestion: { stage: day === 1 ? "STABLE" : "MILD_SIGNAL", confidence, evidence_refs: refs, explanation: "Synthetic congestion proxy" },
  } as HemoSnapshot;
}
function fixture(): { result: AtlasResult; transition: HemoTransition } {
  const previous = snapshot(1, ["retained", "older-edema"], "NORMAL", "LOW");
  const current = snapshot(3, ["retained", "new-weight", "new-edema", "unresolved", "future-finding"], "ELEVATED", "MODERATE");
  const transition: HemoTransition = { id: "transition-test", timestamp: at(3), axis: "volume_status", from_level: "NORMAL", to_level: "ELEVATED",
    evidence_refs: ["retained", "older-edema", "new-weight", "new-edema"], explanation: "Available evidence is compatible with a change.", confidence: "MODERATE", review_required: true };
  const result: AtlasResult = { as_of: at(4), twin: { engine_version: "test", as_of: at(4), patient_ref: "Patient/synthetic-delta", safety_notice: "Research only",
    research_label: "Synthetic", review: { status: "REQUIRED", clinical_approval: false }, snapshot: current, timeline: [current, previous], transitions: [transition],
    evidence: [evidence("retained", 1), evidence("older-edema", 1, "edema"), evidence("new-weight", 3), evidence("new-edema", 3, "edema"), evidence("future-finding", 5)],
    issues: [], derived_measures: [], intervention_responses: [], }, evidence_graph: { nodes: [], edges: [] }, modalities: [],
    spatial: { location: null, events: [], facilities: [], environment: [], context_only: true, synthetic: true }, review: { status: "REQUIRED", clinical_approval: false } };
  return { result, transition };
}

describe("Atlas historical transition evidence comparison", () => {
  it("shows historical confidence and traces added/removed support without future or unresolved references", () => {
    const { result, transition } = fixture(), trace = vi.fn();
    render(<AtlasTransitionDelta result={result} selected={transitionWhy(transition)} onEvidence={trace}/>);
    expect(screen.getByText(/Evidence-support confidence: LOW → MODERATE/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Evidence added to this state (2)" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Evidence removed from this state (1)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Trace added Weight: new-weight" }));
    fireEvent.click(screen.getByRole("button", { name: "Trace removed Edema: older-edema" }));
    expect(trace.mock.calls).toEqual([["new-weight"], ["older-edema"]]);
    expect(screen.getByText("1 evidence reference retained across these snapshots.")).toBeTruthy();
    expect(screen.queryByText(/future-finding|unresolved/)).toBeNull();
    expect(screen.getByText(/does not imply deletion/)).toBeTruthy();
  });

  it("does not turn axis WHY selections or unmatched dates into historical transitions", () => {
    const { result, transition } = fixture();
    const { rerender, container } = render(<AtlasTransitionDelta result={result} selected={{ ...transitionWhy(transition), from: undefined }} onEvidence={vi.fn()}/>);
    expect(container.firstChild).toBeNull();
    rerender(<AtlasTransitionDelta result={result} selected={{ ...transitionWhy(transition), timestamp: at(2) }} onEvidence={vi.fn()}/>);
    expect(container.firstChild).toBeNull();
  });

  it("leaves the comparison UNKNOWN when the preceding historical snapshot is absent", () => {
    const { result, transition } = fixture(); result.twin.timeline = [result.twin.timeline[0]];
    render(<AtlasTransitionDelta result={result} selected={transitionWhy(transition)} onEvidence={vi.fn()}/>);
    expect(screen.getByText(/UNKNOWN · no preceding historical snapshot/)).toBeTruthy();
    expect(screen.getByText(/Evidence-support confidence: UNKNOWN → MODERATE/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/Evidence change is UNKNOWN/)).toBeTruthy();
  });

  it("does not substitute a later snapshot when the exact transition snapshot is missing", () => {
    const { result, transition } = fixture(); result.twin.timeline = [snapshot(1, ["retained"], "NORMAL", "LOW"), snapshot(4, ["retained", "new-weight"], "HIGH", "HIGH")];
    render(<AtlasTransitionDelta result={result} selected={transitionWhy(transition)} onEvidence={vi.fn()}/>);
    expect(screen.getByText(/Evidence-support confidence: LOW → UNKNOWN/)).toBeTruthy();
    expect(screen.getByText(/no snapshot recorded at this transition/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("supports congestion transitions and excludes evidence unavailable at its historical snapshot", () => {
    const { result, transition } = fixture();
    transition.axis = "congestion"; transition.from_level = "STABLE"; transition.to_level = "MILD_SIGNAL";
    result.twin.evidence.find(row => row.id === "new-edema")!.available_at = at(4);
    render(<AtlasTransitionDelta result={result} selected={transitionWhy(transition)} onEvidence={vi.fn()}/>);
    expect(screen.getByRole("heading", { name: "Evidence added to this state (1)" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /new-edema/ })).toBeNull();
    expect(screen.getByText(/Evidence-support confidence: LOW → MODERATE/)).toBeTruthy();
  });

  it("can match an explicit transition ID while refusing a transition beyond the replay boundary", () => {
    const { result, transition } = fixture();
    const selected = { ...transitionWhy(transition), transition_id: transition.id, title: "Selected transition" };
    const { rerender } = render(<AtlasTransitionDelta result={result} selected={selected} onEvidence={vi.fn()}/>);
    expect(screen.getByRole("region", { name: "Transition evidence change summary" })).toBeTruthy();
    rerender(<AtlasTransitionDelta result={{ ...result, as_of: at(2) }} selected={selected} onEvidence={vi.fn()}/>);
    expect(screen.queryByRole("region", { name: "Transition evidence change summary" })).toBeNull();
  });
});
