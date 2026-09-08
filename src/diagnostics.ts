import type { GpuModelDiagnosticSeverity, GpuModelMetadataValue } from "./model-document.js";

/** Supported policy modes; strict is always the default. */
export type GpuModelDiagnosticMode = "strict" | "tolerant" | "forensic";
/** Adapter compliance profiles inherited from the canonical conversion policy. */
export type GpuModelDiagnosticStandard = "gltf-glb" | "obj-mtl" | "fbx" | "cad-bim";
/** Stable repair definitions; format adapters apply and verify these actions. */
export const GPU_MODEL_REPAIR_RULES = Object.freeze(([
  {
    "id": "missing-normals",
    "action": "Generate deterministic vertex normals from validated triangle geometry.",
    "severity": "warning",
    "confidence": "high",
    "standardIds": [
      "gltf-glb",
      "obj-mtl",
      "fbx",
      "cad-bim"
    ],
    "policy": "Generate deterministic vertex normals from validated triangle geometry and record the generation basis."
  },
  {
    "id": "bad-winding",
    "action": "Normalize winding to the adapter coordinate convention.",
    "severity": "warning",
    "confidence": "medium",
    "standardIds": [
      "gltf-glb",
      "obj-mtl",
      "fbx",
      "cad-bim"
    ],
    "policy": "Normalize winding to the adapter coordinate convention and record the inferred orientation."
  },
  {
    "id": "invalid-indices",
    "action": "Drop the invalid primitive.",
    "severity": "error",
    "confidence": "medium",
    "standardIds": [
      "gltf-glb",
      "obj-mtl",
      "fbx",
      "cad-bim"
    ],
    "policy": "Reject the invalid primitive or clamp only when the fixture and adapter policy explicitly prove a safe repair; retain the original index in the record."
  },
  {
    "id": "nan-transforms",
    "action": "Replace non-finite transform components with identity components.",
    "severity": "error",
    "confidence": "high",
    "standardIds": [
      "gltf-glb",
      "obj-mtl",
      "fbx",
      "cad-bim"
    ],
    "policy": "Replace the non-finite component with the identity transform component and record the source value and fallback."
  },
  {
    "id": "non-normalized-weights",
    "action": "Normalize finite non-negative skin weights.",
    "severity": "warning",
    "confidence": "high",
    "standardIds": [
      "gltf-glb",
      "fbx",
      "cad-bim"
    ],
    "policy": "Normalize finite, non-negative influences and record the pre-normalization weights and discarded influence policy."
  },
  {
    "id": "missing-texture-path",
    "action": "Leave the missing or unsafe texture slot unresolved.",
    "severity": "warning",
    "confidence": "low",
    "standardIds": [
      "gltf-glb",
      "obj-mtl",
      "fbx",
      "cad-bim"
    ],
    "policy": "Resolve only an explicitly bounded package-relative fallback; otherwise keep the material slot unresolved and emit a visible warning."
  },
  {
    "id": "malformed-material-reference",
    "action": "Attach the canonical default material.",
    "severity": "error",
    "confidence": "medium",
    "standardIds": [
      "gltf-glb",
      "obj-mtl",
      "fbx",
      "cad-bim"
    ],
    "policy": "Attach the canonical default material only when the target policy permits it and preserve the unresolved source reference."
  }
] as const).map(rule => Object.freeze({ ...rule, standardIds: Object.freeze(rule.standardIds) })));

/** Defensive ceilings for a complete report, including its source snapshots. */
export const GPU_MODEL_DIAGNOSTIC_LIMITS = Object.freeze({
  issues: 4096, values: 16384, depth: 12, members: 1024, string: 65536, bytes: 1048576,
} as const);

/** An inert, bounded report was malformed; errors never echo caller values. */
export class GpuModelDiagnosticsError extends TypeError {
  public constructor() {
    super("Invalid or over-budget GPU model diagnostics report");
    this.name = "GpuModelDiagnosticsError";
  }
}

