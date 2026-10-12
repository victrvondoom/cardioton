import { Link } from "react-router-dom";

import { DOMAINS } from "./tokens";

export default function Footer() {
  return (
    <footer className="pl-footer">
      <div className="pl-footer-inner">
        <div>
          <div className="pl-footer-brand">
            <span className="pl-brand-mark" aria-hidden="true">
              <i /><i /><i /><i />
            </span>
            CARDIOTON
          </div>
          <div className="pl-footer-note">
            You treat patients. We&rsquo;ll take the calls &mdash; prior authorization
            across {DOMAINS.length} cancer programs.
          </div>
        </div>
        <div className="pl-footer-cols">
          <div className="pl-footer-col">
            <span>Product</span>
            <a href="#how-it-works">How it works</a>
            <a href="#live-status">Live status</a>
            <a href="#metrics">Metrics</a>
          </div>
          <div className="pl-footer-col">
            <span>Account</span>
            <Link to="/login">Sign in</Link>
            <Link to="/signup">Sign up</Link>
          </div>
        </div>
      </div>
      <div className="pl-footer-legal">
        &copy; {new Date().getFullYear()} CARDIOTON.
      </div>
      {/* Horizontal warm bands — the cohesive pixel ending. */}
      <div className="pl-colorband" aria-hidden="true">
        <i /><i /><i /><i /><i />
      </div>
    </footer>
  );
}
