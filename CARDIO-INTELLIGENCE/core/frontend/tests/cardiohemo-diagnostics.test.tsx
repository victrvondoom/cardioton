import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EvidenceSensitivity, KnowledgeFrontier } from "../src/cardiotwin/EvidenceSensitivity";
import type { HemoResult } from "../src/cardiotwin/hemoTypes";

afterEach(cleanup);

describe("Hemodynamic knowledge diagnostics", () => {
  it("traces withheld evidence and labels the comparison as a derived input audit", () => {
    const onWhy = vi.fn();
    const result = { as_of: "2026-08-10T23:59:59Z", sensitivity_notice: "Not a treatment simulation or diagnostic probability.", evidence_sensitivity: [{ modality: "Weight", withheld_kinds: ["weight"], evidence_refs: ["w1", "w2"], changed_axes: [{ axis: "filling_pressure_proxy", with_all_evidence: "ELEVATED", with_modality_withheld: "UNKNOWN" }], original_stage: "INCREASING_CONCERN", withheld_stage: "MILD_SIGNAL", original_confidence: "MODERATE", withheld_confidence: "LOW", stage_changed: true, classification: "DERIVED", review_required: true }] } as HemoResult;
    render(<EvidenceSensitivity result={result} onWhy={onWhy} />);
    fireEvent.click(screen.getByRole("button", { name: /Without weight/ }));
    expect(onWhy).toHaveBeenCalledWith(expect.objectContaining({ evidence_refs: ["w1", "w2"], classification: "DERIVED · EVIDENCE SENSITIVITY", to: "MILD_SIGNAL" }));
    expect(screen.getByText(/Not a treatment simulation/)).toBeTruthy();
  });

  it("shows a delayed result only when the server admits it to the knowledge boundary", () => {
    const onWhy = vi.fn();
    const result = { knowledge_frontier: [] } as unknown as HemoResult;
    const view = render(<KnowledgeFrontier result={result} onWhy={onWhy} />);
    expect(screen.queryByRole("button", { name: "Trace delayed source" })).toBeNull();
    view.rerender(<KnowledgeFrontier result={{ ...result, knowledge_frontier: [{ id: "arrival-bnp", kind: "bnp", event_at: "2026-08-10T08:00:00Z", available_at: "2026-08-12T10:00:00Z", delay_hours: 50, evidence_refs: ["bnp"], changes_at_release: [], classification: "DERIVED", explanation: "Earlier replays exclude this source." }] }} onWhy={onWhy} />);
    fireEvent.click(screen.getByRole("button", { name: "Trace delayed source" }));
    expect(onWhy).toHaveBeenCalledWith(expect.objectContaining({ evidence_refs: ["bnp"], timestamp: "2026-08-12T10:00:00Z" }));
    expect(screen.getByText(/50 hours/)).toBeTruthy();
  });
});