/** Common, path-addressable fields; callers must remove sensitive source text. */
export interface GpuModelConversionIssueBase {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}
/** Adapter-reported standard violation, with explicit completed-repair evidence. */
export interface GpuModelConversionViolation extends GpuModelConversionIssueBase {
  readonly kind: "violation";
  readonly ruleId: string;
  readonly originalValue: GpuModelMetadataValue;
  readonly repairApplied: boolean;
}
/** Unsupported source/target semantics are always blocking. */
export interface GpuModelUnsupportedData extends GpuModelConversionIssueBase {
  readonly kind: "unsupported";
}
/** An advisory that does not represent a standard violation or lost data. */
export interface GpuModelConversionWarning extends GpuModelConversionIssueBase {
  readonly kind: "warning";
}
/** Explicit source-fidelity loss, requiring caller consent even after repair. */
export interface GpuModelConversionLoss extends GpuModelConversionIssueBase {
  readonly kind: "loss";
  readonly effect: "dropped" | "approximated";
}
/** Discriminated adapter input contract; unknown rule IDs remain blocking. */
export type GpuModelConversionIssue = GpuModelConversionViolation | GpuModelUnsupportedData | GpuModelConversionWarning | GpuModelConversionLoss;
/** Typed construction contract; the evaluator also validates unknown input. */
export interface GpuModelDiagnosticInput {
  readonly standard: GpuModelDiagnosticStandard;
  readonly mode?: GpuModelDiagnosticMode;
  readonly allowLoss?: boolean;
  readonly issues: readonly GpuModelConversionIssue[];
  readonly rawSource?: GpuModelMetadataValue;
  readonly maxEvidenceBytes?: number;
}
/** One verified report of an adapter-applied repair; never a repair request. */
export interface GpuModelRepairRecord {
  readonly ruleId: typeof GPU_MODEL_REPAIR_RULES[number]["id"];
  readonly originalValue: GpuModelMetadataValue;
  readonly action: string;
  readonly severity: GpuModelDiagnosticSeverity;
  readonly affectedPath: string;
  readonly confidence: "high" | "medium" | "low";
}
/** Separate categories prevent warnings from disguising violations or loss. */
export type GpuModelConversionDiagnostic =
  | (GpuModelConversionIssueBase & { readonly kind: "blocking-error"; readonly severity: "error"; readonly ruleId: string })
  | (GpuModelConversionIssueBase & { readonly kind: "repair"; readonly severity: GpuModelDiagnosticSeverity; readonly ruleId: string })
  | (GpuModelUnsupportedData & { readonly severity: "error" })
  | (GpuModelConversionWarning & { readonly severity: "warning" })
  | (GpuModelConversionLoss & { readonly severity: "warning" });
/** Immutable owned ledger. Acceptance validates reports, not repaired geometry. */
export interface GpuModelDiagnosticReport {
  readonly mode: GpuModelDiagnosticMode;
  readonly standard: GpuModelDiagnosticStandard;
  readonly accepted: boolean;
  readonly diagnostics: readonly GpuModelConversionDiagnostic[];
  readonly repairs: readonly GpuModelRepairRecord[];
  readonly losses: readonly (GpuModelConversionLoss & { readonly severity: "warning" })[];
  readonly rawSource?: GpuModelMetadataValue;
}

function fail(): never { throw new GpuModelDiagnosticsError(); }
interface Budget { values: number; bytes: number }
function charge(budget: Budget, bytes: number): void {
  budget.bytes += bytes;
  if (budget.bytes > GPU_MODEL_DIAGNOSTIC_LIMITS.bytes) fail();
}
function textBytes(value: string): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

