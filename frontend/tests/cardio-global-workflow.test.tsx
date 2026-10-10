import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CardioGlobalDashboard from "../src/cardiotwin/CardioGlobalDashboard";
import { globalApi, type CopilotResponse, type EvidenceRecord, type PassportVerification } from "../src/cardiotwin/globalApi";
import { PassportPanel } from "../src/cardiotwin/CardioGlobalResearch";

vi.mock("../src/cardiotwin/globalApi", () => ({globalApi: {
  getOverview: vi.fn(), getRecords: vi.fn(), getRecord: vi.fn(), getEvidenceMap: vi.fn(),
  askCopilot: vi.fn(), getTrials: vi.fn(), getPipeline: vi.fn(), getSafety: vi.fn(),
  getAgents: vi.fn(), getTask: vi.fn(), getPassport: vi.fn(), verifyPassport: vi.fn(),
  verifySuppliedPassport: vi.fn(), exportRecords: vi.fn(),
}}));
const record: EvidenceRecord = {
  id: "demo-cad", source_name: "Synthetic fixture", source_identifier: "DEMO-CAD", source_url: "/api/cardiotwin/global/records/demo-cad",
  title: "Synthetic coronary research record", authors_or_sponsor: "Synthetic organization", publication_or_start_date: null,
  clinical_area: "Coronary", modality: "CT", task_category: "diagnostic", target_indication: "Coronary disease", intervention_or_device: "CT",
  study_design: "Methods paper", sample_size: null, reported_endpoints: [], summary_findings: "No clinical findings supplied.",
  data_mode: "synthetic_demo", mapping_status: "proposed", human_verified: false,
  mapping_rationale: ["Fixture category supplied by author; requires review."],
};
const metrics = {indexed_research_records: 1, evidence_sources_connected: 0, clinical_trials_discovered: 0, interventions_mapped: 1,
  indications_represented: 1, unresolved_mappings: 1, awaiting_verification: 1, open_safety_events: 0, agent_tasks_running: 0,
  last_updated_at: null, data_mode: "synthetic_demo", source_configuration: [{name: "Europe PMC", status: "not_configured"}]};
beforeEach(() => {
  vi.mocked(globalApi.getOverview).mockResolvedValue(metrics);
  vi.mocked(globalApi.getRecords).mockResolvedValue({records: [record], total: 1, data_mode: "synthetic_demo"});
  vi.mocked(globalApi.getRecord).mockResolvedValue(record);
  vi.mocked(globalApi.getTrials).mockResolvedValue([]);
  vi.mocked(globalApi.getAgents).mockResolvedValue({agents: [], tasks: [], trace_logs: []});
  vi.mocked(globalApi.getEvidenceMap).mockResolvedValue({graph: {nodes: [{id: "a", label: "Synthetic fixture", category: "source", count: 1}, {id: "b", label: "Coronary", category: "area", count: 1}], edges: [{source: "a", target: "b", value: 1, flow_category: "source_to_area", evidence_ids: [record.id], verification_status: "proposed"}], total_records: 1, data_mode: "synthetic_demo", as_of: null, filter_summary: {}}, screening_stats: {}, records: [record]});
});
afterEach(() => {cleanup(); vi.resetAllMocks();});
const mount = () => render(<MemoryRouter><CardioGlobalDashboard /></MemoryRouter>);

it("reports unavailable metrics instead of successful zero data when the API fails", async () => {
  vi.mocked(globalApi.getOverview).mockRejectedValue(new Error("Backend unavailable"));
  mount();
  await screen.findByRole("alert");
  expect(screen.getByText("Backend unavailable")).toBeTruthy();
  expect(screen.getByRole("button", {name: "Inspect Indexed Research Records"}).textContent).toContain("Unavailable");
});

