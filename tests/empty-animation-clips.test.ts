import { describe, expect, it } from "vitest";
import {
  GPU_MODEL_DOCUMENT_LIMITS, GPU_MODEL_DOCUMENT_SCHEMA_VERSION,
  createAndVerifyGpuModelDocument, createGpuModelDocument,
  createGpuModelResourceGraph, createGpuModelStaticDemoCompilerInput,
  encodeGpuModelDocumentCanonical, gpuModelResourceKey, hashGpuModelDocumentCanonical,
  isGpuModelDocument, type GpuModelAnimation,
} from "../src/index.js";
import { FixtureVerificationPort, rigidDocument, validDocument } from "./fixtures/model-document-fixture.js";

type Row = Record<string, unknown>;
const rows = (value: unknown) => value as Row[];
const create = (input: Row) => createAndVerifyGpuModelDocument(input, new FixtureVerificationPort());
const empty = (id = "empty-take", durationSeconds = 2): GpuModelAnimation => ({
  id, name: "Empty Take", durationSeconds, samplers: [], channels: [],
  sourceMetadata: { localStartSeconds: -1, localEndSeconds: 1,
    referenceStartSeconds: 3, referenceEndSeconds: 5, framesPerSecond: 24,
    layers: [{ id: "empty-layer", name: "Base Layer" }] },
});
function fixture() {
  const input = rigidDocument();
  input.animations = [empty()];
  return input;
}

