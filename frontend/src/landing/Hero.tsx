/**
 * Landing hero — pixel-native CardioTwin identity.
 *
 * Near-black full viewport, one large tightly-tracked geometric headline, one
 * supporting sentence, one primary action. Original square compositions frame
 * the message on both edges; an interactive square-particle field and a
 * stepped ECG trace run behind the copy. All motion is staggered and settles
 * — no bouncing, no loops on the text.
 */
import { Link } from "react-router-dom";

import { useAuth } from "../components/AuthContext";
import { HEART_BITMAP } from "../pixel/bitmaps";
import { PixelCluster } from "../pixel/PixelCluster";
import { PixelEcgTrace } from "../pixel/PixelEcgTrace";
import { PixelField } from "../pixel/PixelField";
import { PixelMosaic } from "../pixel/PixelMosaic";
import { PixelStaircase } from "../pixel/PixelStaircase";
import Reveal from "./Reveal";
import { useSystemHealth } from "./useSystemHealth";

export default function Hero() {
  const { health, capabilities, latencyMs, loading, error, updatedAt } = useSystemHealth();
  const { user } = useAuth();

  return (
    <section className="pl-hero">
      {/* Interactive square-particle field + engineering grid */}
      <div className="pl-grid-bg absolute inset-0" aria-hidden="true" />
      <PixelField className="opacity-70" density={0.8} maxParticles={70} aria-hidden="true" />

      {/* Edge compositions — original CardioTwin pixel structures */}
      <div className="pl-hero-side pl-hero-side--left" aria-hidden="true">
        <PixelStaircase steps={6} cell={18} animate />
        <div className="mt-4">
          <PixelMosaic cols={7} rows={4} density={0.5} seed={11} cell={10} animate />
        </div>
      </div>
      <div className="pl-hero-side pl-hero-side--right" aria-hidden="true">
        <PixelCluster map={HEART_BITMAP} cell={12} animate staggerMs={18} ariaLabel="Pixel heart composition" />
      </div>

      <div className="pl-hero-inner">
        <Reveal as="p" className="pl-kicker">
          CARDIOTON / CARDIOVASCULAR DIGITAL TWIN
        </Reveal>

        <Reveal as="h1" className="pl-h1" delay={90}>
          Understand the heart.
          <br />
          Before the <span className="pl-accent">next heartbeat</span>.
        </Reveal>

        <Reveal as="p" className="pl-lede" delay={180}>
          One connected workspace where cardiac models, live agent runs and
          traceable evidence meet — built on a square, honest grid.
        </Reveal>

        <Reveal as="div" className="pl-cta-row" delay={260}>
          {user ? (
            <Link to="/dashboard" className="pl-btn pl-btn-primary">
              Enter the workspace
            </Link>
          ) : (
            <>
              <Link to="/signup" className="pl-btn pl-btn-primary">
                Create an account
              </Link>
              <Link to="/login" className="pl-btn">
                Sign in
              </Link>
            </>
          )}
          <a href="#how-it-works" className="pl-btn">
            See how it works
          </a>
        </Reveal>

        {/* Stepped ECG strip — decorative rhythm under the message */}
        <Reveal as="div" className="mt-10 mx-auto max-w-xl" delay={340} aria-hidden="true">
          <PixelEcgTrace beats={3} width={480} height={56} color="orange" animate />
        </Reveal>
      </div>

      <div className="pl-scroll-cue" aria-hidden="true">
        <PixelStaircase steps={3} cell={6} animate={false} colors={["orange", "yellow", "red"]} />
        <span>Scroll</span>
      </div>

      <div className="pl-statusline">
        {error ? (
          `Live status unavailable${updatedAt ? ` · last successful check ${new Date(updatedAt).toLocaleTimeString()}` : ""}`
        ) : loading && !health ? (
          "checking this deployment..."
        ) : health ? (
          <>
            api {health.status} &middot; database {health.db} &middot; {latencyMs}ms
            {health.case_storage_configured === false ? " · case storage disconnected" : ""}
            {updatedAt ? ` · checked ${new Date(updatedAt).toLocaleTimeString()}` : ""}
            {loading ? " · refreshing…" : ""}
            {capabilities?.deployment?.llm_provider
              ? ` · reasoning on ${capabilities.deployment.llm_provider}`
              : ""}
          </>
        ) : (
          "backend unreachable -- start the API to see live status"
        )}
      </div>
    </section>
  );
}