it("drills from a metric to source metadata with keyboard-closeable review details", async () => {
  mount();
  const metric = await screen.findByRole("button", {name: "Inspect Indexed Research Records"});
  await waitFor(() => expect(metric.hasAttribute("disabled")).toBe(false));
  fireEvent.click(metric);
  const records = await screen.findByRole("dialog");
  fireEvent.click(await within(records).findByRole("button", {name: `Inspect ${record.title}`}));
  const source = await screen.findByRole("dialog", {name: "Evidence source record"});
  await within(source).findByText(record.title);
  expect(within(source).getByText("Not independently verified")).toBeTruthy();
  expect(within(source).getByRole("link", {name: /Open original source/}).getAttribute("href")).toBe(record.source_url);
  fireEvent.keyDown(document, {key: "Escape"});
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("exposes selected relationship evidence and the accessible table without WebGL", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", {name: "Evidence Map"}));
  fireEvent.click(await screen.findByRole("button", {name: /Inspect relationship Synthetic fixture to Coronary/}));
  expect(screen.getByRole("region", {name: "Selected relationship evidence"})).toBeTruthy();
  expect(screen.getByRole("table", {name: "Evidence flow source records"})).toBeTruthy();
  expect(screen.getByRole("button", {name: `Inspect ${record.title}`})).toBeTruthy();
});

it("runs the research request and exposes its actual trace and verifiable passport", async () => {
  vi.mocked(globalApi.askCopilot).mockResolvedValue({query: "coronary", summary_response: "Found 1 matching synthetic record.", factual_claims: [], model_interpretations: [], evidence_citations: [], passport_hash: "a".repeat(64), verified: false, timestamp: "2026-10-10T00:00:00Z", task_id: "task-one", evidence_records: [record], identified_gaps: [{category: "unreviewed_mapping", description: "Requires reviewer", next_action: "Inspect source"}], data_mode: "synthetic_demo"});
  vi.mocked(globalApi.getTask).mockResolvedValue({task_id: "task-one", task_type: "research", agent_role: "Orchestrator", status: "awaiting_human_review", inputs: {query: "coronary"}, allowed_tools: ["public_source_search"], timeout_seconds: 45, max_retries: 1, retry_count: 0, result_artifacts: {}, trace_logs: [{task_id: "task-one", agent_role: "Discovery", step_description: "Searched stored synthetic corpus", timestamp: "2026-10-10T00:00:00Z"}]});
  vi.mocked(globalApi.verifyPassport).mockResolvedValue({passport_hash: "a".repeat(64), status: "INTEGRITY_VERIFIED", integrity_check: "PASSED", tamper_detected: false, verified: true, verified_at: "2026-10-10T00:00:00Z", notes: "Digest only; scientific truth not established."});
  mount();
  fireEvent.change(screen.getByRole("textbox", {name: "Cardiovascular research question"}), {target: {value: "coronary"}});
  fireEvent.click(screen.getByRole("button", {name: "Find evidence"}));
  await screen.findByText("Found 1 matching synthetic record.");
  expect(globalApi.askCopilot).toHaveBeenCalledWith("coronary", expect.any(AbortSignal), expect.any(String));
  fireEvent.click(screen.getByRole("button", {name: "Verify stored passport"}));
  await screen.findByText("Integrity verified");
  fireEvent.click(screen.getByRole("button", {name: "Inspect task execution"}));
  await screen.findByText("Searched stored synthetic corpus");
  expect(screen.getByText(/awaiting_human_review/)).toBeTruthy();
});

it("never treats an unknown hash as verified", async () => {
  vi.mocked(globalApi.verifyPassport).mockResolvedValue({passport_hash: "b".repeat(64), status: "NOT_FOUND", integrity_check: "NOT_FOUND", tamper_detected: null, verified: false, verified_at: "2026-10-10T00:00:00Z", notes: "No stored artifact"});
  mount(); fireEvent.click(screen.getByRole("button", {name: "Agent Monitor"}));
  fireEvent.change(screen.getByRole("textbox", {name: "SHA-256 passport digest"}), {target: {value: "b".repeat(64)}});
  fireEvent.click(screen.getByRole("button", {name: "Verify stored passport"}));
  await screen.findByText("Passport not verified");
  expect(screen.queryByText("Integrity verified")).toBeNull();
});

const brief: CopilotResponse = {query: "coronary", summary_response: "Stored coronary metadata", factual_claims: [], model_interpretations: [], evidence_citations: [], passport_hash: "", verified: false, timestamp: "2026-10-10T00:00:00Z", task_id: "task-reassessment", evidence_records: [record], identified_gaps: [], data_mode: "synthetic_demo"};
const verification: PassportVerification = {passport_hash: "a".repeat(64), status: "INTEGRITY_VERIFIED", integrity_check: "PASSED", tamper_detected: false, verified: true, verified_at: "2026-10-10T00:00:00Z", notes: "Artifact content matched."};

it("starts a new assessment when the same question is run after a successful task", async () => {
  vi.mocked(globalApi.askCopilot).mockResolvedValue(brief);
  mount();
  fireEvent.change(screen.getByRole("textbox", {name: "Cardiovascular research question"}), {target: {value: "coronary"}});
  fireEvent.click(screen.getByRole("button", {name: "Find evidence"}));
  await screen.findByText(brief.summary_response);
  const firstKey = vi.mocked(globalApi.askCopilot).mock.calls[0][2];
  fireEvent.click(screen.getByRole("button", {name: "Find evidence"}));
  await waitFor(() => expect(globalApi.askCopilot).toHaveBeenCalledTimes(2));
  await screen.findByText(brief.summary_response);
  expect(vi.mocked(globalApi.askCopilot).mock.calls[1][2]).not.toBe(firstKey);
});

it("reuses an uncertain request key for retries and permits an explicit new attempt", async () => {
  vi.mocked(globalApi.askCopilot).mockRejectedValue(new Error("Request interrupted"));
  mount();
  fireEvent.change(screen.getByRole("textbox", {name: "Cardiovascular research question"}), {target: {value: "coronary"}});
  fireEvent.click(screen.getByRole("button", {name: "Find evidence"}));
  await screen.findByText("Request interrupted");
  fireEvent.click(screen.getByRole("button", {name: "Find evidence"}));
  await waitFor(() => expect(globalApi.askCopilot).toHaveBeenCalledTimes(2));
  await screen.findByText("Request interrupted");
  const calls = vi.mocked(globalApi.askCopilot).mock.calls;
  expect(calls[1][2]).toBe(calls[0][2]);
  vi.mocked(globalApi.askCopilot).mockResolvedValue(brief);
  fireEvent.click(screen.getByRole("button", {name: "Start new research attempt"}));
  await screen.findByText(brief.summary_response);
  expect(vi.mocked(globalApi.askCopilot).mock.calls[2][2]).not.toBe(calls[0][2]);
});

it("keeps a delayed stored passport check bound to its digest and clears it after edits", async () => {
  let complete!: (result: PassportVerification) => void;
  vi.mocked(globalApi.verifyPassport).mockReturnValue(new Promise(resolve => { complete = resolve; }));
  render(<PassportPanel initialHash={verification.passport_hash} />);
  const digest = screen.getByRole("textbox", {name: "SHA-256 passport digest"}) as HTMLInputElement;
  fireEvent.click(screen.getByRole("button", {name: "Verify stored passport"}));
  expect(digest.disabled).toBe(true);
  fireEvent.change(digest, {target: {value: "b".repeat(64)}});
  expect(digest.value).toBe(verification.passport_hash);
  await act(async () => complete(verification));
  await screen.findByText("Integrity verified");
  expect(screen.getByText(`Verified artifact digest: ${verification.passport_hash}`)).toBeTruthy();
  expect(digest.disabled).toBe(false);
  fireEvent.change(digest, {target: {value: "b".repeat(64)}});
  expect(screen.queryByText("Integrity verified")).toBeNull();
});

it("keeps a delayed supplied-artifact check bound to the JSON that was submitted", async () => {
  let complete!: (result: PassportVerification) => void;
  vi.mocked(globalApi.verifySuppliedPassport).mockReturnValue(new Promise(resolve => { complete = resolve; }));
  render(<PassportPanel />);
  fireEvent.click(screen.getByText("Independently verify an exported artifact"));
  const json = screen.getByLabelText("Exported passport JSON") as HTMLTextAreaElement;
  const supplied = JSON.stringify({passport_hash: verification.passport_hash, payload: {schema_version: "cardiotwin-research-passport-v1"}});
  fireEvent.change(json, {target: {value: supplied}});
  fireEvent.click(screen.getByRole("button", {name: "Verify supplied artifact"}));
  expect(json.disabled).toBe(true);
  fireEvent.change(json, {target: {value: "{}"}});
  expect(json.value).toBe(supplied);
  await act(async () => complete(verification));
  await screen.findByText("Integrity verified");
  expect(screen.getByText(`Verified artifact digest: ${verification.passport_hash}`)).toBeTruthy();
  fireEvent.change(json, {target: {value: "{}"}});
  expect(screen.queryByText("Integrity verified")).toBeNull();
});

it("drills into exactly the proposed mappings and reported indications counted by overview", async () => {
  const rejected = {...record, id: "rejected", title: "Rejected source", mapping_status: "rejected"};
  const unknown = {...record, id: "unknown", title: "Unreported indication source", target_indication: "Not reported", mapping_status: "verified"};
  const unextracted = {...record, id: "unextracted", title: "Unextracted indication source", target_indication: "Not extracted", mapping_status: "verified"};
  vi.mocked(globalApi.getRecords).mockResolvedValue({records: [record, rejected, unknown, unextracted], total: 4, data_mode: "synthetic_demo"});
  mount();
  const metric = screen.getByRole("button", {name: "Inspect Unresolved Mappings"});
  await waitFor(() => expect(metric.hasAttribute("disabled")).toBe(false));
  fireEvent.click(metric);
  let drawer = await screen.findByRole("dialog");
  await within(drawer).findByRole("button", {name: `Inspect ${record.title}`});
  expect(within(drawer).queryByRole("button", {name: "Inspect Rejected source"})).toBeNull();
  fireEvent.click(within(drawer).getByRole("button", {name: "Close detail"}));
  fireEvent.click(screen.getByRole("button", {name: "Inspect Indications Represented"}));
  drawer = await screen.findByRole("dialog");
  await within(drawer).findByRole("button", {name: `Inspect ${record.title}`});
  expect(within(drawer).queryByRole("button", {name: "Inspect Unreported indication source"})).toBeNull();
  expect(within(drawer).queryByRole("button", {name: "Inspect Unextracted indication source"})).toBeNull();
});

it("lets keyboard users reach retained source history and keeps focus inside the drawer", async () => {
  localStorage.clear();
  const user = userEvent.setup();
  vi.mocked(globalApi.getRecord).mockResolvedValue({...record, history: [{snapshot_hash: "a".repeat(64), parent_hash: null, record}]});
  mount();
  const metric = screen.getByRole("button", {name: "Inspect Indexed Research Records"});
  await waitFor(() => expect(metric.hasAttribute("disabled")).toBe(false));
  await user.click(metric);
  await user.click(await screen.findByRole("button", {name: `Inspect ${record.title}`}));
  const drawer = await screen.findByRole("dialog", {name: "Evidence source record"});
  const historySummary = await within(drawer).findByText("Retained source versions and field changes (1)");
  const close = within(drawer).getByRole("button", {name: "Close detail"});
  close.focus();
  let reachedHistory = false;
  for (let index = 0; index < 10; index += 1) {
    await user.tab();
    expect(drawer.contains(document.activeElement)).toBe(true);
    if (document.activeElement === historySummary) { reachedHistory = true; break; }
  }
  expect(reachedHistory).toBe(true);
  // jsdom does not implement native Enter activation for summary; its click
  // action exercises the same details toggle after keyboard focus is verified.
  await user.click(historySummary);
  expect(historySummary.parentElement?.hasAttribute("open")).toBe(true);
  await user.tab();
  expect(document.activeElement).toBe(close);
  await user.tab({shift: true});
  expect(document.activeElement).toBe(historySummary);
});
