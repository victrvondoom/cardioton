import type { ReactNode } from "react";

import CountUp from "./CountUp";
import Reveal from "./Reveal";
import { useSystemHealth } from "./useSystemHealth";

export default function Metrics() {
  const { health, capabilities, latencyMs, loading, error, updatedAt, refresh } = useSystemHealth();

  // Every number is read from this deployment (/capabilities + /healthz); an unavailable value shows "--".
  const sys = capabilities?.system;
  const cards: { label: string; display: ReactNode; accent?: boolean }[] = [
    { label: "agents in the pipeline", display: <CountUp value={sys?.agents ?? null} /> },
    { label: "sub-agents", display: <CountUp value={sys?.sub_agents ?? null} /> },
    { label: "payer policies indexed", display: <CountUp value={sys?.policies_indexed ?? null} /> },
    { label: "CMS-0057-F clauses tracked", display: <CountUp value={capabilities?.compliance?.cms_0057f_clauses_tracked ?? null} /> },
    { label: "this health check", display: latencyMs != null ? `${latencyMs}ms` : "--", accent: true },
  ];

  return (
    <section id="metrics" className="pl-section">
      <div className="pl-section-inner">
        <div className="pl-section-head">
          <Reveal as="p" className="pl-kicker">
            Deployment metrics
          </Reveal>
          <Reveal as="h2" className="pl-h2" delay={60}>
            Numbers from this running instance.
          </Reveal>
          <Reveal as="p" className="pl-section-sub" delay={120}>
            {error
              ? `Refresh unavailable.${updatedAt ? ` Showing the last successful reading from ${new Date(updatedAt).toLocaleTimeString()}.` : " No successful reading yet."}`
              : loading
              ? "fetching..."
              : health
                ? `Checked ${updatedAt ? new Date(updatedAt).toLocaleTimeString() : "this session"}. Updates follow your live update preference.`
                : "backend unreachable right now."}{" "}
            <button type="button" onClick={refresh} disabled={loading} className="pl-link-btn">{loading ? "Refreshing…" : "Refresh metrics"}</button>
          </Reveal>
        </div>

        <div className="pl-metrics">
          {cards.map((card, i) => (
            <Reveal
              key={card.label}
              delay={i * 50}
              className="pl-metric"
              style={{ borderRight: "none", borderBottom: "none", background: "transparent", padding: 0 }}
            >
              <div className="pl-metric-value">
                {card.accent ? <span className="pl-metric-accent">{card.display}</span> : card.display}
              </div>
              <div className="pl-metric-label">{card.label}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
