import { Moon, Sun } from "lucide-react";

import { Link } from "react-router-dom";

import { useAuth } from "../components/core__src_components__AuthContext";
import { useTheme } from "../lib/core__src_lib__theme";

export default function Nav() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <header className="pl-nav">
      <Link to="/" className="pl-brand" aria-label="CARDIOTON home">
        <span className="pl-brand-mark" aria-hidden="true">
          <i /><i /><i /><i />
        </span>
        CARDIOTON
      </Link>

      <nav className="pl-nav-links" aria-label="Landing">
        <a href="#how-it-works" className="pl-nav-link">How it works</a>
        <a href="#live-status" className="pl-nav-link">Live status</a>
        <a href="#metrics" className="pl-nav-link">Metrics</a>
        <Link to="/interop" className="pl-nav-link">Interop Gateway · Track 7</Link>
        <Link to="/onehealth" className="pl-nav-link">One Health · Track 7</Link>

        <button
          type="button"
          onClick={toggle}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
          className="pl-btn-icon"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {user ? (
          <Link to="/dashboard" className="pl-btn pl-btn-primary">
            Go to dashboard
          </Link>
        ) : (
          <>
            <Link to="/login" className="pl-nav-link">
              Sign in
            </Link>
            <Link to="/signup" className="pl-btn pl-btn-primary">
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
