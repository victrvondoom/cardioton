/** Compact 56px app header with search, live status and refresh controls,
 * notifications, theme and user profile. Activity details open in the status menu. */
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  Bell,
  BookOpen,
  CheckCircle,
  Heart,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "./core__src_components__AuthContext";
import { ProfilePanel } from "./ProfilePanel";
import { ActivityTicker } from "./core__src_components__ActivityTicker";
import { LiveDataControls } from "./LiveDataControls";
import { EMPTY_SNAPSHOT, buildNotifications, fetchSnapshot, notifSignature, type TickerIcon, type Tone } from "../lib/liveFeed";
import { useTheme } from "../lib/core__src_lib__theme";
import { useLive } from "../lib/core__src_lib__useLive";

interface Props {
  onOpenSearch: () => void;
  oneHealth?: boolean;
}

export function TopBar({ onOpenSearch, oneHealth = false }: Props) {
  const { theme, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const searchShortcut = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-30 transition-colors duration-200 border-b ${
        scrolled
          ? "bg-surface-bg/95 border-surface-border"
          : "bg-surface-bg/90 border-surface-border/60"
      }`}
    >
      <div className="h-14 flex items-center justify-between px-3 sm:px-4 lg:px-5 gap-2 sm:gap-3">
        <Link
          to={oneHealth ? "/journey" : "/dashboard"}
          className="flex items-center gap-2 sm:gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand rounded-md min-w-0 lg:w-[176px] lg:shrink-0"
          aria-label="CARDIOTON home — open Dashboard"
        >
          <img
            src="/clincase-mark.svg"
            alt=""
            aria-hidden="true"
            className="w-8 h-8 object-contain shrink-0"
            width={32}
            height={32}
          />
          <div className="leading-tight min-w-0">
            <div className="text-ui-primary tracking-[0.01em] text-ink-primary text-[15px] truncate inline-flex items-center gap-1.5">
              CARDIOTON
              <span aria-hidden="true" className="inline-block h-[7px] w-[7px] bg-accent-brand" />
            </div>
            <div className="text-compact hidden sm:block text-[9px] text-ink-muted">
              World Cardiology Clinic
            </div>
          </div>
        </Link>

        {/* Desktop search */}
        <div className="flex-1 max-w-xl hidden md:block">
          <button
            type="button"
            onClick={onOpenSearch}
            className="w-full h-9 px-3 flex items-center gap-2.5 rounded-md border border-surface-border bg-surface-raised hover:border-surface-border-hi hover:shadow-[var(--shadow-raise)] text-left text-[13px] text-ink-muted transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand"
          >
            <Search size={14} className="text-ink-faint" />
            <span className="text-ui-secondary flex-1">Search workspaces and tools…</span>
            <span className="text-mono-tech text-[10px] text-ink-faint">{searchShortcut}</span>
          </button>
        </div>

        {/* Mobile-only search icon */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="md:hidden inline-grid place-items-center w-9 h-9 rounded-md border border-surface-border bg-surface-raised text-ink-muted hover:text-ink-primary hover:border-surface-border-hi hover:shadow-[var(--shadow-raise)] transition-all duration-200 shrink-0"
          aria-label="Search"
        >
          <Search size={14} />
        </button>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <StatusPill oneHealth={oneHealth} />
          <NotificationsBell />
          <button
            type="button"
            onClick={toggle}
            className="inline-grid place-items-center w-8 h-8 rounded-md border border-surface-border bg-surface-raised text-ink-muted hover:text-ink-primary hover:border-surface-border-hi hover:shadow-[var(--shadow-raise)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <UserChip />
        </div>
      </div>
    </header>
  );
}

// ---------- Link to measured deployment status ----------
function StatusPill({ oneHealth }: { oneHealth: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismiss(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <details ref={ref} className="workspace-status">
      <summary aria-label="Live status and update controls" title="Live status and update controls">
        <Activity size={14} aria-hidden="true" /><span className="hidden lg:inline">Live status</span>
      </summary>
      <div className="workspace-status__panel">
        <ActivityTicker oneHealth={oneHealth} inline />
        <LiveDataControls />
        <Link to="/compliance" onClick={() => { if (ref.current) ref.current.open = false; }} className="workspace-status__link">Check live system status &amp; compliance →</Link>
      </div>
    </details>
  );
}

// ---------- Notifications bell ----------
type NotifTone = Tone;
const NOTIF_ICON: Record<TickerIcon, LucideIcon> = {
  activity: Activity, alert: AlertCircle, check: CheckCircle, heart: Heart, shield: ShieldCheck, spark: BookOpen, zap: Zap,
};
const READ_KEY = "clincase-notifs-read";

function loadRead(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<Set<string>>(loadRead);
  const ref = useRef<HTMLDivElement>(null);
  // Real notifications from live state; a count change makes an item unread again.
  const notifs = buildNotifications(useLive(fetchSnapshot, [], 60_000).data ?? EMPTY_SNAPSHOT);
  const unread = notifs.filter((n) => !read.has(notifSignature(n))).length;
  const markAllRead = () => {
    const next = new Set(notifs.map(notifSignature));
    setRead(next);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify([...next]));
    } catch {
      /* private mode — read state simply won't persist */
    }
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const toneCls = (t: NotifTone) =>
    t === "red"     ? "text-accent-red     bg-accent-red/10    border-accent-red/30"
    : t === "emerald" ? "text-accent-green   bg-accent-green/10  border-accent-green/30"
    : t === "amber" ? "text-accent-amber   bg-accent-amber/10  border-accent-amber/30"
    : t === "cyan"  ? "text-accent-cyan    bg-accent-cyan/10   border-accent-cyan/30"
    :                 "text-accent-brand-glow bg-accent-brand/10 border-accent-brand/30";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
        }}
        className="relative inline-grid place-items-center w-8 h-8 rounded-md border border-surface-border bg-surface-raised text-ink-muted hover:text-ink-primary hover:border-surface-border-hi hover:shadow-[var(--shadow-raise)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand"
        aria-label="Notifications"
      >
        <Bell size={14} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent-red text-white text-[9px] text-mono-tech font-semibold grid place-items-center border-2 border-surface-bg">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-[360px] rounded-xl border border-surface-border bg-surface-raised overflow-hidden card-pop animate-slide-in-down origin-top-right"
          style={{ boxShadow: "var(--shadow-pop)" }}
        >
          <div className="px-3.5 py-2.5 border-b border-surface-border flex items-center justify-between">
            <span className="text-[12px] font-semibold text-ink-primary">Notifications</span>
            <span className="text-[10px] text-mono-tech text-ink-muted" data-testid="notif-count">{notifs.length === 0 ? "all clear" : `${unread} new · ${notifs.length} total`}</span>
          </div>
          <ul className="max-h-[360px] overflow-auto divide-y divide-surface-border">
            {notifs.length === 0 && (
              <li className="px-3.5 py-6 text-center text-[12px] text-ink-muted" data-testid="notif-empty">Nothing needs your attention.</li>
            )}
            {notifs.map((n) => {
              const Icon = NOTIF_ICON[n.icon];
              const body = (
                <>
                  <span className={`shrink-0 w-7 h-7 rounded-md grid place-items-center border ${toneCls(n.tone)}`}>
                    <Icon size={13} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-ink-primary">{n.title}</div>
                    <div className="text-[11px] text-ink-muted">{n.body}</div>
                  </div>
                  {!read.has(notifSignature(n)) && <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-brand" aria-label="unread" />}
                </>
              );
              return (
                <li key={n.key} data-testid={`notif-${n.key}`}>
                  {n.to ? (
                    <Link to={n.to} onClick={() => setOpen(false)} className="px-3.5 py-2.5 hover:bg-surface-raised-hi flex items-start gap-2.5">{body}</Link>
                  ) : (
                    <div className="px-3.5 py-2.5 flex items-start gap-2.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="px-3.5 py-2 border-t border-surface-border bg-surface-raised-hi/40 flex items-center justify-between">
            <button
              type="button"
              onClick={markAllRead}
              className="text-[11px] text-mono-tech text-ink-muted hover:text-ink-body"
            >
              Mark all read
            </button>
            <Link to="/cases" onClick={() => setOpen(false)} className="text-[11px] text-mono-tech text-accent-brand-glow hover:underline">
              View all →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- User chip with role — click to open the Profile panel ----------
function UserChip() {
  const { user } = useAuth();
  const role = (user?.role ?? "admin").toLowerCase();
  const isAdmin = role === "admin";

  // Use name/email initials when available, falling back to "CC" (ClinCase)
  const initials =
    (user?.full_name ?? user?.email ?? "CARDIOTON")
      .split(/[@.\s]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "CC";

  const displayName = (user?.full_name ?? user?.email?.split("@")[0] ?? "clincase").toLowerCase();

  return (
    <ProfilePanel
      trigger={({ onClick, open }) => (
        <button
          type="button"
          onClick={onClick}
          aria-expanded={open}
          aria-label="Profile and activity"
          className="flex items-center gap-2 h-8 px-1 md:pr-2.5 rounded-md border border-surface-border bg-surface-raised hover:border-surface-border-hi hover:shadow-[var(--shadow-raise)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand"
        >
          <div className="w-6 h-6 rounded grid place-items-center text-[10px] text-mono-tech font-semibold text-accent-brand bg-accent-brand/15">
            {initials}
          </div>
          <div className="leading-tight hidden lg:block">
            <div className="text-[11px] font-medium text-ink-primary truncate max-w-[110px]">{displayName}</div>
            <div className="text-[9px] text-mono-tech text-ink-muted uppercase tracking-wider">
              {isAdmin ? "Admin" : role}
            </div>
          </div>
        </button>
      )}
    />
  );
}
