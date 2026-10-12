import { Link } from "react-router-dom";

import { useAuth } from "../components/AuthContext";
import { PixelStaircase } from "../pixel/PixelStaircase";
import Reveal from "./Reveal";

export default function FinalCTA() {
  const { user } = useAuth();

  return (
    <section className="pl-section" style={{ textAlign: "center", paddingTop: "7rem", paddingBottom: "7rem" }}>
      <div className="pl-section-inner" style={{ maxWidth: "680px" }}>
        <Reveal>
          <div aria-hidden="true" className="mb-6 flex justify-center">
            <PixelStaircase steps={5} cell={14} animate colors={["red", "orange", "yellow", "blue", "green"]} />
          </div>
          <h2 className="pl-h2">Give the calls back to us.</h2>
          <p className="pl-section-sub" style={{ marginBottom: "2rem" }}>
            Start with one regimen and one payer. Watch a case go from referral to submitted
            authorization in a single sitting.
          </p>
          <div className="pl-cta-row">
            {user ? (
              <Link to="/dashboard" className="pl-btn pl-btn-primary">
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link to="/signup" className="pl-btn pl-btn-primary">
                  Sign up
                </Link>
                <Link to="/login" className="pl-btn">
                  Sign in
                </Link>
              </>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
