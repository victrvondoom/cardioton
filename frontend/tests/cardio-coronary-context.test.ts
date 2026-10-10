import { describe, expect, it } from "vitest";
import { visibleCoronaryContext, type CoronaryModelContext } from "../src/cardiotwin/intelligence/coronaryContext";

const context: CoronaryModelContext = { probabilities: { LAD: .7, LCX: .2, RCA: .3 }, generatedAt: "2026-10-09T08:00:00Z", model: "existing-model / 1", artifactSha256: "source-hash", scenario: "C", researchScenario: false };
describe("existing model context boundaries", () => {
  it("excludes current estimates from earlier replay without converting them to report findings", () => {
    expect(visibleCoronaryContext(context, "2026-08-10T23:59:59Z")).toBeNull();
    expect(visibleCoronaryContext(context, "2026-10-09T23:59:59Z")).toEqual(context);
  });
  it("rejects malformed, timezone-free and invalid probability summaries", () => {
    const asOf = "2026-10-09T23:59:59Z";
    for (const value of [null, {}, { ...context, generatedAt: "2026-10-09T08:00:00" }, { ...context, probabilities: { ...context.probabilities, LAD: 70 } }, { ...context, probabilities: { ...context.probabilities, RCA: NaN } }]) expect(visibleCoronaryContext(value, asOf)).toBeNull();
  });
});
