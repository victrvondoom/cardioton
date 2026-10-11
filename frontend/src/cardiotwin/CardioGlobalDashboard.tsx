/** Existing global dashboard, connected to persisted evidence and bounded tasks. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, Bot, FileText, FlaskConical, Globe, Heart, Info, Layers, RefreshCw, ShieldAlert } from "lucide-react";
import { globalApi, type OverviewMetrics, type SourceConfiguration } from "./globalApi";
import { EvidenceFlowPanel } from "./CardioEvidenceFlow";
import { DataMode, dateText, Loading, PassportPanel, RecordDrawer, RecordsTable, ResearchDrawer, ResearchError, ResearchWorkflow, SourceLink, TaskDrawer, TraceList, useResearchResource } from "./CardioGlobalResearch";
import "./global-intelligence.css";

type Tab = "overview" | "evidence-map" | "trials" | "pipeline" | "safety" | "agents";
const TABS = [
  { id: "overview", label: "Overview", icon: <Globe size={13} aria-hidden /> },
  { id: "evidence-map", label: "Evidence Map", icon: <Layers size={13} aria-hidden /> },
  { id: "trials", label: "Clinical Trials", icon: <FlaskConical size={13} aria-hidden /> },
  { id: "pipeline", label: "Pipeline", icon: <Activity size={13} aria-hidden /> },
  { id: "safety", label: "Safety & Regulatory", icon: <ShieldAlert size={13} aria-hidden /> },
  { id: "agents", label: "Agent Monitor", icon: <Bot size={13} aria-hidden /> },
] as const;
const METRICS = [
  ["indexed_research_records", "Indexed Research Records", "Distinct normalized source records"],
  ["evidence_sources_connected", "Evidence Sources Connected", "Configured source adapters"],
  ["clinical_trials_discovered", "Clinical Trials Discovered", "Indexed registry records"],
  ["interventions_mapped", "Interventions Mapped", "Distinct intervention labels"],
  ["indications_represented", "Indications Represented", "Distinct indication labels"],
  ["unresolved_mappings", "Unresolved Mappings", "Mappings requiring review"],
  ["awaiting_verification", "Awaiting Verification", "Records without independent verification"],
  ["open_safety_events", "Open Safety Events", "Ingested source-backed events"],
] as const;
type MetricKey = typeof METRICS[number][0];

function SourceConfigurationPanel({ sources }: { sources?: SourceConfiguration[] }) {
  return <div className="cgi-panel"><div className="cgi-panel-header"><span className="cgi-panel-title"><Info size={14} aria-hidden />Source configuration and freshness</span></div>
    <div className="cgi-panel-body cgi-stack">{sources?.length ? sources.map((source, index) => <div className="cgi-source-state" key={`${source.name ?? source.source_name}-${index}`}><b>{source.name ?? source.source_name ?? "Unnamed source"}</b><span className="cgi-badge">{source.status}</span><p>{source.notes ?? source.reason}</p><small>Last successful source refresh: {dateText(source.last_successful_refresh ?? source.last_successful_refresh_at)}</small></div>) : <p className="cgi-empty">Source configuration is unavailable. A listed evidence record does not establish an active source connection.</p>}
      <p className="cgi-notice">Freshness is the last successful source retrieval. Dashboard refresh reads stored data and does not imply a new external source retrieval.</p>
    </div></div>;
}

function MetricRecords({ metric, onRecord, onClose }: { metric: MetricKey; onRecord: (id: string) => void; onClose: () => void }) {
  const state = useResearchResource(signal => globalApi.getRecords(undefined, signal));
  let records = state.data?.records ?? [];
  if (metric === "clinical_trials_discovered") records = records.filter(record => record.source_name.toLowerCase().includes("clinicaltrials") || record.record_type?.toLowerCase().includes("trial"));
  if (metric === "interventions_mapped") records = records.filter(record => !!record.intervention_or_device);
  if (metric === "unresolved_mappings") records = records.filter(record => record.mapping_status === "proposed");
  if (metric === "indications_represented") records = records.filter(record => !["Not reported", "Not extracted"].includes(record.target_indication));
  if (metric === "awaiting_verification") records = records.filter(record => record.human_verified !== true);
  return <ResearchDrawer title={METRICS.find(item => item[0] === metric)?.[1] ?? "Underlying records"} onClose={onClose}>
    {state.loading && <Loading />}<ResearchError message={state.error} />{state.data && <><DataMode mode={state.data.data_mode} /><p className="cgi-notice">These source records contribute to the metric. Distinct indication and intervention counts count unique labels, rather than the number of rows. Showing up to 500 records.</p><RecordsTable records={records} onRecord={onRecord} /></>}
  </ResearchDrawer>;
}

function TrialsPanel({ revision, onRecord }: { revision: number; onRecord: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState("");
  const [sort, setSort] = useState("title");
  const state = useResearchResource(signal => globalApi.getTrials({ query, phase }, signal), `${revision}:${query}:${phase}`);
  const baseline = useResearchResource(signal => globalApi.getTrials(undefined, signal), revision);
  const phases = [...new Set((baseline.data ?? []).flatMap(record => Array.isArray(record.phase) ? record.phase : record.phase ? [record.phase] : []))].sort();
  const trials = [...(state.data ?? [])].sort((left, right) => sort === "date" ? (right.publication_or_start_date ?? "").localeCompare(left.publication_or_start_date ?? "") : sort === "enrollment" ? (right.enrollment ?? right.sample_size ?? -1) - (left.enrollment ?? left.sample_size ?? -1) : left.title.localeCompare(right.title));
  return <div className="cgi-panel"><div className="cgi-panel-header"><span className="cgi-panel-title"><FlaskConical size={14} aria-hidden />Clinical Trial Explorer</span><span className="cgi-badge">{state.data ? `${state.data.length} registry records` : "Awaiting records"}</span></div>
    <div className="cgi-panel-body cgi-stack">
      <form className="cgi-copilot-form" onSubmit={event => { event.preventDefault(); setQuery(draft); }}><input className="cgi-copilot-input" value={draft} onChange={event => setDraft(event.target.value)} aria-label="Trial search query" placeholder="Search indication, intervention, or trial identifier" /><button className="cgi-copilot-btn">Search trials</button></form>
      <div className="cgi-filters"><label className="cgi-field">Trial phase<select className="cgi-select" value={phase} onChange={event => setPhase(event.target.value)}><option value="">All phases</option>{phases.map(value => <option key={value}>{value}</option>)}</select></label><label className="cgi-field">Sort trials<select className="cgi-select" value={sort} onChange={event => setSort(event.target.value)}><option value="title">Title</option><option value="date">Newest source date</option><option value="enrollment">Largest reported enrollment</option></select></label><button className="cgi-badge" onClick={() => { setQuery(""); setDraft(""); setPhase(""); setSort("title"); }}>Reset trial filters</button></div>
      <ResearchError message={state.error} />{state.loading && <Loading>Loading indexed clinical trial records…</Loading>}
      {state.data && <RecordsTable records={trials} onRecord={onRecord} label="Clinical trials" />}
      <p className="cgi-notice">Open a study to inspect its sponsor, phase, recruitment status, dates, enrollment, outcomes, retrieval provenance, and original registry link where reported. Trial registration or phase does not imply trial success.</p>
    </div></div>;
}

function PipelinePanel({ revision, onProgram }: { revision: number; onProgram: (program: string) => void }) {
  const state = useResearchResource(signal => globalApi.getPipeline(signal), revision);
  return <div className="cgi-panel"><div className="cgi-panel-header"><span className="cgi-panel-title"><Activity size={14} aria-hidden />Pipeline Intelligence</span></div><div className="cgi-panel-body cgi-stack">
    <ResearchError message={state.error} />{state.loading && <Loading>Grouping indexed intervention records…</Loading>}
    {state.data?.map(program => <div className="cgi-pipeline-row" key={`${program.program}-${program.indication}`}><div><button className="cgi-record-link" onClick={() => onProgram(program.program)}>{program.program}</button><p>{program.indication}</p><small>{program.sponsor} · {program.modality}</small><p>Evidence gap: {program.evidence_gap}</p></div><span className="cgi-badge">{program.phase || "Phase unreported"}</span><div><b>{program.evidence_count}</b><small className="cgi-table-sub">records</small></div></div>)}
    {state.data?.length === 0 && <p className="cgi-empty">No intervention groups in the indexed corpus. Discover and ingest source records to populate this view.</p>}
    <p className="cgi-notice">Programs are grouped from intervention labels in the stored evidence. These groups do not establish a commercial pipeline, regulatory status, partnerships, or clinical efficacy.</p>
  </div></div>;
}

function ProgramDrawer({ program, onRecord, onClose }: { program: string; onRecord: (id: string) => void; onClose: () => void }) {
  const state = useResearchResource(signal => globalApi.getRecords({ intervention: program }, signal), program);
  return <ResearchDrawer title={`${program}: supporting evidence`} onClose={onClose}>{state.loading && <Loading />}<ResearchError message={state.error} />{state.data && <RecordsTable records={state.data.records} onRecord={onRecord} />}</ResearchDrawer>;
}

function SafetyPanel({ revision, sources }: { revision: number; sources?: SourceConfiguration[] }) {
  const state = useResearchResource(signal => globalApi.getSafety(signal), revision);
  return <div className="cgi-panel"><div className="cgi-panel-header"><span className="cgi-panel-title"><ShieldAlert size={14} aria-hidden />Safety & Regulatory Monitoring</span></div><div className="cgi-panel-body cgi-stack">
    <ResearchError message={state.error} />{state.loading && <Loading>Loading ingested safety records…</Loading>}
    {state.data?.map(alert => <div className="cgi-safety-row" key={alert.id}><span className="cgi-badge">{alert.severity}</span><div><b>{alert.event_type}</b><p>{alert.target_intervention}</p><p>{alert.summary}</p><SourceLink url={alert.source_url}>{alert.source}</SourceLink><small className="cgi-table-sub">Last observed {dateText(alert.last_observed)}</small><DataMode mode={alert.data_mode} /></div><span className="cgi-badge">{alert.status}</span></div>)}
    {state.data?.length === 0 && <p className="cgi-empty">No safety or regulatory records have been ingested. This does not establish absence of safety events.</p>}
    {sources?.filter(source => /FDA|regulat|safety/i.test(source.name ?? source.source_name ?? "")).map((source, index) => <p className="cgi-notice" key={index}>{source.name ?? source.source_name}: {source.status}. {source.notes ?? source.reason}</p>)}
    <p className="cgi-notice">Official regulatory announcements, reported adverse events, statistical signals, and causal conclusions are distinct. Inspect the original source before interpreting a record.</p>
  </div></div>;
}

function AgentMonitorPanel({ revision, onTask }: { revision: number; onTask: (id: string) => void }) {
  const state = useResearchResource(signal => globalApi.getAgents(signal), revision);
  return <div className="cgi-panel"><div className="cgi-panel-header"><span className="cgi-panel-title"><Bot size={14} aria-hidden />Multi-Agent Monitor</span></div><div className="cgi-panel-body cgi-stack">
    <ResearchError message={state.error} />{state.loading && <Loading>Loading recorded task states…</Loading>}
    {state.data && <><div className="cgi-agent-grid">{state.data.agents.map(agent => <div className="cgi-agent-card" key={agent.role}><span className="cgi-agent-name">{agent.role}</span><span className="cgi-agent-status">{agent.status} · {agent.active_tasks} active tasks</span></div>)}</div>
      <p className="cgi-kicker">Persisted research tasks</p>{state.data.tasks.length ? <div className="cgi-table-wrap"><table className="cgi-table" aria-label="Persisted research tasks"><thead><tr><th>Task</th><th>Status</th><th>Retries</th><th>Started</th></tr></thead><tbody>{state.data.tasks.map(task => <tr key={task.task_id}><td><button className="cgi-record-link" onClick={() => onTask(task.task_id)} aria-label={`Inspect task ${task.task_id}`}>{task.task_type}<small className="cgi-table-sub">{task.task_id}</small></button></td><td>{task.status}</td><td>{task.retry_count}/{task.max_retries}</td><td>{dateText(task.started_at)}</td></tr>)}</tbody></table></div> : <p className="cgi-empty">No tasks have executed for this account. Run a research question from Overview to create a trace.</p>}
      <TraceList traces={state.data.trace_logs} />
    </>}
    <p className="cgi-notice">Status is recorded by the backend. Idle tools are available capabilities, not evidence of continuous agent activity. Refresh to inspect newly completed tasks.</p>
  </div></div>;
}

export default function CardioGlobalDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [revision, setRevision] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const state = useResearchResource(signal => globalApi.getOverview(signal), revision);
  const metrics: OverviewMetrics | null = state.data;
  function inspectRecord(id: string) { setSelectedMetric(null); setSelectedProgram(null); setSelectedRecord(id); }
  function inspectMetric(key: MetricKey) { if (key === "evidence_sources_connected") setShowSources(true); else if (key === "open_safety_events") setTab("safety"); else setSelectedMetric(key); }
  const stale = metrics?.last_updated_at ? Date.now() - Date.parse(metrics.last_updated_at) > 30 * 86400000 : false;
  return <div className="cgi-workspace" data-testid="cardio-global-dashboard">
    <header className="cgi-header"><div><p className="cgi-kicker">CARDIOTWIN / GLOBAL EVIDENCE</p><h1>Cardiovascular Evidence Workspace</h1><p>Source records · Transparent evidence mapping · Research briefs · Reproducible evidence passports</p></div><div className="cgi-header-actions">
      {state.loading ? <span className="cgi-badge">Loading data status…</span> : <DataMode mode={metrics?.data_mode} />}
      <span className="cgi-badge">Corpus updated {metrics ? dateText(metrics.last_updated_at) : "unavailable"}{stale ? " · Older than 30 days" : ""}</span>
      <button className="cgi-badge" onClick={() => setRevision(value => value + 1)} aria-label="Refresh dashboard"><RefreshCw size={11} aria-hidden />Refresh</button>
      <nav aria-label="Existing CardioTwin modules" className="cgi-filters"><Link to="/cardiotwin" className="cgi-badge"><Heart size={11} aria-hidden />CardioTwin</Link><Link to="/cardiotwin/hemo" className="cgi-badge"><Activity size={11} aria-hidden />Hemo</Link><Link to="/cardiotwin/atlas" className="cgi-badge"><Globe size={11} aria-hidden />Atlas</Link></nav>
    </div></header>
    <p className="cgi-notice" role="note">Research workspace. Synthetic demonstration records are labelled and require source verification before scientific use. Human review remains required for clinical interpretation. External source content is treated as data.</p>
    <nav className="cgi-tabs" aria-label="Intelligence workspace sections">{TABS.map(item => <button key={item.id} aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{item.icon}{item.label}</button>)}</nav>
    <ResearchError message={state.error} />
    {tab === "overview" && <div className="cgi-stack">
      <section aria-label="Intelligence overview metrics"><p className="cgi-kicker">Cardiovascular Intelligence Overview</p><div className="cgi-metrics-grid">{METRICS.map(([key, label, description]) => <button className="cgi-metric-card" key={key} onClick={() => inspectMetric(key)} disabled={!metrics} aria-label={`Inspect ${label}`}><span className="cgi-metric-label">{label}</span><span className={`cgi-metric-value${key === "indexed_research_records" ? " accent" : ""}`}>{metrics ? metrics[key]?.toLocaleString() ?? "Unavailable" : state.loading ? "…" : "Unavailable"}</span><span className="cgi-metric-sub">{metrics?.metric_definitions?.[key] ?? description}</span></button>)}</div></section>
      <div className="cgi-two-col"><ResearchWorkflow onRecord={inspectRecord} onTask={setSelectedTask} onComplete={() => setRevision(value => value + 1)} /><div className="cgi-stack"><SourceConfigurationPanel sources={metrics?.source_configuration} /><div className="cgi-panel"><div className="cgi-panel-header"><span className="cgi-panel-title"><FileText size={14} aria-hidden />Existing CardioTwin Modules</span></div><div className="cgi-panel-body">{[
        ["/cardiotwin", "Coronary Risk Prediction"], ["/cardiotwin/hemo", "Cardio-Hemo Twin"], ["/cardiotwin/atlas", "Atlas + Evidence Passport"], ["/cardiotwin/intelligence", "3D Evidence Intelligence"], ["/interop", "FHIR Interoperability"],
      ].map(([to, label]) => <Link className="cgi-module-link" to={to} key={to}>{label}<ArrowRight size={13} aria-hidden /></Link>)}</div></div>{metrics?.limitations?.map(item => <p className="cgi-notice" key={item}>{item}</p>)}</div></div>
    </div>}
    {tab === "evidence-map" && <EvidenceFlowPanel revision={revision} onRecord={inspectRecord} />}
    {tab === "trials" && <TrialsPanel revision={revision} onRecord={inspectRecord} />}
    {tab === "pipeline" && <div className="cgi-two-col"><PipelinePanel revision={revision} onProgram={setSelectedProgram} /><SafetyPanel revision={revision} sources={metrics?.source_configuration} /></div>}
    {tab === "safety" && <SafetyPanel revision={revision} sources={metrics?.source_configuration} />}
    {tab === "agents" && <div className="cgi-two-col"><AgentMonitorPanel revision={revision} onTask={setSelectedTask} /><div className="cgi-panel"><div className="cgi-panel-header"><span className="cgi-panel-title"><FileText size={14} aria-hidden />Evidence Passport Verifier</span></div><div className="cgi-panel-body"><PassportPanel /></div></div></div>}
    <footer className="cgi-footer">CardioTwin Global Evidence · Source traceability supports research review · Evidence integrity does not establish clinical validity</footer>
    {selectedRecord && <RecordDrawer id={selectedRecord} onClose={() => setSelectedRecord(null)} />}
    {selectedTask && <TaskDrawer id={selectedTask} onClose={() => setSelectedTask(null)} />}
    {selectedMetric && <MetricRecords metric={selectedMetric} onRecord={inspectRecord} onClose={() => setSelectedMetric(null)} />}
    {selectedProgram && <ProgramDrawer program={selectedProgram} onRecord={inspectRecord} onClose={() => setSelectedProgram(null)} />}
    {showSources && <ResearchDrawer title="Connected source configuration" onClose={() => setShowSources(false)}><SourceConfigurationPanel sources={metrics?.source_configuration} /></ResearchDrawer>}
  </div>;
}
