import { describe, expect, it } from "vitest";
import {
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
    stalledPort.inspectResource = async () => new Promise(() => undefined);
    await expect(verifyGpuModelResource(resource, stalledPort, { limits: { timeoutMs: 1 } })).rejects.toThrowError(/deadline/iu);
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
});
