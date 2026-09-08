import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  createModelConversionRegistry, createModelResultBase,
  type ModelAdapter, type ModelSource, type ModelTarget, type GpuModelDocument,
  type GpuModelDiagnosticInput, type AdapterCapabilityMetadata, type ModelOperationOptions, type ModelLoadResult,
} from "../src/index.js";
import { createValidGpuModelDocument } from "./fixtures/model-document-fixture.js";

let document: GpuModelDocument;
beforeAll(async () => { document = await createValidGpuModelDocument(); });
const sources: ModelSource[] = [
  { kind: "file-path", path: "/models/synthetic.glb", fileNameHint: "synthetic.glb" },
  { kind: "url", url: "https://example.invalid/model", headers: { Authorization: "synthetic-redacted" } },
  { kind: "blob-storage-url", url: "https://example.invalid/model", credentialMode: "runtime-resolved" },
  { kind: "blob", blob: new Blob(["fixture"]) },
  { kind: "array-buffer", bytes: new ArrayBuffer(4) },
  { kind: "uint8-array", bytes: new Uint8Array(4) },
  { kind: "stream", stream: new ReadableStream<Uint8Array>(), byteLengthHint: 4 },
];
const targets: ModelTarget[] = [
  { kind: "file-path", path: "/exports/model", overwrite: false },
  { kind: "blob-storage-url", url: "https://example.invalid/output", metadata: { purpose: "fixture" } },
  { kind: "blob", mimeType: "application/octet-stream", fileName: "fixture" },
  { kind: "array-buffer" }, { kind: "uint8-array" },
  { kind: "stream", stream: new WritableStream<Uint8Array>() },
  { kind: "package", packageFormat: "directory-manifest", includeSourcePayload: false },
];
function base(mode: "strict" | "tolerant" | "forensic" = "strict", issues: GpuModelDiagnosticInput["issues"] = [], allowLoss = false) {
  return createModelResultBase({ standard: "gltf-glb", mode, issues, allowLoss, ...(mode === "forensic" ? { rawSource: { synthetic: true } } : {}) });
}
function adapter(formatId = "fixture"): ModelAdapter {
  const metadata = { formatId, displayName: "Synthetic adapter", supportedSourceKinds: sources.map(s => s.kind), supportedTargetKinds: targets.map(t => t.kind), supportsAnimations: true, supportsSkins: true, supportsAnalyticGeometry: true };
  return {
    metadata,
    inspect: vi.fn(async (_source, options) => ({ ...base(options?.mode), detectedFormat: formatId, capabilities: metadata })),
    load: vi.fn(async (_source, options) => ({ ...base(options?.mode), document })),
    validate: vi.fn(async (_input, options) => ({ ...base(options?.mode), valid: true })),
    export: vi.fn(async (_document, target, options) => ({ ...base(options?.mode), target: target.kind })),
  };
}

