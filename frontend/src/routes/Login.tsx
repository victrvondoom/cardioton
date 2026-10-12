/**
 * /login — email + password sign-in.
 *
 * Polished pre-demo: ClinCase mark (public/clincase-mark.svg), flat pixel
 * geometry accents, and one-click demo accounts so evaluators can land in a
 * workspace without typing.
 */
import { Loader2, LogIn, Moon, ShieldCheck, Sparkles, Sun } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../components/AuthContext";
import { useTheme } from "../lib/theme";
import { SpatialBackdrop } from "../components/SpatialBackdrop";
import { PixelCluster } from "../pixel/PixelCluster";
import { PixelStaircase } from "../pixel/PixelStaircase";
import { HEART_BITMAP } from "../pixel/bitmaps";

const DEMO_ACCOUNTS = [
  { email: "admin@clincase.health", role: "Admin", desc: "Full access" },
  {
    email: "reviewer@clincase.health",
    role: "Reviewer",
    desc: "Evidence review",
  },
  {
    email: "coordinator@clincase.health",
    role: "Coordinator",
    desc: "Create observations and cases",
  },
];

export default function Login() {
  const { login, demoLogin } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const [email, setEmail] = useState("admin@clincase.health");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(
    e: React.FormEvent | null,
    opts?: { email: string; password: string },
  ) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(opts?.email ?? email, opts?.password ?? password);
      navigate(from, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function loginAs(account: { email: string }) {
    setEmail(account.email);
    setLoading(true);
    setError(null);
    try {
      await demoLogin(account.email);
      navigate(from, { replace: true });
    } catch (e) {
      // Server has one-click demo sign-in switched off: fall back to the typed password.
      if ((e as { status?: number }).status === 404 && password) {
        setLoading(false);
        await handleSubmit(null, { email: account.email, password });
        return;
      }
      setError(
        (e as { status?: number }).status === 404
          ? "One-click demo sign-in is off on this server. Enter the demo password."
          : e instanceof Error
            ? e.message
            : "Demo sign-in failed",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="spatial-auth relative min-h-screen flex items-center justify-center px-4 py-12 overflow-hidden bg-surface-bg">
      <SpatialBackdrop />
      {/* ---- Theme toggle ---- */}
      <button
        type="button"
        onClick={toggle}
        className="absolute top-4 right-4 z-10 inline-grid place-items-center w-9 h-9 rounded-md border border-surface-border bg-surface-raised text-ink-muted hover:text-ink-primary hover:border-surface-border-hi hover:shadow-[var(--shadow-raise)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand"
        aria-label={
          theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
        }
        title={theme === "dark" ? "Switch to light" : "Switch to dark"}
      >
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* ---- Flat pixel geometry accents ---- */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute right-8 top-28 hidden opacity-70 sm:block">
          <PixelCluster map={HEART_BITMAP} cell={8} animate staggerMs={14} />
        </div>
        <div className="absolute bottom-8 left-8 hidden sm:block">
          <PixelStaircase steps={5} cell={8} />
        </div>
      </div>

      <div className="relative w-full max-w-md">
        {/* ---- Logo + lockup ---- */}
        <Link
          to="/"
          className="flex flex-col items-center gap-3 mb-7 group"
          aria-label="CARDIOTON home"
        >
          <div className="relative">
            <img
              src="/clincase-mark.svg"
              alt="CARDIOTON"
              className="relative w-24 h-24 object-contain drop-shadow-[0_12px_40px_rgba(18,18,18,0.5)] group-hover:scale-110 transition-transform duration-300"
              width={96}
              height={96}
            />
          </div>
          <div className="text-center">
            <div className="text-display-primary text-2xl tracking-tight text-ink-primary">
              CARDIOTON
            </div>
            <div className="text-compact text-[11px] text-ink-muted">
              One Health Interoperability Gateway
            </div>
          </div>
        </Link>

        {/* ---- Card ---- */}
        <div className="spatial-card relative bg-surface-raised border border-surface-border rounded p-7">
          <h1 className="text-display-secondary text-xl text-ink-primary mb-1">
            Sign in to your workspace
          </h1>
          <p className="text-ui-secondary text-sm text-ink-muted mb-5">
            Click a demo account below to go straight in, or sign in with your own
            credentials.
          </p>

          <form onSubmit={(e) => handleSubmit(e)} className="space-y-3">
            <div>
              <label
                htmlFor="login-email"
                className="text-compact text-[10px] text-ink-muted block mb-1"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 rounded-lg border border-surface-border bg-surface-bg text-sm text-ink-primary placeholder:text-ink-faint focus:border-accent-brand focus:ring-2 focus:ring-accent-brand/20 focus:outline-none transition-all"
                placeholder="you@org.com"
              />
            </div>
            <div>
              <label
                htmlFor="login-password"
                className="text-compact text-[10px] text-ink-muted block mb-1"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2.5 rounded-lg border border-surface-border bg-surface-bg text-sm text-ink-primary placeholder:text-ink-faint focus:border-accent-brand focus:ring-2 focus:ring-accent-brand/20 focus:outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-xs text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-md px-3 py-2 flex items-center gap-2">
                <span className="text-mono-tech">●</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="text-ui-primary w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent-brand text-ink-invert text-sm shadow-lg shadow-accent-brand/30 hover:shadow-xl hover:shadow-accent-brand/40 hover:-translate-y-px active:translate-y-0 transition-all disabled:opacity-50 disabled:translate-y-0"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <LogIn size={14} />
              )}
              Sign in
            </button>
          </form>

          <div className="text-compact my-5 flex items-center gap-3 text-[10px] text-ink-faint">
            <span className="flex-1 h-px bg-surface-border" />
            Demo accounts · one click, no password
            <span className="flex-1 h-px bg-surface-border" />
          </div>

          <div className="space-y-1.5">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => loginAs(a)}
                disabled={loading}
                className="w-full text-left px-3 py-2.5 rounded-lg border border-surface-border bg-surface-bg/60 hover:bg-surface-raised-hi hover:border-accent-brand/40 hover:shadow-sm transition-all flex items-center justify-between gap-3 disabled:opacity-50 group/account"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-mono-tech text-xs text-ink-primary truncate">
                    {a.email}
                  </div>
                  <div className="text-compact text-[10px] text-ink-muted">
                    {a.role} · {a.desc}
                  </div>
                </div>
                <Sparkles
                  size={14}
                  className="text-accent-brand shrink-0 group-hover/account:rotate-12 transition-transform"
                />
              </button>
            ))}
          </div>

          <div className="text-ui-secondary mt-5 pt-4 border-t border-surface-border text-center text-xs text-ink-muted">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="text-accent-brand font-medium hover:underline"
            >
              Create one
            </Link>
          </div>
        </div>

        {/* ---- Compliance footer ---- */}
        <div className="text-micro mt-6 flex items-center justify-center gap-1.5 text-ink-faint">
          <ShieldCheck size={11} className="text-accent-green" />
          <span>
            Demo workspace · human review required · no compliance attestation
          </span>
        </div>
        <div className="text-micro mt-2 text-center text-ink-faint leading-relaxed">
          7-agent LangGraph DAG · governed model gateway · configured AI provider ·
          MCP-compatible
        </div>
      </div>
    </div>
  );
}
