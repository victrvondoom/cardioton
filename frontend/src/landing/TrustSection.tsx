import Reveal from "./Reveal";

import { COMPLIANCE_MARKS } from "./tokens";

export default function TrustSection() {
  return (
    <section className="pl-section">
      <div className="pl-section-inner" style={{ maxWidth: "760px" }}>
        <div className="pl-section-head">
          <Reveal as="p" className="pl-kicker">
            Governed by default
          </Reveal>
          <Reveal as="h2" className="pl-h2" delay={60}>
            Every decision, accounted for.
          </Reveal>
          <Reveal as="p" className="pl-section-sub" delay={120}>
            Local document extraction is the default. Cloud OCR requires deployment approval. Identifier screening is not complete de-identification; review documents before sharing. Low-confidence cases
            route to a named human reviewer rather than auto-approving. Every case carries a
            timeline you can hand to an auditor.
          </Reveal>
        </div>

        <div className="pl-marks">
          {COMPLIANCE_MARKS.map((mark) => (
            <div key={mark.label} className="pl-mark">
              <div className="pl-mark-label">{mark.label}</div>
              <div className="pl-mark-status">{mark.status}</div>
            </div>
          ))}
        </div>

        <Reveal className="pl-panel">
          <div style={{ color: "var(--faint)", marginBottom: "0.6rem", fontSize: "0.7rem" }}>
            # illustrative case-timeline event (screening is not certification)
          </div>
          <pre>
            {JSON.stringify(
              {
                actor: "system",
                event_type: "document_uploaded",
                title: "Document uploaded: pathology_report.pdf",
                body: "identifier screening: complete · human review: required",
              },
              null,
              2,
            )}
          </pre>
        </Reveal>
      </div>
    </section>
  );
}
