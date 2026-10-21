import { describe, expect, it } from "vitest";
import {
  GPU_MODEL_DOCUMENT_LIMITS, createAndVerifyGpuModelDocument,
  createGpuModelDocument, encodeGpuModelDocumentCanonical, isGpuModelDocument,
  createGpuModelStaticDemoCompilerInput,
} from "../src/index.js";
import { FixtureVerificationPort, IDENTITY_MATRIX, sha256, validDocument } from "./fixtures/model-document-fixture.js";

type Row = Record<string, unknown>;
const rows = (value: unknown) => value as Row[];
const create = (input: Row) => createAndVerifyGpuModelDocument(input, new FixtureVerificationPort());
const trs = () => ({ translation: [0, 0, 0], rotation: [0, 0, 0, -1], scale: [1, 1, 1] });

function fixture(interpolation = "linear", shapeCount = 2) {
  const input = validDocument();
  const shapes = rows(input.blendShapes);
  shapes[0]!.defaultWeight = -0.5;
  for (let i = 1; i < shapeCount; i++) shapes.push({ ...shapes[0], id: `blend-${i}`, defaultWeight: 1.5 });
  const root = rows(input.nodes)[0]!;
  root.restLocalTransform = trs();
  root.morphWeights = shapes.map((s, i) => ({ blendShapeId: s.id, weight: i ? 1.5 : -0.5 }));
  rows(input.nodes).push({ id: "instance-2", children: [], meshId: "mesh-main", localMatrix: IDENTITY_MATRIX,
    morphWeights: shapes.map(s => ({ blendShapeId: s.id, weight: 0 })) });
  (input.roots as string[]).push("instance-2");
  const count = 2 * shapeCount * (interpolation === "cubic-spline" ? 3 : 1);
  const values = Array.from({ length: count }, (_, i) => (i - 2) * 0.25);
  const data = Float32Array.from(values);
  rows(input.resources).push({ id: "morph-output-buffer", kind: "buffer", contentHash: sha256(new Uint8Array(data.buffer)),
    byteLength: data.byteLength, payload: new Blob([data.buffer]), mimeType: "application/octet-stream" });
  rows(input.accessors).push({ id: "morph-output", resourceId: "morph-output-buffer", byteOffset: 0, count,
    componentType: "f32", elementType: "scalar" });
  const clip = rows(input.animations)[0]!;
  clip.samplers = [{ id: "sampler", inputAccessorId: "animation-time", outputAccessorId: "morph-output",
    inputTimesSeconds: [0, 1], outputValues: values, interpolation, sourceMetadata: {} }];
  clip.channels = [{ id: "channel", samplerId: "sampler", targetType: "node-weights", targetId: "node-root", sourceMetadata: {} }];
  return { input, root, shapes, clip, output: rows(input.accessors).at(-1)!, sampler: rows(clip.samplers)[0]!, channel: rows(clip.channels)[0]! };
}

