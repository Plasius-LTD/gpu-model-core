import { describe, expect, it } from "vitest";
import { createModelAssetManifest } from "@plasius/asset-contracts";
import {
  MODEL_GPU_COMPATIBILITY_FIELDS,
  asSha256Hex,
  parseCanonicalModelGpuCompatibility,
  readModelGpuCompatibility,
  type GpuCompatibleModelResource,
  type ModelGpuCompatibilityDescriptor,
} from "../src/index.js";

const MODEL_ABI_HASH = asSha256Hex("1".repeat(64));
const INTERFACE_ABI_HASH = asSha256Hex("2".repeat(64));
const MANIFEST_SHA256 = asSha256Hex("3".repeat(64));
const PROFILE_SHA256 = asSha256Hex("4".repeat(64));
const FILE_SHA256 = asSha256Hex("5".repeat(64));

type DeepMutable<T> = T extends string | number | boolean | bigint | symbol | null | undefined
  ? T
  : T extends readonly (infer Item)[]
  ? DeepMutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
    : T;

function validDescriptor(): ModelGpuCompatibilityDescriptor {
  return {
    modelId: "model-character",
    version: "2026.07.15-1",
    gpuInterface: {
      interfaceId: "interface.character",
      interfaceVersion: "2026.07.15-1",
      manifestUri: "https://assets.example.invalid/gpu-interfaces/interface.character/2026.07.15-1/manifest.json",
      manifestSha256: MANIFEST_SHA256,
      interfaceAbiHash: INTERFACE_ABI_HASH,
      modelAbiHash: MODEL_ABI_HASH,
    },
    modelAbiHash: MODEL_ABI_HASH,
    providedSemantics: ["position", "normal", "material.base-color"],
    defaultStyleProfile: {
      profileId: "profile.realistic",
      version: "3",
      manifestUri: "https://assets.example.invalid/shader-style-profiles/profile.realistic/3/manifest.json",
      manifestSha256: PROFILE_SHA256,
    },
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mutableDescriptor(): DeepMutable<ModelGpuCompatibilityDescriptor> {
  return clone(validDescriptor()) as unknown as DeepMutable<ModelGpuCompatibilityDescriptor>;
}

function validModelAssetManifest() {
  const gpu = validDescriptor();
  return createModelAssetManifest({
    assetKind: "model",
    assetId: gpu.modelId,
    version: gpu.version,
    entrypoint: "model.glb",
    files: [{
      path: "model.glb",
      byteLength: 4,
      sha256: FILE_SHA256,
      contentType: "model/gltf-binary",
      role: "model",
    }],
    sourceAdapter: "local-import",
    createdAt: "2026-07-15T00:00:00.000Z",
    gpuInterface: gpu.gpuInterface,
    modelAbiHash: gpu.modelAbiHash,
    providedSemantics: gpu.providedSemantics,
    defaultStyleProfile: gpu.defaultStyleProfile,
  });
}

describe("canonical model GPU compatibility", () => {
  it("exports the canonical resource field and parses exact immutable references", () => {
    expect(MODEL_GPU_COMPATIBILITY_FIELDS).toEqual([
      "assetId",
      "version",
      "gpuInterface",
      "modelAbiHash",
      "providedSemantics",
      "defaultStyleProfile",
    ]);

    const parsed = parseCanonicalModelGpuCompatibility(validDescriptor());

    expect(parsed.modelAbiHash).toBe(MODEL_ABI_HASH);
    expect(parsed.defaultStyleProfile?.profileId).toBe("profile.realistic");
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.gpuInterface)).toBe(true);
    expect(Object.isFrozen(parsed.providedSemantics)).toBe(true);
    expect(Object.isFrozen(parsed.defaultStyleProfile)).toBe(true);
  });

  it("detaches the returned contract from caller-owned objects", () => {
    const input = mutableDescriptor();
    const parsed = parseCanonicalModelGpuCompatibility(input);

    input.gpuInterface.interfaceId = "interface.changed";
    input.providedSemantics[0] = "changed";
    if (input.defaultStyleProfile) input.defaultStyleProfile.profileId = "profile.changed";

    expect(parsed.gpuInterface.interfaceId).toBe("interface.character");
    expect(parsed.providedSemantics[0]).toBe("position");
    expect(parsed.defaultStyleProfile?.profileId).toBe("profile.realistic");
  });

  it("rejects ABI drift between the model and its exact interface reference", () => {
    const input = mutableDescriptor();
    input.gpuInterface.modelAbiHash = asSha256Hex("9".repeat(64));

    expect(() => parseCanonicalModelGpuCompatibility(input)).toThrow(
      /modelAbiHash differs/u,
    );
  });

  it.each([
    [["position", "position"], /duplicate position/u],
    [["position", "normal value"], /safe token/u],
  ])("rejects duplicate or invalid provided semantics", (providedSemantics, message) => {
    const input = mutableDescriptor();
    input.providedSemantics = providedSemantics;

    expect(() => parseCanonicalModelGpuCompatibility(input)).toThrow(message);
  });

  it.each([
    ["model version", (input: DeepMutable<ModelGpuCompatibilityDescriptor>) => { input.version = "latest"; }],
    ["interface version", (input: DeepMutable<ModelGpuCompatibilityDescriptor>) => { input.gpuInterface.interfaceVersion = "1.x"; }],
    ["profile version", (input: DeepMutable<ModelGpuCompatibilityDescriptor>) => {
      if (input.defaultStyleProfile) input.defaultStyleProfile.version = "stable";
    }],
  ])("rejects mutable %s aliases", (_label, mutate) => {
    const input = mutableDescriptor();
    mutate(input);

    expect(() => parseCanonicalModelGpuCompatibility(input)).toThrow(
      /immutable asset version/u,
    );
  });

  it("accepts an explicitly absent default profile", () => {
    const input = mutableDescriptor();
    input.defaultStyleProfile = null;

    expect(parseCanonicalModelGpuCompatibility(input).defaultStyleProfile).toBeNull();
  });

  it("keeps catalog and promotion state outside the immutable model contract", () => {
    const input = {
      ...clone(validDescriptor()),
      compatibleProfiles: [],
    };

    expect(() => parseCanonicalModelGpuCompatibility(input)).toThrow(
      /compatibleProfiles is not part of this contract version/u,
    );
  });

  it("reads the flat GPU projection of the canonical model asset manifest", () => {
    const resource: GpuCompatibleModelResource = validModelAssetManifest();
    const parsed = readModelGpuCompatibility(resource);

    expect(parsed.modelId).toBe("model-character");
    expect(parsed.gpuInterface.interfaceId).toBe("interface.character");

    const inherited = Object.create(validModelAssetManifest()) as object;
    expect(() => readModelGpuCompatibility(inherited)).toThrow(/plain JSON object/u);
  });

  it("rejects an accessor-backed resource field without invoking it", () => {
    let reads = 0;
    const resource = { ...validModelAssetManifest() };
    Object.defineProperty(resource, "gpuInterface", {
      enumerable: true,
      get() {
        reads += 1;
        return validDescriptor().gpuInterface;
      },
    });

    expect(() => readModelGpuCompatibility(resource)).toThrow(/gpuInterface as an enumerable own data property/u);
    expect(reads).toBe(0);
  });

  it("rejects non-enumerable fields and class instances that do not round-trip as JSON objects", () => {
    const hidden = { ...validModelAssetManifest() };
    Object.defineProperty(hidden, "gpuInterface", {
      enumerable: false,
      value: validDescriptor().gpuInterface,
    });
    expect(() => readModelGpuCompatibility(hidden)).toThrow(/enumerable own data property/u);

    class ModelResource {
      constructor(manifest: ReturnType<typeof validModelAssetManifest>) {
        Object.assign(this, manifest);
      }
    }
    expect(() => readModelGpuCompatibility(new ModelResource(validModelAssetManifest())))
      .toThrow(/plain JSON object/u);
  });

  it.each([
    ["prototype", () => new Proxy({}, {
      getPrototypeOf() {
        throw new Error("prototype-provider-secret");
      },
    })],
    ["property descriptor", () => new Proxy({}, {
      getOwnPropertyDescriptor() {
        throw new Error("descriptor-provider-secret");
      },
    })],
  ])("sanitizes a hostile proxy %s trap", (_label, createResource) => {
    let thrown: unknown;
    try {
      readModelGpuCompatibility(createResource());
    } catch (cause) {
      thrown = cause;
    }

    expect(thrown).toBeInstanceOf(TypeError);
    expect((thrown as Error).message).toBe(
      "Model resource GPU compatibility fields could not be inspected safely.",
    );
    expect(String(thrown)).not.toContain("provider-secret");
    expect((thrown as Error & { cause?: unknown }).cause).toBeUndefined();
  });

  it.each([null, [], "model", 42])("rejects a non-object model resource", (value) => {
    expect(() => readModelGpuCompatibility(value)).toThrow(/must be an object/u);
  });
});
