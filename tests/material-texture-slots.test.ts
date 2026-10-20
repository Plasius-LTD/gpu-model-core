import { describe, expect, it } from "vitest";
import {
  createAndVerifyGpuModelDocument, createGpuModelResourceGraph,
  createGpuModelStaticDemoCompilerInput, encodeGpuModelDocumentCanonical,
  hashGpuModelDocumentCanonical, gpuModelResourceKey,
  type GpuModelMaterialTextures, type GpuModelTextureUsage,
} from "../src/index.js";
import { FixtureVerificationPort, validDocument } from "./fixtures/model-document-fixture.js";

// Requirements come from the existing showcase/renderer material contract, not
// the production slot table: adding a slot there must not silently add test cases.
const SLOTS = [
  ["thickness", "thickness"], ["specular", "specular"],
  ["specularColor", "specular-color"], ["iridescence", "iridescence"],
  ["iridescenceThickness", "iridescence-thickness"], ["anisotropy", "anisotropy"],
] as const satisfies readonly (readonly [keyof GpuModelMaterialTextures, GpuModelTextureUsage])[];
type Row = Record<string, unknown>;
const rows = (value: unknown) => value as Row[];
const transform = () => ({ offset: [0.125, -0.25], rotationRadians: 0.75, scale: [2, 0.5] });

function fixture(slot: string, usage: string) {
  const input = validDocument();
  const material = rows(input.materials)[0]!;
  const texture = rows(input.textures)[0]!;
  const colorSpace = slot === "specularColor" ? "srgb" : "linear";
  const binding: Row = {
    textureId: texture.id, samplerId: "sampler-main", texCoordSet: 1,
    colorSpace, intendedUsage: usage, transform: transform(),
  };
  material.textures = { [slot]: binding };
  material.extensions = {};
  rows(rows(rows(input.meshes)[0]!.primitives)[0]!.attributes)
    .push({ semantic: "TEXCOORD_1", accessorId: "texcoords" });
  texture.intendedUsage = [usage];
  texture.colorSpace = colorSpace;
  return { input, material, texture, binding };
}
const create = (input: Row) => createAndVerifyGpuModelDocument(input, new FixtureVerificationPort());

