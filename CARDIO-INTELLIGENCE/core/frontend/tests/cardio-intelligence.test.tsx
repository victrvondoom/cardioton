import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CardioIntelligence, { reportAnnotations } from "../src/routes/CardioIntelligence";
import { reportsApi, type CardiovascularReport } from "../src/cardiotwin/intelligence/reportApi";
import { setStoredUser } from "../src/lib/core__src_lib__auth";

vi.mock("../src/cardiotwin/intelligence/reportApi", () => ({ reportsApi: { list: vi.fn(), upload: vi.fn(), review: vi.fn(), passport: vi.fn(), remove: vi.fn() } }));
vi.mock("../src/cardiotwin/intelligence/core__cardiotwin_intelligence__AnatomyViewer", () => ({ default: ({ findings, onSelect }: { findings: { id: string; label: string }[]; onSelect: (id: string) => void }) => <div aria-label="Accessible reference anatomy"><button onClick={() => onSelect("LAD")}>Select LAD reference</button>{findings.map(finding => <p key={finding.id}>Annotation: {finding.label}</p>)}</div> }));
vi.mock("../src/cardiotwin/intelligence/EnvironmentWorkspace", () => ({ default: ({ date, clinicalCount }: { date: string; clinicalCount?: number }) => <p>Environmental date {date}; clinical count {clinicalCount ?? "unlinked"}</p> }));
vi.mock("../src/cardiotwin/core__src_cardiotwin__api", () => ({ cardio: { hemoDemo: vi.fn() } }));
const stamp = "2026-10-09T08:00:00Z";
function fixture(status: "pending" | "approved" = "pending"): CardiovascularReport {
  return { id: "report-one", version: 1, case_ref: "synthetic-cardio-demo", patient_ref: "Patient/synthetic-cardio-hemo", source: { filename: "synthetic.pdf", media_type: "application/pdf", sha256: "abc", size_bytes: 100, page_count: 1, report_type: "angiography" }, event_at: stamp, available_at: stamp, synthetic: true, storage_mode: "synthetic_sqlite", warnings: [], audit: [], findings: [{ id: "finding-one", source_excerpt: "LAD stenosis, 70%", original_observation: {}, normalized: { kind: "stenosis", label: "LAD stenosis, 70% reported", structure_id: "LAD", segment: null, value: 70, unit: "%" }, certainty: "documented", status, reviewed_at: status === "approved" ? stamp : null, reviewer_id: status === "approved" ? "reviewer" : null, mapping: { version: "anatomy-1", structure_id: "LAD", label: "LAD", rationale: "Vessel explicitly stated; exact segment not established.", location_status: "vessel_only", no_lesion_geometry: true }, active_annotation: status === "approved" }] };
}
beforeEach(() => {
  vi.mocked(reportsApi.list).mockResolvedValue({ reports: [fixture()], as_of: stamp, storage_mode: "synthetic_sqlite", limitations: [] });
  setStoredUser({ id: "reviewer", email: "fictional@example.test", full_name: "Fictional reviewer", organization_id: "org", organization_name: "Synthetic", role: "reviewer" });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); localStorage.clear(); });
const mount = () => render(<MemoryRouter><CardioIntelligence/></MemoryRouter>);

describe("reviewed anatomical evidence", () => {
  it("never turns pending, conflicting, inactive or unresolved evidence into an anatomical claim", () => {
    expect(reportAnnotations([fixture()])).toEqual([]);
    const report = fixture("approved");
    expect(reportAnnotations([report])[0].structure_id).toBe("LAD");
    report.findings[0].certainty = "conflicting";
    expect(reportAnnotations([report])).toEqual([]);
    report.findings[0].certainty = "documented"; report.findings[0].active_annotation = false;
    expect(reportAnnotations([report])).toEqual([]);
  });
  it("requires a review transition before showing the source-linked LAD annotation", async () => {
    const approved = fixture("approved"); approved.version = 2;
    vi.mocked(reportsApi.review).mockImplementation(async () => { vi.mocked(reportsApi.list).mockResolvedValue({ reports: [approved], as_of: stamp, storage_mode: "synthetic_sqlite", limitations: [] }); return approved; });
    mount();
    await waitFor(() => expect(screen.getByText(/0 approved mappings/)).toBeTruthy());
    expect(screen.queryByText(/^Annotation:/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reports + review" }));
    await screen.findByRole("button", { name: "Approve finding" });
    fireEvent.click(screen.getByRole("button", { name: "Approve finding" }));
    await waitFor(() => expect(reportsApi.review).toHaveBeenCalledWith("report-one", expect.objectContaining({ action: "approve", expected_version: 1 })));
    await waitFor(() => expect(screen.getByText(/1 approved mappings/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Heart + evidence" }));
    await screen.findByText("Annotation: LAD stenosis, 70% reported");
    fireEvent.click(screen.getByRole("button", { name: "Select LAD reference" }));
    expect(screen.getByText("LAD stenosis, 70%")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Evidence Passport trail" })).toBeTruthy();
  });
  it("sends historical boundaries to the server and clears annotations while replay loads", async () => {
    vi.mocked(reportsApi.list).mockResolvedValueOnce({ reports: [fixture("approved")], as_of: stamp, storage_mode: "synthetic_sqlite", limitations: [] }).mockResolvedValue({ reports: [], as_of: "2026-08-10T23:59:59Z", storage_mode: "synthetic_sqlite", limitations: [] });
    mount(); await screen.findByText("Annotation: LAD stenosis, 70% reported");
    fireEvent.change(screen.getByLabelText("Replay date · end of day UTC"), { target: { value: "2026-08-10" } });
    await waitFor(() => expect(screen.queryByText(/^Annotation:/)).toBeNull());
    await waitFor(() => expect(reportsApi.list).toHaveBeenLastCalledWith("synthetic-cardio-demo", "2026-08-10T23:59:59.999999Z", expect.any(AbortSignal)));
  });
  it("requires explicit local consent before clinical/environmental alignment", async () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "Evidence alignment" }));
    expect(screen.queryByText(/Environmental date/)).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: /I consent to a temporary, local comparison/ }));
    await screen.findByText(/Environmental date/);
    expect(screen.getByText(/Personal exposure is not documented/)).toBeTruthy();
  });
});
