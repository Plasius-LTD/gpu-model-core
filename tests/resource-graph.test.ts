import { beforeAll, describe, expect, it } from "vitest";
import {
  createGpuModelResourceGraph, gpuModelResourceKey, isGpuModelResourceGraph,
  GpuModelResourceGraphError, GPU_MODEL_RESOURCE_GRAPH_LIMITS,
  createAndVerifyGpuModelDocument, type GpuModelDocument,
} from "../src/index.js";
import { createValidGpuModelDocument, validDocument, rigidDocument, FixtureVerificationPort } from "./fixtures/model-document-fixture.js";
import { resourceGraphFixture } from "./fixtures/resource-graph-fixture.js";

let document: GpuModelDocument;
beforeAll(async () => { document = await createValidGpuModelDocument(); });
function fails(input: unknown, code: string) {
  try { createGpuModelResourceGraph(document, input); throw new Error("expected rejection"); }
  catch (error) { expect(error).toBeInstanceOf(GpuModelResourceGraphError); expect(error).toHaveProperty("code", code); }
}

describe("canonical conversion resource graph", () => {
  it("retains verified bytes, external paths, texture fidelity, rigs, animation and provenance", async () => {
    const graph = createGpuModelResourceGraph(document, resourceGraphFixture());
    const node = (kind: string, id: string) => graph.nodes.find(n => n.key === JSON.stringify([kind, id]))!;
    expect(isGpuModelResourceGraph(graph)).toBe(true);
    expect(graph.schemaVersion).toBe("plasius.gpu-model-resource-graph/1");
    expect(node("resource", "buffer-main").value).toMatchObject({ resource: { contentHash: document.resources[0]!.contentHash }, location: { kind: "embedded" } });
    expect(node("resource", "image-main").value).toMatchObject({ location: { kind: "external", relativePath: "textures/fixture.png" }, exportEmbeddingPolicy: "prefer-external" });
    expect(node("texture", "texture-main").value).toEqual(document.textures[0]);
    expect(node("material", "material-main").dependencies).toEqual([gpuModelResourceKey("texture", "texture-main")]);
    expect(node("skeleton", "skeleton-main").value).toEqual({ skeleton: document.skeletons[0], joints: document.joints });
    expect(node("skin", "skin-main").dependencies).toContain(gpuModelResourceKey("skeleton", "skeleton-main"));
    expect(node("skin", "skin-main").dependencies).toContain(gpuModelResourceKey("accessor", "weights"));
    expect(node("animation", "animation-main").dependencies).toEqual([gpuModelResourceKey("accessor", "animation-output"), gpuModelResourceKey("accessor", "animation-time")]);
    expect(node("provenance", "source").value).toEqual(document.provenance);
    expect(node("package", "conversion").dependencies).toHaveLength(4);
    const resource = graph.nodes.find(n => n.kind === "resource");
    if (resource?.kind !== "resource") throw new Error("resource missing");
    expect(await resource.value.resource.payload.arrayBuffer()).toEqual(await document.resources[0]!.payload.arrayBuffer());
  });

  it("is deterministic under reordered descriptor and canonical collection declarations", async () => {
    const first = createGpuModelResourceGraph(document, resourceGraphFixture());
    const input = resourceGraphFixture(); input.resources.reverse(); input.packages.reverse(); input.packages.forEach(p => p.members.reverse());
    const raw = validDocument(); for (const key of ["resources", "accessors", "textures", "materials", "skins", "skeletons", "animations"]) (raw[key] as unknown[]).reverse();
    const reordered = await createAndVerifyGpuModelDocument(raw, new FixtureVerificationPort());
    expect(createGpuModelResourceGraph(reordered, input)).toEqual(first);
  });

  it("keeps logical identities separate from hashes and kinds", () => {
    expect(gpuModelResourceKey("texture", "x")).not.toBe(gpuModelResourceKey("material", "x"));
    expect(gpuModelResourceKey("resource", "a:b")).toBe('["resource","a:b"]');
  });

  it("copies descriptor inputs and freezes graph containers", () => {
    const input = resourceGraphFixture(); const graph = createGpuModelResourceGraph(document, input);
    input.resources[1]!.location.relativePath = "changed.png"; input.packages[0]!.members.length = 0;
    expect(JSON.stringify(graph)).toContain("textures/fixture.png");
    expect(Object.isFrozen(graph)).toBe(true); expect(Object.isFrozen(graph.nodes)).toBe(true);
    for (const node of graph.nodes) { expect(Object.isFrozen(node)).toBe(true); expect(Object.isFrozen(node.value)).toBe(true); expect(Object.isFrozen(node.dependencies)).toBe(true); }
    expect(isGpuModelResourceGraph({ ...graph })).toBe(false);
    expect(isGpuModelResourceGraph(null)).toBe(false);
    expect(isGpuModelResourceGraph(structuredClone(graph))).toBe(false);
  });

  it("rejects unverified and cloned documents", () => {
    for (const value of [null, validDocument(), structuredClone(document)]) expect(() => createGpuModelResourceGraph(value, resourceGraphFixture())).toThrow(GpuModelResourceGraphError);
  });

  it.each(["inherit-source", "prefer-embedded", "prefer-external", "forbid-embedding"])("represents export policy %s", policy => {
    const input = resourceGraphFixture(); input.resources[1]!.exportEmbeddingPolicy = policy;
    expect(createGpuModelResourceGraph(document, input).nodes.some(n => n.kind === "resource" && n.value.exportEmbeddingPolicy === policy)).toBe(true);
  });

  it("rejects embedded origin with forbidden embedding", () => {
    const input = resourceGraphFixture(); input.resources[0]!.exportEmbeddingPolicy = "forbid-embedding"; fails(input, "invalid-value");
  });

  it.each(["../image.png", "/image.png", "C:/image.png", "textures\\image.png", "a//b", "a/./b", "a/../b", "a/%2e/b", "a.png?q=1", "a.png#x", "a\n.png", "CON.png", "aux", "a/NUL.txt", "a.", "a /b", "", "a".repeat(1025)])("rejects unsafe path %j", path => {
    const input = resourceGraphFixture(); input.resources[1]!.location.relativePath = path; fails(input, "invalid-value");
  });

  it("rejects duplicate paths ignoring case", () => {
    const input = resourceGraphFixture(); input.resources[0]!.location = { kind: "external", relativePath: "Textures/Fixture.PNG" }; fails(input, "duplicate-reference");
  });

  it("requires exactly one binding for every verified resource", () => {
    const input = resourceGraphFixture(); input.resources.pop(); fails(input, "missing-reference");
    input.resources.push(input.resources[0]!); fails(input, "duplicate-reference");
    input.resources[1] = { ...input.resources[1]!, resourceId: "missing" }; fails(input, "missing-reference");
  });

  it("rejects duplicate packages, repeated members and missing typed references", () => {
    const input = resourceGraphFixture(); input.packages.push(input.packages[0]!); fails(input, "duplicate-reference");
    input.packages.pop(); input.packages[0]!.members.push(input.packages[0]!.members[0]!); fails(input, "duplicate-reference");
    input.packages[0]!.members.pop(); input.packages[0]!.members[0]!.kind = "skin"; fails(input, "missing-reference");
  });

  it("rejects self and multi-package cycles", () => {
    const input = resourceGraphFixture(); input.packages[0]!.members = [{ kind: "package", id: "surface" }]; fails(input, "graph-cycle");
    input.packages[0]!.members = [{ kind: "package", id: "conversion" }]; fails(input, "graph-cycle");
  });

  it.each([null, [], {}, { resources: [], packages: [], secret: "synthetic" }, { resources: "bad", packages: [] }])("rejects malformed descriptors", value => { fails(value, "invalid-value"); });

  it("rejects accessors without executing them and never echoes input", () => {
    let calls = 0; const input = resourceGraphFixture(); Object.defineProperty(input, "resources", { get() { calls++; throw new Error("synthetic-private"); } });
    fails(input, "invalid-value"); expect(calls).toBe(0);
    expect(() => gpuModelResourceKey("resource", "synthetic\nprivate")).toThrow("Invalid GPU model resource graph: invalid-value");
  });

  it("rejects sparse arrays, exotic objects, unknown nested keys and invalid enum values", () => {
    fails({ ...resourceGraphFixture(), resources: new Array(2) }, "invalid-value");
    fails(new Date(), "invalid-value");
    const input = resourceGraphFixture(); Object.assign(input.resources[0]!, { extra: true }); fails(input, "invalid-value");
    fails({ ...resourceGraphFixture(), packages: [{ id: "x", members: [{ kind: "unknown", id: "x" }] }] }, "invalid-value");
    fails({ ...resourceGraphFixture(), packages: [{ id: "", members: [] }] }, "invalid-value");
  });

  it("bounds package declarations before traversal", () => {
    fails({ ...resourceGraphFixture(), packages: new Array(GPU_MODEL_RESOURCE_GRAPH_LIMITS.packages + 1) }, "limit-exceeded");
  });
  it("rejects file/directory output collisions", () => {
    const input = resourceGraphFixture(); input.resources[0]!.location = { kind: "external", relativePath: "Textures" };
    fails(input, "duplicate-reference");
  });

  it("supports empty packages and the maximum package chain without recursive traversal", () => {
    const input = { ...resourceGraphFixture(), packages: Array.from({ length: GPU_MODEL_RESOURCE_GRAPH_LIMITS.packages }, (_, index) => ({ id: `p${index}`, members: index === 0 ? [] : [{ kind: "package", id: `p${index - 1}` }] })) };
    expect(createGpuModelResourceGraph(document, input).nodes.filter(n => n.kind === "package")).toHaveLength(256);
  });

  it("bounds raw resources and member edges before inspecting entries", () => {
    fails({ ...resourceGraphFixture(), resources: new Array(GPU_MODEL_RESOURCE_GRAPH_LIMITS.nodes + 1) }, "limit-exceeded");
    fails({ ...resourceGraphFixture(), packages: [{ id: "x", members: new Array(GPU_MODEL_RESOURCE_GRAPH_LIMITS.edges + 1) }] }, "limit-exceeded");
  });

  it("sanitizes proxy failures", () => {
    const proxy = new Proxy({}, { getPrototypeOf() { throw new Error("synthetic-private"); } });
    fails(proxy, "invalid-value");
  });

  it.each([
    { kind: "unknown" }, null, { kind: "embedded", relativePath: "x" },
    { kind: "external", relativePath: 7 }, { kind: "external", relativePath: "a".repeat(256) },
    { kind: "external", relativePath: "/a" }, { kind: "external", relativePath: "a/" },
  ])("rejects malformed locations %j", location => {
    const input = resourceGraphFixture(); Object.assign(input.resources[0]!, { location }); fails(input, "invalid-value");
  });

  it("rejects non-enumerable, symbol, inherited and accessor descriptor values", () => {
    const input = resourceGraphFixture(); Object.defineProperty(input, "packages", { enumerable: false }); fails(input, "invalid-value");
    const withSymbol = Object.assign(resourceGraphFixture(), { [Symbol("x")]: true }); fails(withSymbol, "invalid-value");
    fails(Object.create(resourceGraphFixture()), "invalid-value");
    const location = { get kind() { throw new Error("must not run"); } };
    fails({ ...resourceGraphFixture(), resources: [{ resourceId: "buffer-main", location, exportEmbeddingPolicy: "inherit-source" }] }, "invalid-value");
    const resources = resourceGraphFixture().resources; Object.defineProperty(resources, "0", { get() { throw new Error("must not run"); } });
    fails({ resources, packages: [] }, "invalid-value");
  });

  it("accepts null-prototype plain descriptors and no conversion packages", () => {
    const input = Object.assign(Object.create(null), resourceGraphFixture(), { packages: [] });
    expect(isGpuModelResourceGraph(createGpuModelResourceGraph(document, input))).toBe(true);
  });

  it("does not confuse a shared content hash with duplicate logical resource ids", async () => {
    const raw = validDocument(); const resources = raw.resources as Array<Record<string, unknown>>;
    resources.push({ ...resources[0], id: "same-bytes" });
    const verified = await createAndVerifyGpuModelDocument(raw, new FixtureVerificationPort());
    const input = resourceGraphFixture(); input.resources.push({ resourceId: "same-bytes", location: { kind: "embedded" }, exportEmbeddingPolicy: "inherit-source" });
    expect(createGpuModelResourceGraph(verified, input).nodes.filter(n => n.kind === "resource")).toHaveLength(3);
  });

  it("caps generated graph nodes even when the canonical document is valid", async () => {
    const raw = rigidDocument(); const accessor = (raw.accessors as Array<Record<string, unknown>>)[0]!;
    raw.accessors = [accessor, ...Array.from({ length: GPU_MODEL_RESOURCE_GRAPH_LIMITS.nodes - 1 }, (_, i) => ({ ...accessor, id: `a${i}` }))];
    const verified = await createAndVerifyGpuModelDocument(raw, new FixtureVerificationPort());
    expect(() => createGpuModelResourceGraph(verified, { resources: [resourceGraphFixture().resources[0]], packages: [] })).toThrow(expect.objectContaining({ code: "limit-exceeded" }));
  });

  it("caps cumulative package dependencies across individually bounded packages", async () => {
    const raw = rigidDocument(); const accessor = (raw.accessors as Array<Record<string, unknown>>)[0]!;
    raw.accessors = [accessor, ...Array.from({ length: 2048 }, (_, i) => ({ ...accessor, id: `a${i}` }))];
    const verified = await createAndVerifyGpuModelDocument(raw, new FixtureVerificationPort());
    const members = Array.from({ length: 2048 }, (_, i) => ({ kind: "accessor", id: `a${i}` }));
    const packages = Array.from({ length: 128 }, (_, i) => ({ id: `p${i}`, members }));
    expect(() => createGpuModelResourceGraph(verified, { resources: [resourceGraphFixture().resources[0]], packages })).toThrow(expect.objectContaining({ code: "limit-exceeded" }));
  });

});
