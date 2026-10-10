import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AnatomyViewer from "../src/cardiotwin/intelligence/AnatomyViewer";
import { approvedStructureFindings, normalizeStructureId, REFERENCE_STRUCTURES, type AnatomyFinding } from "../src/cardiotwin/intelligence/anatomyTypes";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const findings: AnatomyFinding[] = [
  { id: "approved", structure_id: "LAD", label: "LAD stenosis, 70% reported", review_status: "approved", source_ref: "synthetic-angiography", observed_at: "2026-08-12T10:00:00Z" },
  { id: "pending", structure_id: "RCA", label: "Proposed RCA finding", review_status: "pending" },
  { id: "rejected", structure_id: "LAD", label: "Rejected finding", review_status: "rejected" },
  { id: "unresolved", structure_id: null, label: "Cardiac disease without a location", review_status: "unsupported" },
];

describe("Reference anatomy safety and accessible fallback", () => {
  it("retains every semantic structure and evidence selection without WebGL", () => {
    const onSelect = vi.fn();
    render(<AnatomyViewer findings={findings} selectedStructure="LAD" onSelect={onSelect} mode="evidence" />);
    expect(screen.getByText("3D rendering unavailable")).toBeTruthy();
    const directory = screen.getByRole("group", { name: "Cardiovascular structures" });
    expect(within(directory).getAllByRole("button")).toHaveLength(16);
    fireEvent.click(within(directory).getByRole("button", { name: "Select Mitral valve" }));
    fireEvent.click(within(directory).getByRole("button", { name: "Select Right coronary artery" }));
    expect(onSelect.mock.calls).toEqual([["MITRAL"], ["RCA"]]);
    expect(screen.getByRole("list", { name: "Approved findings for selected structure" }).textContent).toContain("70% reported");
    expect(screen.getByText("synthetic-angiography")).toBeTruthy();
    expect(screen.getByText("2026-08-12")).toBeTruthy();
  });

  it("withholds proposed and rejected evidence and leaves unknown anatomy unresolved", () => {
    render(<AnatomyViewer findings={findings} onSelect={vi.fn()} mode="evidence" />);
    expect(screen.getByRole("button", { name: "Select Left anterior descending artery: 1 approved finding" })).toBeTruthy();
    const rca = screen.getByRole("button", { name: "Select Right coronary artery" });
    expect(rca.className).not.toContain("has-evidence");
    expect(screen.getByText(/pending human review/)).toBeTruthy();
    expect(screen.getByText("Location not established from supplied evidence")).toBeTruthy();
    expect(screen.getByText("Cardiac disease without a location")).toBeTruthy();
    expect(screen.queryByText("Rejected finding")).toBeNull();
    expect(screen.getByText(/Reported severity never changes vessel shape/)).toBeTruthy();
  });

  it("provides explicit text exploration and adjustable section controls", () => {
    render(<AnatomyViewer findings={findings} onSelect={vi.fn()} selectedStructure="mitral_valve" mode="section" />);
    const depth = screen.getByRole("slider", { name: "Section depth in generic display coordinates" });
    fireEvent.change(depth, { target: { value: "0.42" } });
    expect((depth as HTMLInputElement).value).toBe("0.42");
    fireEvent.click(screen.getByRole("button", { name: "Text view" }));
    expect(screen.getByText("ACCESSIBLE STRUCTURE EXPLORER")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Text view" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Select Mitral valve" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/UBERON:0002135/)).toBeTruthy();
  });

  it("honors reduced motion and responds when the OS preference changes", () => {
    let listener: (() => void) | undefined;
    const media = { matches: true, addEventListener: vi.fn((_event, update) => { listener = update; }), removeEventListener: vi.fn() };
    vi.stubGlobal("matchMedia", vi.fn(() => media));
    render(<AnatomyViewer findings={[]} onSelect={vi.fn()} />);
    const motion = screen.getByRole("button", { name: "Illustrative motion" }) as HTMLButtonElement;
    expect(motion.disabled).toBe(true);
    expect(screen.getByText(/Reduced-motion preference is active/)).toBeTruthy();
    // Fire a real preference event through the registered listener.
    act(() => { media.matches = false; listener?.(); });
    expect(motion.disabled).toBe(false);
    expect(media.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    cleanup();
    expect(media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("does not coerce unsupported structures into a generic lesion", () => {
    expect(normalizeStructureId("left ventricle")).toBe("LV");
    expect(normalizeStructureId("mitral_valve")).toBe("MITRAL");
    expect(normalizeStructureId("undefined infarction location")).toBeNull();
    expect(normalizeStructureId(null)).toBeNull();
    expect(approvedStructureFindings(findings, "LAD").map(finding => finding.id)).toEqual(["approved"]);
    expect(REFERENCE_STRUCTURES.filter(structure => structure.origin === "HRA reference mesh")).toHaveLength(9);
  });
});
