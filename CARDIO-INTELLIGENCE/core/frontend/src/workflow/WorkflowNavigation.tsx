import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../components/core__src_components__AuthContext";
import { areas, areaFor } from "./areas";
import { WORKSPACES, workspaceFor, workspaceLinkFor, workspaceLinks } from "./workspaces";

const TAB_LABELS: Record<string, string> = {
  "/cardiotwin": "3D Heart", "/cardiotwin/hemo": "Hemodynamics",
  "/cardiotwin/intelligence": "Intelligence", "/cardiotwin/atlas": "Atlas",
  "/cardiotwin/global": "Global", "/cardiotwin/evaluation": "Methods",
  "/dashboard": "Overview", "/journey": "Clinical journey", "/track7": "Track 7",
  "/cases": "Registry", "/intake-tools": "Intake tools", "/intake": "New case",
  "/cases/bulk-import": "Bulk import", "/clinical-context": "Clinical context", "/follow-up": "Follow-up",
};

/** One compact navigation strip shared by every workspace. */
export function WorkflowNavigation() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const journeyMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (journeyMenu.current) journeyMenu.current.open = false;
    const closeOutside = (event: MouseEvent) => {
      if (journeyMenu.current && !journeyMenu.current.contains(event.target as Node)) journeyMenu.current.open = false;
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [pathname]);
  if (["/", "/platform"].includes(pathname)) return null;
  const workspace = workspaceFor(pathname);
  if (!workspace) return null;
  const links = workspaceLinks(workspace, user?.role);
  const current = workspaceLinkFor(pathname);
  const tabs = links.slice(0, 6);
  if (current && !tabs.some(link => link.href === current.href) && links.includes(current)) tabs.splice(5, 1, current);
  let journeyPath = "/journey";
  try {
    const remembered = sessionStorage.getItem("clini-current-journey");
    if (remembered?.startsWith("/journey/")) journeyPath = remembered;
  } catch { /* storage unavailable */ }
  const area = areaFor(pathname);
  const index = area ? areas.indexOf(area) : -1;
  const previous = index > 0 ? areas[index - 1] : null;
  const next = index >= 0 && index < 5 ? areas[index + 1] : null;

  return (
    <div className="workspace-strip">
      <div className="workspace-strip__heading">
        <label className="workspace-switcher">
          <workspace.icon size={15} aria-hidden="true" />
          <span className="sr-only">Switch workspace</span>
          <select aria-label="Switch workspace" value={workspace.id} onChange={event => {
            const target = WORKSPACES.find(item => item.id === event.target.value);
            if (target) navigate(target.href);
          }}>
            {WORKSPACES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <span className="workspace-strip__divider" aria-hidden="true">/</span>
        <span className="workspace-strip__current">{current?.label}</span>
        <details ref={journeyMenu} className="workspace-journey" onKeyDown={event => {
          if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
        }}>
          <summary>Journey &amp; tools</summary>
          <nav aria-label="Workflow context" className="workspace-journey__panel">
            <Link to={journeyPath}>Back to Journey →</Link>
            <ol>{areas.slice(0, 6).map((step, i) => (
              <li key={step.path}><Link to={step.path} aria-current={step === area ? "step" : undefined} title={step.summary}>
                <span>{String(i + 1).padStart(2, "0")}</span><span>{step.label}<small>{step.summary}</small></span>
              </Link></li>
            ))}</ol>
            {area && <Link to={area.path}>{area.label} / Choose tools</Link>}
            {previous && <Link to={previous.path}>← Previous: {previous.label}</Link>}
            {next && <Link to={next.path}>Continue to {next.label} →</Link>}
          </nav>
        </details>
      </div>
      <div className="workspace-strip__tools">
        <nav aria-label={`${workspace.label} tools`} className="workspace-tabs">
          {tabs.map(link => <Link key={link.href} to={link.href} aria-label={link.label} title={link.description ?? link.label} aria-current={current?.href === link.href ? "page" : undefined}>
            {TAB_LABELS[link.href] ?? link.label}
          </Link>)}
        </nav>
        {links.length > 6 && <label className="workspace-more">
          <span className="sr-only">All {workspace.label} tools</span>
          <select aria-label={`All ${workspace.label} tools`} value="" onChange={event => { if (event.target.value) navigate(event.target.value); }}>
            <option value="" disabled>All tools ({links.length})</option>
            {links.map(link => <option key={link.href} value={link.href}>{link.label}</option>)}
          </select>
        </label>}
      </div>
    </div>
  );
}

export function WorkflowOverview() {
  return (
    <section aria-label="One connected evidence journey" className="mb-4">
      <h2 className="mb-2 text-base font-semibold">One connected evidence journey</h2>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {areas.slice(0, 6).map((area, i) => <Link key={area.path} to={area.path} className="rounded-lg border border-surface-border bg-surface-panel px-3 py-2 text-xs hover:border-accent-brand focus-visible:ring-2 focus-visible:ring-accent-brand">
          <span className="mr-2 text-ink-muted">{i + 1}</span>{area.label}
        </Link>)}
      </div>
      <Link to="/journey" className="mt-2 inline-block text-xs text-accent-brand hover:underline">Open Evidence Journey →</Link>
    </section>
  );
}
