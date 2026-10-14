import { describe, expect, it } from "vitest";
import { areas } from "../src/workflow/areas";
import { WORKSPACES, workspaceFor, workspaceLinkFor, workspaceLinks } from "../src/workflow/workspaces";
import mainSource from "../src/core__frontend_src__main.tsx?raw";

describe("one compact workspace inventory", () => {
  it("retains all static tools and area destinations under seven unique workspaces", () => {
    expect(WORKSPACES).toHaveLength(7);
    const hrefs = WORKSPACES.flatMap((workspace) => workspace.links.map((link) => link.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const workspace of WORKSPACES) expect(workspace.links.some((link) => link.href === workspace.href)).toBe(true);
    for (const area of areas) {
      expect(hrefs).toContain(area.path);
      for (const [, href] of area.links) expect(hrefs, href).toContain(href);
    }
    const publicRoutes = ["/", "/platform", "/login", "/signup"];
    const registered = [...mainSource.matchAll(/path="([^"]+)"/g)].map((match) => match[1]);
    for (const route of registered.filter((path) => !path.includes(":") && path !== "*" && !publicRoutes.includes(path))) {
      expect(hrefs, `${route} must remain discoverable`).toContain(route);
    }
  });

  it("uses the longest complete path so only the specific current tool is selected", () => {
    expect(workspaceLinkFor("/hub/benchmarks")?.href).toBe("/hub/benchmarks");
    expect(workspaceFor("/hub/cardioscope")?.id).toBe("hub");
    expect(workspaceLinkFor("/cardiotwin/hemo")?.href).toBe("/cardiotwin/hemo");
    expect(workspaceLinkFor("/cardiotwin/atlas/replay")?.href).toBe("/cardiotwin/atlas");
    expect(workspaceLinkFor("/aquahealth/observations/new")?.href).toBe("/aquahealth/observations/new");
    expect(workspaceLinkFor("/twin/demo/classic")?.href).toBe("/twin/demo/classic");
    expect(workspaceLinkFor("/cases/patient/compare")?.href).toBe("/cases");
    expect(workspaceFor("/intake-tools")?.id).toBe("patients");
    expect(workspaceFor("/cardiotwin-global")).toBeUndefined();
    expect(workspaceFor("/cases-extra")).toBeUndefined();
  });

  it("preserves admin visibility and route-governed review access", () => {
    const administration = WORKSPACES.find((workspace) => workspace.id === "administration")!;
    expect(workspaceLinks(administration, "admin").some((link) => link.href === "/settings")).toBe(true);
    expect(workspaceLinks(administration, "reviewer").some((link) => link.href === "/settings")).toBe(false);
    expect(workspaceLinks(administration).some((link) => link.href === "/settings")).toBe(false);
    const evidence = WORKSPACES.find((workspace) => workspace.id === "evidence")!;
    expect(workspaceLinks(evidence).some((link) => link.href === "/review")).toBe(true);
  });
});
