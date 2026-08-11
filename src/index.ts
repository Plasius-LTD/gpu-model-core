/** Package identity and rollout metadata for the initial repository baseline. */
export const packageName = "@plasius/gpu-model-core" as const;

export const packageBootstrap = Object.freeze({
  packageName,
  featureFlag: "gpu.model.conversion.enabled",
  status: "bootstrap",
} as const);

export { asSha256Hex } from "@plasius/gpu-shader";
export type { Sha256Hex } from "@plasius/gpu-shader";

export {
  MODEL_GPU_COMPATIBILITY_FIELDS,
  parseCanonicalModelGpuCompatibility,
  readModelGpuCompatibility,
} from "./model-gpu-compatibility.js";

export type {
  GpuCompatibleModelResource,
  GpuInterfaceRef,
  ModelAssetManifest,
  ModelAssetManifestInput,
  ModelGpuCompatibilityDescriptor,
  ShaderStyleProfileRef,
} from "./model-gpu-compatibility.js";