describe("node-scoped canonical animation fidelity", () => {
  it.each(["step", "linear", "cubic-spline"])("preserves two instances and flattened %s output with deterministic revalidation", async mode => {
    const { input, root, sampler } = fixture(mode);
    const model = await create(input);
    expect(model.nodes[0]).toMatchObject({ restLocalTransform: trs(), morphWeights: root.morphWeights });
    expect(model.nodes[2]).toMatchObject({ morphWeights: [{ blendShapeId: "blend-main", weight: 0 }, { blendShapeId: "blend-1", weight: 0 }] });
    expect(model.animations[0]!.samplers[0]!.outputValues).toEqual(sampler.outputValues);
    const bytes = encodeGpuModelDocumentCanonical(model);
    const decoded = (JSON.parse(new TextDecoder().decode(bytes)) as { document: Row }).document;
    rows(decoded.resources).forEach((r, i) => { r.payload = model.resources[i]!.payload; });
    expect(encodeGpuModelDocumentCanonical(await create(decoded))).toEqual(bytes);
    expect(createGpuModelDocument(model)).toBe(model);
    expect(isGpuModelDocument(structuredClone(model))).toBe(false);
    const node = model.nodes[0]!;
    for (const entry of [node.morphWeights, node.morphWeights![0], node.restLocalTransform, node.restLocalTransform!.rotation]) expect(Object.isFrozen(entry)).toBe(true);
    rows(root.morphWeights)[0]!.weight = 99;
    (root.restLocalTransform as Row).scale = [9, 9, 9];
    expect(encodeGpuModelDocumentCanonical(model)).toEqual(bytes);
    await expect(createGpuModelStaticDemoCompilerInput(model, { pvoxModelsEnabled: true })).rejects.toThrow(/static demo/);
  });

  it("preserves authored quaternion sign, rotated nonuniform scales and translation", async () => {
    const { input } = fixture();
    const node = rows(input.nodes)[1]!; // joint has no geometry, so fixture world bounds stay valid
    node.restLocalTransform = { translation: [2, -3, 4], rotation: [0, 0, -Math.SQRT1_2, -Math.SQRT1_2], scale: [-2, 3, 0] };
    node.localMatrix = [0, -2, 0, 0, -3, 0, 0, 0, 0, 0, 0, 0, 2, -3, 4, 1];
    const model = await create(input);
    expect((model.nodes[1] as unknown as Row).restLocalTransform).toEqual(node.restLocalTransform);
  });

  it("allows sharing a sampler between distinct instances with the same arity", async () => {
    const { input, clip, channel } = fixture();
    rows(clip.channels).push({ ...channel, id: "channel-2", targetId: "instance-2" });
    expect((await create(input)).animations[0]!.channels).toHaveLength(2);
  });

  it("keeps independently animated values on two nodes sharing the same shapes", async () => {
    const { input, clip, channel, sampler } = fixture();
    const values = [1, 0, 0, -2];
    const data = Float32Array.from(values);
    rows(input.resources).push({ id: "second-output", kind: "buffer", contentHash: sha256(new Uint8Array(data.buffer)),
      byteLength: data.byteLength, payload: new Blob([data.buffer]), mimeType: "application/octet-stream" });
    rows(input.accessors).push({ id: "second-output", resourceId: "second-output", byteOffset: 0, count: 4, componentType: "f32", elementType: "scalar" });
    rows(clip.samplers).push({ ...sampler, id: "sampler-2", outputAccessorId: "second-output", outputValues: values });
    rows(clip.channels).push({ ...channel, id: "channel-2", samplerId: "sampler-2", targetId: "instance-2" });
    const model = await create(input);
    expect(model.meshes).toHaveLength(1);
    expect(model.blendShapes).toHaveLength(2);
    expect(model.animations[0]!.channels.map(c => c.targetId)).toEqual(["node-root", "instance-2"]);
    expect(model.animations[0]!.samplers.map(s => s.outputValues)).toEqual([sampler.outputValues, values]);
  });

  it("retains explicit binding order instead of deriving it from shape IDs", async () => {
    const { input, root } = fixture();
    rows(root.morphWeights).reverse();
    const model = await create(input);
    expect(model.nodes[0]!.morphWeights!.map(b => b.blendShapeId)).toEqual(["blend-1", "blend-main"]);
    expect(model.animations[0]!.samplers[0]!.outputValues).toEqual([-0.5, -0.25, 0, 0.25]);
  });

  const invalid: readonly [string, (f: ReturnType<typeof fixture>) => void, RegExp][] = [
    ["mismatched TRS", f => { (f.root.restLocalTransform as Row).translation = [1, 0, 0]; }, /restLocalTransform.*matrix/i],
    ["invalid quaternion", f => { (f.root.restLocalTransform as Row).rotation = [0, 0, 0, 2]; }, /quaternion/],
    ["unknown TRS property", f => { (f.root.restLocalTransform as Row).other = true; }, /unknown/],
    ["unrepresentable finite TRS scale", f => { (f.root.restLocalTransform as Row).rotation = [0, 0, 1.00004, 0]; (f.root.restLocalTransform as Row).scale = [Number.MAX_VALUE, 1, 1]; }, /scale.*between/],
    ["nonfinite scale", f => { (f.root.restLocalTransform as Row).scale = [Infinity, 1, 1]; }, /finite/],
    ["empty bindings", f => { f.root.morphWeights = []; }, /morphWeights/],
    ["missing binding", f => { rows(f.root.morphWeights).pop(); }, /exactly cover/],
    ["duplicate binding", f => { rows(f.root.morphWeights)[1]!.blendShapeId = "blend-main"; }, /duplicate/],
    ["missing shape", f => { rows(f.root.morphWeights)[0]!.blendShapeId = "missing"; }, /blend shape/],
    ["cross mesh shape", f => { f.shapes[0]!.meshId = "other-mesh"; }, /mesh/],
    ["binding without mesh", f => { delete f.root.meshId; delete f.root.skinId; }, /morph.*mesh/],
    ["nonfinite weight", f => { rows(f.root.morphWeights)[0]!.weight = Infinity; }, /finite/],
    ["nonfinite default", f => { f.shapes[0]!.defaultWeight = NaN; }, /finite/],
    ["unknown binding property", f => { rows(f.root.morphWeights)[0]!.untrusted = true; }, /unknown/],
    ["missing target node", f => { f.channel.targetId = "missing"; }, /node/],
    ["target without bindings", f => { delete f.root.morphWeights; }, /morphWeights/],
    ["non scalar output", f => { f.output.elementType = "vec2"; f.output.count = 2; }, /representation/],
    ["wrong output arity", f => { f.output.count = 3; (f.sampler.outputValues as number[]).pop(); }, /counts/],
    ["forged authored values", f => { (f.sampler.outputValues as number[])[0] = 0.125; }, /verified accessor bytes/],
    ["duplicate target", f => { rows(f.clip.channels).push({ ...f.channel, id: "duplicate" }); }, /duplicate.*target/],
    ["incompatible shared sampler", f => { rows(f.clip.channels).push({ ...f.channel, id: "other", targetType: "weights", targetId: "blend-main" }); }, /incompatible/],
    ["incompatible instance arity", f => {
      rows(f.input.meshes).push({ ...rows(f.input.meshes)[0], id: "other-mesh", primitives: [{ ...rows(rows(f.input.meshes)[0]!.primitives)[0], id: "other-primitive",
        attributes: [{ semantic: "POSITION", accessorId: "positions" }, { semantic: "TEXCOORD_0", accessorId: "texcoords" }] }] });
      f.shapes.push({ ...f.shapes[0], id: "other-shape", meshId: "other-mesh", deltas: [{ primitiveId: "other-primitive", positionAccessorId: "morph-positions" }] });
      const other = rows(f.input.nodes)[2]!; other.meshId = "other-mesh"; other.morphWeights = [{ blendShapeId: "other-shape", weight: 0 }];
      rows(f.clip.channels).push({ ...f.channel, id: "other", targetId: "instance-2" });
    }, /incompatible.*arity/],
  ];
  it.each(invalid)("rejects %s", async (_name, mutate, pattern) => {
    const f = fixture(); mutate(f);
    await expect(create(f.input)).rejects.toThrow(pattern);
  });

  it("retains old documents and legacy per-shape weights channels", async () => {
    expect((await create(validDocument())).nodes[0]).not.toHaveProperty("morphWeights");
    const { input, clip, channel } = fixture("linear", 1);
    delete rows(input.nodes)[0]!.morphWeights;
    delete rows(input.nodes)[2]!.morphWeights;
    channel.targetType = "weights"; channel.targetId = "blend-main";
    expect((await create(input)).animations[0]!.channels[0]!.targetType).toBe("weights");
    expect(rows(clip.samplers)).toHaveLength(1);
  });

  it("caps individual and aggregate morph bindings before reference traversal", async () => {
    const { input, root } = fixture();
    root.morphWeights = Array.from({ length: GPU_MODEL_DOCUMENT_LIMITS.blendShapes + 1 }, (_, i) => ({ blendShapeId: `shape-${i}`, weight: 0 }));
    await expect(create(input)).rejects.toThrow(/morphWeights.*array length/);
    root.morphWeights = (root.morphWeights as unknown[]).slice(0, GPU_MODEL_DOCUMENT_LIMITS.blendShapes);
    input.nodes = Array.from({ length: 5 }, (_, i) => ({ ...root, id: `node-${i}`, children: [] }));
    await expect(create(input)).rejects.toThrow(/morph.*limit/i);
  });

  it("honours pre-abort and verification cancellation without leaking provider errors", async () => {
    const { input } = fixture();
    const controller = new AbortController(); controller.abort();
    const port = new FixtureVerificationPort();
    await expect(createAndVerifyGpuModelDocument(input, port, { signal: controller.signal })).rejects.toThrow(/aborted/);
    expect(port.digestCalls).toBe(0);
    const mid = new AbortController();
    port.inspectResource = async () => { mid.abort(); throw new Error("private source URI"); };
    const failure = createAndVerifyGpuModelDocument(input, port, { signal: mid.signal });
    await expect(failure).rejects.toThrow(/aborted/);
    await expect(failure).rejects.not.toThrow(/private source/);
  });
});
