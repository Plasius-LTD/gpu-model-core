import { describe, expect, it } from "vitest";
import {
  CANONICAL_GPU_MODEL_COORDINATE_SYSTEM,
  GPU_MODEL_DOCUMENT_LIMITS,
  GPU_MODEL_DOCUMENT_SCHEMA_VERSION,
  GpuModelDocumentError,
  canCreateGpuModelDocument,
  createAndVerifyGpuModelDocument,
  createGpuModelDocument,
  isGpuModelDocument,
  verifyGpuModelResource,
} from "../src/index.js";
import {
  FixtureVerificationPort,
  PNG_1X1,
  collect,
  fixtureBuffer,
  rigidDocument,
  sha256,
  validDocument,
} from "./fixtures/model-document-fixture.js";

describe("verified canonical resource boundary", () => {
  it("only narrows privately branded factory output and rejects structured-clone brand loss", async () => {
    const port = new FixtureVerificationPort();
    const raw = validDocument();
    expect(isGpuModelDocument(raw)).toBe(false);
    expect(canCreateGpuModelDocument(raw)).toBe(false);
    expect(() => createGpuModelDocument(raw)).toThrowError(/verified resource/iu);

    const model = await createAndVerifyGpuModelDocument(raw, port);
    expect(isGpuModelDocument(model)).toBe(true);
    expect(canCreateGpuModelDocument(model)).toBe(true);
    expect(createGpuModelDocument(model)).toBe(model);
    const clone = structuredClone(model);
    expect(isGpuModelDocument(clone)).toBe(false);
    expect(() => createGpuModelDocument(clone)).toThrowError(/verified resource/iu);
    expect(isGpuModelDocument(await createAndVerifyGpuModelDocument(clone, port))).toBe(true);
  });

  it("rejects forged hashes, invalid image payloads, and unverified resources", async () => {
    const port = new FixtureVerificationPort();
    const forged = validDocument();
    (forged.resources as Array<Record<string, unknown>>)[0]!.contentHash = "a".repeat(64);
    await expect(createAndVerifyGpuModelDocument(forged, port)).rejects.toThrowError(/digest/iu);

    const invalidImage = validDocument();
    const bytes = PNG_1X1.slice(0, 8);
    (invalidImage.resources as Array<Record<string, unknown>>)[1] = {
      id: "image-main",
      kind: "image",
      contentHash: sha256(bytes),
      byteLength: bytes.byteLength,
      mimeType: "image/png",
      payload: new Blob([bytes], { type: "image/png" }),
    };
    await expect(createAndVerifyGpuModelDocument(invalidImage, port)).rejects.toThrowError(/image|inspection/iu);
  });

  it("enforces byte and dimension budgets before hashing", async () => {
    const oversizedPort = new FixtureVerificationPort();
    await expect(createAndVerifyGpuModelDocument(validDocument(), oversizedPort, { limits: { maxResourceBytes: 64 } })).rejects.toThrowError(/resource byte/iu);
    expect(oversizedPort.digestCalls).toBe(0);
    expect(oversizedPort.inspectionCalls).toBe(0);

    const dimensionPort = new FixtureVerificationPort();
    dimensionPort.inspectResource = async (chunks, context) => {
      dimensionPort.inspectionCalls += 1;
      await collect(chunks);
      return context.kind === "image"
        ? { valid: true, detectedMimeType: "image/png", width: 4_097, height: 1 }
        : { valid: true, detectedMimeType: context.declaredMimeType };
    };
    await expect(createAndVerifyGpuModelDocument(validDocument(), dimensionPort)).rejects.toThrowError(/dimension/iu);
    expect(dimensionPort.digestCalls).toBe(1);
  });

  it("does not expose a public shape that can forge resource verification", async () => {
    const port = new FixtureVerificationPort();
    const raw = validDocument();
    const resources = raw.resources as unknown[];
    const verified = await verifyGpuModelResource(resources[0], port);
    expect(Object.isFrozen(verified)).toBe(true);
    expect(() => createGpuModelDocument({ ...raw, resources: [verified, resources[1]] })).toThrowError(/verified resource/iu);
  });

  it("escapes hostile keys from stable error paths and messages", () => {
    const input = validDocument();
    Object.defineProperty(input, "hostile\nforged-log", { value: true, enumerable: true });
    let failure: unknown;
    try {
      createGpuModelDocument(input);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(GpuModelDocumentError);
    expect((failure as GpuModelDocumentError).path).not.toContain("\n");
    expect(String(failure)).not.toContain("\n");
    expect(String(failure)).toContain("\\u000a");
  });

  it("rejects ports that short-read, throw, lie about MIME, or return malformed inspection", async () => {
    const resource = (validDocument().resources as unknown[])[0];
    const short = new FixtureVerificationPort();
    short.inspectResource = async () => ({ valid: true, detectedMimeType: "application/octet-stream" });
    await expect(verifyGpuModelResource(resource, short)).rejects.toThrowError(/complete payload/iu);

    const throwing = new FixtureVerificationPort();
    throwing.inspectResource = async () => { throw new Error("secret provider detail"); };
    await expect(verifyGpuModelResource(resource, throwing)).rejects.toThrowError(/inspection failed/iu);

    const wrongMime = new FixtureVerificationPort();
    wrongMime.inspectResource = async (chunks) => {
      await collect(chunks);
      return { valid: true, detectedMimeType: "image/png" };
    };
    await expect(verifyGpuModelResource(resource, wrongMime)).rejects.toThrowError(/MIME/iu);

    const malformed = new FixtureVerificationPort();
    malformed.inspectResource = async (chunks) => {
      await collect(chunks);
      return { valid: true, detectedMimeType: "application/octet-stream", unexpected: true } as never;
    };
    await expect(verifyGpuModelResource(resource, malformed)).rejects.toThrowError(/unknown key/iu);
  });

  it("rejects raised limits, duplicate resources, payload mismatches, and invalid ports before use", async () => {
    await expect(createAndVerifyGpuModelDocument(validDocument(), new FixtureVerificationPort(), { limits: { maxResourceBytes: Number.MAX_SAFE_INTEGER } })).rejects.toThrowError(/safe integer/iu);
    const duplicate = validDocument();
    (duplicate.resources as unknown[]).push((duplicate.resources as unknown[])[0]);
    await expect(createAndVerifyGpuModelDocument(duplicate, new FixtureVerificationPort())).rejects.toThrowError(/duplicate/iu);

    const mismatch = validDocument();
    (mismatch.resources as Array<Record<string, unknown>>)[0]!.byteLength = 1;
    await expect(createAndVerifyGpuModelDocument(mismatch, new FixtureVerificationPort())).rejects.toThrowError(/byte length/iu);
    await expect(verifyGpuModelResource((validDocument().resources as unknown[])[0], {} as never)).rejects.toThrowError(/digest and inspection/iu);
  });

  it("honours cancellation and deadlines without starting cancelled inspection", async () => {
    const resource = (validDocument().resources as unknown[])[0];
    const cancelledPort = new FixtureVerificationPort();
    const controller = new AbortController();
    controller.abort();
    await expect(verifyGpuModelResource(resource, cancelledPort, { signal: controller.signal })).rejects.toThrowError(/aborted/iu);
    expect(cancelledPort.inspectionCalls).toBe(0);

    const stalledPort = new FixtureVerificationPort();
    let deadlineSignal: AbortSignal | undefined;
    stalledPort.inspectResource = async (_chunks, context) => {
      deadlineSignal = context.signal;
      return new Promise((_resolve, reject) => context.signal?.addEventListener("abort", () => reject(context.signal?.reason), { once: true }));
    };
    await expect(verifyGpuModelResource(resource, stalledPort, { limits: { timeoutMs: 1 } })).rejects.toThrowError(/deadline/iu);
    expect(deadlineSignal?.aborted).toBe(true);

    const activeController = new AbortController();
    const streamingPort = new FixtureVerificationPort();
    let propagatedSignal: AbortSignal | undefined;
    streamingPort.inspectResource = async (chunks, context) => {
      propagatedSignal = context.signal;
      for await (const _chunk of chunks) activeController.abort();
      return { valid: true, detectedMimeType: context.declaredMimeType };
    };
    await expect(verifyGpuModelResource(resource, streamingPort, { signal: activeController.signal }))
      .rejects.toThrowError(/aborted/iu);
    expect(propagatedSignal).not.toBe(activeController.signal);
    expect(propagatedSignal?.aborted).toBe(true);
    expect(streamingPort.digestCalls).toBe(0);
  });

  it("returns a snapshot-backed resource and applies tighter limits or cancellation on cached values", async () => {
    const raw = (validDocument().resources as unknown[])[0];
    const port = new FixtureVerificationPort();
    port.digestSha256 = async (chunks) => {
      port.digestCalls += 1;
      const pristine: Uint8Array[] = [];
      for await (const chunk of chunks) {
        pristine.push(chunk.slice());
        chunk.fill(0xff);
      }
      const size = pristine.reduce((total, chunk) => total + chunk.byteLength, 0);
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of pristine) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return sha256(bytes);
    };
    const verified = await verifyGpuModelResource(raw, port);
    expect(new Uint8Array(await verified.payload.arrayBuffer())).toEqual(fixtureBuffer());

    const calls = { digest: port.digestCalls, inspection: port.inspectionCalls };
    expect(await verifyGpuModelResource(verified, {} as never)).toBe(verified);
    expect(port.digestCalls).toBe(calls.digest);
    expect(port.inspectionCalls).toBe(calls.inspection);
    await expect(verifyGpuModelResource(verified, {} as never, { limits: { maxResourceBytes: verified.byteLength - 1 } }))
      .rejects.toThrowError(/resource byte budget/iu);
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(verifyGpuModelResource(verified, {} as never, { signal: cancelled.signal }))
      .rejects.toThrowError(/aborted/iu);

    const widePng = PNG_1X1.slice();
    new DataView(widePng.buffer, widePng.byteOffset, widePng.byteLength).setUint32(16, 2);
    const image = await verifyGpuModelResource({
      id: "wide-image",
      kind: "image",
      contentHash: sha256(widePng),
      byteLength: widePng.byteLength,
      mimeType: "image/png",
      payload: new Blob([widePng], { type: "image/png" }),
    }, new FixtureVerificationPort());
    await expect(verifyGpuModelResource(image, {} as never, { limits: { maxImageDimension: 1 } }))
      .rejects.toThrowError(/dimension budget/iu);
  });

  it("reapplies aggregate limits and cancellation to already verified documents", async () => {
    const model = await createAndVerifyGpuModelDocument(validDocument(), new FixtureVerificationPort());
    expect(await createAndVerifyGpuModelDocument(model, {} as never)).toBe(model);
    const totalBytes = model.resources.reduce((total, resource) => total + resource.byteLength, 0);
    await expect(createAndVerifyGpuModelDocument(model, {} as never, { limits: { maxAggregateBytes: totalBytes - 1 } }))
      .rejects.toThrowError(/aggregate resource byte budget/iu);
    const controller = new AbortController();
    controller.abort();
    await expect(createAndVerifyGpuModelDocument(model, {} as never, { signal: controller.signal }))
      .rejects.toThrowError(/aborted/iu);
  });

  it("preflights aggregate instanced geometry work before repeated world traversal", async () => {
    const nodeCount = GPU_MODEL_DOCUMENT_LIMITS.roots;
    const vertexCount = Math.floor(GPU_MODEL_DOCUMENT_LIMITS.geometryWorldVertices / nodeCount) + 1;
    const bytes = new Uint8Array(vertexCount * 12);
    const view = new DataView(bytes.buffer);
    [-1, 0, -1, 1, 2, 1].forEach((value, index) => view.setFloat32(index * 4, value, true));
    const contentHash = sha256(bytes);
    const identity = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
    const roots = Array.from({ length: nodeCount }, (_entry, index) => `node-${String(index)}`);
    const document = {
      schemaVersion: GPU_MODEL_DOCUMENT_SCHEMA_VERSION,
      coordinateSystem: CANONICAL_GPU_MODEL_COORDINATE_SYSTEM,
      roots,
      nodes: roots.map((id) => ({ id, children: [], meshId: "mesh-main", localMatrix: identity })),
      resources: [{
        id: "buffer-main",
        kind: "buffer",
        contentHash,
        byteLength: bytes.byteLength,
        mimeType: "application/octet-stream",
        payload: new Blob([bytes], { type: "application/octet-stream" }),
      }],
      accessors: [{
        id: "positions",
        resourceId: "buffer-main",
        byteOffset: 0,
        count: vertexCount,
        componentType: "f32",
        elementType: "vec3",
        min: [-1, 0, -1],
        max: [1, 2, 1],
      }],
      meshes: [{ id: "mesh-main", primitives: [{ id: "primitive-main", topology: "points", attributes: [{ semantic: "POSITION", accessorId: "positions" }] }] }],
      materials: [],
      textures: [],
      skeletons: [],
      joints: [],
      skins: [],
      blendShapes: [],
      animations: [],
      analyticGeometry: [],
      bounds: { min: [-1, 0, -1], max: [1, 2, 1] },
      provenance: { sourceFormat: "test", sourceContentHash: contentHash, converterId: "test", converterVersion: "1" },
      diagnostics: [],
      metadata: {},
    };
    await expect(createAndVerifyGpuModelDocument(document, new FixtureVerificationPort()))
      .rejects.toThrowError(/world-geometry vertex count/iu);
  });

  it("indexes shared mesh primitives once before validating many instances", async () => {
    const input = rigidDocument();
    const primitiveCount = 4_096;
    const nodeCount = GPU_MODEL_DOCUMENT_LIMITS.roots;
    const mesh = (input.meshes as Array<Record<string, unknown>>)[0]!;
    mesh.primitives = Array.from({ length: primitiveCount }, (_entry, index) => ({
      id: `primitive-${String(index)}`,
      topology: "points",
      attributes: [{ semantic: "POSITION", accessorId: "positions" }],
    }));
    const roots = Array.from({ length: nodeCount }, (_entry, index) => `node-${String(index)}`);
    input.roots = roots;
    input.nodes = roots.map((id) => ({
      id,
      children: [],
      meshId: "mesh-main",
      localMatrix: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ],
    }));

    const model = await createAndVerifyGpuModelDocument(input, new FixtureVerificationPort());
    expect(model.meshes[0]?.primitives).toHaveLength(primitiveCount);
    expect(model.nodes).toHaveLength(nodeCount);
  });

  it("rejects Blob subclasses with attacker-controlled instance behavior", async () => {
    class HostileBlob extends Blob {
      public override get size(): number { return 1; }
      public override slice(): Blob { throw new Error("hostile slice override"); }
    }
    const input = validDocument();
    const resource = (input.resources as Array<Record<string, unknown>>)[0]!;
    const actual = await (resource.payload as Blob).arrayBuffer();
    resource.payload = new HostileBlob([actual], { type: "application/octet-stream" });
    await expect(verifyGpuModelResource(resource, new FixtureVerificationPort())).rejects.toThrowError(/native Blob/iu);
  });

  it("uses captured Blob intrinsics instead of mutable prototype methods", async () => {
    const original = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = async () => { throw new Error("prototype method was replaced"); };
    try {
      const verified = await verifyGpuModelResource((validDocument().resources as unknown[])[0], new FixtureVerificationPort());
      expect(verified.contentHash).toMatch(/^[a-f0-9]{64}$/u);
    } finally {
      Blob.prototype.arrayBuffer = original;
    }
  });
});
