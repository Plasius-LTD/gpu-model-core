import {
  parseModelGpuCompatibilityDescriptor,
  type GpuInterfaceRef,
  type ModelGpuCompatibilityDescriptor,
  type ShaderStyleProfileRef,
} from "@plasius/gpu-shader";
import type {
  ModelAssetManifest,
  ModelAssetManifestInput,
} from "@plasius/asset-contracts";

export type {
  GpuInterfaceRef,
  ModelAssetManifest,
  ModelAssetManifestInput,
  ModelGpuCompatibilityDescriptor,
  ShaderStyleProfileRef,
};

/** GPU compatibility fields carried by the canonical flat model asset manifest. */
export const MODEL_GPU_COMPATIBILITY_FIELDS = Object.freeze([
  "assetId",
  "version",
  "gpuInterface",
  "modelAbiHash",
  "providedSemantics",
  "defaultStyleProfile",
] as const);

/**
 * GPU-facing projection of the canonical `ModelAssetManifest` published by
 * `@plasius/asset-contracts`.
 *
 * Promotion state and compatible-profile catalog results deliberately do not
 * belong to this contract. They can change without republishing model bytes.
 */
export type GpuCompatibleModelResource = Pick<
  ModelAssetManifest,
  typeof MODEL_GPU_COMPATIBILITY_FIELDS[number]
>;

/**
 * Parses the canonical model-facing GPU compatibility descriptor.
 *
 * Final assembled WGSL remains authoritative: this function delegates GPU
 * reference, digest-grammar, semantic, and exact-version enforcement to
 * `@plasius/gpu-shader` and returns its detached, deeply frozen contract
 * value. It does not derive an ABI hash or verify fetched bytes.
 */
export function parseCanonicalModelGpuCompatibility(
  value: unknown,
): ModelGpuCompatibilityDescriptor {
  return parseModelGpuCompatibilityDescriptor(value);
}

/**
 * Reads the canonical flat GPU fields from a model asset/resource manifest and
 * maps them to the shader framework's immutable model descriptor.
 * Ordinary accessor-backed or inherited fields are rejected without reading
 * their values. Proxy reflection traps can run because JavaScript provides no
 * browser-safe proxy detector, but any exception they throw is replaced by a
 * constant diagnostic without preserving the original cause.
 */
export function readModelGpuCompatibility(
  resource: unknown,
): ModelGpuCompatibilityDescriptor {
  if (typeof resource !== "object" || resource === null || Array.isArray(resource)) {
    throw new TypeError("Model resource must be an object with canonical GPU compatibility fields.");
  }

  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(resource) as object | null;
  } catch {
    throw new TypeError("Model resource GPU compatibility fields could not be inspected safely.");
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Model resource must be a plain JSON object.");
  }

  const snapshot = Object.create(null) as Record<
    typeof MODEL_GPU_COMPATIBILITY_FIELDS[number],
    unknown
  >;
  for (const field of MODEL_GPU_COMPATIBILITY_FIELDS) {
    let property: PropertyDescriptor | undefined;
    try {
      property = Object.getOwnPropertyDescriptor(resource, field);
    } catch {
      throw new TypeError("Model resource GPU compatibility fields could not be inspected safely.");
    }
    if (!property || !property.enumerable || !("value" in property)) {
      throw new TypeError(`Model resource must expose ${field} as an enumerable own data property.`);
    }
    snapshot[field] = property.value;
  }

  return parseCanonicalModelGpuCompatibility({
    modelId: snapshot.assetId,
    version: snapshot.version,
    gpuInterface: snapshot.gpuInterface,
    modelAbiHash: snapshot.modelAbiHash,
    providedSemantics: snapshot.providedSemantics,
    defaultStyleProfile: snapshot.defaultStyleProfile,
  });
}
