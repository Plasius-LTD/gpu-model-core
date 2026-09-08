import { isGpuModelDocument, type GpuModelDocument } from "./model-document.js";
import {
  evaluateGpuModelDiagnostics, type GpuModelDiagnosticInput, type GpuModelDiagnosticMode,
  type GpuModelDiagnosticReport, type GpuModelConversionDiagnostic,
  type GpuModelConversionIssue, type GpuModelRepairRecord,
} from "./diagnostics.js";

/** Inert provenance hints. Never put credentials or signed URLs in this metadata. */
export interface ModelProvenance {
  readonly sourceId?: string; readonly sourceSystem?: string;
  readonly acquiredAt?: string; readonly licenseHint?: string;
}
interface SourceHints {
  readonly mimeTypeHint?: string; readonly fileNameHint?: string; readonly provenance?: ModelProvenance;
}
/** Node Readable streams implement AsyncIterable; no Node types enter browser declarations. */
export type ModelReadableStream = ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>;
/** Portable subset also implemented by Node Writable streams. */
export type ModelWritableStream = WritableStream<Uint8Array> | { write(chunk: Uint8Array): boolean; end(): unknown };
/** Declarative IO; the injected adapter/runtime owns resolution and authorization. */
export type ModelSource = SourceHints & (
  | { readonly kind: "file-path"; readonly path: string }
  | { readonly kind: "url"; readonly url: string; readonly headers?: Readonly<Record<string, string>> }
  | { readonly kind: "blob-storage-url"; readonly url: string; readonly credentialMode?: "anonymous" | "signed" | "runtime-resolved" }
  | { readonly kind: "blob"; readonly blob: Blob }
  | { readonly kind: "array-buffer"; readonly bytes: ArrayBuffer }
  | { readonly kind: "uint8-array"; readonly bytes: Uint8Array }
  | { readonly kind: "stream"; readonly stream: ModelReadableStream; readonly byteLengthHint?: number }
);
/** Each call selects exactly one output destination. */
export type ModelTarget =
  | { readonly kind: "file-path"; readonly path: string; readonly overwrite?: boolean }
  | { readonly kind: "blob-storage-url"; readonly url: string; readonly overwrite?: boolean; readonly contentType?: string; readonly metadata?: Readonly<Record<string, string>> }
  | { readonly kind: "blob"; readonly mimeType?: string; readonly fileName?: string }
  | { readonly kind: "array-buffer" }
  | { readonly kind: "uint8-array" }
  | { readonly kind: "stream"; readonly stream: ModelWritableStream; readonly contentType?: string }
  | { readonly kind: "package"; readonly packageFormat: "zip" | "tar" | "directory-manifest"; readonly destinationHint?: string; readonly includeSourcePayload?: boolean };
