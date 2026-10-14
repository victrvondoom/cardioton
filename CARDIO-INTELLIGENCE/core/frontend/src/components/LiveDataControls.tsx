import { Pause, Play, RefreshCw, WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";
import { getLiveUpdateState, requestLiveRefresh, setAutomaticUpdates, subscribeLiveUpdates } from "../lib/liveUpdates";

export function LiveDataControls() {
  const state = useSyncExternalStore(subscribeLiveUpdates, getLiveUpdateState, getLiveUpdateState);
  const label = !state.online ? "Offline" : state.enabled ? "Live updates on" : "Automatic updates paused";
  return <section className="live-data-controls" aria-label="Live data controls">
    <div className="live-data-controls__status">
      {!state.online ? <WifiOff size={13} aria-hidden /> : <span className={`live-data-controls__dot${state.enabled ? " is-live" : ""}`} aria-hidden />}
      <span>{label}</span>
      <span className="live-data-controls__time">{state.pending ? `Refreshing ${state.pending} request${state.pending === 1 ? "" : "s"}…` : state.lastResponseAt ? `Last response ${new Date(state.lastResponseAt).toLocaleTimeString()}` : "Waiting for service responses"}</span>
      {state.unavailable > 0 && <span className="live-data-controls__unavailable">{state.unavailable} unavailable response{state.unavailable === 1 ? "" : "s"}</span>}
    </div>
    <div className="live-data-controls__actions">
      <button type="button" onClick={() => setAutomaticUpdates(!state.enabled)} aria-pressed={state.enabled}>{state.enabled ? <Pause size={12} aria-hidden /> : <Play size={12} aria-hidden />}{state.enabled ? "Pause updates" : "Resume updates"}</button>
      <button type="button" disabled={!state.online || state.pending > 0} onClick={() => requestLiveRefresh()}><RefreshCw size={12} aria-hidden />Refresh now</button>
    </div>
  </section>;
}
