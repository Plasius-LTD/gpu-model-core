import { describe, expect, it } from "vitest";
import {
  GPU_MODEL_STATIC_DEMO_FEATURE_FLAG,
  GPU_MODEL_STATIC_DEMO_MAX_ABSOLUTE_COORDINATE_METRES,
  GPU_MODEL_STATIC_DEMO_PROFILE_VERSION,
  GpuModelDocumentError,
  createAndVerifyGpuModelDocument,
  createGpuModelStaticDemoCompilerInput,
  encodeGpuModelDocumentCanonical,
  hashGpuModelDocumentCanonical,
} from "../src/index.js";
import {
  FixtureVerificationPort,
  fixtureBuffer,
  sha256,
  validDocument,
} from "./fixtures/model-document-fixture.js";

function staticDemoDocument(): Record<string, unknown> {
  const input = validDocument();
  const root = (input.nodes as Array<Record<string, unknown>>)[0]!;
  delete root.skinId;
  input.resources = [(input.resources as unknown[])[0]!];
  input.accessors = (input.accessors as Array<Record<string, unknown>>)
    .filter(({ id }) => id === "positions" || id === "indices" || id === "normals");
  const primitive = ((input.meshes as Array<Record<string, unknown>>)[0]!
    .primitives as Array<Record<string, unknown>>)[0]!;
  primitive.attributes = (primitive.attributes as Array<Record<string, unknown>>)
    .filter(({ semantic }) => semantic === "POSITION" || semantic === "NORMAL");
  const material = (input.materials as Array<Record<string, unknown>>)[0]!;
  material.textures = {};
  material.extensions = {};
  input.textures = [];
  input.skeletons = [];
  input.joints = [];
  input.skins = [];
  input.blendShapes = [];
  input.animations = [];
  input.analyticGeometry = [];
  (input.provenance as Record<string, unknown>).sourceIdentifier = "https://untrusted.invalid/source.glb";
  return input;
}

async function createStatic(input: Record<string, unknown> = staticDemoDocument()) {
  return createAndVerifyGpuModelDocument(input, new FixtureVerificationPort());
}

const ENABLED = Object.freeze({ pvoxModelsEnabled: true });