describe("canonical material texture fidelity prerequisite", () => {
  it.each(SLOTS)("preserves verified %s bindings, UV selection, transform and image bytes", async (slot, usage) => {
    const { input, binding, texture } = fixture(slot, usage);
    const document = await create(input);
    const actual = (document.materials[0]!.textures as Record<string, unknown>)[slot];
    expect(actual).toEqual(binding);
    expect(document.textures[0]).toMatchObject({ intendedUsage: [usage], colorSpace: texture.colorSpace });
    expect(await document.resources[1]!.payload.arrayBuffer())
      .toEqual(await (rows(input.resources)[1]!.payload as Blob).arrayBuffer());
    expect(Object.isFrozen(actual)).toBe(true);
    expect(Object.isFrozen((actual as Row).transform)).toBe(true);
    const before = encodeGpuModelDocumentCanonical(document);
    const decoded = (JSON.parse(new TextDecoder().decode(before)) as { document: Row }).document;
    rows(decoded.resources).forEach((r, i) => { r.payload = document.resources[i]!.payload; });
    expect(encodeGpuModelDocumentCanonical(await create(decoded))).toEqual(before);
    (binding.transform as Row).offset = [9, 9];
    expect(encodeGpuModelDocumentCanonical(document)).toEqual(before);
    const reordered = fixture(slot, usage).input;
    rows(reordered.materials)[0]!.textures = { [slot]: {
      transform: { scale: [2, 0.5], rotationRadians: 0.75, offset: [0.125, -0.25] },
      intendedUsage: usage, colorSpace: texture.colorSpace, texCoordSet: 1,
      samplerId: "sampler-main", textureId: texture.id,
    } };
    expect(await hashGpuModelDocumentCanonical(await create(reordered)))
      .toBe(await hashGpuModelDocumentCanonical(document));
  });

  const badBindings: readonly [string, (binding: Row, texture: Row) => void, RegExp][] = [
    ["missing texture", b => { b.textureId = "missing"; }, /textureId/],
    ["wrong slot usage", (b, t) => { b.intendedUsage = "base-color"; t.intendedUsage = ["base-color"]; }, /usage does not match/],
    ["undeclared texture usage", (_b, t) => { t.intendedUsage = ["base-color"]; }, /does not declare/],
    ["different color space", b => { b.colorSpace = "data"; }, /color spaces must match/],
    ["different sampler", b => { b.samplerId = "missing"; }, /sampler does not match/],
    ["invalid UV set", b => { b.texCoordSet = 8; }, /texCoordSet/],
    ["nonfinite transform", b => { b.transform = { rotationRadians: Infinity }; }, /rotationRadians/],
  ];
  for (const [slot, usage] of SLOTS) {
    it.each(badBindings)(`rejects ${slot}: %s`, async (_name, mutate, pattern) => {
      const { input, binding, texture } = fixture(slot, usage);
      mutate(binding, texture);
      await expect(create(input)).rejects.toThrow(pattern);
    });
    it(`rejects ${slot} with mismatched image evidence`, async () => {
      const { input, texture } = fixture(slot, usage);
      texture.contentHash = "0".repeat(64);
      await expect(create(input)).rejects.toThrow(/hash must match/);
      const badBytes = fixture(slot, usage).input;
      rows(badBytes.resources)[1]!.contentHash = "0".repeat(64);
      await expect(create(badBytes)).rejects.toThrow(/digest does not match contentHash/);
    });
    it(`rejects ${slot} when its selected UV set is missing`, async () => {
      const { input } = fixture(slot, usage);
      rows(rows(rows(input.meshes)[0]!.primitives)[0]!.attributes).pop();
      await expect(create(input)).rejects.toThrow(/requires primitive attribute TEXCOORD_1/);
    });
    it(`rejects ${slot} with mismatched image MIME type or length`, async () => {
      const wrongMime = fixture(slot, usage);
      wrongMime.texture.mimeType = "image/jpeg";
      await expect(create(wrongMime.input)).rejects.toThrow(/MIME type must match/);
      const wrongLength = fixture(slot, usage);
      wrongLength.texture.byteLength = 1;
      await expect(create(wrongLength.input)).rejects.toThrow(/byteLength must match/);
    });
    it(`keeps ${slot} outside the texture-free static compiler`, async () => {
      const { input } = fixture(slot, usage);
      delete rows(input.nodes)[0]!.skinId;
      input.skeletons = []; input.joints = []; input.skins = [];
      input.blendShapes = []; input.animations = []; input.analyticGeometry = [];
      const primitive = rows(rows(input.meshes)[0]!.primitives)[0]!;
      primitive.attributes = rows(primitive.attributes).filter(a => !String(a.semantic).match(/JOINTS|WEIGHTS/));
      const document = await create(input);
      await expect(createGpuModelStaticDemoCompilerInput(document, { pvoxModelsEnabled: true }))
        .rejects.toThrow(/texture/);
      await expect(createGpuModelStaticDemoCompilerInput(document, { pvoxModelsEnabled: false }))
        .rejects.toThrow(/disabled/);
    });
  }

  it("retains every new material-to-texture graph edge with shared verified image bytes", async () => {
    const input = validDocument();
    const original = rows(input.textures)[0]!;
    const textures = SLOTS.map(([slot, usage]) => ({
      ...original, id: `texture-${slot}`, colorSpace: slot === "specularColor" ? "srgb" : "linear", intendedUsage: [usage],
    }));
    rows(input.materials)[0]!.textures = Object.fromEntries(SLOTS.map(([slot, usage], index) => [slot, {
      textureId: textures[index]!.id, intendedUsage: usage,
      colorSpace: textures[index]!.colorSpace, transform: transform(),
    }]));
    input.textures = textures;
    const document = await create(input);
    const graph = createGpuModelResourceGraph(document, {
      resources: document.resources.map(r => ({ resourceId: r.id, location: { kind: "embedded" }, exportEmbeddingPolicy: "inherit-source" })),
      packages: [],
    });
    const material = graph.nodes.find(n => n.kind === "material")!;
    expect(material.dependencies).toEqual(textures.map(t => gpuModelResourceKey("texture", t.id)).sort());
    for (const t of textures) {
      const node = graph.nodes.find(n => n.key === gpuModelResourceKey("texture", t.id))!;
      expect(node.dependencies).toEqual([gpuModelResourceKey("resource", "image-main")]);
    }
  });

  it("keeps unknown slots and usages closed", async () => {
    const { input, binding } = fixture("futureSlot", "base-color");
    await expect(create(input)).rejects.toThrow(/unknown key/);
    rows(input.materials)[0]!.textures = { baseColor: binding };
    binding.intendedUsage = "future-usage";
    await expect(create(input)).rejects.toThrow(/intendedUsage/);
  });
});