// Read only own data properties. Serialized JSON is the boundary for hostile Proxies.
function snapshot(value: unknown, depth: number, budget: Budget, ancestors: Set<object>, memberLimit: number = GPU_MODEL_DIAGNOSTIC_LIMITS.members): GpuModelMetadataValue {
  if (++budget.values > GPU_MODEL_DIAGNOSTIC_LIMITS.values || depth > GPU_MODEL_DIAGNOSTIC_LIMITS.depth) fail();
  if (value === null || typeof value === "boolean") { charge(budget, value === null ? 4 : value ? 4 : 5); return value; }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail();
    charge(budget, JSON.stringify(value).length);
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === "string") {
    if (value.length > GPU_MODEL_DIAGNOSTIC_LIMITS.string) fail();
    charge(budget, textBytes(value));
    return value;
  }
  if (typeof value !== "object" || ancestors.has(value)) fail();
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) fail();
  const keys = Reflect.ownKeys(value);
  // Only the top-level issues list gets the higher issue ceiling.
  const maxMembers = memberLimit;
  if (keys.length > maxMembers + (array ? 1 : 0)) fail();
  ancestors.add(value);
  charge(budget, 2);
  if (array) {
    const length = Object.getOwnPropertyDescriptor(value, "length")!.value as number;
    if (length > maxMembers || keys.length !== length + 1) fail();
    const result: GpuModelMetadataValue[] = [];
    for (let i = 0; i < length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) fail();
      if (i > 0) charge(budget, 1);
      result.push(snapshot(descriptor.value, depth + 1, budget, ancestors));
    }
    ancestors.delete(value);
    return Object.freeze(result);
  }
  const result: Record<string, GpuModelMetadataValue> = {};
  let count = 0;
  for (const key of keys) {
    if (typeof key !== "string" || key.length > 256 || ["__proto__", "constructor", "prototype"].includes(key)) fail();
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!("value" in descriptor) || !descriptor.enumerable) fail();
    if (count++ > 0) charge(budget, 1);
    charge(budget, textBytes(key) + 1);
    result[key] = snapshot(descriptor.value, depth + 1, budget, ancestors, depth === 0 && key === "issues" ? GPU_MODEL_DIAGNOSTIC_LIMITS.issues : GPU_MODEL_DIAGNOSTIC_LIMITS.members);
  }
  ancestors.delete(value);
  return Object.freeze(result);
}
function record(value: GpuModelMetadataValue | undefined): Record<string, GpuModelMetadataValue> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return fail();
  return value as Record<string, GpuModelMetadataValue>;
}
function keysOnly(value: Record<string, GpuModelMetadataValue>, allowed: readonly string[]): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) fail();
}
function enumValue<T extends string>(value: GpuModelMetadataValue | undefined, allowed: readonly T[]): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) return fail();
  return value as T;
}
function hasUnsafeText(value: string): boolean {
  for (const character of value) {
    const point = character.codePointAt(0)!;
    if (point < 0x20 || (point >= 0x7f && point <= 0x9f) || (point >= 0x2028 && point <= 0x202e) || (point >= 0x2066 && point <= 0x2069) || (point >= 0xd800 && point <= 0xdfff)) return true;
  }
  return false;
}
function text(value: GpuModelMetadataValue | undefined, max: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max || hasUnsafeText(value)) return fail();
  return value;
}
function boolean(value: GpuModelMetadataValue | undefined): boolean {
  if (typeof value !== "boolean") return fail();
  return value;
}
function parseIssue(value: GpuModelMetadataValue): GpuModelConversionIssue {
  const issue = record(value);
  const kind = enumValue(issue.kind, ["violation", "unsupported", "warning", "loss"] as const);
  const base = { code: text(issue.code, 128), path: text(issue.path, 1024), message: text(issue.message, 2048) };
  if (!base.path.startsWith("/")) fail();
  const common = ["kind", "code", "path", "message"];
  if (kind === "violation") {
    keysOnly(issue, [...common, "ruleId", "originalValue", "repairApplied"]);
    if (!Object.hasOwn(issue, "originalValue")) fail();
    return { ...base, kind, ruleId: text(issue.ruleId, 128), originalValue: issue.originalValue!, repairApplied: boolean(issue.repairApplied) };
  }
  if (kind === "loss") {
    keysOnly(issue, [...common, "effect"]);
    return { ...base, kind, effect: enumValue(issue.effect, ["dropped", "approximated"] as const) };
  }
  keysOnly(issue, common);
  return { ...base, kind };
}