describe("canonical adapter registry", () => {
  it.each(sources)("accepts declarative source $kind through every source operation", async source => {
    const a = adapter(); const r = createModelConversionRegistry([a]);
    expect((await r.inspect("fixture", source)).accepted).toBe(true);
    expect((await r.load("fixture", source)).document).toBe(document);
    expect((await r.validate("fixture", source)).accepted).toBe(true);
  });
  it.each(targets)("routes canonical model to target $kind", async target => {
    const a = adapter("source"); const b = adapter("target"); const r = createModelConversionRegistry([a, b]);
    const result = await r.convert({ sourceFormat: "source", targetFormat: "target", source: sources[0]!, target });
    expect(result.accepted).toBe(true); expect(result.document).toBe(document);
    expect(result.stages.map(s => s.operation)).toEqual(["load", "capabilities", "validate", "export"]);
    expect(b.export).toHaveBeenCalledWith(document, expect.objectContaining({ kind: target.kind }), expect.objectContaining({ mode: "strict", allowLoss: false }));
    expect(a.inspect).not.toHaveBeenCalled(); expect(a.export).not.toHaveBeenCalled();
  });
  it("rejects unknown format or source/target kind before calling an adapter", async () => {
    const a = adapter(); const r = createModelConversionRegistry([a]);
    await expect(r.load("missing", sources[0]!)).rejects.toMatchObject({ code: "unsupported-format" });
    await expect(r.load("fixture", { kind: "package" } as unknown as ModelSource)).rejects.toMatchObject({ code: "invalid-input" });
    await expect(r.convert({ sourceFormat: "fixture", targetFormat: "missing", source: sources[0]!, target: targets[0]! })).rejects.toMatchObject({ code: "unsupported-format" });
    expect(a.load).not.toHaveBeenCalled();
  });
  it("rejects duplicate registrations and direct converter contracts", () => {
    expect(() => createModelConversionRegistry([adapter(), adapter()])).toThrow();
    expect(() => createModelConversionRegistry([{ ...adapter(), convert: () => null } as ModelAdapter])).toThrow();
    expect(() => createModelConversionRegistry([{ ...adapter(), export: undefined } as unknown as ModelAdapter])).toThrow();
  });
  it("stops at unverified canonical output", async () => {
    const a = adapter(); a.load = async () => ({ ...base(), document: structuredClone(document) });
    const r = createModelConversionRegistry([a]);
    await expect(r.convert({ sourceFormat: "fixture", targetFormat: "fixture", source: sources[0]!, target: targets[0]! })).rejects.toMatchObject({ code: "invalid-result" });
    expect(a.export).not.toHaveBeenCalled();
  });
  it("refuses capability loss before export and records consented loss", async () => {
    const original = adapter(); const a = { ...original, metadata: { ...original.metadata, supportsAnimations: false, supportsSkins: false } };
    const r = createModelConversionRegistry([a]);
    const request = { sourceFormat: "fixture", targetFormat: "fixture", source: sources[0]!, target: targets[0]! };
    const denied = await r.convert(request);
    expect(denied.accepted).toBe(false); expect(denied.lossReports.length).toBe(2); expect(a.export).not.toHaveBeenCalled();
    const accepted = await r.convert(request, { allowLoss: true });
    expect(accepted.accepted).toBe(true); expect(accepted.lossReports.length).toBe(2);
  });
  it("retains adapter diagnostics and stops a refused load", async () => {
    const a = adapter(); a.load = async () => base("strict", [{ kind: "unsupported", code: "UNSUPPORTED", path: "/", message: "Unsupported fixture" }]);
    const result = await createModelConversionRegistry([a]).convert({ sourceFormat: "fixture", targetFormat: "fixture", source: sources[0]!, target: targets[0]! });
    expect(result.accepted).toBe(false); expect(result.diagnostics[0]).toHaveProperty("kind", "unsupported");
    expect(result.stages).toHaveLength(1); expect(a.export).not.toHaveBeenCalled();
  });
  it("does not allow an adapter to override caller loss consent", async () => {
    const a = adapter(); a.load = async () => ({ ...base("strict", [{ kind: "loss", code: "LOSS", path: "/", message: "Fixture loss", effect: "dropped" }], true), document });
    const r = createModelConversionRegistry([a]);
    expect((await r.load("fixture", sources[0]!)).accepted).toBe(false);
    expect((await r.load("fixture", sources[0]!, { allowLoss: true })).accepted).toBe(true);
  });
  it.each(["strict", "tolerant", "forensic"] as const)("passes caller mode %s", async mode => {
    const result = await createModelConversionRegistry([adapter()]).load("fixture", sources[0]!, { mode });
    expect(result.accepted).toBe(true); expect(result.stages[0]?.report.mode).toBe(mode);
  });
  it("redacts thrown errors and never includes sensitive source descriptors", async () => {
    const a = adapter(); a.load = async () => { throw new Error("synthetic-private-token"); };
    await expect(createModelConversionRegistry([a]).load("fixture", sources[1]!)).rejects.toMatchObject({ code: "adapter-failed", message: "GPU model registry: adapter-failed" });
  });
  it("cancels without invoking adapters", async () => {
    const a = adapter(); const c = new AbortController(); c.abort("private-reason");
    await expect(createModelConversionRegistry([a]).load("fixture", sources[0]!, { signal: c.signal })).rejects.toMatchObject({ code: "aborted" });
    expect(a.load).not.toHaveBeenCalled();
  });
  it("bounds an unresponsive adapter and retains its capacity slot", async () => {
    const a = adapter(); a.load = () => new Promise(() => {});
    const r = createModelConversionRegistry([a], { maxConcurrent: 1 });
    await expect(r.load("fixture", sources[0]!, { timeoutMs: 5 })).rejects.toMatchObject({ code: "deadline-exceeded" });
    await expect(r.load("fixture", sources[0]!)).rejects.toMatchObject({ code: "capacity-exceeded" });
  });
});

