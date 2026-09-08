import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  evaluateGpuModelDiagnostics, GPU_MODEL_REPAIR_RULES, GPU_MODEL_DIAGNOSTIC_LIMITS,
  GpuModelDiagnosticsError,
} from "../src/index.js";

const fixtures = ["gltf", "obj", "fbx", "cad"].map(name => JSON.parse(readFileSync(new URL(`./fixtures/diagnostics/${name}-corrupt.fixture.json`, import.meta.url), "utf8")));
const standard = (format: string) => ({ gltf: "gltf-glb", obj: "obj-mtl", fbx: "fbx", "cad-bim": "cad-bim" })[format];
const violation = (ruleId = "missing-normals", repairApplied = true) => ({ kind: "violation", ruleId, code: "fixture", path: "/mesh/0", message: "Synthetic malformed model", originalValue: null, repairApplied });
const input = (changes: Record<string, unknown> = {}) => ({ standard: "gltf-glb", mode: "tolerant", issues: [violation()], ...changes });

describe("canonical diagnostic policy fixtures", () => {
  for (const fixture of fixtures) {
    const issues = fixture.issues.flatMap((issue: any) => {
      const result = [{ ...issue, kind: "violation", code: issue.ruleId, repairApplied: true }];
      if (["invalid-indices", "missing-texture-path", "malformed-material-reference"].includes(issue.ruleId)) result.push({ kind: "loss", code: "fallback", path: issue.path, message: "Adapter explicitly records lost source fidelity", effect: "dropped" } as any);
      return result;
    });
    it(`${fixture.id}: rejects every violation in strict mode`, () => {
      const report = evaluateGpuModelDiagnostics({ standard: standard(fixture.format), issues });
      expect(report.mode).toBe("strict");
      expect(report.accepted).toBe(false);
      expect(report.repairs).toEqual([]);
      expect(report.diagnostics.filter(d => d.kind === "blocking-error")).toHaveLength(fixture.issues.length);
      expect(report).not.toHaveProperty("rawSource");
    });
    for (const mode of ["tolerant", "forensic"]) {
      it(`${fixture.id}: ${mode} records complete applied repairs`, () => {
        const report = evaluateGpuModelDiagnostics({ standard: standard(fixture.format), mode, allowLoss: true, issues, ...(mode === "forensic" ? { rawSource: fixture.rawPayload } : {}) });
        expect(report.accepted).toBe(true);
        expect(report.repairs).toHaveLength(fixture.issues.length);
        fixture.issues.forEach((issue: any, i: number) => {
          const rule = GPU_MODEL_REPAIR_RULES.find(r => r.id === issue.ruleId)!;
          expect(report.repairs[i]).toEqual({ ruleId: issue.ruleId, originalValue: issue.originalValue, action: rule.action, severity: rule.severity, affectedPath: issue.path, confidence: rule.confidence });
        });
        if (mode === "forensic") {
          expect(report.rawSource).toEqual(fixture.rawPayload);
          expect(report.rawSource).not.toBe(fixture.rawPayload);
        } else expect(report).not.toHaveProperty("rawSource");
      });
    }
  }
});

