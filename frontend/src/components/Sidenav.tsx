/** Compact workflow navigation with persistent scroll and preferences. */
import clsx from "clsx";
import {
  Droplets,
  FolderOpen,
  HeartPulse,
  Info,
  LayoutDashboard,
  Lock,
  LogOut,
  Microscope,
  Network,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Stethoscope,
  Upload,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useRef, useLayoutEffect } from "react";
import { areaFor } from "../workflow/areas";
import { NavLink, useLocation } from "react-router-dom";

import { EMPTY_SNAPSHOT, buildNavChips, fetchSnapshot } from "../lib/liveFeed";
import { useLive } from "../lib/useLive";
import { AboutModal } from "./AboutModal";
import { useAuth } from "./AuthContext";

interface NavItem {
  label: string;
  description?: string;
  href: string;
  icon: LucideIcon;
  /** Static badge text. Ignored when `liveBadge` is set — see NavLiveCounts. */
  badge?: string;
  /** Key into NavLiveCounts — badge renders the live count (or nothing while
   * loading / on fetch failure, rather than a stale hardcoded number). */
  liveBadge?: keyof NavLiveCounts;
  chip?: string; // small inline chip (e.g. "CMS-0057-F")
  disabled?: boolean;
  end?: boolean; // active only on an exact match (not on child routes)
  adminOnly?: boolean;
  reviewerOrAdmin?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavLiveCounts {
  cases: number | null;
  awaitingReview: number | null;
}

// World Cardiology Clinic — centralized cardiology digital twin workflow.
// Every route is grouped under a structured clinical workflow so cardiologists
// see a single cohesive clinic, not scattered pages.
const SECTIONS: NavSection[] = [
  {
    label: "Command Center",
    items: [
      { label: "Clinic Dashboard", href: "/dashboard", icon: LayoutDashboard },
      {
        label: "Patient Registry",
        href: "/cases",
        icon: FolderOpen,
        liveBadge: "cases",
        end: true,
      },
      { label: "Clinical Journey", href: "/journey", icon: Workflow },
    ],
  },
  {
    label: "Patient Intake",
    items: [
      { label: "Clinical Intake", href: "/intake-tools", icon: Upload },
      { label: "New Patient Case", href: "/intake", icon: Stethoscope },
      { label: "Evidence Sources", href: "/evidence", icon: Droplets },
    ],
  },
  {
    label: "Cardiac Assessment",
    items: [
      { label: "CardioTwin 3D Heart", href: "/cardiotwin", icon: HeartPulse, description: "Live vessel-level CAD prediction and 3D heart" },
      { label: "Hemodynamic Twin", href: "/cardiotwin/hemo", icon: HeartPulse, description: "Heart-failure evidence, hemodynamic transitions" },
      { label: "Cardiovascular AI", href: "/cardiotwin/intelligence", icon: HeartPulse, description: "Anatomic upload, reviewed evidence replay" },
      { label: "CardioTwin Atlas", href: "/cardiotwin/atlas", icon: HeartPulse, description: "Multimodal evidence graph and spatial replay" },
      { label: "Evaluation & Methods", href: "/cardiotwin/evaluation", icon: Microscope },
    ],
  },
  {
    label: "Diagnostics & AI",
    items: [
      { label: "AI Agent Console", href: "/agents", icon: Network },
      { label: "Clinical Context", href: "/clinical-context", icon: Stethoscope },
      { label: "Oncology Module", href: "/onco", icon: Microscope },
      { label: "Policy Engine", href: "/policies", icon: ShieldCheck },
      { label: "Clinical Sandbox", href: "/sandbox", icon: Microscope },
    ],
  },
  {
    label: "Digital Twin Lab",
    items: [
      { label: "OncoTwin", href: "/twin", icon: HeartPulse },
      { label: "Twin Overview", href: "/twin/overview", icon: HeartPulse },
      { label: "Research Lab", href: "/twin/lab", icon: Microscope },
      { label: "Twin Operations", href: "/twin/ops", icon: Server },
      { label: "Cohort Analysis", href: "/cohorts", icon: Microscope },
    ],
  },
  {
    label: "Evidence & Review",
    items: [
      { label: "Evidence Workbench", href: "/onehealth", icon: Droplets },
      { label: "Interoperability", href: "/interop", icon: Network },
      { label: "Reviewer Queue", href: "/review", icon: ShieldCheck, liveBadge: "awaitingReview" },
      { label: "Follow-up & Retest", href: "/follow-up", icon: HeartPulse },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Compliance", href: "/compliance", icon: ShieldCheck },
      { label: "ROI & Value", href: "/roi", icon: LayoutDashboard },
      { label: "System Health", href: "/runtime", icon: Server },
      { label: "Architecture", href: "/architecture", icon: Network },
      { label: "Evaluation", href: "/eval", icon: Microscope },
      { label: "Settings", href: "/settings", icon: Settings, adminOnly: true },
    ],
  },
];

/** The workflow in reading order, for Previous / Next links under each page. */
export const FLOW = SECTIONS.flatMap((section) =>
  section.items
    .filter((item) => !item.adminOnly)
    .map((item) => ({
      label: item.label,
      href: item.href,
      group: section.label,
    })),
);

function defaultClosedSections(pathname: string) {
  const contextualPath = areaFor(pathname)?.path;
  const destinations = SECTIONS.flatMap((section) =>
    section.items.map((item) => ({ section: section.label, href: item.href })),
  );
  const currentSection = destinations
    .filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.section
    ?? destinations.find(({ href }) => href === contextualPath)?.section;
  const alwaysOpen = ["Command Center", "Evidence & Review"];
  const open = [...alwaysOpen, currentSection && !alwaysOpen.includes(currentSection)
    ? currentSection
    : "Cardiac Assessment"];
  return SECTIONS.filter((section) => !open.includes(section.label)).map((section) => section.label);
}

export function Sidenav() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [aboutOpen, setAboutOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("clini-nav-collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [closed, setClosed] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("clini-nav-groups");
      if (stored === null) return defaultClosedSections(location.pathname);
      const value = JSON.parse(stored);
      return Array.isArray(value)
        ? value.filter((v): v is string => typeof v === "string")
        : defaultClosedSections(location.pathname);
    } catch {
      return defaultClosedSections(location.pathname);
    }
  });
  useLayoutEffect(() => {
    try {
      if (navRef.current)
        navRef.current.scrollTop = Number(
          sessionStorage.getItem("clini-nav-scroll") ?? 0,
        );
    } catch {
      /* storage unavailable */
    }
  }, []);
  function toggleGroup(label: string) {
    setClosed((previous) => {
      const next = previous.includes(label)
        ? previous.filter((v) => v !== label)
        : [...previous, label];
      try {
        localStorage.setItem("clini-nav-groups", JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }
  const role = user?.role ?? "coordinator";

  // Live nav badge counts — replaces the old hardcoded "47" / "8" placeholder
  // badges with real counts from the backend. null = not loaded yet (or the
  // fetch failed); the badge simply doesn't render rather than showing a lie.
  const snapshot = useLive(fetchSnapshot, [], 60_000).data ?? EMPTY_SNAPSHOT;
  const liveCounts: NavLiveCounts = {
    cases: snapshot.cases?.total ?? null,
    awaitingReview: snapshot.cases?.awaiting ?? null,
  };

  // Metric-style chips (F1, projected savings, layer count) come from real endpoints; absent until loaded.
  const chips = buildNavChips(snapshot);

  // Filter sections by role
  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.adminOnly && role !== "admin") return false;
      // Reviewer Queue is visible to all but RequireAuth blocks Coordinator
      // (we keep it visible so they understand the workflow exists).
      return true;
    }),
  })).filter((s) => s.items.length > 0);

  const initials =
    (user?.full_name ?? user?.email ?? "??")
      .split(/[@.\s]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "??";

  return (
    <>
      <aside
        className={clsx(
          collapsed ? "w-16" : "w-48",
          "hidden md:flex shrink-0 border-r border-surface-border bg-surface-panel flex-col h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-84px)] sticky top-14 sm:top-[84px]",
        )}
        aria-label="Primary navigation"
      >
        <button
          type="button"
          className="p-2 text-xs hover:bg-surface-raised"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={() =>
            setCollapsed((v) => {
              try {
                localStorage.setItem("clini-nav-collapsed", String(!v));
              } catch {
                /* storage unavailable */
              }
              return !v;
            })
          }
        >
          {collapsed ? (
            <span aria-hidden="true">›</span>
          ) : (
            <>
              <span aria-hidden="true">&lt;</span>
              <span className="hidden sm:inline"> Collapse sidebar</span>
            </>
          )}
        </button>
        <nav
          ref={navRef}
          onScroll={(e) => {
            try {
              sessionStorage.setItem(
                "clini-nav-scroll",
                String(e.currentTarget.scrollTop),
              );
            } catch {
              /* storage unavailable */
            }
          }}
          className="flex-1 overflow-y-auto py-3 px-2 space-y-3"
          aria-label="Sections"
        >
          {visibleSections.map((section) => (
            <div
              key={section.label}
              role="group"
              aria-labelledby={`section-${section.label}`}
            >
              <button
                type="button"
                aria-label={section.label}
                aria-expanded={!closed.includes(section.label)}
                onClick={() => toggleGroup(section.label)}
                id={`section-${section.label}`}
                className="w-full rounded px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-faint hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand"
              >
                <span>{collapsed ? section.label.slice(0, 1) : section.label}</span>
              </button>
              {!closed.includes(section.label) && (
                <div className="mt-1 space-y-0.5">
                  {section.items.map((item) => (
                    <NavItemRow
                      key={item.href}
                      item={item}
                      liveCounts={liveCounts}
                      chips={chips}
                      collapsed={collapsed}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div
          className={clsx("px-3 py-3 border-t border-surface-border space-y-2")}
        >
          {/* User identity card */}
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
            <div
              className={clsx(
                collapsed && "hidden",
                "w-8 h-8 rounded-full bg-accent-brand/15 text-accent-brand flex items-center justify-center text-mono-tech font-semibold text-[11px] shrink-0",
              )}
              aria-hidden="true"
            >
              {initials}
            </div>
            <div className={clsx(collapsed && "hidden", "flex-1 min-w-0")}>
              <div className="text-ink-primary font-medium truncate">
                {user?.full_name || user?.email || "—"}
              </div>
              <div className="text-[10px] text-ink-muted truncate">
                <span className="uppercase text-mono-tech tracking-wider">
                  {role}
                </span>
                {user?.organization_name && (
                  <>
                    <span className="mx-1" aria-hidden="true">
                      ·
                    </span>
                    <span className="truncate">{user.organization_name}</span>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAboutOpen(true)}
              className="p-1.5 rounded text-ink-muted hover:text-ink-primary hover:bg-surface-raised transition-all focus:outline-none focus:ring-2 focus:ring-accent-brand"
              aria-label="About CARDIOTON (build version, deployment mode, feature flags)"
              title="About CARDIOTON"
            >
              <Info size={14} aria-hidden="true" />
            </button>
          </div>

          {/* Always-visible Sign out */}
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-ink-body bg-surface-bg hover:bg-accent-red/10 hover:text-accent-red border border-surface-border hover:border-accent-red/40 transition-colors focus:outline-none focus:ring-2 focus:ring-accent-red/40"
            aria-label="Sign out of CARDIOTON"
            title="Sign out"
          >
            <LogOut size={14} aria-hidden="true" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>
      <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-surface-border bg-surface-panel/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur md:hidden">
        {[
          { label: "Home", href: "/dashboard", icon: LayoutDashboard },
          { label: "Cases", href: "/cases", icon: FolderOpen },
          { label: "Intake", href: "/intake-tools", icon: Upload },
          { label: "Cardiology", href: "/architecture", icon: HeartPulse },
          { label: "Journey", href: "/journey", icon: Workflow },
          { label: "Search", href: "#search", icon: Search },
        ].map(({ label, href, icon: Icon }) => {
          const active = href === "/architecture" ? location.pathname === href || location.pathname.startsWith("/cardiotwin") : href === "/journey" ? location.pathname.startsWith(href) : location.pathname === href || (href === "/intake-tools" && location.pathname === "/intake");
          if (href === "#search") return <button key={href} type="button" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))} aria-label="Search all pages" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-medium text-ink-muted hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand"><Icon size={17} aria-hidden="true" /><span>{label}</span></button>;
          return <NavLink key={href} to={href} aria-current={active ? "page" : undefined} className={clsx("flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand", active ? "text-accent-brand" : "text-ink-muted hover:text-ink-primary")}>
            <Icon size={17} aria-hidden="true" /><span>{label}</span>
          </NavLink>;
        })}
      </nav>
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  );
}

function NavItemRow({
  item,
  liveCounts,
  chips,
  collapsed,
}: {
  collapsed?: boolean;
  item: NavItem;
  liveCounts: NavLiveCounts;
  chips: Record<string, string | null>;
}) {
  const { pathname } = useLocation();
  const contextualActive = areaFor(pathname)?.path === item.href;
  const chip = item.chip ?? chips[item.href] ?? null;
  const Icon = item.icon;
  const liveValue = item.liveBadge ? liveCounts[item.liveBadge] : null;
  const badgeText = item.liveBadge
    ? liveValue !== null
      ? String(liveValue)
      : null
    : (item.badge ?? null);

  if (item.disabled) {
    return (
      <div
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm text-ink-faint cursor-not-allowed"
        title="Coming soon"
      >
        <Icon size={15} />
        <span className="flex-1">{item.label}</span>
        <Lock size={11} className="opacity-60" />
      </div>
    );
  }

  return (
    <NavLink
      data-nav-description={item.description}
      title={item.description ? `${item.label}: ${item.description}` : item.label}
      aria-label={item.label}
      aria-current={contextualActive ? "page" : undefined}
      to={item.href}
      end={item.end}
      className={({ isActive }) =>
        clsx(
          "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors duration-200 group relative",
          isActive || contextualActive
            ? "bg-accent-brand/10 text-accent-brand font-medium"
            : "text-ink-body hover:bg-surface-raised hover:text-ink-primary",
        )
      }
    >
      {({ isActive }) => (
        <>
          {(isActive || contextualActive) && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-accent-brand animate-fade-in" />
          )}
          <Icon
            size={15}
            className={clsx(
              isActive || contextualActive ? "text-accent-brand" : "",
              "transition-colors duration-200",
            )}
          />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
          {!collapsed && chip && (
            <span
              data-testid={`chip-${item.href}`}
              className="text-[9px] text-mono-tech px-1 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan"
            >
              {chip}
            </span>
          )}
          {!collapsed && badgeText && (
            <span
              className={clsx(
                "text-[10px] text-mono-tech px-1.5 py-0.5 rounded transition-colors duration-200",
                isActive || contextualActive
                  ? "bg-accent-brand text-ink-invert"
                  : "bg-surface-border text-ink-muted group-hover:bg-surface-border-hi",
              )}
            >
              {badgeText}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
