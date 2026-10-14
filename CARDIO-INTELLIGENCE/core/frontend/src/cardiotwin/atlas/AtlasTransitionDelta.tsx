import { hemoDate, hemoLabel, hemoValue, type WhySelection } from "../HemoPanels";
import { HEMO_AXES, type HemoEvidence, type HemoSnapshot, type HemoTransition } from "../hemoTypes";
import type { AtlasResult } from "./core__cardiotwin_atlas__types";

type Props = { result: AtlasResult; selected: WhySelection; onEvidence: (id: string) => void };
type TransitionSelection = WhySelection & { id?: string; transition_id?: string; axis?: string };
const normalized = (value: string) => value.toLowerCase().replace(/[_\s]+/g, " ").trim();
const clock = (value: string) => Date.parse(value);
const validAxis = (axis: string) => axis === "congestion" || HEMO_AXES.some(([key]) => key === axis);

function matchTransition(result: AtlasResult, selected: TransitionSelection): HemoTransition | undefined {
  const id = selected.transition_id ?? selected.id;
  return result.twin.transitions.find(transition => {
    if (!validAxis(transition.axis) || clock(transition.timestamp) > clock(result.as_of)) return false;
    if (id) return transition.id === id;
    return selected.from !== undefined
      && normalized(selected.axis ?? selected.title) === normalized(transition.axis)
      && clock(selected.timestamp) === clock(transition.timestamp)
      && selected.from === transition.from_level
      && selected.to === transition.to_level;
  });
}

function axisState(snapshot: HemoSnapshot | undefined, axis: string) {
  if (!snapshot) return undefined;
  if (axis === "congestion") return { ...snapshot.congestion, level: snapshot.congestion.stage };
  const key = HEMO_AXES.find(([candidate]) => candidate === axis)?.[0];
  return key ? snapshot[key] : undefined;
}

/** Compare recorded historical support sets; never infer why a reference ceased to contribute. */
export default function AtlasTransitionDelta({ result, selected, onEvidence }: Props) {
  const transition = matchTransition(result, selected);
  if (!transition) return null;

  const at = clock(transition.timestamp), boundary = clock(result.as_of);
  const history = result.twin.timeline
    .filter(snapshot => Number.isFinite(clock(snapshot.timestamp)) && clock(snapshot.timestamp) <= at && clock(snapshot.timestamp) <= boundary)
    .sort((a, b) => clock(a.timestamp) - clock(b.timestamp));
  const current = history.find(snapshot => clock(snapshot.timestamp) === at);
  const previous = history.filter(snapshot => clock(snapshot.timestamp) < at).at(-1);
  const before = axisState(previous, transition.axis), after = axisState(current, transition.axis);
  const admitted = new Map(result.twin.evidence
    .filter(evidence => clock(evidence.event_at) <= boundary && clock(evidence.available_at) <= boundary)
    .map(evidence => [evidence.id, evidence]));
  const references = (state: typeof before, snapshot: HemoSnapshot | undefined) => new Set(
    (state?.evidence_refs ?? []).filter(id => {
      const evidence = admitted.get(id);
      return evidence !== undefined && snapshot !== undefined
        && clock(evidence.event_at) <= clock(snapshot.timestamp)
        && clock(evidence.available_at) <= clock(snapshot.timestamp);
    }),
  );
  const beforeRefs = references(before, previous), afterRefs = references(after, current);
  const comparable = Boolean(before && after);
  const added = comparable ? [...afterRefs].filter(id => !beforeRefs.has(id)).sort() : [];
  const removed = comparable ? [...beforeRefs].filter(id => !afterRefs.has(id)).sort() : [];
  const retained = [...beforeRefs].filter(id => afterRefs.has(id)).length;
  const renderEvidence = (ids: string[], action: "added" | "removed") => <div className="atlas-citations">{ids.map(id => {
    const evidence = admitted.get(id) as HemoEvidence;
    return <button type="button" key={id} onClick={() => onEvidence(id)} aria-label={`Trace ${action} ${hemoLabel(evidence.kind)}: ${id}`}>
      {hemoLabel(evidence.kind)}: {hemoValue(evidence.value)} {evidence.unit ?? ""} · {id}
    </button>;
  })}</div>;

  return <section className="atlas-panel" aria-label="Transition evidence change summary">
    <div className="atlas-panel-head"><div><p className="atlas-kicker">Recorded support sets · historical comparison</p><h2>What changed in the evidence?</h2></div><span className="atlas-badge">DERIVED · REVIEW REQUIRED</span></div>
    <p>{hemoLabel(transition.axis)} · {hemoLabel(transition.from_level)} → {hemoLabel(transition.to_level)} · {hemoDate(transition.timestamp, true)} UTC</p>
    <div className="atlas-two-col">
      <div><h3>Previous historical state</h3><p>{before?.level ?? "UNKNOWN"} · Confidence: {before?.confidence ?? "UNKNOWN"}</p><p className="atlas-muted">{previous ? `${hemoDate(previous.timestamp, true)} UTC` : "UNKNOWN · no preceding historical snapshot"}</p></div>
      <div><h3>State at this transition</h3><p>{after?.level ?? "UNKNOWN"} · Confidence: {after?.confidence ?? "UNKNOWN"}</p><p className="atlas-muted">{current ? `${hemoDate(current.timestamp, true)} UTC` : "UNKNOWN · no snapshot recorded at this transition"}</p></div>
    </div>
    <p className="atlas-muted">Evidence-support confidence: {before?.confidence ?? "UNKNOWN"} → {after?.confidence ?? "UNKNOWN"}. This is not diagnostic probability.</p>
    {comparable ? <><div className="atlas-two-col">
      <div><h3>Evidence added to this state ({added.length})</h3>{added.length ? renderEvidence(added, "added") : <p className="atlas-muted">No newly referenced evidence.</p>}</div>
      <div><h3>Evidence removed from this state ({removed.length})</h3>{removed.length ? renderEvidence(removed, "removed") : <p className="atlas-muted">No evidence references removed.</p>}</div>
    </div><p className="atlas-muted">{retained} evidence reference{retained === 1 ? "" : "s"} retained across these snapshots.</p></> : <p className="atlas-muted">Evidence change is UNKNOWN because a preceding or transition snapshot is unavailable. No added/removed evidence is inferred.</p>}
    <p className="atlas-muted">Removed means no longer referenced by this state. It does not imply deletion of the original record or establish why support changed. Only evidence admitted at the active replay boundary is traceable here.</p>
  </section>;
}