describe("registry conformance and defensive boundaries", () => {
  it("freezes copied capability lists and captures bound methods", async () => {
    const a = adapter(); const r = createModelConversionRegistry([a]);
    const original = a.load; a.load = async () => { throw new Error("replaced"); };
    (a.metadata.supportedSourceKinds as string[]).length = 0;
    expect(Object.isFrozen(r)).toBe(true); expect(Object.isFrozen(r.capabilities[0])).toBe(true);
    expect(Object.isFrozen(r.capabilities[0]?.supportedSourceKinds)).toBe(true);
    expect(r.capabilities[0]?.supportedSourceKinds).toHaveLength(7);
    expect((await r.load("fixture", sources[0]!)).accepted).toBe(true); expect(original).toHaveBeenCalled();
  });
  it("returns memory output and manifest snapshots", async () => {
    const a = adapter(); const bytes = new Uint8Array([1, 2]);
    const resourcePackage = { format: "inline" as const, entries: [{ id: "mesh", role: "mesh" as const, path: "meshes/a.bin", contentType: "application/octet-stream" }] };
    a.export = async (_document, target) => ({ ...base(), target: target.kind, output: bytes, resourcePackage });
    const result = await createModelConversionRegistry([a]).export("fixture", document, { kind: "uint8-array" });
    bytes[0] = 9; resourcePackage.entries[0]!.path = "changed";
    expect(result.exported?.output).toEqual(new Uint8Array([1, 2]));
    expect(result.resourcePackage?.entries[0]?.path).toBe("meshes/a.bin"); expect(Object.isFrozen(result.resourcePackage?.entries)).toBe(true);
  });
  it.each([new Blob(["data"]), new ArrayBuffer(4)])("passes matching memory export %s", async output => {
    const a = adapter(); const kind = output instanceof Blob ? "blob" : "array-buffer";
    a.export = async () => ({ ...base(), target: kind, output });
    expect((await createModelConversionRegistry([a]).export("fixture", document, { kind })).exported?.output).toEqual(output);
  });
  it("copies byte inputs and provenance while preserving stream capability identity", async () => {
    const a = adapter(); const bytes = new Uint8Array([7]); const provenance = { sourceId: "synthetic" };
    const r = createModelConversionRegistry([a]); await r.load("fixture", { kind: "uint8-array", bytes, provenance });
    const captured = vi.mocked(a.load).mock.calls[0]![0];
    bytes[0] = 8; provenance.sourceId = "changed";
    expect(captured).toMatchObject({ bytes: new Uint8Array([7]), provenance: { sourceId: "synthetic" } });
    expect(Object.isFrozen(captured)).toBe(true); expect(Object.isFrozen(captured.provenance)).toBe(true);
    const stream: AsyncIterable<Uint8Array> = { async *[Symbol.asyncIterator]() { yield new Uint8Array(); } };
    await r.load("fixture", { kind: "stream", stream });
    expect(vi.mocked(a.load).mock.calls[1]![0]).toHaveProperty("stream", stream);
    const writable = { write: (_chunk: Uint8Array) => true, end: () => {} };
    expect((await r.export("fixture", document, { kind: "stream", stream: writable })).accepted).toBe(true);
  });
  it("supports output package kinds and accepted missing-payload error reports", async () => {
    const a = adapter(); a.load = async () => ({ ...base("strict", [{ kind: "unsupported", code: "MISSING", path: "/", message: "No canonical output" }]), resourcePackage: { format: "directory-manifest", entries: [] } });
    expect((await createModelConversionRegistry([a]).load("fixture", sources[0]!)).resourcePackage?.format).toBe("directory-manifest");
    for (const packageFormat of ["zip", "tar", "directory-manifest"] as const) {
      expect((await createModelConversionRegistry([adapter()]).export("fixture", document, { kind: "package", packageFormat, destinationHint: "synthetic", includeSourcePayload: false })).accepted).toBe(true);
    }
  });
  it("supports raw and canonical validation and returns explicit false", async () => {
    const a = adapter(); a.validate = async () => ({ ...base(), valid: false });
    const r = createModelConversionRegistry([a]); expect((await r.validate("fixture", document)).accepted).toBe(false);
    expect((await r.export("fixture", document, targets[0]!)).accepted).toBe(false); expect(a.export).not.toHaveBeenCalled();
  });
  it("preserves repairs and forensic raw evidence under caller policy", async () => {
    const issues: GpuModelDiagnosticInput["issues"] = [{ kind: "violation", code: "NORMAL", path: "/mesh", message: "Missing normals", ruleId: "missing-normals", originalValue: null, repairApplied: true }];
    const a = adapter(); a.load = async (_s, options) => ({ ...base(options?.mode, issues), document });
    const r = createModelConversionRegistry([a]); expect((await r.load("fixture", sources[0]!)).accepted).toBe(false);
    const result = await r.load("fixture", sources[0]!, { mode: "forensic" });
    expect(result.repairs).toHaveLength(1); expect(result.stages[0]?.report.rawSource).toEqual({ synthetic: true });
  });
  it("stops target validation loss without consent", async () => {
    const a = adapter(); a.validate = async () => ({ ...base("strict", [{ kind: "loss", code: "MATERIAL", path: "/material", message: "Material approximation", effect: "approximated" }], true), valid: true });
    const r = createModelConversionRegistry([a]); expect((await r.export("fixture", document, targets[0]!)).accepted).toBe(false); expect(a.export).not.toHaveBeenCalled();
    expect((await r.export("fixture", document, targets[0]!, { allowLoss: true })).accepted).toBe(true);
  });
  it.each(["inspect", "load", "validate", "export"] as const)("rejects unbranded diagnostic reports in %s", async operation => {
    const a = adapter(); const valid = base();
    const fake = { ...valid, report: structuredClone(valid.report), document, capabilities: a.metadata, valid: true, target: "file-path" };
    a[operation] = (async () => fake) as never;
    const r = createModelConversionRegistry([a]);
    const pending = operation === "export" ? r.export("fixture", document, targets[0]!) : r[operation]("fixture", sources[0]!);
    await expect(pending).rejects.toMatchObject({ code: "invalid-result" });
  });
  it("rejects mode spoofing, changed projections, and accepted missing document", async () => {
    for (const result of [{ ...base("tolerant"), document }, { ...base(), warnings: [], document }, { ...base() }]) {
      const a = adapter(); a.load = async () => result;
      await expect(createModelConversionRegistry([a]).load("fixture", sources[0]!)).rejects.toMatchObject({ code: "invalid-result" });
    }
  });
  it("rejects malformed inspect/validate/export results", async () => {
    const a = adapter(); const r = createModelConversionRegistry([{ ...a, inspect: async () => ({ ...base(), detectedFormat: "other", capabilities: a.metadata }) }]);
    await expect(r.inspect("fixture", sources[0]!)).rejects.toMatchObject({ code: "invalid-result" });
    await expect(createModelConversionRegistry([{ ...a, inspect: async () => ({ ...base(), capabilities: { ...a.metadata, supportsSkins: false } }) }]).inspect("fixture", sources[0]!)).rejects.toMatchObject({ code: "invalid-result" });
    await expect(createModelConversionRegistry([{ ...a, validate: async () => ({ ...base(), valid: "yes" as unknown as boolean }) }]).validate("fixture", document)).rejects.toMatchObject({ code: "invalid-result" });
    for (const result of [{ ...base(), target: "blob" as const }, { ...base(), target: "file-path" as const, output: new Uint8Array() }]) {
      await expect(createModelConversionRegistry([{ ...a, export: async () => result }]).export("fixture", document, targets[0]!)).rejects.toMatchObject({ code: "invalid-result" });
    }
  });
  it.each(["../secret", "/absolute", "a//b", "a\\b", "a/%2e", "A/CON.txt", "a/trailing."])("rejects unsafe manifest path %s", async path => {
    const a = adapter(); a.export = async (_d, target) => ({ ...base(), target: target.kind, resourcePackage: { format: "inline", entries: [{ id: "x", role: "auxiliary", path }] } });
    await expect(createModelConversionRegistry([a]).export("fixture", document, targets[0]!)).rejects.toMatchObject({ code: "invalid-result" });
  });
  it("rejects duplicate manifest identities and case-folded paths", async () => {
    for (const entries of [[{ id: "x", path: "a.bin" }, { id: "x", path: "b.bin" }], [{ id: "x", path: "a.bin" }, { id: "y", path: "A.bin" }]]) {
      const a = adapter(); a.load = async () => ({ ...base(), document, resourcePackage: { format: "inline", entries: entries.map(e => ({ ...e, role: "mesh" as const })) } });
      await expect(createModelConversionRegistry([a]).load("fixture", sources[0]!)).rejects.toMatchObject({ code: "invalid-result" });
    }
  });
  it.each([
    null, {}, { kind: "file-path", path: "" }, { kind: "file-path", path: "a\nprivate" },
    { kind: "file-path", path: "x", convert: true }, { kind: "url", url: "invalid" },
    { kind: "url", url: "file:///private" }, { kind: "url", url: "https://name:secret@example.invalid" },
    { kind: "blob", blob: {} }, { kind: "array-buffer", bytes: [] }, { kind: "uint8-array", bytes: [] },
    { kind: "stream", stream: {} }, { kind: "stream", stream: null },
    { kind: "stream", stream: new ReadableStream(), byteLengthHint: -1 },
    { kind: "blob-storage-url", url: "https://example.invalid", credentialMode: "password" },
    { kind: "url", url: "https://example.invalid", headers: { x: 4 } },
    { kind: "blob", blob: new Blob(), provenance: { secret: "no" } },
  ])("rejects malformed source descriptor %#", async input => {
    await expect(createModelConversionRegistry([adapter()]).load("fixture", input as ModelSource)).rejects.toMatchObject({ code: "invalid-input" });
  });
  it("does not invoke descriptor getters", async () => {
    const getter = vi.fn(() => "private"); const source = { kind: "file-path", get path() { return getter(); } } as const;
    await expect(createModelConversionRegistry([adapter()]).load("fixture", source)).rejects.toMatchObject({ code: "invalid-input" }); expect(getter).not.toHaveBeenCalled();
    expect(() => createModelConversionRegistry([{ get metadata() { return getter(); } } as unknown as ModelAdapter])).toThrow(); expect(getter).not.toHaveBeenCalled();
  });
  it("rejects invalid registration lists and capability descriptors", () => {
    for (const values of [new Array(1), Array.from({ length: 129 }, () => adapter()), Object.assign([adapter()], { extra: true })]) expect(() => createModelConversionRegistry(values)).toThrow();
    const a = adapter();
    for (const metadata of [{ ...a.metadata, formatId: "FBX" }, { ...a.metadata, supportsSkins: 1 }, { ...a.metadata, supportedSourceKinds: ["file-path", "file-path"] }, { ...a.metadata, supportedTargetKinds: ["url"] }, { ...a.metadata, displayName: "x".repeat(4097) }]) {
      expect(() => createModelConversionRegistry([{ ...a, metadata: metadata as AdapterCapabilityMetadata }])).toThrow();
    }
    expect(() => createModelConversionRegistry([a], { maxConcurrent: 0 })).toThrow();
  });
  it("refuses undeclared IO capabilities without calling adapters", async () => {
    const a = adapter(); const r = createModelConversionRegistry([{ ...a, metadata: { ...a.metadata, supportedSourceKinds: [], supportedTargetKinds: [] } }]);
    await expect(r.load("fixture", sources[0]!)).rejects.toMatchObject({ code: "unsupported-source" });
    await expect(r.export("fixture", document, targets[0]!)).rejects.toMatchObject({ code: "unsupported-target" }); expect(a.load).not.toHaveBeenCalled();
  });
  it("rejects malformed request/options and unverified export document", async () => {
    const r = createModelConversionRegistry([adapter()]);
    for (const options of [{ mode: "other" }, { allowLoss: "yes" }, { timeoutMs: 0 }, { timeoutMs: 300001 }, { signal: {} }]) await expect(r.load("fixture", sources[0]!, options as ModelOperationOptions)).rejects.toMatchObject({ code: "invalid-input" });
    await expect(r.export("fixture", structuredClone(document), targets[0]!)).rejects.toMatchObject({ code: "invalid-input" });
    await expect(r.export("fixture", document, { kind: "file-path", path: "x", overwrite: "yes" } as unknown as ModelTarget)).rejects.toMatchObject({ code: "invalid-input" });
  });
  it("aborts in flight, suppresses late export, then frees capacity on settlement", async () => {
    const a = adapter(); let resolve!: (result: ModelLoadResult) => void; let signal!: AbortSignal;
    a.load = (_s, options) => { signal = options!.signal!; return new Promise(r => { resolve = r; }); };
    const r = createModelConversionRegistry([a], { maxConcurrent: 1 }); const controller = new AbortController();
    const pending = r.convert({ sourceFormat: "fixture", targetFormat: "fixture", source: sources[0]!, target: targets[0]! }, { signal: controller.signal });
    await Promise.resolve(); controller.abort("private"); await expect(pending).rejects.toMatchObject({ code: "aborted" }); expect(signal.aborted).toBe(true);
    resolve({ ...base(), document }); await new Promise(r => setTimeout(r, 0));
    expect(a.export).not.toHaveBeenCalled(); expect((await r.inspect("fixture", sources[0]!)).accepted).toBe(true);
  });
  it("shares a single deadline across stages and clears completed timers", async () => {
    vi.useFakeTimers();
    try {
      const a = adapter(); a.load = async () => { await new Promise(r => setTimeout(r, 8)); return { ...base(), document }; };
      a.validate = async () => { await new Promise(r => setTimeout(r, 8)); return { ...base(), valid: true }; };
      const pending = createModelConversionRegistry([a]).convert({ sourceFormat: "fixture", targetFormat: "fixture", source: sources[0]!, target: targets[0]! }, { timeoutMs: 10 });
      const assertion = expect(pending).rejects.toMatchObject({ code: "deadline-exceeded" });
      await vi.advanceTimersByTimeAsync(20); await assertion; expect(a.export).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});
