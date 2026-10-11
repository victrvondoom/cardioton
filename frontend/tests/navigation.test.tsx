/**
 * Unification must not delete anything: every pre-existing route stays registered and every
 * pre-existing nav destination stays reachable, alongside the new journey and runtime entries.
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Link, MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Sidenav } from "../src/components/Sidenav";
import { RouteBoundary } from "../src/components/RouteBoundary";
import { areas } from "../src/workflow/areas";
import mainSource from "../src/main.tsx?raw";

vi.mock("../src/components/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u", email: "a@b.c", full_name: "Ann Lee", role: "admin", organization_id: "o", organization_name: "Org" },
    logout: vi.fn(),
  }),
}));
vi.mock("../src/lib/api", async (orig) => ({
  ...(await orig<typeof import("../src/lib/api")>()),
  api: { listCases: vi.fn().mockRejectedValue(new Error("offline")) },
}));
vi.mock("../src/lib/liveFeed", async (orig) => ({
  ...(await orig<typeof import("../src/lib/liveFeed")>()),
  fetchSnapshot: vi.fn().mockRejectedValue(new Error("offline")),
}));

const LEGACY_ROUTES = [
  "/", "/platform", "/login", "/signup", "/dashboard", "/cases", "/cases/bulk-import", "/cases/:caseId",
  "/cases/:caseId/compare", "/intake", "/sandbox", "/twin", "/twin/overview", "/twin/lab", "/twin/ops",
  "/twin/demo", "/twin/demo/classic", "/twin/demo/:tab", "/twin/:patientId/classic", "/twin/:patientId/:tab?",
  "/cardiotwin", "/cardiotwin/evaluation", "/policies", "/onco", "/policies/:policyId/diff", "/agents",
  "/cohorts", "/reviewer", "/compliance", "/roi", "/industrialize", "/architecture", "/eval", "/settings",
  "/aquahealth", "/onehealth", "/interop", "/aquahealth/observations", "/aquahealth/observations/new",
  "/aquahealth/observations/:observationId", "/aquahealth/map", "/aquahealth/trends", "/aquahealth/one-health",
  "/aquahealth/community", "/aquahealth/evaluation", "/aquahealth/review",
];
const NEW_ROUTES = ["/journey", "/journey/:jobId", "/journey/:jobId/:stageId", "/runtime"];
const LEGACY_NAV = [
  "/interop", "/onehealth", "/aquahealth", "/aquahealth/observations/new", "/aquahealth/observations",
  "/aquahealth/map", "/aquahealth/trends", "/aquahealth/one-health", "/aquahealth/evaluation",
  "/aquahealth/review", "/aquahealth/community", "/dashboard", "/cases", "/intake", "/cases/bulk-import",
  "/sandbox", "/twin", "/twin/demo", "/twin/lab", "/twin/ops", "/cardiotwin", "/cardiotwin/evaluation",
  "/policies", "/agents", "/onco", "/cohorts", "/reviewer", "/eval", "/roi", "/compliance",
  "/industrialize", "/architecture", "/settings",
];

afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); });

describe("one platform, nothing removed", () => {
  it("keeps every pre-existing route registered and adds the journey and runtime routes", () => {
    for (const path of [...LEGACY_ROUTES, ...NEW_ROUTES]) {
      expect(mainSource, path).toContain(`path="${path}"`);
    }
  });

  it("consolidates navigation into six workspaces and keeps every capability reachable", () => {
    render(
      <MemoryRouter>
        <Sidenav />
      </MemoryRouter>,
    );
    const nav = screen.getByRole("navigation", { name: "Sections" });
    const hrefs = within(nav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    for (const href of ["/dashboard", "/cases", "/cardiotwin", "/onehealth", "/research", "/runtime"]) expect(hrefs).toContain(href);
    expect(hrefs.length).toBeLessThanOrEqual(13);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const button of within(nav).getAllByRole("button")) {
      if (button.getAttribute("aria-expanded") === "false") fireEvent.click(button);
    }
    const allHrefs = within(nav).getAllByRole("link").map((link) => link.getAttribute("href"));
    const contextual = areas.flatMap(a => a.links.map(([,href]) => href));
    for (const href of LEGACY_NAV) expect([...allHrefs, ...contextual], href).toContain(href);
    expect(new Set(allHrefs).size).toBe(allHrefs.length);
  });
});

it("keeps sidebar DOM, scroll and expanded state across navigation and remembers collapse", () => {
  render(<MemoryRouter><RouteBoundary><Sidenav /><Link to="/architecture">Open architecture</Link></RouteBoundary></MemoryRouter>);
  const nav = screen.getByRole("navigation", { name: "Sections" });
  nav.scrollTop = 125;
  fireEvent.scroll(nav);
  const evidence = screen.getByRole("button", { name: "Evidence & Exchange tools" });
  fireEvent.click(evidence);
  fireEvent.click(evidence);
  fireEvent.click(screen.getByRole("link", { name: "Open architecture" }));
  expect(screen.getByRole("navigation", { name: "Sections" })).toBe(nav);
  expect(nav.scrollTop).toBe(125);
  expect(evidence.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "Administration tools" }));
  fireEvent.click(screen.getByRole("button", { name: "Collapse navigation" }));
  expect(localStorage.getItem("clini-nav-collapsed")).toBe("true");
  expect(within(nav).getByRole("link", { name: "Cardiology" }).getAttribute("title")).toContain("Heart anatomy");
  fireEvent.click(screen.getByRole("button", { name: "Expand navigation" }));
  expect(screen.getByRole("link", { name: "Architecture" }).getAttribute("title")).toBe("Architecture");
});

it("makes every tool reachable from the mobile menu and closes after choosing one", () => {
  render(<MemoryRouter initialEntries={["/cardiotwin/hemo"]}><Sidenav /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "All workspaces and tools" }));
  const dialog = screen.getByRole("dialog", { name: "All workspaces & tools" });
  const menu = within(dialog).getByRole("navigation", { name: "All tools" });
  for (const href of LEGACY_NAV) expect(within(menu).getAllByRole("link").some((link) => link.getAttribute("href") === href), href).toBe(true);
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Filter all tools" }), { target: { value: "Architecture" } });
  expect(within(menu).getAllByRole("link")).toHaveLength(1);
  fireEvent.click(within(menu).getByRole("link", { name: "Architecture" }));
  expect(screen.queryByRole("dialog", { name: "All workspaces & tools" })).toBeNull();
});

it("selects the hemodynamic tool without also selecting the 3D heart home", () => {
  render(<MemoryRouter initialEntries={["/cardiotwin/hemo"]}><Sidenav /></MemoryRouter>);
  const nav = screen.getByRole("navigation", { name: "Sections" });
  const active = within(nav).getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page");
  expect(active.map((link) => link.getAttribute("href"))).toEqual(["/cardiotwin/hemo"]);
});

it("starts the new grouping compact while retaining old preferences and new group choices", () => {
  const oldPreference = JSON.stringify(["Patient Intake", "Administration"]);
  localStorage.setItem("clini-nav-groups", oldPreference);
  render(<MemoryRouter initialEntries={["/cardiotwin/hemo"]}><Sidenav /></MemoryRouter>);
  const nav = screen.getByRole("navigation", { name: "Sections" });
  expect(within(nav).getAllByRole("button").filter((button) => button.getAttribute("aria-expanded") === "true")).toHaveLength(1);
  expect(within(nav).getByRole("button", { name: "Cardiology tools" }).getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(within(nav).getByRole("button", { name: "Research & AI tools" }));
  expect(localStorage.getItem("clini-nav-groups")).toBe(oldPreference);
  expect(JSON.parse(localStorage.getItem("clini-nav-workspaces")!)).not.toContain("research");
});

it("restores mobile menu focus and scrolling when dismissed with Escape", () => {
  render(<MemoryRouter><Sidenav /></MemoryRouter>);
  const trigger = screen.getByRole("button", { name: "All workspaces and tools" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "All workspaces & tools" });
  expect(document.body.style.overflow).toBe("hidden");
  expect(document.activeElement).toBe(within(dialog).getByRole("textbox", { name: "Filter all tools" }));
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "All workspaces & tools" })).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(document.body.style.overflow).toBe("");
});
