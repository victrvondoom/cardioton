import { describe, expect, it } from "vitest";
import { selectSceneHeartRate } from "../src/cardiotwin/hemoSceneEvidence";
import type { HemoEvidence } from "../src/cardiotwin/hemoTypes";

const at = (day: number) => `2026-08-${String(day).padStart(2, "0")}T08:00:00Z`;
const source = (id: string, overrides: Partial<HemoEvidence> = {}): HemoEvidence => ({
  id, patient_ref: "Patient/synthetic-heart-scene", kind: "heart_rate", value: 80, unit: "/min",
  event_at: at(12), available_at: at(12), source_ref: `Observation/${id}`,
  original_record: { resourceType: "Observation", id }, provenance: { synthetic: true }, classification: "OBSERVED",
  ...overrides,
});

describe("Heart scene observed source selection", () => {
  it("keeps missing measurements unknown without substituting a pulse rate", () => {
    expect(selectSceneHeartRate([], at(12))).toMatchObject({ value: null, unit: "bpm", evidenceIds: [], observedAt: null, status: "unknown" });
    expect(selectSceneHeartRate([source("weight", { kind: "weight", value: 74, unit: "kg" })], at(12)).value).toBeNull();
  });

  it("selects the newest event rather than input order or latest receipt time", () => {
    const result = selectSceneHeartRate([
      source("current", { event_at: at(12), available_at: at(12), value: 86 }),
      source("older-late-arrival", { event_at: at(7), available_at: at(13), value: 82 }),
    ], at(13));
    expect(result).toMatchObject({ value: 86, status: "observed", observedAt: at(12), evidenceIds: ["current"] });
    expect(result.reason).toContain("motion remains illustrative");
  });

  it("excludes future events and previously observed sources that arrive after the replay", () => {
    const known = source("known", { value: 86 });
    const future = source("future", { event_at: at(15), available_at: at(12), value: 104 });
    const late = source("late", { event_at: at(12), available_at: at(15), value: 112 });
    const historical = selectSceneHeartRate([known, future, late], at(12));
    expect(historical).toMatchObject({ value: 86, evidenceIds: ["known"], status: "observed" });
    expect(selectSceneHeartRate([future, late], at(12))).toMatchObject({ value: null, evidenceIds: [], observedAt: null });
    expect(selectSceneHeartRate([known, future, late], at(15))).toMatchObject({ value: 104, evidenceIds: ["future"] });
  });

  it("does not let an unavailable invalid source create a historical conflict", () => {
    const result = selectSceneHeartRate([
      source("known"), source("unsupported-later", { available_at: at(15), value: "80", unit: "Hz" }),
    ], at(12));
    expect(result).toMatchObject({ value: 80, status: "observed", evidenceIds: ["known"] });
  });

  it("keeps conflicting latest event values unknown rather than falling back", () => {
    const result = selectSceneHeartRate([
      source("older", { event_at: at(7), available_at: at(7), value: 82 }),
      source("a", { value: 80 }), source("b", { value: 104 }),
    ], at(12));
    expect(result).toMatchObject({ value: null, status: "unknown", evidenceIds: ["a", "b"], observedAt: at(12) });
    expect(result.reason).toContain("conflicting");
  });

  it.each([
    ["unsupported unit", { unit: "Hz" }],
    ["missing unit", { unit: null }],
    ["string quantity", { value: "80" }],
    ["nonfinite quantity", { value: Number.NaN }],
    ["below supported bounds", { value: 9 }],
    ["above supported bounds", { value: 351 }],
    ["inferred quantity", { classification: "INFERRED" }],
    ["derived quantity", { classification: "DERIVED" }],
  ] as [string, Partial<HemoEvidence>][]) ("withholds a latest event containing %s, even alongside a valid quantity", (_description, invalid) => {
    const result = selectSceneHeartRate([
      source("older", { event_at: at(7), available_at: at(7) }),
      source("valid"), source("invalid", invalid),
    ], at(12));
    expect(result).toMatchObject({ value: null, status: "unknown", evidenceIds: ["invalid", "valid"] });
  });

  it("withholds a newest unsupported event instead of reviving an earlier observation", () => {
    expect(selectSceneHeartRate([
      source("older", { event_at: at(7), available_at: at(7), value: 82 }),
      source("latest", { unit: "Hz" }),
    ], at(12))).toMatchObject({ value: null, status: "unknown", evidenceIds: ["latest"] });
  });

  it.each(["bpm", "/min", "{beats}/min", " BPM "])("accepts the supported %s source unit as bpm", unit => {
    expect(selectSceneHeartRate([source("rate", { unit })], at(12))).toMatchObject({ value: 80, unit: "bpm", status: "observed" });
  });

  it("treats equal values in compatible unit aliases as agreeing sources", () => {
    const result = selectSceneHeartRate([source("b", { unit: "bpm" }), source("a", { unit: "/min" })], at(12));
    expect(result).toMatchObject({ value: 80, status: "observed", evidenceIds: ["a", "b"] });
  });

  it("preserves dated stale provenance but withholds a current heart-rate value", () => {
    const result = selectSceneHeartRate([source("old", { event_at: at(1), available_at: at(1) })], at(16));
    expect(result).toMatchObject({ value: null, status: "unknown", observedAt: at(1), evidenceIds: ["old"] });
    expect(result.reason).toContain("outside the 14-day evidence window");
  });

  it("accepts the exact freshness boundary and honors a narrower configured window", () => {
    const records = [source("boundary", { event_at: at(1), available_at: at(1) })];
    expect(selectSceneHeartRate(records, at(15)).value).toBe(80);
    expect(selectSceneHeartRate(records, at(15), 7).value).toBeNull();
  });

  it("requires valid event, availability, and replay times before exposing source data", () => {
    const records = [source("bad-event", { event_at: "invalid" }), source("bad-arrival", { available_at: "invalid" })];
    expect(selectSceneHeartRate(records, at(12))).toMatchObject({ value: null, evidenceIds: [], observedAt: null });
    expect(selectSceneHeartRate([source("known")], "invalid")).toMatchObject({ value: null, evidenceIds: [], observedAt: null });
  });
});
