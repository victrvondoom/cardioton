import Reveal from "./core__src_landing__Reveal";

import { LIFECYCLE_STEPS } from "./core__src_landing__tokens";

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="pl-section">
      <div className="pl-section-inner">
        <div className="pl-section-head">
          <Reveal as="p" className="pl-kicker">
            01–06 · Authorization lifecycle
          </Reveal>
          <Reveal as="h2" className="pl-h2" delay={60}>
            Six steps, one traceable record.
          </Reveal>
        </div>
        <div className="pl-steps">
          {LIFECYCLE_STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 60} className="pl-step" style={{ background: "var(--panel)" }}>
              <span className="pl-step-n">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
