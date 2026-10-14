import { CheckCircle2, Circle, CirclePause, Loader2, RotateCcw, Sparkles, Square, TriangleAlert, Zap } from "lucide-react";
import type { ReactNode } from "react";
import type { AutomationController } from "./useAutomation";
import "./automation.css";

export function AutomationPanel({ automation, title, description, onStart, startLabel = "Automate preparation", disabled = false, children }: {
  automation: AutomationController; title: string; description: string;
  onStart: () => void; startLabel?: string; disabled?: boolean; children?: ReactNode;
}) {
  const { state, running } = automation;
  const complete = state.steps.filter(step => step.status === "complete").length;
  const active = state.phase !== "idle";
  const duration = state.startedAt && state.finishedAt ? Math.max(.1, (state.finishedAt - state.startedAt) / 1000).toFixed(1) : null;
  return <section className="automation-panel" aria-label={title} aria-busy={running}>
    <div className="automation-panel__heading">
      <span className="automation-panel__icon"><Zap size={17} aria-hidden /></span>
      <div className="automation-panel__intro"><h2>{title}</h2><p>{description}</p></div>
      <button type="button" className="automation-panel__start" disabled={disabled || running} onClick={onStart}>
        {running ? <Loader2 size={14} className="animate-spin" aria-hidden /> : active ? <RotateCcw size={14} aria-hidden /> : <Sparkles size={14} aria-hidden />}
        {running ? "Running automation…" : state.phase === "failed" || state.phase === "cancelled" ? "Retry preparation" : startLabel}
      </button>
      {running && <button type="button" className="automation-panel__stop" onClick={automation.cancel}><Square size={12} aria-hidden /> Stop</button>}
    </div>
    {active && <div className="automation-panel__run">
      <div role="progressbar" aria-label={`${title} progress`} aria-valuemin={0} aria-valuemax={state.steps.length} aria-valuenow={complete} className="automation-panel__progress"><span style={{ width: `${100 * complete / Math.max(1, state.steps.length)}%` }} /></div>
      <ol className="automation-panel__steps">{state.steps.map(step => <li key={step.id} data-status={step.status}>
        {step.status === "complete" ? <CheckCircle2 size={13} aria-hidden /> : step.status === "running" ? <Loader2 size={13} className="animate-spin" aria-hidden /> : step.status === "paused" ? <CirclePause size={13} aria-hidden /> : step.status === "failed" ? <TriangleAlert size={13} aria-hidden /> : <Circle size={13} aria-hidden />}
        <span>{step.label}</span><span className="sr-only">: {step.status}</span>
      </li>)}</ol>
      <p className="automation-panel__message" role={state.phase === "failed" ? "alert" : "status"}>{state.message}{duration && <span> · {duration}s</span>}</p>
    </div>}
    {children && <div className="automation-panel__results">{children}</div>}
  </section>;
}