export type RepairMode = GpuModelDiagnosticMode;
/** Caller policy is authoritative; cancellation/deadline apply to the whole conversion. */
export interface ModelOperationOptions {
  readonly mode?: RepairMode; readonly allowLoss?: boolean;
  readonly signal?: AbortSignal; readonly timeoutMs?: number;
}
export type InspectOptions = ModelOperationOptions;
export type LoadOptions = ModelOperationOptions;
export type ExportOptions = ModelOperationOptions;
export type ValidateOptions = ModelOperationOptions;
export interface AdapterCapabilityMetadata {
  readonly formatId: string; readonly displayName: string;
  readonly supportedSourceKinds: readonly ModelSource["kind"][];
  readonly supportedTargetKinds: readonly ModelTarget["kind"][];
  readonly supportsAnimations: boolean; readonly supportsSkins: boolean; readonly supportsAnalyticGeometry: boolean;
}
/** Packaging descriptors are not proof of exported bytes or asset promotion. */
export interface ResourcePackageManifest {
  readonly format: "zip" | "tar" | "directory-manifest" | "inline";
  readonly entries: readonly {
    readonly id: string; readonly role: "mesh" | "material" | "texture" | "animation" | "auxiliary";
    readonly path: string; readonly contentType?: string;
  }[];
}
/** Construct through createModelResultBase; derived fields cannot disagree with the report. */
export interface ModelResultBase {
  readonly report: GpuModelDiagnosticReport;
  readonly diagnostics: readonly GpuModelConversionDiagnostic[];
  readonly warnings: readonly GpuModelConversionDiagnostic[];
  readonly repairs: readonly GpuModelRepairRecord[];
  readonly lossReports: GpuModelDiagnosticReport["losses"];
}
export interface ModelInspectResult extends ModelResultBase {
  readonly detectedFormat?: string; readonly capabilities: AdapterCapabilityMetadata;
}
export interface ModelLoadResult extends ModelResultBase {
  readonly document?: GpuModelDocument; readonly resourcePackage?: ResourcePackageManifest;
}
export interface ModelExportResult extends ModelResultBase {
  readonly target: ModelTarget["kind"]; readonly resourcePackage?: ResourcePackageManifest;
  readonly output?: Blob | ArrayBuffer | Uint8Array;
}
export interface ModelValidateResult extends ModelResultBase { readonly valid: boolean }
/** Trusted injected adapter: stage writes and enforce policy before committing output. */
export interface ModelAdapter {
  readonly metadata: AdapterCapabilityMetadata;
  inspect(source: ModelSource, options?: InspectOptions): Promise<ModelInspectResult>;
  load(source: ModelSource, options?: LoadOptions): Promise<ModelLoadResult>;
  export(document: GpuModelDocument, target: ModelTarget, options?: ExportOptions): Promise<ModelExportResult>;
  validate(input: ModelSource | GpuModelDocument, options?: ValidateOptions): Promise<ModelValidateResult>;
}
export interface ModelConversionStage {
  readonly formatId: string; readonly operation: "inspect" | "load" | "capabilities" | "validate" | "export";
  readonly report: GpuModelDiagnosticReport;
}
/** No source/target descriptors or exception causes are retained in a ledger. */
export interface ModelRegistryResult {
  readonly accepted: boolean; readonly stages: readonly ModelConversionStage[];
  readonly diagnostics: readonly GpuModelConversionDiagnostic[];
  readonly warnings: readonly GpuModelConversionDiagnostic[];
  readonly repairs: readonly GpuModelRepairRecord[];
  readonly lossReports: GpuModelDiagnosticReport["losses"];
  readonly document?: GpuModelDocument;
  readonly inspection?: ModelInspectResult;
  readonly resourcePackage?: ResourcePackageManifest;
  readonly exported?: ModelExportResult;
}
export interface ModelConversionRequest {
  readonly sourceFormat: string; readonly targetFormat: string;
  readonly source: ModelSource; readonly target: ModelTarget;
}
export interface ModelConversionRegistry {
  readonly capabilities: readonly AdapterCapabilityMetadata[];
  inspect(format: string, source: ModelSource, options?: InspectOptions): Promise<ModelRegistryResult>;
  load(format: string, source: ModelSource, options?: LoadOptions): Promise<ModelRegistryResult>;
  validate(format: string, input: ModelSource | GpuModelDocument, options?: ValidateOptions): Promise<ModelRegistryResult>;
  export(format: string, document: GpuModelDocument, target: ModelTarget, options?: ExportOptions): Promise<ModelRegistryResult>;
  convert(request: ModelConversionRequest, options?: ModelOperationOptions): Promise<ModelRegistryResult>;
}
export const MODEL_REGISTRY_LIMITS = Object.freeze({ adapters: 128, concurrent: 8, timeoutMs: 30_000, maxTimeoutMs: 300_000, string: 4096, mapEntries: 64, manifestEntries: 4096, memoryBytes: 64 * 1024 * 1024 });
export type ModelRegistryErrorCode = "invalid-input" | "invalid-adapter" | "duplicate-format" | "unsupported-format" | "unsupported-source" | "unsupported-target" | "invalid-result" | "adapter-failed" | "aborted" | "deadline-exceeded" | "capacity-exceeded";
export class ModelRegistryError extends TypeError {
  public constructor(public readonly code: ModelRegistryErrorCode) { super(`GPU model registry: ${code}`); this.name = "ModelRegistryError"; }
}
function fail(code: ModelRegistryErrorCode = "invalid-input"): never { throw new ModelRegistryError(code); }
const sourceKinds = ["file-path", "url", "blob-storage-url", "blob", "array-buffer", "uint8-array", "stream"] as const;
const targetKinds = ["file-path", "blob-storage-url", "blob", "array-buffer", "uint8-array", "stream", "package"] as const;
const bases = new WeakMap<object, ModelResultBase>();
/** Evaluates, copies and freezes bounded adapter evidence using the core repair policy. */
export function createModelResultBase(input: GpuModelDiagnosticInput): ModelResultBase {
  const report = evaluateGpuModelDiagnostics(input);
  const value = Object.freeze({ report, diagnostics: report.diagnostics, warnings: Object.freeze(report.diagnostics.filter(d => d.severity === "warning")), repairs: report.repairs, lossReports: report.losses });
  bases.set(report, value);
  return value;
}
// Only own data properties. Runtime adapters/stream implementations are trusted code;
// malicious Proxies require isolation before reaching this in-process API.
function record(value: unknown, allowed?: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail();
  const keys = Reflect.ownKeys(value);
  if (keys.length > MODEL_REGISTRY_LIMITS.mapEntries) fail();
  const output = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    if (typeof key !== "string" || (allowed && !allowed.includes(key))) fail();
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!("value" in descriptor)) fail();
    output[key] = descriptor.value;
  }
  return output;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.length || value.length > MODEL_REGISTRY_LIMITS.string || Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) fail();
  return value;
}
function format(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(value)) fail();
  return value;
}
function enumeration<T extends string>(value: unknown, values: readonly T[]): T {
  if (!values.includes(value as T)) fail(); return value as T;
}
function boolean(value: unknown): boolean { if (typeof value !== "boolean") fail(); return value; }
function integer(value: unknown, max: number, min = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) fail(); return value;
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max || Reflect.ownKeys(value).length !== value.length + 1) fail();
  return Array.from({ length: value.length }, (_, i) => {
    const d = Object.getOwnPropertyDescriptor(value, String(i)); if (!d || !("value" in d)) fail(); return d.value as unknown;
  });
}
function strings(value: unknown): Readonly<Record<string, string>> {
  const input = record(value); const out = Object.create(null) as Record<string, string>;
  for (const [key, entry] of Object.entries(input)) out[text(key)] = text(entry);
  return Object.freeze(out);
}
function metadata(value: unknown): AdapterCapabilityMetadata {
  const v = record(value, ["formatId", "displayName", "supportedSourceKinds", "supportedTargetKinds", "supportsAnimations", "supportsSkins", "supportsAnalyticGeometry"]);
  const kinds = <T extends string>(input: unknown, allowed: readonly T[]) => {
    const values = list(input, allowed.length).map(k => enumeration(k, allowed));
    if (new Set(values).size !== values.length) fail(); return Object.freeze(values);
  };
  return Object.freeze({ formatId: format(v.formatId), displayName: text(v.displayName), supportedSourceKinds: kinds(v.supportedSourceKinds, sourceKinds), supportedTargetKinds: kinds(v.supportedTargetKinds, targetKinds), supportsAnimations: boolean(v.supportsAnimations), supportsSkins: boolean(v.supportsSkins), supportsAnalyticGeometry: boolean(v.supportsAnalyticGeometry) });
}
function snapshotIO(input: unknown, source: boolean): ModelSource | ModelTarget {
  const v = record(input); const kind = enumeration(v.kind, source ? sourceKinds : targetKinds);
  const common = source ? ["kind", "fileNameHint", "mimeTypeHint", "provenance"] : ["kind"];
  const specific: Record<string, string[]> = source ? {
    "file-path": ["path"], url: ["url", "headers"], "blob-storage-url": ["url", "credentialMode"], blob: ["blob"], "array-buffer": ["bytes"], "uint8-array": ["bytes"], stream: ["stream", "byteLengthHint"],
  } : {
    "file-path": ["path", "overwrite"], "blob-storage-url": ["url", "overwrite", "contentType", "metadata"], blob: ["mimeType", "fileName"], "array-buffer": [], "uint8-array": [], stream: ["stream", "contentType"], package: ["packageFormat", "destinationHint", "includeSourcePayload"],
  };
  if (Object.keys(v).some(k => ![...common, ...specific[kind]!].includes(k))) fail();
  const out: Record<string, unknown> = { kind };
  for (const key of ["fileNameHint", "mimeTypeHint", "mimeType", "fileName", "contentType", "destinationHint"]) if (v[key] !== undefined) out[key] = text(v[key]);
  for (const key of ["overwrite", "includeSourcePayload"]) if (v[key] !== undefined) out[key] = boolean(v[key]);
  for (const key of ["headers", "metadata"]) if (v[key] !== undefined) out[key] = strings(v[key]);
  if (v.provenance !== undefined) out.provenance = strings(record(v.provenance, ["sourceId", "sourceSystem", "acquiredAt", "licenseHint"]));
  if (v.credentialMode !== undefined) out.credentialMode = enumeration(v.credentialMode, ["anonymous", "signed", "runtime-resolved"]);
  if (v.byteLengthHint !== undefined) out.byteLengthHint = integer(v.byteLengthHint, Number.MAX_SAFE_INTEGER);
  if (kind === "file-path") out.path = text(v.path);
  if (kind === "url" || kind === "blob-storage-url") {
    const url = text(v.url); let parsed: URL;
    try { parsed = new URL(url); } catch { return fail(); }
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) fail();
    out.url = url;
  }
  if (source && kind === "blob") {
    if (!(v.blob instanceof Blob)) fail(); integer(v.blob.size, MODEL_REGISTRY_LIMITS.memoryBytes); out.blob = v.blob;
  }
  if (source && (kind === "array-buffer" || kind === "uint8-array")) {
    if (kind === "array-buffer") { if (!(v.bytes instanceof ArrayBuffer)) fail(); integer(v.bytes.byteLength, MODEL_REGISTRY_LIMITS.memoryBytes); out.bytes = v.bytes.slice(0); }
    else { if (!(v.bytes instanceof Uint8Array) || !(v.bytes.buffer instanceof ArrayBuffer)) fail(); integer(v.bytes.byteLength, MODEL_REGISTRY_LIMITS.memoryBytes); out.bytes = new Uint8Array(v.bytes); }
  }
  if (kind === "stream") {
    const stream = v.stream as ModelReadableStream & ModelWritableStream;
    if (!stream || typeof stream !== "object") fail();
    if (source ? !(stream instanceof ReadableStream) && typeof (stream as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] !== "function" : !(stream instanceof WritableStream) && !("write" in stream && typeof stream.write === "function" && typeof stream.end === "function")) fail();
    out.stream = stream;
  }
  if (kind === "package") out.packageFormat = enumeration(v.packageFormat, ["zip", "tar", "directory-manifest"]);
  return Object.freeze(out) as unknown as ModelSource | ModelTarget;
}
function manifest(input: unknown): ResourcePackageManifest {
  const v = record(input, ["format", "entries"]); const ids = new Set<string>(); const paths = new Set<string>();
  const entries = list(v.entries, MODEL_REGISTRY_LIMITS.manifestEntries).map(entry => {
    const e = record(entry, ["id", "role", "path", "contentType"]); const id = text(e.id); const path = text(e.path);
    if (ids.has(id) || paths.has(path.toLowerCase()) || path.split("/").some(s => !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/.test(s) || /[.]$/.test(s) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:[.]|$)/i.test(s))) fail();
    ids.add(id); paths.add(path.toLowerCase());
    return Object.freeze({ id, path, role: enumeration(e.role, ["mesh", "material", "texture", "animation", "auxiliary"] as const), ...(e.contentType !== undefined ? { contentType: text(e.contentType) } : {}) });
  });
  return Object.freeze({ format: enumeration(v.format, ["zip", "tar", "directory-manifest", "inline"]), entries: Object.freeze(entries) });
}
interface Context { options: Required<Pick<ModelOperationOptions, "mode" | "allowLoss" | "signal" | "timeoutMs">>; deadline: number }
function reportBase(value: Record<string, unknown>, context: Context): ModelResultBase {
  const base = bases.get(value.report as object);
  if (!base || base.report.mode !== context.options.mode || ["diagnostics", "warnings", "repairs", "lossReports"].some(k => value[k] !== base[k as keyof ModelResultBase])) fail("invalid-result");
  return base;
}
function accepted(report: GpuModelDiagnosticReport, context: Context): boolean {
  return report.accepted && (context.options.allowLoss || report.losses.length === 0);
}
function ledger(stages: ModelConversionStage[], ok: boolean, payload: Partial<ModelRegistryResult> = {}): ModelRegistryResult {
  return Object.freeze({ ...payload, accepted: ok, stages: Object.freeze([...stages]), diagnostics: Object.freeze(stages.flatMap(s => s.report.diagnostics)), warnings: Object.freeze(stages.flatMap(s => s.report.diagnostics.filter(d => d.severity === "warning"))), repairs: Object.freeze(stages.flatMap(s => s.report.repairs)), lossReports: Object.freeze(stages.flatMap(s => s.report.losses)) });
}
/** Creates an immutable fixed registry. No global discovery, format sniffing or IO. */
export function createModelConversionRegistry(adapters: readonly ModelAdapter[], limits: { readonly maxConcurrent?: number } = {}): ModelConversionRegistry {
  const registry = new Map<string, ModelAdapter>();
  const maxConcurrent = integer(record(limits, ["maxConcurrent"]).maxConcurrent ?? MODEL_REGISTRY_LIMITS.concurrent, MODEL_REGISTRY_LIMITS.concurrent, 1);
  for (const input of list(adapters, MODEL_REGISTRY_LIMITS.adapters)) {
    let a: ModelAdapter;
    try {
      const v = record(input, ["metadata", "inspect", "load", "export", "validate"]); const m = metadata(v.metadata);
      for (const name of ["inspect", "load", "export", "validate"]) if (typeof v[name] !== "function") fail();
      const raw = input as ModelAdapter;
      a = Object.freeze({ metadata: m, inspect: raw.inspect.bind(raw), load: raw.load.bind(raw), export: raw.export.bind(raw), validate: raw.validate.bind(raw) });
    } catch { return fail("invalid-adapter"); }
    if (registry.has(a.metadata.formatId)) fail("duplicate-format"); registry.set(a.metadata.formatId, a);
  }
  let active = 0;
  function lookup(id: unknown): ModelAdapter { const a = registry.get(format(id)); if (!a) fail("unsupported-format"); return a; }
  function sourceFor(a: ModelAdapter, input: unknown): ModelSource {
    const source = snapshotIO(input, true) as ModelSource;
    if (!a.metadata.supportedSourceKinds.includes(source.kind)) fail("unsupported-source"); return source;
  }
  function targetFor(a: ModelAdapter, input: unknown): ModelTarget {
    const target = snapshotIO(input, false) as ModelTarget;
    if (!a.metadata.supportedTargetKinds.includes(target.kind)) fail("unsupported-target"); return target;
  }
  function check(context: Context): void {
    if (context.options.signal.aborted) fail("aborted"); if (Date.now() >= context.deadline) fail("deadline-exceeded");
  }
  async function run(options: ModelOperationOptions | undefined, work: (context: Context) => Promise<ModelRegistryResult>): Promise<ModelRegistryResult> {
    const v = record(options ?? {}, ["mode", "allowLoss", "signal", "timeoutMs"]);
    const mode = enumeration(v.mode ?? "strict", ["strict", "tolerant", "forensic"] as const);
    const allowLoss = v.allowLoss === undefined ? false : boolean(v.allowLoss);
    const timeoutMs = integer(v.timeoutMs ?? MODEL_REGISTRY_LIMITS.timeoutMs, MODEL_REGISTRY_LIMITS.maxTimeoutMs, 1);
    if (v.signal !== undefined && !(v.signal instanceof AbortSignal)) fail();
    const parent = v.signal as AbortSignal | undefined;
    if (parent?.aborted) fail("aborted");
    if (active >= maxConcurrent) fail("capacity-exceeded");
    const controller = new AbortController();
    const context: Context = { options: Object.freeze({ mode, allowLoss, timeoutMs, signal: controller.signal }), deadline: Date.now() + timeoutMs };
    active++;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    // Capacity follows underlying work settlement, not the timeout race.
    const pending = Promise.resolve().then(() => { check(context); return work(context); }).finally(() => { active--; });
    const stopped = new Promise<never>((_, reject) => {
      abort = () => { controller.abort(); reject(new ModelRegistryError("aborted")); };
      parent?.addEventListener("abort", abort, { once: true });
      timer = setTimeout(() => { controller.abort(); reject(new ModelRegistryError("deadline-exceeded")); }, timeoutMs);
    });
    try { return await Promise.race([pending, stopped]); }
    catch (error) { if (error instanceof ModelRegistryError) throw error; return fail(); }
    finally { clearTimeout(timer); if (abort) parent?.removeEventListener("abort", abort); }
  }
  async function invoke(a: ModelAdapter, operation: "inspect" | "load" | "validate" | "export", context: Context, call: () => Promise<ModelResultBase>, stages: ModelConversionStage[]): Promise<Record<string, unknown>> {
    check(context); let raw: unknown;
    try { raw = await call(); } catch { return fail("adapter-failed"); }
    check(context);
    try {
      const v = record(raw, ["report", "diagnostics", "warnings", "repairs", "lossReports", ...({ inspect: ["detectedFormat", "capabilities"], load: ["document", "resourcePackage"], validate: ["valid"], export: ["target", "resourcePackage", "output"] }[operation])]);
      const base = reportBase(v, context);
      const result: Record<string, unknown> = { ...v, ...base };
      if (v.resourcePackage !== undefined) result.resourcePackage = manifest(v.resourcePackage);
      stages.push(Object.freeze({ formatId: a.metadata.formatId, operation, report: base.report }));
      return result;
    } catch { return fail("invalid-result"); }
  }
  async function load(a: ModelAdapter, source: ModelSource, c: Context, stages: ModelConversionStage[]): Promise<ModelLoadResult> {
    const v = await invoke(a, "load", c, () => a.load(source, c.options), stages);
    if (v.document !== undefined && !isGpuModelDocument(v.document)) fail("invalid-result");
    if (accepted(v.report as GpuModelDiagnosticReport, c) && !isGpuModelDocument(v.document)) fail("invalid-result");
    return Object.freeze(v) as unknown as ModelLoadResult;
  }
  async function validate(a: ModelAdapter, input: ModelSource | GpuModelDocument, c: Context, stages: ModelConversionStage[]): Promise<boolean> {
    const v = await invoke(a, "validate", c, () => a.validate(input, c.options), stages);
    if (typeof v.valid !== "boolean") fail("invalid-result"); return v.valid && accepted(v.report as GpuModelDiagnosticReport, c);
  }
  async function exportDocument(a: ModelAdapter, document: GpuModelDocument, target: ModelTarget, c: Context, stages: ModelConversionStage[]): Promise<ModelRegistryResult> {
    const issues: GpuModelConversionIssue[] = [];
    for (const [supported, present, path] of [[a.metadata.supportsAnimations, document.animations.length, "/animations"], [a.metadata.supportsSkins, document.skins.length + document.skeletons.length + document.joints.length, "/skins"], [a.metadata.supportsAnalyticGeometry, document.analyticGeometry.length, "/analyticGeometry"]] as const) {
      if (!supported && present) issues.push({ kind: "loss", code: "TARGET_CAPABILITY_LOSS", path, message: "Target cannot preserve canonical semantics", effect: "dropped" });
    }
    const report = evaluateGpuModelDiagnostics({ standard: "gltf-glb", mode: c.options.mode, allowLoss: c.options.allowLoss, issues, ...(c.options.mode === "forensic" ? { rawSource: null } : {}) });
    // This synthetic capability report contains no format-specific repair rules.
    stages.push(Object.freeze({ formatId: a.metadata.formatId, operation: "capabilities", report }));
    if (!accepted(report, c) || !await validate(a, document, c, stages)) return ledger(stages, false, { document });
    const v = await invoke(a, "export", c, () => a.export(document, target, c.options), stages);
    if (v.target !== target.kind) fail("invalid-result");
    try {
      if (v.output !== undefined) {
        const output = v.output;
        if (target.kind === "blob" && output instanceof Blob) { integer(output.size, MODEL_REGISTRY_LIMITS.memoryBytes); }
        else if (target.kind === "array-buffer" && output instanceof ArrayBuffer) { integer(output.byteLength, MODEL_REGISTRY_LIMITS.memoryBytes); v.output = output.slice(0); }
        else if (target.kind === "uint8-array" && output instanceof Uint8Array && output.buffer instanceof ArrayBuffer) { integer(output.byteLength, MODEL_REGISTRY_LIMITS.memoryBytes); v.output = new Uint8Array(output); }
        else fail();
      }
    } catch { return fail("invalid-result"); }
    const exported = Object.freeze(v) as unknown as ModelExportResult;
    return ledger(stages, accepted(exported.report, c), { document, exported, ...(exported.resourcePackage ? { resourcePackage: exported.resourcePackage } : {}) });
  }
  const api: ModelConversionRegistry = {
    capabilities: Object.freeze([...registry.values()].map(a => a.metadata)),
    inspect: (id, input, options) => run(options, async c => {
      const a = lookup(id); const source = sourceFor(a, input); const stages: ModelConversionStage[] = [];
      const v = await invoke(a, "inspect", c, () => a.inspect(source, c.options), stages);
      try {
        if (v.detectedFormat !== undefined && format(v.detectedFormat) !== a.metadata.formatId) fail();
        if (JSON.stringify(metadata(v.capabilities)) !== JSON.stringify(a.metadata)) fail();
      } catch { return fail("invalid-result"); }
      return ledger(stages, accepted(v.report as GpuModelDiagnosticReport, c), { inspection: Object.freeze({ ...v, capabilities: a.metadata }) as unknown as ModelInspectResult });
    }),
    load: (id, input, options) => run(options, async c => {
      const a = lookup(id); const stages: ModelConversionStage[] = [];
      const result = await load(a, sourceFor(a, input), c, stages);
      return ledger(stages, accepted(result.report, c), { ...(result.document ? { document: result.document } : {}), ...(result.resourcePackage ? { resourcePackage: result.resourcePackage } : {}) });
    }),
    validate: (id, input, options) => run(options, async c => {
      const a = lookup(id); const stages: ModelConversionStage[] = [];
      return ledger(stages, await validate(a, isGpuModelDocument(input) ? input : sourceFor(a, input), c, stages));
    }),
    export: (id, document, input, options) => run(options, async c => {
      const a = lookup(id); if (!isGpuModelDocument(document)) fail();
      return exportDocument(a, document, targetFor(a, input), c, []);
    }),
    convert: (request, options) => run(options, async c => {
      const v = record(request, ["sourceFormat", "targetFormat", "source", "target"]);
      const from = lookup(v.sourceFormat); const to = lookup(v.targetFormat);
      const source = sourceFor(from, v.source); const target = targetFor(to, v.target);
      const stages: ModelConversionStage[] = []; const result = await load(from, source, c, stages);
      if (!accepted(result.report, c)) return ledger(stages, false, { ...(result.resourcePackage ? { resourcePackage: result.resourcePackage } : {}) });
      return exportDocument(to, result.document!, target, c, stages);
    }),
  };
  return Object.freeze(api);
}
