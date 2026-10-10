// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REFERENCE_STRUCTURES } from "../src/cardiotwin/intelligence/anatomyTypes";

describe("Bundled HRA reference asset provenance", () => {
  it("retains the original verified upstream GLB and explicit chamber/valve/septum nodes", () => {
    const binary = readFileSync(new URL("../public/models/hra-human-heart.glb", import.meta.url));
    expect(binary.readUInt32LE(0)).toBe(0x46546c67);
    expect(createHash("sha256").update(binary).digest("hex")).toBe("b1237e7e765178e9357fd2ea7ccf19d55d0bf9ca55e187886635febe28244c70");
    const length = binary.readUInt32LE(12);
    const metadata = JSON.parse(binary.subarray(20, 20 + length).toString("utf8")) as { nodes: { name: string; extras?: { ontologyid?: string } }[] };
    const ontologies = new Set(metadata.nodes.map(node => node.extras?.ontologyid));
    const reference = REFERENCE_STRUCTURES.filter(structure => structure.origin === "HRA reference mesh");
    expect(reference).toHaveLength(9);
    for (const structure of reference) expect(ontologies.has(structure.ontology)).toBe(true);
  });
});
