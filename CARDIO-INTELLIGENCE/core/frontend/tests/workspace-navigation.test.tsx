import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { WorkflowNavigation } from "../src/workflow/WorkflowNavigation";

vi.mock("../src/components/core__src_components__AuthContext", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
afterEach(() => { cleanup(); sessionStorage.clear(); });
function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }
function mount(path: string) {
  render(<MemoryRouter initialEntries={[path]}><WorkflowNavigation /><Location /></MemoryRouter>);
}

it("merges the cardiac tools into one strip with one current destination", () => {
  mount("/cardiotwin/hemo");
  const nav = screen.getByRole("navigation", { name: "Cardiology tools" });
  expect(within(nav).getAllByRole("link")).toHaveLength(6);
  expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  expect(within(nav).getByRole("link", { name: "Hemodynamic Twin" }).getAttribute("aria-current")).toBe("page");
  expect(within(nav).getByRole("link", { name: "CardioTwin 3D Heart" }).getAttribute("aria-current")).toBeNull();
  expect((screen.getByText("Journey & tools").closest("details") as HTMLDetailsElement).open).toBe(false);
});

it("keeps secondary tools reachable and brings the selected tool into the strip", () => {
  mount("/cases/patient-123");
  const nav = screen.getByRole("navigation", { name: "Patients tools" });
  expect(within(nav).getByRole("link", { name: "Patient Registry" }).getAttribute("aria-current")).toBe("page");
  fireEvent.change(screen.getByRole("combobox", { name: "All Patients tools" }), { target: { value: "/notifications" } });
  expect(screen.getByTestId("location").textContent).toBe("/notifications");
  expect(within(nav).getByRole("link", { name: "Notification Preferences" }).getAttribute("aria-current")).toBe("page");
});

it("retains the six-step journey and remembered job, and closes it on navigation", () => {
  sessionStorage.setItem("clini-current-journey", "/journey/job-7/map");
  mount("/cardiotwin/hemo");
  const summary = screen.getByText("Journey & tools");
  fireEvent.click(summary);
  const nav = screen.getByRole("navigation", { name: "Workflow context" });
  expect(within(nav).getByRole("link", { name: "Back to Journey →" }).getAttribute("href")).toBe("/journey/job-7/map");
  expect(within(nav).getAllByRole("listitem")).toHaveLength(6);
  fireEvent.click(within(nav).getByRole("link", { name: /^03 Interoperability/ }));
  expect(screen.getByTestId("location").textContent).toBe("/interop");
  expect((summary.closest("details") as HTMLDetailsElement).open).toBe(false);
});

it("switches workspaces without changing the registered tool URLs", () => {
  mount("/cardiotwin/hemo");
  fireEvent.change(screen.getByRole("combobox", { name: "Switch workspace" }), { target: { value: "research" } });
  expect(screen.getByTestId("location").textContent).toBe("/research");
  expect(screen.getByRole("navigation", { name: "Research & AI tools" })).toBeTruthy();
});
