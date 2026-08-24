import { describe, expect, it } from "vitest";
import {
  CANONICAL_GPU_MODEL_COORDINATE_SYSTEM,
  GPU_MODEL_DOCUMENT_SCHEMA_VERSION,
  GpuModelDocumentError,
  createAndVerifyGpuModelDocument,
  createGpuModelDocument,
  isGpuModelDocument,
} from "../src/index.js";
import {
  FixtureVerificationPort,
  IDENTITY_MATRIX,
  fixtureBuffer,
  sha256,
  validDocument,
  withVerifiedResources,
} from "./fixtures/model-document-fixture.js";

async function create(input: Record<string, unknown> = validDocument()) {
  return createAndVerifyGpuModelDocument(input, new FixtureVerificationPort());
}

async function reject(input: Record<string, unknown>, pattern?: RegExp): Promise<void> {
  const assertion = expect(create(input)).rejects;
  if (pattern) await assertion.toThrowError(pattern);
  else await assertion.toThrowError(GpuModelDocumentError);
}

function replaceBuffer(input: Record<string, unknown>, mutate: (bytes: Uint8Array, view: DataView) => void): void {
  const bytes = fixtureBuffer();
  mutate(bytes, new DataView(bytes.buffer));
  (input.resources as Array<Record<string, unknown>>)[0] = {
    id: "buffer-main",
    kind: "buffer",
    contentHash: sha256(bytes),
    byteLength: bytes.byteLength,
    mimeType: "application/octet-stream",
    payload: new Blob([bytes.buffer as ArrayBuffer], { type: "application/octet-stream" }),
  };
  (input.provenance as Record<string, unknown>).sourceContentHash = sha256(bytes);
}

