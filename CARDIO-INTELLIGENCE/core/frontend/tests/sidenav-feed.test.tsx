import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActivityTicker } from "../src/components/core__src_components__ActivityTicker";
import { Sidenav } from "../src/components/Sidenav";
import { api } from "../src/lib/core__src_lib__api";
import { resetSnapshotCache } from "../src/lib/liveFeed";

vi.mock("../src/components/core__src_components__AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u", email: "a@b.c", full_name: "Ann Lee", role: "admin", organization_id: "o", organization_name: "Org" },
    logout: vi.fn(),
  }),
}));
vi.mock("../src/lib/core__src_lib__api", () => ({ api: { listCases: vi.fn() } }));

beforeEach(() => { resetSnapshotCache(); localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

function backend(configured: boolean) {
  const fetcher = vi.fn(async (url: string) => {
    let result: unknown;
    if (url.includes("/healthz")) result = { status: "ok", db: "not_checked", case_storage_configured: configured };
    else if (url.includes("status=awaiting_review")) result = { total: 2 };
    else if (url.includes("/cases?")) result = { total: 9 };
    else if (url.includes("/architecture/layers")) result = { layers: [1, 2, 3] };
    return result ? new Response(JSON.stringify(result)) : new Response("unavailable", { status: 503 });
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

const desktop = () => screen.getByRole("navigation", { name: "Sections" });
const casesLink = () => within(desktop()).getByRole("link", { name: "Patients" });
const reviewLink = () => within(desktop()).getByRole("link", { name: "Reviewer Queue" });
const openAdministration = () => fireEvent.click(within(desktop()).getByRole("button", { name: "Administration tools" }));
const openEvidence = () => fireEvent.click(within(desktop()).getByRole("button", { name: "Evidence & Exchange tools" }));

describe("sidebar shares the governed shell feed", () => {
  it("shows real case and review badges from the shared snapshot", async () => {
    const fetcher = backend(true);
    render(<MemoryRouter><Sidenav /></MemoryRouter>);
    openEvidence();
    await waitFor(() => expect(casesLink().textContent).toBe("Patients9"));
    expect(reviewLink().textContent).toBe("Reviewer Queue2");
    openAdministration();
    expect(screen.getByTestId("chip-/architecture").textContent).toBe("3-LAYER");
    expect(fetcher.mock.calls.filter(([url]) => url.includes("/cases?"))).toHaveLength(2);
    expect(api.listCases).not.toHaveBeenCalled();
  });

  it("leaves badges unknown and skips case requests when storage is not configured", async () => {
    const fetcher = backend(false);
    render(<MemoryRouter><Sidenav /></MemoryRouter>);
    openEvidence();
    openAdministration();
    await screen.findByTestId("chip-/architecture");
    expect(casesLink().textContent).toBe("Patients");
    expect(reviewLink().textContent).toBe("Reviewer Queue");
    expect(fetcher.mock.calls.some(([url]) => url.includes("/cases?") || url.includes("/agents/metrics"))).toBe(false);
    expect(api.listCases).not.toHaveBeenCalled();
  });

  it("shares a single request round with the ticker", async () => {
    const fetcher = backend(true);
    render(<MemoryRouter><ActivityTicker /><Sidenav /></MemoryRouter>);
    await waitFor(() => expect(casesLink().textContent).toBe("Patients9"));
    expect(fetcher).toHaveBeenCalledTimes(10);
    expect(fetcher.mock.calls.filter(([url]) => url.includes("/cases?"))).toHaveLength(2);
    expect(api.listCases).not.toHaveBeenCalled();
  });
});