/**
 * Validate a bounded inert adapter report and build an immutable conversion ledger.
 * Strict rejects violations. Tolerant/forensic require explicit applied repairs.
 * Callers must scrub source snapshots before supplying them and must not log them.
 * Throws GpuModelDiagnosticsError for malformed or over-budget reports.
 */
export function evaluateGpuModelDiagnostics(value: unknown): GpuModelDiagnosticReport {
  const budget: Budget = { values: 0, bytes: 0 };
  const args = record(snapshot(value, 0, budget, new Set()));
  keysOnly(args, ["standard", "mode", "allowLoss", "issues", "rawSource", "maxEvidenceBytes"]);
  const standard = enumValue(args.standard, ["gltf-glb", "obj-mtl", "fbx", "cad-bim"] as const);
  const mode = args.mode === undefined ? "strict" : enumValue(args.mode, ["strict", "tolerant", "forensic"] as const);
  const allowLoss = args.allowLoss === undefined ? false : boolean(args.allowLoss);
  if (args.maxEvidenceBytes !== undefined && (typeof args.maxEvidenceBytes !== "number" || !Number.isSafeInteger(args.maxEvidenceBytes) || args.maxEvidenceBytes < 1 || args.maxEvidenceBytes > GPU_MODEL_DIAGNOSTIC_LIMITS.bytes || budget.bytes > args.maxEvidenceBytes)) fail();
  if (mode === "forensic" ? !Object.hasOwn(args, "rawSource") : Object.hasOwn(args, "rawSource")) fail();
  if (!Array.isArray(args.issues) || args.issues.length > GPU_MODEL_DIAGNOSTIC_LIMITS.issues) fail();
  const issues = args.issues.map(parseIssue);
  const lossPaths = new Set(issues.filter(issue => issue.kind === "loss").map(issue => issue.path));
  const diagnostics: GpuModelConversionDiagnostic[] = [];
  const repairs: GpuModelRepairRecord[] = [];
  const losses: (GpuModelConversionLoss & { readonly severity: "warning" })[] = [];
  let accepted = true;
  for (const issue of issues) {
    const base = { code: issue.code, path: issue.path, message: issue.message };
    if (issue.kind === "violation") {
      const rule = GPU_MODEL_REPAIR_RULES.find(rule => rule.id === issue.ruleId);
      const requiresLoss = ["invalid-indices", "missing-texture-path", "malformed-material-reference"].includes(issue.ruleId);
      const repaired = mode !== "strict" && issue.repairApplied && rule && (rule.standardIds as readonly string[]).includes(standard) && (!requiresLoss || lossPaths.has(issue.path));
      if (repaired) {
        repairs.push(Object.freeze({ ruleId: rule.id, originalValue: issue.originalValue, action: rule.action, severity: rule.severity, affectedPath: issue.path, confidence: rule.confidence }));
        diagnostics.push(Object.freeze({ ...base, kind: "repair", severity: rule.severity, ruleId: rule.id }));
      } else {
        accepted = false;
        diagnostics.push(Object.freeze({ ...base, kind: "blocking-error", severity: "error", ruleId: issue.ruleId }));
      }
    } else if (issue.kind === "unsupported") {
      accepted = false;
      diagnostics.push(Object.freeze({ ...issue, severity: "error" }));
    } else if (issue.kind === "loss") {
      if (!allowLoss) accepted = false;
      const loss = Object.freeze({ ...issue, severity: "warning" as const });
      losses.push(loss);
      diagnostics.push(loss);
    } else diagnostics.push(Object.freeze({ ...issue, severity: "warning" }));
  }
  return Object.freeze({ mode, standard, accepted, diagnostics: Object.freeze(diagnostics), repairs: Object.freeze(repairs), losses: Object.freeze(losses), ...(mode === "forensic" ? { rawSource: args.rawSource! } : {}) });
}
