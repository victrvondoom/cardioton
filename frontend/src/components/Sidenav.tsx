/** Compact workspaces with every tool retained in desktop and mobile navigation. */
import clsx from "clsx";
import { ChevronDown, ChevronLeft, ChevronRight, Info, LogOut, Menu, Search, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { WORKSPACES, workspaceFor, workspaceLinkFor, workspaceLinks } from "../workflow/workspaces";
import type { WorkspaceLink } from "../workflow/workspaces";
import { EMPTY_SNAPSHOT, buildNavChips, fetchSnapshot } from "../lib/liveFeed";
import { useLive } from "../lib/useLive";
import { AboutModal } from "./AboutModal";
import { useAuth } from "./AuthContext";

interface NavLiveCounts {
  cases: number | null;
  awaitingReview: number | null;
}

/** Kept for consumers of the original workflow inventory. */
export const FLOW = WORKSPACES.flatMap((workspace) => workspace.links
  .filter((item) => !item.adminOnly)
  .map((item) => ({ label: item.label, href: item.href, group: workspace.label })));

function initialClosed(pathname: string): string[] {
  const defaults = WORKSPACES.filter((workspace) => workspace.id !== (workspaceFor(pathname)?.id ?? "clinic")).map(({ id }) => id);
  try {
    // Workspace groups differ from the old scattered sections. Keep the old
    // preference untouched and start the new grouping with only current tools.
    const stored = localStorage.getItem("clini-nav-workspaces");
    if (stored === null) return defaults;
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return defaults;
    return [...new Set(parsed.filter((item): item is string => typeof item === "string")
      .filter((id) => WORKSPACES.some((workspace) => workspace.id === id)))];
  } catch { return defaults; }
}

export function Sidenav() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const currentWorkspace = workspaceFor(location.pathname);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");
  const navRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("clini-nav-collapsed") === "true"; } catch { return false; }
  });
  const [closed, setClosed] = useState(() => initialClosed(location.pathname));
  const role = user?.role ?? "coordinator";
  const snapshot = useLive(fetchSnapshot, [], 60_000).data ?? EMPTY_SNAPSHOT;
  const liveCounts: NavLiveCounts = { cases: snapshot.cases?.total ?? null, awaitingReview: snapshot.cases?.awaiting ?? null };
  const chips = buildNavChips(snapshot);

  useLayoutEffect(() => {
    try { if (navRef.current) navRef.current.scrollTop = Number(sessionStorage.getItem("clini-nav-scroll") ?? 0); } catch { /* storage unavailable */ }
  }, []);

  // Closing the mobile menu never resets desktop group or scroll preferences.
  useEffect(() => { setMenuOpen(false); setMenuSearch(""); }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const dialog = menuRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (dialog?.showModal) dialog.showModal();
    else dialog?.setAttribute("open", "");
    return () => {
      if (dialog?.close) dialog.close();
      else dialog?.removeAttribute("open");
      document.body.style.overflow = previousOverflow;
      menuButtonRef.current?.focus();
    };
  }, [menuOpen]);

  function toggleGroup(id: string) {
    setClosed((previous) => {
      const next = previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id];
      try { localStorage.setItem("clini-nav-workspaces", JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }

  function toggleCollapsed() {
    setCollapsed((previous) => {
      try { localStorage.setItem("clini-nav-collapsed", String(!previous)); } catch { /* storage unavailable */ }
      return !previous;
    });
  }

  const initials = (user?.full_name ?? user?.email ?? "??").split(/[@.\s]/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "??";
  const query = menuSearch.trim().toLowerCase();
  const mobileWorkspaces = WORKSPACES.map((workspace) => ({ workspace, links: workspaceLinks(workspace, role)
    .filter((link) => !query || `${workspace.label} ${link.label} ${link.description ?? ""}`.toLowerCase().includes(query)) }))
    .filter(({ links }) => links.length > 0);

  return <>
    <aside className={clsx(collapsed ? "w-16" : "w-52", "hidden md:flex shrink-0 border-r border-surface-border bg-surface-panel flex-col h-[calc(100dvh_-_var(--app-header-height,56px))] sticky top-[var(--app-header-height,56px)]")} aria-label="Primary navigation">
      <div className={clsx("flex h-11 shrink-0 items-center border-b border-surface-border px-2", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Workspaces</span>}
        <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} title={collapsed ? "Expand navigation" : "Collapse navigation"} className="rounded-md p-2 text-ink-muted hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-accent-brand">
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
      <nav ref={navRef} aria-label="Sections" className="flex-1 space-y-1 overflow-y-auto px-2 py-2" onScroll={(event) => {
        try { sessionStorage.setItem("clini-nav-scroll", String(event.currentTarget.scrollTop)); } catch { /* storage unavailable */ }
      }}>
        {WORKSPACES.map((workspace) => {
          const Icon = workspace.icon;
          const open = !closed.includes(workspace.id);
          const selected = currentWorkspace?.id === workspace.id;
          const home = workspace.links.find((link) => link.href === workspace.href)!;
          const badge = home.liveBadge ? liveCounts[home.liveBadge] : null;
          return <div key={workspace.id} role="group" aria-label={`${workspace.label} workspace`}>
            <div className={clsx("flex items-center rounded-lg", selected && "bg-accent-brand/10")}>
              <NavLink to={workspace.href} end aria-label={workspace.label} title={`${workspace.label}: ${workspace.summary}`} className={clsx("flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-accent-brand", selected ? "text-accent-brand" : "text-ink-body hover:bg-surface-raised hover:text-ink-primary")}>
                <Icon size={17} aria-hidden="true" className="shrink-0" />
                {!collapsed && <><span className="min-w-0 flex-1 truncate">{workspace.label}</span>{badge !== null && <span className="rounded bg-surface-border px-1.5 py-0.5 text-[10px] text-ink-muted">{badge}</span>}</>}
              </NavLink>
              {!collapsed && <button type="button" aria-label={`${workspace.label} tools`} aria-expanded={open} aria-controls={`workspace-tools-${workspace.id}`} onClick={() => toggleGroup(workspace.id)} className="mr-0.5 rounded-md p-2 text-ink-muted hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-accent-brand"><ChevronDown size={13} aria-hidden="true" className={clsx("transition-transform", !open && "-rotate-90")} /></button>}
            </div>
            {!collapsed && open && <div id={`workspace-tools-${workspace.id}`} className="mb-2 ml-4 mt-0.5 space-y-0.5 border-l border-surface-border pl-1.5">
              {workspaceLinks(workspace, role).filter((link) => link.href !== workspace.href).map((link) => <NavItemRow key={link.href} item={link} liveCounts={liveCounts} chips={chips} />)}
            </div>}
          </div>;
        })}
      </nav>
      <div className="space-y-1 border-t border-surface-border p-2">
        <div className="flex min-h-10 items-center gap-2 px-1 text-xs">
          {!collapsed && <><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-brand/15 text-[10px] font-semibold text-accent-brand" aria-hidden="true">{initials}</span><div className="min-w-0 flex-1"><div className="truncate font-medium text-ink-primary">{user?.full_name || user?.email || "—"}</div><div className="truncate text-[9px] uppercase tracking-wide text-ink-muted">{role}{user?.organization_name && ` · ${user.organization_name}`}</div></div></>}
          <button type="button" onClick={() => setAboutOpen(true)} className="rounded p-2 text-ink-muted hover:bg-surface-raised hover:text-ink-primary focus-visible:ring-2 focus-visible:ring-accent-brand" aria-label="About CARDIOTON (build version, deployment mode, feature flags)" title="About CARDIOTON"><Info size={14} aria-hidden="true" /></button>
        </div>
        <button type="button" onClick={logout} aria-label="Sign out of CARDIOTON" title="Sign out" className="flex w-full items-center justify-center gap-2 rounded-md border border-surface-border px-2 py-2 text-xs text-ink-muted hover:bg-accent-red/10 hover:text-accent-red focus-visible:ring-2 focus-visible:ring-accent-red/40"><LogOut size={14} aria-hidden="true" />{!collapsed && <span>Sign out</span>}</button>
      </div>
    </aside>

    <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-surface-border bg-surface-panel/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur md:hidden">
      {WORKSPACES.slice(0, 4).map((workspace) => {
        const Icon = workspace.icon;
        const selected = currentWorkspace?.id === workspace.id;
        return <Link key={workspace.id} to={workspace.href} aria-label={workspace.label} aria-current={selected ? "location" : undefined} className={clsx("flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-0.5 text-[10px] font-medium focus-visible:ring-2 focus-visible:ring-accent-brand", selected ? "text-accent-brand" : "text-ink-muted hover:text-ink-primary")}><Icon size={17} aria-hidden="true" /><span className="max-w-full truncate">{workspace.id === "evidence" ? "Evidence" : workspace.label}</span></Link>;
      })}
      <button ref={menuButtonRef} type="button" onClick={() => setMenuOpen(true)} aria-label="All workspaces and tools" aria-expanded={menuOpen} aria-haspopup="dialog" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-medium text-ink-muted hover:text-ink-primary focus-visible:ring-2 focus-visible:ring-accent-brand"><Menu size={18} aria-hidden="true" /><span>All tools</span></button>
    </nav>

    {menuOpen && <dialog ref={menuRef} aria-labelledby="workspace-menu-title" onCancel={(event) => { event.preventDefault(); setMenuOpen(false); }} onClick={(event) => { if (event.target === event.currentTarget) setMenuOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") setMenuOpen(false); }} className="fixed inset-0 z-50 m-auto max-h-[90dvh] w-[calc(100%_-_1.5rem)] max-w-xl overflow-hidden rounded-2xl border border-surface-border bg-surface-panel p-0 text-ink-primary shadow-2xl backdrop:bg-black/60">
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3"><div><h2 id="workspace-menu-title" className="text-sm font-semibold">All workspaces & tools</h2><p className="mt-0.5 text-[11px] text-ink-muted">Every capability, together.</p></div><button type="button" onClick={() => setMenuOpen(false)} aria-label="Close all tools" className="rounded-md p-2 hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-accent-brand"><X size={18} aria-hidden="true" /></button></div>
      <div className="px-4 pt-3"><label className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-bg px-3"><Search size={15} aria-hidden="true" className="text-ink-faint" /><input autoFocus aria-label="Filter all tools" value={menuSearch} onChange={(event) => setMenuSearch(event.target.value)} placeholder="Find a tool…" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none" /></label></div>
      <nav aria-label="All tools" className="max-h-[calc(90dvh_-_11.5rem)] space-y-4 overflow-y-auto p-4">
        {mobileWorkspaces.map(({ workspace, links }) => <section key={workspace.id} aria-label={workspace.label}><h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{workspace.label}</h3><div className="grid gap-0.5 sm:grid-cols-2">{links.map((link) => <NavItemRow key={link.href} item={link} liveCounts={liveCounts} chips={chips} onNavigate={() => setMenuOpen(false)} />)}</div></section>)}
        {mobileWorkspaces.length === 0 && <p className="py-4 text-center text-sm text-ink-muted">No tools match this search.</p>}
      </nav>
      <div className="flex items-center justify-between border-t border-surface-border px-4 py-2"><button type="button" onClick={() => { setMenuOpen(false); setAboutOpen(true); }} className="rounded-md px-2 py-2 text-xs text-ink-muted hover:bg-surface-raised">About CARDIOTON</button><button type="button" onClick={logout} className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-ink-muted hover:bg-accent-red/10 hover:text-accent-red"><LogOut size={13} aria-hidden="true" />Sign out</button></div>
    </dialog>}
    <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
  </>;
}

function NavItemRow({ item, liveCounts, chips, onNavigate }: { item: WorkspaceLink; liveCounts: NavLiveCounts; chips: Record<string, string | null>; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const active = workspaceLinkFor(pathname)?.href === item.href;
  const chip = chips[item.href] ?? null;
  const badge = item.liveBadge ? liveCounts[item.liveBadge] : null;
  const Icon = item.icon;
  return <NavLink data-nav-description={item.description} title={item.description ? `${item.label}: ${item.description}` : item.label} aria-label={item.label} aria-current={active ? "page" : undefined} to={item.href} end onClick={onNavigate} className={clsx("group relative flex min-h-8 min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors focus-visible:ring-2 focus-visible:ring-accent-brand", active ? "bg-accent-brand/10 font-medium text-accent-brand" : "text-ink-muted hover:bg-surface-raised hover:text-ink-primary")}>
    <Icon size={13} aria-hidden="true" className="shrink-0" /><span className="min-w-0 flex-1 truncate">{item.label}</span>
    {chip && <span data-testid={`chip-${item.href}`} className="rounded bg-accent-cyan/10 px-1 py-0.5 text-[9px] text-accent-cyan">{chip}</span>}
    {badge !== null && <span className={clsx("rounded px-1.5 py-0.5 text-[10px]", active ? "bg-accent-brand text-ink-invert" : "bg-surface-border text-ink-muted")}>{badge}</span>}
  </NavLink>;
}