describe("bounded static-demo compiler document", () => {
  it("canonically encodes and hashes a verified whole document", async () => {
    const leftInput = staticDemoDocument();
    leftInput.metadata = { zeta: 2, alpha: { second: false, first: true } };
    const left = await createStatic(leftInput);

    const rightInput = staticDemoDocument();
    rightInput.metadata = { alpha: { first: true, second: false }, zeta: 2 };
    const right = await createStatic(rightInput);

    const beforeMutation = encodeGpuModelDocumentCanonical(left);
    (leftInput.metadata as Record<string, unknown>).zeta = 99;
    const afterMutation = encodeGpuModelDocumentCanonical(left);

    expect(afterMutation).toEqual(beforeMutation);
    expect(encodeGpuModelDocumentCanonical(right)).toEqual(beforeMutation);
    expect(await hashGpuModelDocumentCanonical(left)).toBe(await hashGpuModelDocumentCanonical(right));
    expect(await hashGpuModelDocumentCanonical(left)).toBe("5b809ea4c478a6fbe265fa615a6e39f8f2101017b0b33aa1449dfd12a8be58a0");
    expect(beforeMutation).toHaveLength(2_286);

    const changedInput = staticDemoDocument();
    (changedInput.materials as Array<Record<string, unknown>>)[0]!.baseColorFactor = [0.25, 0.5, 0.75, 1];
    expect(await hashGpuModelDocumentCanonical(await createStatic(changedInput)))
      .not.toBe(await hashGpuModelDocumentCanonical(left));

    const orderedInput = staticDemoDocument();
    orderedInput.diagnostics = [
      { severity: "info", code: "first", message: "First." },
      { severity: "info", code: "second", message: "Second." },
    ];
    const reversedInput = staticDemoDocument();
    reversedInput.diagnostics = [...(orderedInput.diagnostics as unknown[])].reverse();
    expect(await hashGpuModelDocumentCanonical(await createStatic(orderedInput)))
      .not.toBe(await hashGpuModelDocumentCanonical(await createStatic(reversedInput)));
    expect(() => encodeGpuModelDocumentCanonical(validDocument() as never))
      .toThrowError(GpuModelDocumentError);
  });

  it("extracts a frozen, resource-verified world-triangle/material view", async () => {
    const document = await createStatic();
    const result = await createGpuModelStaticDemoCompilerInput(document, ENABLED);

    expect(GPU_MODEL_STATIC_DEMO_FEATURE_FLAG).toBe("asset.pipeline.pvox-models.enabled");
    expect(result.profileVersion).toBe(GPU_MODEL_STATIC_DEMO_PROFILE_VERSION);
    expect(result.canonicalDocumentHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.coordinateSystem).toMatchObject({ unit: "metre", upAxis: "y", forwardAxis: "-z", origin: "floor-centred" });
    expect(result.bounds).toEqual({ min: [-1, 0, -1], max: [1, 2, 1] });
    expect(result.sourceEvidence).toEqual({
      sourceFormat: "glb",
      sourceContentHash: document.provenance.sourceContentHash,
      converterId: "gltf-glb-adapter",
      converterVersion: "2026-08-20.v1",
      provider: "plasius",
    });
    expect(JSON.stringify(result)).not.toContain("untrusted.invalid");
    expect(result.materials).toEqual([expect.objectContaining({
      sourceMaterialId: "material-main",
      baseColorFactor: [1, 1, 1, 1],
      metallicFactor: 0,
      roughnessFactor: 1,
    })]);
    expect(result.worldTriangles).toHaveLength(2);
    expect(result.worldTriangles[0]).toEqual(expect.objectContaining({
      sourceNodeId: "node-root",
      sourceMeshId: "mesh-main",
      sourcePrimitiveId: "primitive-main",
      materialIndex: 0,
      positions: [[-1, 0, -1], [1, 0, -1], [-1, 2, 1]],
      bounds: { min: [-1, 0, -1], max: [1, 2, 1] },
    }));
    expect(result.worldTriangles[0]?.normals).toHaveLength(3);
    expect(Math.hypot(...result.worldTriangles[0]!.normals[0])).toBeCloseTo(1, 6);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.worldTriangles[0]?.positions[0])).toBe(true);
  });

  it("fails closed unless the inherited PVOX feature flag is enabled", async () => {
    const document = await createStatic();
    await expect(createGpuModelStaticDemoCompilerInput(document, { pvoxModelsEnabled: false }))
      .rejects.toMatchObject({ code: "feature-disabled", path: "$.options.pvoxModelsEnabled" });
  });

  it("rejects unsupported dynamic, texture, and topology features", async () => {
    const dynamic = await createAndVerifyGpuModelDocument(validDocument(), new FixtureVerificationPort());
    await expect(createGpuModelStaticDemoCompilerInput(dynamic, ENABLED))
      .rejects.toMatchObject({ code: "unsupported-feature" });

    const texturedInput = staticDemoDocument();
    const original = validDocument();
    texturedInput.resources = original.resources;
    texturedInput.textures = original.textures;
    texturedInput.accessors = [
      ...(texturedInput.accessors as unknown[]),
      (original.accessors as Array<Record<string, unknown>>).find(({ id }) => id === "texcoords")!,
    ];
    const texturedPrimitive = ((texturedInput.meshes as Array<Record<string, unknown>>)[0]!
      .primitives as Array<Record<string, unknown>>)[0]!;
    texturedPrimitive.attributes = [
      ...(texturedPrimitive.attributes as unknown[]),
      { semantic: "TEXCOORD_0", accessorId: "texcoords" },
    ];
    (texturedInput.materials as Array<Record<string, unknown>>)[0]!.textures =
      (original.materials as Array<Record<string, unknown>>)[0]!.textures;
    const textured = await createStatic(texturedInput);
    await expect(createGpuModelStaticDemoCompilerInput(textured, ENABLED))
      .rejects.toMatchObject({ code: "unsupported-feature" });

    const stripInput = staticDemoDocument();
    (((stripInput.meshes as Array<Record<string, unknown>>)[0]!.primitives as Array<Record<string, unknown>>)[0]!).topology = "triangle-strip";
    const strip = await createStatic(stripInput);
    await expect(createGpuModelStaticDemoCompilerInput(strip, ENABLED))
      .rejects.toMatchObject({ code: "unsupported-feature" });

    const unsupportedMaterialInput = staticDemoDocument();
    (unsupportedMaterialInput.materials as Array<Record<string, unknown>>)[0]!.clearcoatFactor = 0.5;
    await expect(createGpuModelStaticDemoCompilerInput(await createStatic(unsupportedMaterialInput), ENABLED))
      .rejects.toMatchObject({ code: "unsupported-feature" });
  });

  it("enforces triangle, resource, and normalization bounds before extraction", async () => {
    const document = await createStatic();
    await expect(createGpuModelStaticDemoCompilerInput(document, {
      pvoxModelsEnabled: true,
      limits: { maxTriangles: 1 },
    })).rejects.toMatchObject({ code: "limit-exceeded" });
    await expect(createGpuModelStaticDemoCompilerInput(document, {
      pvoxModelsEnabled: true,
      limits: { maxTriangles: 200_001 },
    })).rejects.toMatchObject({ code: "invalid-value", path: "$.options.limits.maxTriangles" });
    await expect(createGpuModelStaticDemoCompilerInput(document, {
      pvoxModelsEnabled: true,
      limits: { maxAggregateResourceBytes: 100 },
    })).rejects.toMatchObject({ code: "limit-exceeded" });

    const translatedInput = staticDemoDocument();
    (translatedInput.nodes as Array<Record<string, unknown>>)[0]!.localMatrix = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 1, 0, 1,
    ];
    translatedInput.bounds = { min: [-1, 1, -1], max: [1, 3, 1] };
    await expect(createGpuModelStaticDemoCompilerInput(await createStatic(translatedInput), ENABLED))
      .rejects.toMatchObject({ code: "invalid-value", path: "$.bounds" });

    expect(GPU_MODEL_STATIC_DEMO_MAX_ABSOLUTE_COORDINATE_METRES).toBe(1_048_576);
    const extremeInput = staticDemoDocument();
    const scale = GPU_MODEL_STATIC_DEMO_MAX_ABSOLUTE_COORDINATE_METRES + 1;
    (extremeInput.nodes as Array<Record<string, unknown>>)[0]!.localMatrix = [
      scale, 0, 0, 0,
      0, scale, 0, 0,
      0, 0, scale, 0,
      0, 0, 0, 1,
    ];
    extremeInput.bounds = { min: [-scale, 0, -scale], max: [scale, 2 * scale, scale] };
    await expect(createGpuModelStaticDemoCompilerInput(await createStatic(extremeInput), ENABLED))
      .rejects.toMatchObject({ code: "limit-exceeded", path: "$.bounds" });
  });

  it("rejects incomplete triangle groups and singular world transforms", async () => {
    const incompleteInput = staticDemoDocument();
    (incompleteInput.accessors as Array<Record<string, unknown>>)
      .find(({ id }) => id === "indices")!.count = 5;
    const incomplete = await createStatic(incompleteInput);
    await expect(createGpuModelStaticDemoCompilerInput(incomplete, ENABLED))
      .rejects.toMatchObject({ code: "invalid-value" });

    const singularInput = staticDemoDocument();
    (singularInput.nodes as Array<Record<string, unknown>>)[0]!.localMatrix = [
      1, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
    singularInput.bounds = { min: [-1, 0, -1], max: [1, 0, 1] };
    await expect(createGpuModelStaticDemoCompilerInput(await createStatic(singularInput), ENABLED))
      .rejects.toMatchObject({ code: "invalid-value" });
  });

  it("keeps the canonical hash bound to byte-verified source content", async () => {
    const original = await createStatic();
    const changedInput = staticDemoDocument();
    const bytes = fixtureBuffer();
    const view = new DataView(bytes.buffer);
    view.setFloat32(0, -0.5, true);
    const resource = (changedInput.resources as Array<Record<string, unknown>>)[0]!;
    resource.contentHash = sha256(bytes);
    resource.payload = new Blob([bytes.buffer as ArrayBuffer], { type: "application/octet-stream" });
    (changedInput.provenance as Record<string, unknown>).sourceContentHash = sha256(bytes);
    (changedInput.accessors as Array<Record<string, unknown>>)
      .find(({ id }) => id === "positions")!.min = [-1, 0, -1];
    const changed = await createStatic(changedInput);

    expect(await hashGpuModelDocumentCanonical(changed))
      .not.toBe(await hashGpuModelDocumentCanonical(original));
  });

  it("derives face normals and a default material for bounded unindexed geometry", async () => {
    const input = staticDemoDocument();
    input.accessors = (input.accessors as Array<Record<string, unknown>>)
      .filter(({ id }) => id === "positions");
    (input.accessors as Array<Record<string, unknown>>)[0]!.count = 3;
    const primitive = ((input.meshes as Array<Record<string, unknown>>)[0]!
      .primitives as Array<Record<string, unknown>>)[0]!;
    primitive.attributes = [{ semantic: "POSITION", accessorId: "positions" }];
    delete primitive.indicesAccessorId;
    delete primitive.materialId;

    const result = await createGpuModelStaticDemoCompilerInput(await createStatic(input), ENABLED);
    expect(result.worldTriangles).toHaveLength(1);
    expect(result.materials.at(-1)?.sourceMaterialId).toBeNull();
    expect(result.worldTriangles[0]?.materialIndex).toBe(result.materials.length - 1);
    expect(result.worldTriangles[0]?.normals[0]).toEqual(result.worldTriangles[0]?.normals[1]);
  });
});
