import Reveal from "./core__src_landing__Reveal";

import { DOMAINS } from "./core__src_landing__tokens";
import { useSystemHealth } from "./core__src_landing__useSystemHealth";

export default function Integrations() {
  const { capabilities } = useSystemHealth();
  const deployment = capabilities?.deployment;

  return (
    <section className="pl-section">
      <div className="pl-section-inner" style={{ maxWidth: "820px", textAlign: "center" }}>
        <Reveal as="p" className="pl-kicker" style={{ justifyContent: "center" }}>
          Works with the chart you already keep
        </Reveal>
        <Reveal as="h2" className="pl-h2" delay={60}>
          One workflow, every cancer program.
        </Reveal>

        <div className="pl-chips">
          {DOMAINS.map((d, i) => (
            <Reveal key={d.key} as="span" delay={i * 40} className="pl-chip">
              {d.label}
            </Reveal>
          ))}
        </div>

        {deployment?.llm_provider && (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--faint)" }}>
            reasoning model in this instance: {deployment.llm_provider}
            {deployment.bedrock_model_id ? ` / ${deployment.bedrock_model_id}` : ""}
          </p>
        )}
      </div>
    </section>
  );
}
