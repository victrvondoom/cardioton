import { Loader2, RotateCw } from "lucide-react";

import Reveal from "./core__src_landing__Reveal";
import { HEALTH_URL, useSystemHealth } from "./core__src_landing__useSystemHealth";

/**
 * A real, unauthenticated call to this deployment's health endpoint — the
 * landing page's one claim a visitor can verify without an account.
 */
export default function LiveStatus() {
  const { health, capabilities, latencyMs, loading, error, checkedAt, updatedAt, refresh } =
    useSystemHealth();

  return (
    <section id="live-status" className="pl-section">
      <div className="pl-section-inner" style={{ maxWidth: "760px" }}>
        <div className="pl-section-head">
          <Reveal as="p" className="pl-kicker" style={{ justifyContent: "center" }}>
            Try it
          </Reveal>
          <Reveal as="h2" className="pl-h2" delay={60}>
            A real call to the running system, right now.
          </Reveal>
        </div>

        <Reveal className="pl-panel">
          <div className="pl-panel-head">
            <span>~ curl {HEALTH_URL}</span>
            <button type="button" onClick={refresh} disabled={loading} className="pl-link-btn">
              {loading ? <Loader2 size={12} className="pl-spin" /> : <RotateCw size={12} />}
              Refresh status
            </button>
          </div>

          {loading && <div style={{ color: "var(--muted)" }}>connecting...</div>}

          {error && !loading && (
            <div style={{ color: "var(--p-red)" }}>
              request failed: {error}
              {updatedAt && <div style={{ marginTop: "0.5rem", fontSize: "0.74rem", color: "var(--muted)" }}>Last successful reading: {new Date(updatedAt).toLocaleString()}. Previously: API {health?.status}, database {health?.db}.</div>}
              <div style={{ color: "var(--faint)", marginTop: "0.5rem", fontSize: "0.74rem" }}>
                Refresh to retry the running service.
              </div>
            </div>
          )}

          {health && !loading && !error && (
            <>
              <div style={{ color: "var(--p-orange)", marginBottom: "0.6rem" }}>
                &#8618; {latencyMs}ms &middot; status: {health.status} &middot; db:{" "}
                {health.db}
                {checkedAt ? ` · ${new Date(checkedAt).toLocaleTimeString()}` : ""}
              </div>
              <pre>
                {JSON.stringify(
                  {
                    healthz: health,
                    ...(capabilities
                      ? {
                          deployment: capabilities.deployment,
                          compliance: capabilities.compliance,
                        }
                      : {}),
                  },
                  null,
                  2,
                )}
              </pre>
            </>
          )}
        </Reveal>
      </div>
    </section>
  );
}
