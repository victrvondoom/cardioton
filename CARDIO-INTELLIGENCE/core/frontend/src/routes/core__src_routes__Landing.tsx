/**
 * / — public marketing landing page.
 *
 * Pixel-native CardioTwin identity: near-black canvas, tight geometric sans
 * headlines, original square compositions, an interactive pixel-particle
 * field, and hairline section dividers. Runs its own scoped palette under
 * .pixel-landing (see landing/landing.css) that follows the app's dark/light
 * choice so a visitor who flips theme doesn't get flipped back.
 *
 * Reachable signed-out; signed-in visitors get "Enter the workspace" CTAs.
 */
import { useEffect } from "react";

import FinalCTA from "../landing/core__src_landing__FinalCTA";
import Footer from "../landing/core__src_landing__Footer";
import Hero from "../landing/core__src_landing__Hero";
import HowItWorks from "../landing/core__src_landing__HowItWorks";
import Integrations from "../landing/core__src_landing__Integrations";
import LiveStatus from "../landing/core__src_landing__LiveStatus";
import Metrics from "../landing/core__src_landing__Metrics";
import Nav from "../landing/core__src_landing__Nav";
import ProblemSection from "../landing/core__src_landing__ProblemSection";
import TrustSection from "../landing/core__src_landing__TrustSection";
import { useTheme } from "../lib/core__src_lib__theme";
import "../landing/landing.css";

export default function Landing() {
  const { theme } = useTheme();

  // Paint the document background to match so overscroll doesn't flash the
  // opposite color, and undo it on the way out so app routes are unaffected.
  useEffect(() => {
    const previous = document.body.style.backgroundColor;
    document.body.style.backgroundColor = theme === "light" ? "#FAFAF8" : "#0D0E10";
    return () => {
      document.body.style.backgroundColor = previous;
    };
  }, [theme]);

  return (
    <div className="pixel-landing" data-theme={theme}>
      <Nav />
      <Hero />
      <div className="pl-divider" aria-hidden="true" />
      <ProblemSection />
      <div className="pl-divider" aria-hidden="true" />
      <HowItWorks />
      <div className="pl-divider" aria-hidden="true" />
      <LiveStatus />
      <div className="pl-divider" aria-hidden="true" />
      <Metrics />
      <div className="pl-divider" aria-hidden="true" />
      <Integrations />
      <div className="pl-divider" aria-hidden="true" />
      <TrustSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}