describe("empty canonical animation clips", () => {
  it.each([0, 2, 2.5])("retains empty clip identity and a %s second duration without synthesizing motion or resources", async duration => {
    const input = fixture(); input.animations = [empty("take", duration)];
    const model = await create(input);
    expect(model.schemaVersion).toBe(GPU_MODEL_DOCUMENT_SCHEMA_VERSION);
    expect(model.animations).toEqual(input.animations);
    expect(model.resources).toHaveLength(rows(input.resources).length);
    expect(model.accessors).toHaveLength(rows(input.accessors).length);
    expect(model.nodes).toHaveLength(rows(input.nodes).length);
    expect(isGpuModelDocument(model)).toBe(true);
    expect(createGpuModelDocument(model)).toBe(model);
    expect(isGpuModelDocument(structuredClone(model))).toBe(false);
  });

  it("preserves mixed empty and populated clips, including the populated sampler's verified bytes", async () => {
    const input = validDocument();
    const populated = rows(input.animations)[0]!;
    input.animations = [empty("empty-first", 0), populated, empty("empty-last")];
    const model = await create(input);
    expect(model.animations.map(c => c.id)).toEqual(["empty-first", populated.id, "empty-last"]);
    expect(model.animations[1]).toEqual(populated);
    expect(model.animations[1]!.samplers[0]!.inputTimesSeconds).toEqual([0, 1]);
    const forged = validDocument();
    rows(rows(forged.animations)[0]!.samplers)[0]!.outputValues = [1, 0, 0, 0, 0, 0];
    rows(forged.animations).unshift(empty() as unknown as Row);
    await expect(create(forged)).rejects.toThrow(/verified accessor bytes/);
  });

  it("copies/freezes source evidence and canonically round trips empty clips without changing order or values", async () => {
    const input = fixture();
    rows(input.animations).push(empty("second", 0) as unknown as Row);
    const model = await create(input);
    const bytes = encodeGpuModelDocumentCanonical(model);
    const hash = await hashGpuModelDocumentCanonical(model);
    const decoded = (JSON.parse(new TextDecoder().decode(bytes)) as { document: Row }).document;
    rows(decoded.resources).forEach((r, i) => { r.payload = model.resources[i]!.payload; });
    expect(encodeGpuModelDocumentCanonical(await create(decoded))).toEqual(bytes);
    expect(await hashGpuModelDocumentCanonical(await create(decoded))).toBe(hash);
    const clip = model.animations[0]!;
    for (const part of [clip, clip.samplers, clip.channels, clip.sourceMetadata,
      clip.sourceMetadata.layers, (clip.sourceMetadata.layers as readonly unknown[])[0]]) expect(Object.isFrozen(part)).toBe(true);
    const source = rows(input.animations)[0]!;
    source.name = "mutated";
    (source.sourceMetadata as Row).localStartSeconds = -99;
    rows((source.sourceMetadata as Row).layers)[0]!.name = "mutated";
    rows(input.animations).reverse();
    expect(encodeGpuModelDocumentCanonical(model)).toEqual(bytes);
  });

  it("keeps an empty animation as a graph/package member with no accessor dependencies", async () => {
    const model = await create(fixture());
    const graph = createGpuModelResourceGraph(model, {
      resources: model.resources.map(r => ({ resourceId: r.id, location: { kind: "embedded" }, exportEmbeddingPolicy: "inherit-source" })),
      packages: [{ id: "takes", members: [{ kind: "animation", id: "empty-take" }] }],
    });
    const animation = graph.nodes.find(n => n.kind === "animation")!;
    expect(animation.value).toEqual(model.animations[0]);
    expect(animation.dependencies).toEqual([]);
    expect(graph.nodes.find(n => n.kind === "package")!.dependencies).toEqual([gpuModelResourceKey("animation", "empty-take")]);
  });

  it.each(["samplers", "channels"])("still rejects an asymmetric populated %s collection", async field => {
    const input = validDocument();
    rows(input.animations)[0]![field === "samplers" ? "channels" : "samplers"] = [];
    await expect(create(input)).rejects.toThrow(field === "samplers" ? /unused sampler/ : /missing animation sampler/);
  });

  it.each([
    ["negative duration", (c: Row) => { c.durationSeconds = -1; }],
    ["nonfinite duration", (c: Row) => { c.durationSeconds = Infinity; }],
    ["nonfinite source evidence", (c: Row) => { c.sourceMetadata = { time: NaN }; }],
    ["unknown key", (c: Row) => { c.unknown = true; }],
    ["missing samplers", (c: Row) => { delete c.samplers; }],
    ["missing channels", (c: Row) => { delete c.channels; }],
    ["null samplers", (c: Row) => { c.samplers = null; }],
    ["sparse channels", (c: Row) => { c.channels = new Array(1); }],
    ["oversized name", (c: Row) => { c.name = "x".repeat(GPU_MODEL_DOCUMENT_LIMITS.nameLength + 1); }],
    ["oversized metadata", (c: Row) => { c.sourceMetadata = { layers: new Array(GPU_MODEL_DOCUMENT_LIMITS.metadataArrayLength + 1).fill(0) }; }],
  ] as const)("rejects empty clips with %s", async (_label, mutate) => {
    const input = fixture(); mutate(rows(input.animations)[0]!);
    await expect(create(input)).rejects.toThrow();
  });

  it("keeps duplicate identity, animation count and aggregate metadata limits", async () => {
    const duplicate = fixture(); rows(duplicate.animations).push(empty() as unknown as Row);
    await expect(create(duplicate)).rejects.toThrow(/duplicate/);
    const excessive = fixture(); excessive.animations = new Array(GPU_MODEL_DOCUMENT_LIMITS.animations + 1);
    await expect(create(excessive)).rejects.toThrow(/animations.*array length/);
    const metadata = fixture();
    metadata.animations = Array.from({ length: 10 }, (_, i) => ({ ...empty(`take-${i}`), sourceMetadata: { values: new Array(512).fill(0) } }));
    await expect(create(metadata)).rejects.toThrow(/document metadata value count exceeds/);
  });

  it("still refuses empty animation in a static projection and honors its fail-closed gate", async () => {
    const model = await create(fixture());
    await expect(createGpuModelStaticDemoCompilerInput(model, { pvoxModelsEnabled: true })).rejects.toThrow(/animations.*static demo/);
    await expect(createGpuModelStaticDemoCompilerInput(model, { pvoxModelsEnabled: false })).rejects.toThrow(/disabled/);
    await expect(createGpuModelStaticDemoCompilerInput(model, { pvoxModelsEnabled: true })).rejects.toThrow(/animations.*static demo/);
    const controller = new AbortController(); controller.abort();
    const port = new FixtureVerificationPort();
    await expect(createAndVerifyGpuModelDocument(fixture(), port, { signal: controller.signal })).rejects.toThrow(/aborted/);
    expect(port.digestCalls).toBe(0);
  });
});