describe("fail-closed diagnostic decisions", () => {
  it("accepts valid empty reports and nonblocking warnings", () => {
    expect(evaluateGpuModelDiagnostics(input({ issues: [] })).accepted).toBe(true);
    const report = evaluateGpuModelDiagnostics(input({ issues: [{ kind: "warning", code: "hint", path: "/", message: "Hint" }] }));
    expect(report.accepted).toBe(true);
    expect(report.diagnostics[0]).toMatchObject({ kind: "warning", severity: "warning" });
  });
  it.each(["strict", "tolerant", "forensic"])("rejects unknown and unsupported cases in %s", mode => {
    const report = evaluateGpuModelDiagnostics(input({ mode, ...(mode === "forensic" ? { rawSource: null } : {}), issues: [violation("unknown"), { kind: "unsupported", code: "extension", path: "/extensions/0", message: "Unsupported extension" }] }));
    expect(report.accepted).toBe(false);
    expect(report.repairs).toEqual([]);
    expect(report.diagnostics.map(d => d.kind)).toEqual(["blocking-error", "unsupported"]);
  });
  it("requires an actually applied repair and a matching standard", () => {
    expect(evaluateGpuModelDiagnostics(input({ issues: [violation("missing-normals", false)] })).accepted).toBe(false);
    expect(evaluateGpuModelDiagnostics(input({ standard: "obj-mtl", issues: [violation("non-normalized-weights")] })).accepted).toBe(false);
  });
  it("requires matching loss records for lossy fallbacks and explicit loss consent", () => {
    expect(evaluateGpuModelDiagnostics(input({ allowLoss: true, issues: [violation("invalid-indices")] })).accepted).toBe(false);
    const loss = { kind: "loss", code: "primitive-dropped", path: "/mesh/0", message: "Invalid primitive removed", effect: "dropped" };
    expect(evaluateGpuModelDiagnostics(input({ issues: [violation("invalid-indices"), loss] })).accepted).toBe(false);
    const report = evaluateGpuModelDiagnostics(input({ allowLoss: true, issues: [loss, violation("invalid-indices")] }));
    expect(report.accepted).toBe(true);
    expect(report.losses).toEqual([{ ...loss, severity: "warning" }]);
    expect(evaluateGpuModelDiagnostics(input({ allowLoss: true, issues: [violation("invalid-indices"), { ...loss, path: "/elsewhere" }] })).accepted).toBe(false);
  });
  it("keeps bounded forensic evidence on rejected conversions", () => {
    const report = evaluateGpuModelDiagnostics(input({ mode: "forensic", rawSource: { broken: true }, issues: [violation("unknown")] }));
    expect(report.accepted).toBe(false);
    expect(report.rawSource).toEqual({ broken: true });
  });
  it("owns and deeply freezes evidence without mutating caller data", () => {
    const raw = { nodes: [1, { label: "safe" }] };
    const args = input({ mode: "forensic", rawSource: raw, issues: [{ ...violation(), originalValue: raw }] });
    const first = evaluateGpuModelDiagnostics(args);
    expect(evaluateGpuModelDiagnostics(args)).toEqual(first);
    raw.nodes.push(2);
    expect((first.rawSource as any).nodes).toHaveLength(2);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.repairs[0]?.originalValue)).toBe(true);
    expect(() => (first.repairs as any).push({})).toThrow();
    expect(() => (first.rawSource as any).nodes.push(3)).toThrow();
  });
});

describe("bounded inert report input", () => {
  it.each([
    null, [], { standard: "unknown", issues: [] }, input({ mode: "unknown" }), input({ extra: true }),
    input({ allowLoss: "yes" }), input({ issues: [null] }), input({ issues: [{ ...violation(), extra: true }] }),
    input({ issues: [{ ...violation(), kind: "made-up" }] }), input({ issues: [{ ...violation(), repairApplied: "yes" }] }),
    input({ issues: [{ ...violation(), path: "missing-leading-slash" }] }),
    input({ issues: [{ ...violation(), message: "\u0000" }] }),
    input({ issues: [{ ...violation(), originalValue: NaN }] }),
    input({ issues: [{ ...violation(), originalValue: undefined }] }),
    input({ issues: [{ kind: "loss", code: "x", path: "/", message: "x", effect: "unknown" }] }),
    input({ mode: "forensic" }), input({ rawSource: {} }), input({ maxEvidenceBytes: 0 }),
    input({ maxEvidenceBytes: GPU_MODEL_DIAGNOSTIC_LIMITS.bytes + 1 }),
  ])("rejects malformed input without including its values in errors", value => {
    expect(() => evaluateGpuModelDiagnostics(value)).toThrow(GpuModelDiagnosticsError);
  });
  it("bounds bytes exactly and rejects rather than truncates", () => {
    const value = input({ mode: "forensic", rawSource: "é🙂" });
    const bytes = new TextEncoder().encode(JSON.stringify(value)).length;
    // The supplied limit itself is part of the bounded report input.
    const withLimit = { ...value, maxEvidenceBytes: bytes + 30 };
    expect(evaluateGpuModelDiagnostics(withLimit).rawSource).toBe("é🙂");
    expect(() => evaluateGpuModelDiagnostics({ ...value, maxEvidenceBytes: 10 })).toThrow();
  });
  it("rejects count, depth, string and array overflow", () => {
    expect(() => evaluateGpuModelDiagnostics(input({ issues: Array(4097).fill(violation()) }))).toThrow();
    let deep: unknown = null;
    for (let i = 0; i < 14; i++) deep = { deep };
    for (const rawSource of [deep, "x".repeat(65537), Array(1025).fill(0), Object.fromEntries(Array.from({ length: 1025 }, (_, i) => [String(i), 0]))]) {
      expect(() => evaluateGpuModelDiagnostics(input({ mode: "forensic", rawSource }))).toThrow();
    }
  });
  it("rejects cycles, accessors, symbols, dangerous keys, sparse arrays and exotic objects", () => {
    const cyclic: any = {}; cyclic.self = cyclic;
    let invoked = false;
    const accessor = Object.defineProperty({}, "value", { enumerable: true, get() { invoked = true; return 1; } });
    const symbol = { [Symbol("hidden")]: 1 };
    const hidden = Object.defineProperty({}, "hidden", { value: 1 });
    const sparse = Array(2);
    const decorated: any = []; decorated.extra = 1;
    for (const rawSource of [cyclic, accessor, symbol, hidden, sparse, decorated, new Date(), new Uint8Array(2), 1n, () => 1, JSON.parse('{"__proto__":{}}')]) {
      expect(() => evaluateGpuModelDiagnostics(input({ mode: "forensic", rawSource }))).toThrow();
    }
    expect(invoked).toBe(false);
  });
  it("does not echo private payload or invoke toJSON when rejecting", () => {
    let called = false;
    const rawSource = { toJSON() { called = true; return "fixture-private-marker"; } };
    try { evaluateGpuModelDiagnostics(input({ mode: "forensic", rawSource })); throw new Error("missing rejection"); }
    catch (error) { expect(error).toBeInstanceOf(GpuModelDiagnosticsError); expect(String(error)).not.toContain("fixture-private-marker"); }
    expect(called).toBe(false);
  });
});

