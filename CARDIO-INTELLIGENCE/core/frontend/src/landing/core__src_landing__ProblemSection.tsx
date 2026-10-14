import Reveal from "./core__src_landing__Reveal";

export default function ProblemSection() {
  return (
    <section className="pl-section">
      <div className="pl-section-inner">
        <Reveal style={{ maxWidth: "640px", margin: "0 auto", textAlign: "center" }}>
          <p className="pl-kicker" style={{ justifyContent: "center" }}>
            Without CARDIOTON
          </p>
          <h2 className="pl-h2">
            The regimen is decided on Monday. The approval lands three weeks later.
          </h2>
          <p className="pl-section-sub" style={{ marginBottom: 0 }}>
            A nurse navigator rebuilds the same clinical story for every payer, in every
            portal, on every call. A criterion is buried on page 9 of a policy that was
            revised last month. A denial arrives citing documentation that was in the chart
            the whole time &mdash; and the appeal starts the clock over. Meanwhile the
            patient waits, and the disease does not.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