describe("canonical GPU model document", () => {
  it("copies, validates, and deeply freezes the complete renderer-neutral fidelity contract", async () => {
    const input = validDocument();
    const originalBlob = (input.resources as Array<Record<string, unknown>>)[0]!.payload;
    const model = await create(input);

    expect(model.schemaVersion).toBe(GPU_MODEL_DOCUMENT_SCHEMA_VERSION);
    expect(model.coordinateSystem).toEqual(CANONICAL_GPU_MODEL_COORDINATE_SYSTEM);
    expect(model.meshes[0]?.primitives[0]?.attributes[0]?.semantic).toBe("POSITION");
    expect(model.animations[0]?.channels[0]?.targetType).toBe("node-translation");
    expect(model.skeletons[0]?.jointIds).toEqual(["joint-root"]);
    expect(model.skins[0]?.weightSets[0]?.weights[0]).toEqual([1, 0, 0, 0]);
    expect(model.blendShapes[0]?.deltas[0]?.positionAccessorId).toBe("morph-positions");
    expect(model.resources[0]?.payload).not.toBe(originalBlob);
    expect(model.resources[0]?.payload.size).toBe((originalBlob as Blob).size);
    for (const value of [model, model.nodes, model.nodes[0]?.metadata, model.materials[0]?.textures.baseColor, model.materials[0]?.extensions, model.skins[0]?.weightSets[0]?.weights[0], model.animations[0]?.sourceMetadata]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    expect(Object.isFrozen(model.resources[0]?.payload)).toBe(false);

    (input.nodes as Array<Record<string, unknown>>)[0]!.name = "Mutated";
    ((input.metadata as Record<string, unknown>).tags as string[])[0] = "mutated";
    (((input.skins as Array<Record<string, unknown>>)[0]!.weightSets as Array<Record<string, unknown>>)[0]!.weights as number[][])[0]![0] = 0;
    expect(model.nodes[0]?.name).toBe("Root");
    expect(model.metadata).toEqual({ category: "prop", tags: ["fixture"] });
    expect(model.skins[0]?.weightSets[0]?.weights[0]?.[0]).toBe(1);
    expect(isGpuModelDocument(model)).toBe(true);
  });

  it("accepts authored material factors, texture transforms, extension payloads, and optional metadata", async () => {
    const input = validDocument();
    const material = (input.materials as Array<Record<string, unknown>>)[0]!;
    Object.assign(material, {
      alphaMode: "mask",
      alphaCutoff: 0.5,
      transmissionFactor: 0.2,
      clearcoatFactor: 0.3,
      clearcoatRoughnessFactor: 0.4,
      sheenColorFactor: [0.1, 0.2, 0.3],
      sheenRoughnessFactor: 0.5,
      normalScale: -1,
      occlusionStrength: 0.8,
    });
    const binding = ((material.textures as Record<string, unknown>).baseColor as Record<string, unknown>);
    binding.transform = { offset: [0.1, 0.2], rotationRadians: 0.3, scale: [2, 2] };
    const analytic = (input.analyticGeometry as Array<Record<string, unknown>>)[0]!;
    analytic.metadata = { retained: true };
    (input.provenance as Record<string, unknown>).metadata = { source: null };
    const diagnostic = (input.diagnostics as Array<Record<string, unknown>>)[0]!;
    diagnostic.path = "$.meshes[0]";
    diagnostic.metadata = { repaired: false };
    input.metadata = { category: "prop", tags: ["fixture", null, true, -0], nested: { quality: 1 } };
    const model = await create(input);
    expect(model.materials[0]?.alphaCutoff).toBe(0.5);
    expect(model.materials[0]?.textures.baseColor?.transform?.scale).toEqual([2, 2]);
    expect((model.metadata.tags as readonly unknown[])[3]).toBe(0);
  });

  it("validates world-space document bounds from byte-verified positions and affine transforms", async () => {
    const translated = validDocument();
    (translated.nodes as Array<Record<string, unknown>>)[0]!.localMatrix = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      10, 3, -2, 1,
    ];
    translated.bounds = { min: [9, 3, -3], max: [11, 5, -1] };
    expect((await create(translated)).bounds).toEqual({ min: [9, 3, -3], max: [11, 5, -1] });

    const projective = validDocument();
    (projective.nodes as Array<Record<string, unknown>>)[0]!.localMatrix = [...IDENTITY_MATRIX.slice(0, 3), 0.1, ...IDENTITY_MATRIX.slice(4)];
    await reject(projective, /affine/iu);

    const falseBounds = validDocument();
    falseBounds.bounds = { min: [-2, 0, -1], max: [1, 2, 1] };
    await reject(falseBounds, /byte-verified POSITION/iu);
  });

  it("returns stable bounded errors for hostile object inspection", () => {
    const hostile = new Proxy({}, { ownKeys() { throw new Error("attacker-controlled internal detail"); } });
    let failure: unknown;
    try { createGpuModelDocument(hostile); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(GpuModelDocumentError);
    expect(failure).toMatchObject({ code: "invalid-type", path: "$" });
    expect(String(failure)).not.toContain("attacker-controlled");
    expect(isGpuModelDocument(hostile)).toBe(false);
  });

  it.each([
    ["non-object document", () => [] as unknown as Record<string, unknown>],
    ["non-plain document", () => new Date() as unknown as Record<string, unknown>],
    ["unknown top-level key", () => ({ ...validDocument(), unexpected: true })],
    ["missing required key", () => { const input = validDocument(); delete input.metadata; return input; }],
    ["top-level symbol key", () => { const input = validDocument(); Object.defineProperty(input, Symbol("unsafe"), { value: true }); return input; }],
    ["top-level accessor", () => { const input = validDocument(); Object.defineProperty(input, "metadata", { get: () => ({}) }); return input; }],
    ["non-enumerable top-level data", () => { const input = validDocument(); Object.defineProperty(input, "metadata", { value: {}, enumerable: false }); return input; }],
    ["non-array roots", () => ({ ...validDocument(), roots: "node-root" })],
    ["empty roots", () => ({ ...validDocument(), roots: [] })],
    ["sparse roots", () => ({ ...validDocument(), roots: new Array(1) })],
    ["non-enumerable array entry", () => { const input = validDocument(); Object.defineProperty(input.roots as string[], "0", { value: "node-root", enumerable: false }); return input; }],
    ["array extension property", () => { const input = validDocument(); Object.defineProperty(input.roots as string[], "4294967295", { value: "node-root" }); return input; }],
    ["invalid identifier", () => { const input = validDocument(); (input.nodes as Array<Record<string, unknown>>)[0]!.id = "unsafe id"; return input; }],
    ["non-string name", () => { const input = validDocument(); (input.nodes as Array<Record<string, unknown>>)[0]!.name = 1; return input; }],
    ["empty name", () => { const input = validDocument(); (input.nodes as Array<Record<string, unknown>>)[0]!.name = ""; return input; }],
    ["control text", () => { const input = validDocument(); (input.nodes as Array<Record<string, unknown>>)[0]!.name = "unsafe\u0000name"; return input; }],
    ["malformed Unicode", () => { const input = validDocument(); (input.nodes as Array<Record<string, unknown>>)[0]!.name = "\ud800"; return input; }],
    ["orphaned Unicode surrogate", () => { const input = validDocument(); (input.nodes as Array<Record<string, unknown>>)[0]!.name = "\udc00"; return input; }],
    ["invalid boolean", () => { const input = validDocument(); (input.materials as Array<Record<string, unknown>>)[0]!.doubleSided = "false"; return input; }],
    ["invalid enum", () => { const input = validDocument(); (input.materials as Array<Record<string, unknown>>)[0]!.alphaMode = "transparent"; return input; }],
    ["invalid integer", () => { const input = validDocument(); (input.accessors as Array<Record<string, unknown>>)[0]!.count = 1.5; return input; }],
    ["document without geometry", () => { const input = validDocument(); input.meshes = []; input.analyticGeometry = []; return input; }],
  ])("rejects malformed structural input: %s", async (_name, makeInput) => {
    await reject(makeInput());
  });

  it.each([
    ["metadata scalar", () => 1],
    ["metadata custom prototype", () => new Date()],
    ["metadata symbol key", () => { const metadata = {}; Object.defineProperty(metadata, Symbol("unsafe"), { value: true }); return metadata; }],
    ["metadata accessor", () => { const metadata = {}; Object.defineProperty(metadata, "unsafe", { get: () => true, enumerable: true }); return metadata; }],
    ["metadata non-enumerable data", () => { const metadata = {}; Object.defineProperty(metadata, "unsafe", { value: true, enumerable: false }); return metadata; }],
    ["metadata invalid key", () => ({ "unsafe key": true })],
    ["metadata key count", () => Object.fromEntries(Array.from({ length: 129 }, (_, index) => [`key${index}`, index]))],
    ["metadata array length", () => ({ values: Array.from({ length: 513 }, () => 0) })],
    ["metadata depth", () => ({ a: { a: { a: { a: { a: { a: { a: { a: {} } } } } } } } })],
    ["metadata value count", () => Object.fromEntries(Array.from({ length: 128 }, (_, index) => [`key${index}`, Array.from({ length: 32 }, () => index)]))],
    ["metadata non-finite number", () => ({ value: Number.NaN })],
  ])("rejects unsafe or unbounded metadata: %s", async (_name, makeMetadata) => {
    const input = validDocument();
    input.metadata = makeMetadata();
    await reject(input);
  });

  it("applies the metadata budget across the complete document", async () => {
    const metadataChunk = () => Object.fromEntries(Array.from({ length: 128 }, (_, index) => [`key${index}`, Array.from({ length: 16 }, () => index)]));
    const input = validDocument();
    input.metadata = metadataChunk();
    (input.nodes as Array<Record<string, unknown>>)[0]!.metadata = metadataChunk();
    await reject(input, /metadata value count/iu);
  });

  it.each([
    ["unsupported image MIME", (input: Record<string, unknown>) => { (input.resources as Array<Record<string, unknown>>)[1]!.mimeType = "image/gif"; }],
    ["non-Blob payload", (input: Record<string, unknown>) => { (input.resources as Array<Record<string, unknown>>)[0]!.payload = new Uint8Array(320); }],
    ["empty resource", (input: Record<string, unknown>) => { const resource = (input.resources as Array<Record<string, unknown>>)[0]!; resource.byteLength = 0; resource.payload = new Blob([]); }],
    ["payload MIME mismatch", (input: Record<string, unknown>) => { const resource = (input.resources as Array<Record<string, unknown>>)[1]!; resource.payload = new Blob([new Uint8Array(resource.byteLength as number)], { type: "image/jpeg" }); }],
    ["floating normalization", (input: Record<string, unknown>) => { (input.accessors as Array<Record<string, unknown>>)[0]!.normalized = true; }],
    ["one-sided accessor bounds", (input: Record<string, unknown>) => { delete (input.accessors as Array<Record<string, unknown>>)[0]!.max; }],
    ["inverted accessor bounds", (input: Record<string, unknown>) => { (input.accessors as Array<Record<string, unknown>>)[0]!.min = [2, 0, 0]; }],
    ["inverted document bounds", (input: Record<string, unknown>) => { (input.bounds as Record<string, unknown>).min = [2, 0, 0]; }],
    ["missing POSITION", (input: Record<string, unknown>) => { (((input.meshes as Array<Record<string, unknown>>)[0]!.primitives as Array<Record<string, unknown>>)[0]!.attributes as Array<Record<string, unknown>>)[0]!.semantic = "NORMAL"; }],
    ["duplicate attribute", (input: Record<string, unknown>) => { (((input.meshes as Array<Record<string, unknown>>)[0]!.primitives as Array<Record<string, unknown>>)[0]!.attributes as Array<Record<string, unknown>>).push({ semantic: "POSITION", accessorId: "positions" }); }],
    ["mask without cutoff", (input: Record<string, unknown>) => { (input.materials as Array<Record<string, unknown>>)[0]!.alphaMode = "mask"; }],
    ["cutoff on opaque", (input: Record<string, unknown>) => { (input.materials as Array<Record<string, unknown>>)[0]!.alphaCutoff = 0.5; }],
    ["unsafe texture path", (input: Record<string, unknown>) => { (input.textures as Array<Record<string, unknown>>)[0]!.relativePath = "../secret.png"; }],
    ["duplicate texture usage", (input: Record<string, unknown>) => { (input.textures as Array<Record<string, unknown>>)[0]!.intendedUsage = ["base-color", "base-color"]; }],
    ["empty transform", (input: Record<string, unknown>) => { (((input.materials as Array<Record<string, unknown>>)[0]!.textures as Record<string, unknown>).baseColor as Record<string, unknown>).transform = {}; }],
  ])("rejects invalid component contracts: %s", async (_name, mutate) => {
    const input = validDocument();
    mutate(input);
    await reject(input);
  });

  it.each([
    ["component alignment", (input: Record<string, unknown>) => { (input.accessors as Array<Record<string, unknown>>)[0]!.byteOffset = 2; }],
    ["POSITION without min/max", (input: Record<string, unknown>) => { delete (input.accessors as Array<Record<string, unknown>>)[0]!.min; delete (input.accessors as Array<Record<string, unknown>>)[0]!.max; }],
    ["integer accessor fractional bounds", (input: Record<string, unknown>) => { const accessor = (input.accessors as Array<Record<string, unknown>>)[1]!; accessor.min = [0.5]; accessor.max = [3]; }],
    ["integer accessor component range", (input: Record<string, unknown>) => { const accessor = (input.accessors as Array<Record<string, unknown>>)[2]!; accessor.min = [-1, 0, 0, 0]; accessor.max = [1, 1, 1, 1]; }],
    ["integer matrix accessor", (input: Record<string, unknown>) => { const accessor = (input.accessors as Array<Record<string, unknown>>)[1]!; accessor.elementType = "mat2"; }],
    ["normalized index accessor", (input: Record<string, unknown>) => { (input.accessors as Array<Record<string, unknown>>)[1]!.normalized = true; }],
    ["invalid NORMAL accessor", (input: Record<string, unknown>) => { (input.accessors as Array<Record<string, unknown>>)[7]!.elementType = "vec2"; }],
    ["invalid texture-coordinate accessor", (input: Record<string, unknown>) => { (input.accessors as Array<Record<string, unknown>>)[8]!.normalized = true; }],
    ["invalid joint accessor", (input: Record<string, unknown>) => { (input.accessors as Array<Record<string, unknown>>)[2]!.componentType = "f32"; }],
    ["invalid weight accessor", (input: Record<string, unknown>) => { const accessor = (input.accessors as Array<Record<string, unknown>>)[3]!; accessor.componentType = "u8"; delete accessor.normalized; }],
    ["accessor stride too small", (input: Record<string, unknown>) => { (input.accessors as Array<Record<string, unknown>>)[0]!.byteStride = 4; }],
    ["accessor exceeds resource", (input: Record<string, unknown>) => { (input.accessors as Array<Record<string, unknown>>)[0]!.count = 100; }],
    ["POSITION accessor type", (input: Record<string, unknown>) => { const accessor = (input.accessors as Array<Record<string, unknown>>)[0]!; accessor.elementType = "vec2"; accessor.min = [-1, 0]; accessor.max = [1, 2]; }],
    ["attribute count", (input: Record<string, unknown>) => { (input.accessors as Array<Record<string, unknown>>)[7]!.count = 3; }],
    ["invalid index accessor", (input: Record<string, unknown>) => { (((input.meshes as Array<Record<string, unknown>>)[0]!.primitives as Array<Record<string, unknown>>)[0]!).indicesAccessorId = "animation-output"; }],
  ])("rejects invalid accessor representation: %s", async (_name, mutate) => {
    const input = validDocument();
    mutate(input);
    await reject(input);
  });

  it.each([
    ["duplicate nodes", (input: Record<string, unknown>) => { (input.nodes as unknown[]).push({ id: "node-root", children: [], localMatrix: IDENTITY_MATRIX }); }],
    ["multiple parents", (input: Record<string, unknown>) => { (input.nodes as unknown[]).push({ id: "node-second-parent", children: ["node-joint"], localMatrix: IDENTITY_MATRIX }); input.roots = ["node-root", "node-second-parent"]; }],
    ["parentless node omitted", (input: Record<string, unknown>) => { (input.nodes as unknown[]).push({ id: "node-orphan", children: [], localMatrix: IDENTITY_MATRIX }); }],
    ["missing child", (input: Record<string, unknown>) => { (input.nodes as Array<Record<string, unknown>>)[0]!.children = ["missing-node"]; }],
    ["duplicate roots", (input: Record<string, unknown>) => { input.roots = ["node-root", "node-root"]; }],
    ["scene cycle", (input: Record<string, unknown>) => { (input.nodes as Array<Record<string, unknown>>)[1]!.children = ["node-root"]; }],
    ["root with parent", (input: Record<string, unknown>) => { input.roots = ["node-root", "node-joint"]; }],
    ["accessor image resource", (input: Record<string, unknown>) => { (input.accessors as Array<Record<string, unknown>>)[0]!.resourceId = "image-main"; }],
    ["texture backed by buffer", (input: Record<string, unknown>) => { (input.textures as Array<Record<string, unknown>>)[0]!.imageResourceId = "buffer-main"; }],
    ["texture hash mismatch", (input: Record<string, unknown>) => { (input.textures as Array<Record<string, unknown>>)[0]!.contentHash = "a".repeat(64); }],
    ["material texture missing", (input: Record<string, unknown>) => { ((((input.materials as Array<Record<string, unknown>>)[0]!.textures as Record<string, unknown>).baseColor as Record<string, unknown>)).textureId = "missing-texture"; }],
    ["binding usage mismatch", (input: Record<string, unknown>) => { ((((input.materials as Array<Record<string, unknown>>)[0]!.textures as Record<string, unknown>).baseColor as Record<string, unknown>)).intendedUsage = "normal"; }],
    ["binding colour mismatch", (input: Record<string, unknown>) => { ((((input.materials as Array<Record<string, unknown>>)[0]!.textures as Record<string, unknown>).baseColor as Record<string, unknown>)).colorSpace = "linear"; }],
    ["binding sampler mismatch", (input: Record<string, unknown>) => { ((((input.materials as Array<Record<string, unknown>>)[0]!.textures as Record<string, unknown>).baseColor as Record<string, unknown>)).samplerId = "other"; }],
    ["missing analytic source", (input: Record<string, unknown>) => { (input.analyticGeometry as Array<Record<string, unknown>>)[0]!.sourceResourceId = "missing-resource"; }],
    ["analytic image source", (input: Record<string, unknown>) => { (input.analyticGeometry as Array<Record<string, unknown>>)[0]!.sourceResourceId = "image-main"; }],
  ])("rejects invalid scene/resource/reference contracts: %s", async (_name, mutate) => {
    const input = validDocument();
    mutate(input);
    await reject(input);
  });

  it.each([
    ["joint not in skeleton", (input: Record<string, unknown>) => { (input.skeletons as Array<Record<string, unknown>>)[0]!.jointIds = ["missing-joint"]; }],
    ["wrong skeleton roots", (input: Record<string, unknown>) => { (input.skeletons as Array<Record<string, unknown>>)[0]!.rootJointIds = ["missing-joint"]; }],
    ["joint missing skeleton membership", (input: Record<string, unknown>) => { input.skeletons = []; }],
    ["joint node missing", (input: Record<string, unknown>) => { (input.joints as Array<Record<string, unknown>>)[0]!.nodeId = "missing-node"; }],
    ["bad quaternion", (input: Record<string, unknown>) => { (((input.joints as Array<Record<string, unknown>>)[0]!.restLocalTransform as Record<string, unknown>)).rotation = [0, 0, 0, 2]; }],
    ["skin without mesh", (input: Record<string, unknown>) => { delete (input.nodes as Array<Record<string, unknown>>)[0]!.meshId; }],
    ["skin not linked", (input: Record<string, unknown>) => { delete (input.nodes as Array<Record<string, unknown>>)[0]!.skinId; }],
    ["skin skeleton missing", (input: Record<string, unknown>) => { (input.skins as Array<Record<string, unknown>>)[0]!.skeletonId = "missing-skeleton"; }],
    ["skin joint outside skeleton", (input: Record<string, unknown>) => { (input.skins as Array<Record<string, unknown>>)[0]!.jointIds = ["missing-joint"]; }],
    ["inverse bind count mismatch", (input: Record<string, unknown>) => { (input.skins as Array<Record<string, unknown>>)[0]!.inverseBindMatrices = []; }],
    ["inverse bind value mismatch", (input: Record<string, unknown>) => { (input.skins as Array<Record<string, unknown>>)[0]!.inverseBindMatrices = [[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1]]; }],
    ["weight set missing", (input: Record<string, unknown>) => { (input.skins as Array<Record<string, unknown>>)[0]!.weightSets = []; }],
    ["weight set primitive missing", (input: Record<string, unknown>) => { (((input.skins as Array<Record<string, unknown>>)[0]!.weightSets as Array<Record<string, unknown>>)[0]!).primitiveId = "missing-primitive"; }],
    ["weight influences not multiple of four", (input: Record<string, unknown>) => { (((input.skins as Array<Record<string, unknown>>)[0]!.weightSets as Array<Record<string, unknown>>)[0]!).influencesPerVertex = 3; }],
    ["weight rows mismatch", (input: Record<string, unknown>) => { (((input.skins as Array<Record<string, unknown>>)[0]!.weightSets as Array<Record<string, unknown>>)[0]!).weights = [[1, 0, 0, 0]]; }],
    ["JOINTS without WEIGHTS", (input: Record<string, unknown>) => { const attrs = (((input.meshes as Array<Record<string, unknown>>)[0]!.primitives as Array<Record<string, unknown>>)[0]!.attributes as Array<Record<string, unknown>>); const weight = attrs.findIndex(({ semantic }) => semantic === "WEIGHTS_0"); attrs.splice(weight, 1); }],
    ["blend mesh missing", (input: Record<string, unknown>) => { (input.blendShapes as Array<Record<string, unknown>>)[0]!.meshId = "missing-mesh"; }],
    ["blend primitive outside mesh", (input: Record<string, unknown>) => { (((input.blendShapes as Array<Record<string, unknown>>)[0]!.deltas as Array<Record<string, unknown>>)[0]!).primitiveId = "missing-primitive"; }],
    ["blend empty delta", (input: Record<string, unknown>) => { (input.blendShapes as Array<Record<string, unknown>>)[0]!.deltas = [{ primitiveId: "primitive-main" }]; }],
    ["blend accessor count", (input: Record<string, unknown>) => { (input.accessors as Array<Record<string, unknown>>)[4]!.count = 3; }],
  ])("rejects invalid rig, skin, and blend-shape contracts: %s", async (_name, mutate) => {
    const input = validDocument();
    mutate(input);
    await reject(input);
  });

  it("enforces parent-joint ancestry and skeleton ownership", async () => {
    const input = validDocument();
    (input.nodes as Array<Record<string, unknown>>)[1]!.children = ["node-joint-child"];
    (input.nodes as unknown[]).push({ id: "node-joint-child", children: [], localMatrix: IDENTITY_MATRIX });
    (input.joints as unknown[]).push({ id: "joint-child", nodeId: "node-joint-child", parentJointId: "joint-root", restLocalTransform: { translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }, inverseBindMatrix: IDENTITY_MATRIX, sourceMetadata: {} });
    const skeleton = (input.skeletons as Array<Record<string, unknown>>)[0]!;
    skeleton.jointIds = ["joint-root", "joint-child"];
    const skin = (input.skins as Array<Record<string, unknown>>)[0]!;
    skin.jointIds = ["joint-root", "joint-child"];
    skin.inverseBindMatrices = [IDENTITY_MATRIX, IDENTITY_MATRIX];
    expect((await create(input)).joints[1]?.parentJointId).toBe("joint-root");

    const invalid = validDocument();
    (invalid.joints as Array<Record<string, unknown>>)[0]!.parentJointId = "joint-root";
    await reject(invalid, /rootJointIds|ancestor|cycle/iu);
  });

  it.each([
    ["missing sampler", (input: Record<string, unknown>) => { (((input.animations as Array<Record<string, unknown>>)[0]!.channels as Array<Record<string, unknown>>)[0]!).samplerId = "missing-sampler"; }],
    ["unused sampler", (input: Record<string, unknown>) => { ((input.animations as Array<Record<string, unknown>>)[0]!.samplers as unknown[]).push({ id: "unused", inputAccessorId: "animation-time", outputAccessorId: "animation-output", inputTimesSeconds: [0, 1], outputValues: [0, 0, 0, 0, 0, 0], interpolation: "linear", sourceMetadata: {} }); }],
    ["invalid animation input", (input: Record<string, unknown>) => { (((input.animations as Array<Record<string, unknown>>)[0]!.samplers as Array<Record<string, unknown>>)[0]!).inputAccessorId = "positions"; }],
    ["invalid animation output", (input: Record<string, unknown>) => { (((input.animations as Array<Record<string, unknown>>)[0]!.channels as Array<Record<string, unknown>>)[0]!).targetType = "node-rotation"; }],
    ["animation count mismatch", (input: Record<string, unknown>) => { (input.accessors as Array<Record<string, unknown>>)[6]!.count = 1; }],
    ["authored input mismatch", (input: Record<string, unknown>) => { (((input.animations as Array<Record<string, unknown>>)[0]!.samplers as Array<Record<string, unknown>>)[0]!).inputTimesSeconds = [0, 0.5]; }],
    ["authored output mismatch", (input: Record<string, unknown>) => { (((input.animations as Array<Record<string, unknown>>)[0]!.samplers as Array<Record<string, unknown>>)[0]!).outputValues = [0, 0, 0, 1, 0, 0]; }],
    ["time exceeds duration", (input: Record<string, unknown>) => { (input.animations as Array<Record<string, unknown>>)[0]!.durationSeconds = 0.5; }],
    ["non-increasing times", (input: Record<string, unknown>) => { (((input.animations as Array<Record<string, unknown>>)[0]!.samplers as Array<Record<string, unknown>>)[0]!).inputTimesSeconds = [1, 0]; }],
    ["missing target node", (input: Record<string, unknown>) => { (((input.animations as Array<Record<string, unknown>>)[0]!.channels as Array<Record<string, unknown>>)[0]!).targetId = "missing-node"; }],
    ["missing weight target", (input: Record<string, unknown>) => { const channel = (((input.animations as Array<Record<string, unknown>>)[0]!.channels as Array<Record<string, unknown>>)[0]!); channel.targetType = "weights"; channel.targetId = "missing-shape"; }],
    ["duplicate channel id", (input: Record<string, unknown>) => { const animation = (input.animations as Array<Record<string, unknown>>)[0]!; (animation.channels as unknown[]).push({ ...(animation.channels as Array<Record<string, unknown>>)[0] }); }],
  ])("rejects invalid animation fidelity contracts: %s", async (_name, mutate) => {
    const input = validDocument();
    mutate(input);
    await reject(input);
  });

  it("supports a verified blend-shape weight channel", async () => {
    const input = validDocument();
    const animation = (input.animations as Array<Record<string, unknown>>)[0]!;
    ((animation.channels as Array<Record<string, unknown>>)[0]!).targetType = "weights";
    ((animation.channels as Array<Record<string, unknown>>)[0]!).targetId = "blend-main";
    const output = (input.accessors as Array<Record<string, unknown>>)[6]!;
    output.elementType = "scalar";
    output.count = 2;
    ((animation.samplers as Array<Record<string, unknown>>)[0]!).outputValues = [0, 0];
    expect((await create(input)).animations[0]?.channels[0]?.targetType).toBe("weights");
  });

  it("rejects non-finite POSITION bytes, forged accessor bounds, and out-of-range indices", async () => {
    const nonFinite = validDocument();
    replaceBuffer(nonFinite, (_bytes, view) => view.setFloat32(0, Number.NaN, true));
    await reject(nonFinite, /non-finite/iu);

    const forgedBounds = validDocument();
    (forgedBounds.accessors as Array<Record<string, unknown>>)[0]!.min = [-2, 0, -1];
    await reject(forgedBounds, /min\/max.*verified payload/iu);

    const badIndex = validDocument();
    replaceBuffer(badIndex, (_bytes, view) => view.setUint16(48, 999, true));
    await reject(badIndex, /outside POSITION/iu);
  });

  it("rejects byte-forged joint indices, unnormalised weights, blend deltas, and animation values", async () => {
    const joint = validDocument();
    replaceBuffer(joint, (bytes) => { bytes[64] = 1; });
    await reject(joint, /joint payload index/iu);

    const weight = validDocument();
    replaceBuffer(weight, (_bytes, view) => view.setFloat32(80, 0.5, true));
    const weightSet = (((weight.skins as Array<Record<string, unknown>>)[0]!.weightSets as Array<Record<string, unknown>>)[0]!);
    (weightSet.weights as number[][])[0]![0] = 0.5;
    await reject(weight, /sum to one/iu);

    const blend = validDocument();
    replaceBuffer(blend, (_bytes, view) => view.setFloat32(144, Number.POSITIVE_INFINITY, true));
    await reject(blend, /non-finite/iu);

    const animation = validDocument();
    replaceBuffer(animation, (_bytes, view) => view.setFloat32(200, Number.NaN, true));
    await reject(animation, /non-finite/iu);
  });

  it("requires sync callers to preserve verified resource identity while allowing structural validation", async () => {
    const input = await withVerifiedResources(validDocument());
    const model = createGpuModelDocument(input);
    expect(isGpuModelDocument(model)).toBe(true);
    const missing = { ...input, nodes: (input.nodes as Array<Record<string, unknown>>).map((node, index) => index === 0 ? { ...node, meshId: "missing-mesh" } : node) };
    expect(() => createGpuModelDocument(missing)).toThrowError(/missing mesh/iu);
  });
});