describe("aggregate budgets and conservative repair actions", () => {
  it("uses the exact UTF-8 input size for tightened limits", () => {
    const args: Record<string, unknown> = input({ mode: "forensic", rawSource: "é🙂", maxEvidenceBytes: 300 });
    let bytes = new TextEncoder().encode(JSON.stringify(args)).length;
    args.maxEvidenceBytes = bytes;
    bytes = new TextEncoder().encode(JSON.stringify(args)).length;
    args.maxEvidenceBytes = bytes;
    expect(evaluateGpuModelDiagnostics(args).accepted).toBe(true);
    expect(() => evaluateGpuModelDiagnostics({ ...args, maxEvidenceBytes: bytes - 1 })).toThrow();
  });
  it("bounds total values and aggregate bytes across otherwise legal evidence", () => {
    for (const rawSource of [Array.from({ length: 20 }, () => Array(1000).fill(0)), Array(20).fill("x".repeat(65536))]) {
      expect(() => evaluateGpuModelDiagnostics(input({ mode: "forensic", rawSource }))).toThrow();
    }
  });
  it("does not silently clamp an invalid index or resolve an unsafe texture URL", () => {
    expect(GPU_MODEL_REPAIR_RULES.find(r => r.id === "invalid-indices")?.action).toBe("Drop the invalid primitive.");
    expect(GPU_MODEL_REPAIR_RULES.find(r => r.id === "missing-texture-path")?.action).toBe("Leave the missing or unsafe texture slot unresolved.");
  });
  it("supports approximated loss and retains booleans, escaped text and null-prototype JSON", () => {
    const rawSource = Object.assign(Object.create(null), { value: false, escaped: "\n", emoji: "🙂", zero: -0 });
    const report = evaluateGpuModelDiagnostics(input({ mode: "forensic", rawSource, allowLoss: true, issues: [{ kind: "loss", code: "approx", path: "/cad", message: "Tessellated surface", effect: "approximated" }] }));
    expect(report.accepted).toBe(true);
    expect(report.rawSource).toEqual({ value: false, escaped: "\n", emoji: "🙂", zero: 0 });
  });
  it.each(["\u202e", "\u2066", "\ud800", "\u007f"])("rejects unsafe diagnostic text %s", message => {
    expect(() => evaluateGpuModelDiagnostics(input({ issues: [{ ...violation(), message }] }))).toThrow();
  });
  it("rejects oversized keys and diagnostic fields", () => {
    expect(() => evaluateGpuModelDiagnostics(input({ mode: "forensic", rawSource: { ["x".repeat(257)]: true } }))).toThrow();
    expect(() => evaluateGpuModelDiagnostics(input({ issues: [{ ...violation(), code: "x".repeat(129) }] }))).toThrow();
    expect(() => evaluateGpuModelDiagnostics(input({ issues: [{ ...violation(), ruleId: "" }] }))).toThrow();
    const missing = { ...violation() } as any; delete missing.originalValue;
    expect(() => evaluateGpuModelDiagnostics(input({ issues: [missing] }))).toThrow();
  });
});

// Compile-time API ownership checks are kept out of executable mutation paths.
function readonlyContracts(report: ReturnType<typeof evaluateGpuModelDiagnostics>) {
  // @ts-expect-error Published rule tables are readonly.
  GPU_MODEL_REPAIR_RULES.push(GPU_MODEL_REPAIR_RULES[0]);
  // @ts-expect-error Report ledgers are readonly.
  report.repairs.push(report.repairs[0]!);
  // @ts-expect-error Repair snapshots are readonly.
  report.repairs[0]!.originalValue = null;
}
