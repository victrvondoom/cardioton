import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { JourneyView } from "../journey/api";
import { AutomationPanel } from "./AutomationPanel";
import { journeyAutomationApi, type JourneyAutomationState } from "./journeyAutomationApi";
import { useAutomation } from "./useAutomation";

/** The server selects each permissible step; saved jobs are the resume checkpoint. */
export function JourneyAutomation({ jobId, disabled = false, onUpdate }: { jobId: string; disabled?: boolean; onUpdate?: (view: JourneyView) => void }) {
  const automation = useAutomation();
  const checkpoint = useRef<JourneyAutomationState | null>(null);
  const [saved, setSaved] = useState<JourneyAutomationState | null>(null);
  async function start() {
    await automation.run([
      { id: "inspect", label: "Read saved progress", run: async control => {
        const state = await journeyAutomationApi.get(jobId);
        if (!control.isCurrent()) return;
        checkpoint.current = state; setSaved(state); onUpdate?.(state.view);
      } },
      { id: "prepare", label: "Prepare remaining evidence", run: async control => {
        let state = checkpoint.current!;
        // At most map, generate and validate. A reviewed job normally generates
        // and validates together through the gateway's existing guarded command.
        for (let count = 0; state.next_step && count < 4; count++) {
          if (control.shouldStop()) return;
          state = await journeyAutomationApi.advance(jobId, state.job_version);
          if (!control.isCurrent()) return;
          checkpoint.current = state; setSaved(state); onUpdate?.(state.view);
        }
        if (state.next_step) throw new Error("Preparation did not reach a handoff. Review the saved journey before continuing.");
        if (state.status === "waiting_review" || state.status === "blocked") return { pause: state.message };
      } },
      { id: "handoff", label: "Confirm review handoff", run: async control => {
        const state = await journeyAutomationApi.get(jobId);
        if (!control.isCurrent()) return;
        checkpoint.current = state; setSaved(state); onUpdate?.(state.view);
        if (state.status === "waiting_review" || state.status === "blocked") return { pause: state.message };
      } },
    ]);
  }
  return <AutomationPanel automation={automation} title="Evidence preparation automation" description="Map source fields, prepare reviewed FHIR evidence and validate it. Saved progress survives navigation; review and sending stay with you." startLabel={saved?.status === "waiting_review" ? "Continue after review" : "Automate evidence preparation"} onStart={() => void start()} disabled={disabled}>
    {saved && <>
      <span>{saved.message}</span>
      <Link to={`/journey/${encodeURIComponent(jobId)}/${saved.view.current_stage}`}>Open saved journey →</Link>
    </>}
  </AutomationPanel>;
}
