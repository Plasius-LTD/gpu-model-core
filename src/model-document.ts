/** The only document version accepted by the v1 runtime validator. */
export const GPU_MODEL_DOCUMENT_SCHEMA_VERSION = "plasius.gpu-model-document/1" as const;

/** Canonical basis shared by conversion, processing, and rendering packages. */
export const CANONICAL_GPU_MODEL_COORDINATE_SYSTEM = Object.freeze({
  unit: "metre",
  upAxis: "y",
  forwardAxis: "-z",
  handedness: "right",
  winding: "counter-clockwise",
  origin: "floor-centred",
} as const);

/** Fixed defensive ceilings for one canonical v1 document. */
export const GPU_MODEL_DOCUMENT_LIMITS = Object.freeze({
  roots: 4_096,
  nodes: 65_536,
  resources: 16_384,
  accessors: 262_144,
  accessorElements: 16_000_000,
  meshes: 65_536,
  primitives: 262_144,
  materials: 65_536,
  textures: 65_536,
  skeletons: 4_096,
  joints: 65_536,
  skins: 4_096,
  blendShapes: 65_536,
  blendShapeDeltas: 262_144,
  blendShapeAccessorReferences: 786_432,
  animations: 4_096,
  analyticGeometry: 4_096,
  diagnostics: 4_096,
  sceneEdges: 65_535,
  primitiveAttributes: 262_144,
  skinJoints: 65_536,
  weightVertices: 1_000_000,
  weightInfluences: 8_000_000,
  animationSamplers: 65_536,
  animationChannels: 262_144,
  animationValues: 8_000_000,
  geometryIndexElements: 16_000_000,
  geometryWorldAccessorInstances: 262_144,
  geometryWorldVertices: 16_000_000,
  identifierLength: 128,
  nameLength: 512,
  diagnosticMessageLength: 2_048,
  metadataDepth: 8,
  metadataValues: 4_096,
  metadataObjectKeys: 128,
  metadataArrayLength: 512,
  metadataKeyLength: 128,
  metadataStringLength: 2_048,
} as const);

export interface GpuModelResourceVerificationLimits {
  readonly maxResourceBytes: number;
  readonly maxAggregateBytes: number;
  readonly maxImageBytes: number;
  readonly maxAggregateImageBytes: number;
  readonly maxImageDimension: number;
  readonly maxImagePixels: number;
  readonly chunkBytes: number;
  readonly timeoutMs: number;
}

/** Default verification budgets. Callers may tighten, but never raise, them. */
export const GPU_MODEL_RESOURCE_VERIFICATION_LIMITS: Readonly<GpuModelResourceVerificationLimits> = Object.freeze({
  maxResourceBytes: 100 * 1024 * 1024,
  maxAggregateBytes: 164 * 1024 * 1024,
  maxImageBytes: 64 * 1024 * 1024,
  maxAggregateImageBytes: 64 * 1024 * 1024,
  maxImageDimension: 4_096,
  maxImagePixels: 4_096 * 4_096,
  chunkBytes: 1024 * 1024,
  timeoutMs: 30_000,
} as const);

/** Stable machine-readable validation failure categories. */
export type GpuModelDocumentErrorCode =
  | "invalid-type"
  | "invalid-value"
  | "unknown-key"
  | "limit-exceeded"
  | "feature-disabled"
  | "unsupported-feature"
  | "duplicate-id"
  | "missing-reference"
  | "invalid-reference"
  | "graph-cycle"
  | "payload-length-mismatch"
  | "resource-unverified"
  | "resource-verification-failed"
  | "resource-budget-exceeded";

function escapeDiagnosticText(value: string, maximum: number): string {
  let output = "";
  for (const character of value) {
    const point = character.codePointAt(0)!;
    const unsafe = point < 0x20
      || (point >= 0x7f && point <= 0x9f)
      || point === 0x2028
      || point === 0x2029
      || (point >= 0x202a && point <= 0x202e)
      || (point >= 0x2066 && point <= 0x2069)
      || (point >= 0xd800 && point <= 0xdfff);
    output += character === "\\"
      ? "\\\\"
      : unsafe
      ? `\\u${point.toString(16).padStart(point <= 0xffff ? 4 : 6, "0")}`
      : character;
    if (output.length >= maximum) break;
  }
  return output.slice(0, maximum);
}

/** Bounded validation error safe to return across worker boundaries. */
export class GpuModelDocumentError extends TypeError {
  public readonly code: GpuModelDocumentErrorCode;
  public readonly path: string;

  public constructor(code: GpuModelDocumentErrorCode, path: string, detail: string) {
    const safePath = escapeDiagnosticText(path, 256);
    const safeDetail = escapeDiagnosticText(detail, 512);
    super(`Invalid GPU model document at ${safePath}: ${safeDetail}`);
    this.name = "GpuModelDocumentError";
    this.code = code;
    this.path = safePath;
  }
}

/** JSON-compatible value accepted by bounded canonical metadata fields. */
export type GpuModelMetadataValue =
  | null
  | boolean
  | number
  | string
  | readonly GpuModelMetadataValue[]
  | { readonly [key: string]: GpuModelMetadataValue };

/** Immutable, safe-keyed source/extension metadata. */
export type GpuModelMetadata = Readonly<Record<string, GpuModelMetadataValue>>;
export type GpuModelSourceMetadata = GpuModelMetadata;
export type GpuModelVec2 = readonly [number, number];
export type GpuModelVec3 = readonly [number, number, number];
export type GpuModelVec4 = readonly [number, number, number, number];
/** Column-major 4 x 4 affine matrix. */
export type GpuModelMatrix4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

export interface GpuModelTransformTrs {
  readonly translation: GpuModelVec3;
  readonly rotation: GpuModelVec4;
  readonly scale: GpuModelVec3;
}

export interface GpuModelBounds {
  readonly min: GpuModelVec3;
  readonly max: GpuModelVec3;
}

export interface GpuModelNode {
  readonly id: string;
  readonly name?: string;
  readonly children: readonly string[];
  readonly meshId?: string;
  readonly skinId?: string;
  readonly localMatrix: GpuModelMatrix4;
  readonly metadata?: GpuModelMetadata;
}

export type GpuModelResourceKind = "buffer" | "image";

/** Privately attestable immutable payload. Verification status is never shape-based. */
export interface GpuModelResource {
  readonly id: string;
  readonly kind: GpuModelResourceKind;
  readonly contentHash: string;
  readonly byteLength: number;
  readonly mimeType: string;
  readonly payload: Blob;
}

export interface GpuModelResourceVerificationContext {
  readonly resourceId: string;
  readonly kind: GpuModelResourceKind;
  readonly declaredMimeType: string;
  readonly byteLength: number;
  readonly signal?: AbortSignal;
}

export interface GpuModelResourceInspection {
  readonly valid: boolean;
  readonly detectedMimeType: string;
  readonly width?: number;
  readonly height?: number;
}

/** Trusted, injected worker boundary for streaming digest and payload inspection. */
export interface GpuModelResourceVerificationPort {
  digestSha256(
    chunks: AsyncIterable<Uint8Array>,
    context: GpuModelResourceVerificationContext,
  ): Promise<string>;
  inspectResource(
    chunks: AsyncIterable<Uint8Array>,
    context: GpuModelResourceVerificationContext,
  ): Promise<GpuModelResourceInspection>;
}

export interface GpuModelResourceVerificationOptions {
  readonly signal?: AbortSignal;
  readonly limits?: Partial<GpuModelResourceVerificationLimits>;
}

export type GpuModelAccessorComponentType = "i8" | "u8" | "i16" | "u16" | "u32" | "f32";
export type GpuModelAccessorElementType = "scalar" | "vec2" | "vec3" | "vec4" | "mat2" | "mat3" | "mat4";

export interface GpuModelAccessor {
  readonly id: string;
  readonly resourceId: string;
  readonly byteOffset: number;
  readonly byteStride?: number;
  readonly count: number;
  readonly componentType: GpuModelAccessorComponentType;
  readonly elementType: GpuModelAccessorElementType;
  readonly normalized?: boolean;
  readonly min?: readonly number[];
  readonly max?: readonly number[];
}

export interface GpuModelPrimitiveAttribute {
  readonly semantic: string;
  readonly accessorId: string;
}

export type GpuModelPrimitiveTopology = "points" | "lines" | "line-strip" | "triangles" | "triangle-strip";

export interface GpuModelPrimitive {
  readonly id: string;
  readonly topology: GpuModelPrimitiveTopology;
  readonly attributes: readonly GpuModelPrimitiveAttribute[];
  readonly indicesAccessorId?: string;
  readonly materialId?: string;
  readonly metadata?: GpuModelMetadata;
}

export interface GpuModelMesh {
  readonly id: string;
  readonly name?: string;
  readonly primitives: readonly GpuModelPrimitive[];
  readonly metadata?: GpuModelMetadata;
}

export type GpuModelTextureColorSpace = "srgb" | "linear" | "normal-map" | "data";
export type GpuModelTextureUsage =
  | "base-color"
  | "metallic-roughness"
  | "normal"
  | "occlusion"
  | "emissive"
  | "transmission"
  | "clearcoat"
  | "clearcoat-roughness"
  | "clearcoat-normal"
  | "sheen-color"
  | "sheen-roughness";

export interface GpuModelTextureTransform {
  readonly offset?: GpuModelVec2;
  readonly rotationRadians?: number;
  readonly scale?: GpuModelVec2;
}

export interface GpuModelTextureBinding {
  readonly textureId: string;
  readonly samplerId?: string;
  readonly texCoordSet?: number;
  readonly transform?: GpuModelTextureTransform;
  readonly colorSpace: GpuModelTextureColorSpace;
  readonly intendedUsage: GpuModelTextureUsage;
}

export type GpuModelAlphaMode = "opaque" | "mask" | "blend";
export type GpuModelMaterialWorkflow = "metallic-roughness" | "specular-glossiness" | "unlit" | "custom";

export interface GpuModelMaterialTextures {
  readonly baseColor?: GpuModelTextureBinding;
  readonly metallicRoughness?: GpuModelTextureBinding;
  readonly normal?: GpuModelTextureBinding;
  readonly occlusion?: GpuModelTextureBinding;
  readonly emissive?: GpuModelTextureBinding;
  readonly transmission?: GpuModelTextureBinding;
  readonly clearcoat?: GpuModelTextureBinding;
  readonly clearcoatRoughness?: GpuModelTextureBinding;
  readonly clearcoatNormal?: GpuModelTextureBinding;
  readonly sheenColor?: GpuModelTextureBinding;
  readonly sheenRoughness?: GpuModelTextureBinding;
}

export interface GpuModelMaterial {
  readonly id: string;
  readonly name?: string;
  readonly workflow: GpuModelMaterialWorkflow;
  readonly alphaMode: GpuModelAlphaMode;
  readonly alphaCutoff?: number;
  readonly doubleSided?: boolean;
  readonly baseColorFactor: GpuModelVec4;
  readonly metallicFactor?: number;
  readonly roughnessFactor?: number;
  readonly emissiveFactor?: GpuModelVec3;
  readonly transmissionFactor?: number;
  readonly clearcoatFactor?: number;
  readonly clearcoatRoughnessFactor?: number;
  readonly sheenColorFactor?: GpuModelVec3;
  readonly sheenRoughnessFactor?: number;
  readonly normalScale?: number;
  readonly occlusionStrength?: number;
  readonly textures: GpuModelMaterialTextures;
  readonly extensions: GpuModelMetadata;
  readonly sourceMetadata: GpuModelSourceMetadata;
}

export type GpuModelTextureWrap = "repeat" | "mirrored-repeat" | "clamp-to-edge";
export interface GpuModelTextureSampler {
  readonly id: string;
  readonly wrapS?: GpuModelTextureWrap;
  readonly wrapT?: GpuModelTextureWrap;
  readonly minFilter?: string;
  readonly magFilter?: string;
  readonly mipFilter?: "nearest" | "linear";
}

export type GpuModelTextureEmbeddingPolicy = "inherit-source" | "prefer-embedded" | "prefer-external" | "forbid-embedding";

/** Texture fidelity node; embedded bytes are addressed through imageResourceId. */
export interface GpuModelTexture {
  readonly id: string;
  readonly fileName?: string;
  readonly relativePath?: string;
  readonly mimeType?: string;
  readonly contentHash: string;
  readonly imageResourceId: string;
  readonly byteLength?: number;
  readonly intendedUsage: readonly GpuModelTextureUsage[];
  readonly colorSpace: GpuModelTextureColorSpace;
  readonly sampler?: GpuModelTextureSampler;
  readonly exportEmbeddingPolicy: GpuModelTextureEmbeddingPolicy;
  readonly sourceMetadata: GpuModelSourceMetadata;
}

export interface GpuModelSkeleton {
  readonly id: string;
  readonly name?: string;
  readonly jointIds: readonly string[];
  readonly rootJointIds: readonly string[];
  readonly sourceMetadata: GpuModelSourceMetadata;
}

export interface GpuModelJoint {
  readonly id: string;
  readonly name?: string;
  readonly nodeId: string;
  readonly parentJointId?: string;
  readonly restLocalTransform: GpuModelTransformTrs;
  readonly inverseBindMatrix?: GpuModelMatrix4;
  readonly sourceMetadata: GpuModelSourceMetadata;
}

export interface GpuModelVertexWeightSet {
  readonly primitiveId: string;
  readonly influencesPerVertex: number;
  readonly joints: readonly (readonly number[])[];
  readonly weights: readonly (readonly number[])[];
}

export interface GpuModelSkin {
  readonly id: string;
  readonly skeletonId: string;
  readonly jointIds: readonly string[];
  readonly inverseBindMatrices: readonly GpuModelMatrix4[];
  readonly weightSets: readonly GpuModelVertexWeightSet[];
  readonly sourceMetadata: GpuModelSourceMetadata;
}

export interface GpuModelBlendShapeDelta {
  readonly primitiveId: string;
  readonly positionAccessorId?: string;
  readonly normalAccessorId?: string;
  readonly tangentAccessorId?: string;
}

export interface GpuModelBlendShape {
  readonly id: string;
  readonly meshId: string;
  readonly name?: string;
  readonly defaultWeight?: number;
  readonly deltas: readonly GpuModelBlendShapeDelta[];
  readonly sourceMetadata: GpuModelSourceMetadata;
}

export type GpuModelAnimationInterpolation = "step" | "linear" | "cubic-spline";
export interface GpuModelAnimationSampler {
  readonly id: string;
  readonly inputAccessorId: string;
  readonly outputAccessorId: string;
  readonly inputTimesSeconds: readonly number[];
  readonly outputValues: readonly number[];
  readonly interpolation: GpuModelAnimationInterpolation;
  readonly sourceMetadata: GpuModelSourceMetadata;
}

export type GpuModelAnimationTargetType = "node-translation" | "node-rotation" | "node-scale" | "weights";
export interface GpuModelAnimationChannel {
  readonly id: string;
  readonly samplerId: string;
  readonly targetType: GpuModelAnimationTargetType;
  readonly targetId: string;
  readonly sourceMetadata: GpuModelSourceMetadata;
}

export interface GpuModelAnimation {
  readonly id: string;
  readonly name?: string;
  readonly durationSeconds: number;
  readonly samplers: readonly GpuModelAnimationSampler[];
  readonly channels: readonly GpuModelAnimationChannel[];
  readonly sourceMetadata: GpuModelSourceMetadata;
}

export type GpuModelSourceUnit = "metre" | "millimetre" | "centimetre" | "inch" | "foot" | "unitless";
export interface GpuModelAnalyticGeometry {
  readonly id: string;
  readonly kind: "brep-placeholder";
  readonly sourceResourceId: string;
  readonly sourceUnit: GpuModelSourceUnit;
  readonly tessellatedMeshId?: string;
  readonly metadata?: GpuModelMetadata;
}

export interface GpuModelProvenance {
  readonly sourceFormat: string;
  readonly sourceContentHash: string;
  readonly converterId: string;
  readonly converterVersion: string;
  readonly provider?: string;
  readonly sourceIdentifier?: string;
  readonly metadata?: GpuModelMetadata;
}

export type GpuModelDiagnosticSeverity = "info" | "warning" | "error";
export interface GpuModelDiagnostic {
  readonly severity: GpuModelDiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly metadata?: GpuModelMetadata;
}

/** Complete immutable renderer-neutral canonical model document v1. */
export interface GpuModelDocument {
  readonly schemaVersion: typeof GPU_MODEL_DOCUMENT_SCHEMA_VERSION;
  readonly coordinateSystem: typeof CANONICAL_GPU_MODEL_COORDINATE_SYSTEM;
  readonly roots: readonly string[];
  readonly nodes: readonly GpuModelNode[];
  readonly resources: readonly GpuModelResource[];
  readonly accessors: readonly GpuModelAccessor[];
  readonly meshes: readonly GpuModelMesh[];
  readonly materials: readonly GpuModelMaterial[];
  readonly textures: readonly GpuModelTexture[];
  readonly skeletons: readonly GpuModelSkeleton[];
  readonly joints: readonly GpuModelJoint[];
  readonly skins: readonly GpuModelSkin[];
  readonly blendShapes: readonly GpuModelBlendShape[];
  readonly animations: readonly GpuModelAnimation[];
  readonly analyticGeometry: readonly GpuModelAnalyticGeometry[];
  readonly bounds: GpuModelBounds;
  readonly provenance: GpuModelProvenance;
  readonly diagnostics: readonly GpuModelDiagnostic[];
  readonly metadata: GpuModelMetadata;
}

type UnknownRecord = Record<string, unknown>;
type VerificationLimits = Readonly<GpuModelResourceVerificationLimits>;

const PROHIBITED_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const METADATA_KEY = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/u;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9.+_-]{0,127}$/u;
const ATTRIBUTE_SEMANTIC = /^(?:POSITION|NORMAL|TANGENT|TEXCOORD_[0-7]|COLOR_[0-7]|JOINTS_[0-7]|WEIGHTS_[0-7]|_[A-Z][A-Z0-9_]{0,62})$/u;
const SHA_256 = /^[a-f0-9]{64}$/u;
const MIME_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,63}$/u;
const RELATIVE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)(?![a-z][a-z0-9+.-]*:).{1,2048}$/iu;
const FILE_NAME = /^(?!\.{1,2}$)(?!.*[\\/]).{1,512}$/u;
const GPU_FLOAT_MAX = 3.402_823_466_385_288_6e38;
const EPSILON = 1e-5;
const BOUNDS_ABSOLUTE_EPSILON = 1e-5;
const COMPONENT_BYTES: Readonly<Record<GpuModelAccessorComponentType, number>> = Object.freeze({
  i8: 1, u8: 1, i16: 2, u16: 2, u32: 4, f32: 4,
});
const ELEMENT_COMPONENTS: Readonly<Record<GpuModelAccessorElementType, number>> = Object.freeze({
  scalar: 1, vec2: 2, vec3: 3, vec4: 4, mat2: 4, mat3: 9, mat4: 16,
});
const COMPONENT_RANGES: Readonly<Record<GpuModelAccessorComponentType, readonly [number, number, boolean]>> = Object.freeze({
  i8: [-128, 127, true],
  u8: [0, 255, true],
  i16: [-32_768, 32_767, true],
  u16: [0, 65_535, true],
  u32: [0, 4_294_967_295, true],
  f32: [-GPU_FLOAT_MAX, GPU_FLOAT_MAX, false],
});
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/ktx2", "image/png", "image/webp"]);
const BUFFER_MIME_TYPES = new Set(["application/octet-stream", "application/vnd.plasius.gpu-buffer"]);
const TEXTURE_USAGES: readonly GpuModelTextureUsage[] = Object.freeze([
  "base-color", "metallic-roughness", "normal", "occlusion", "emissive", "transmission",
  "clearcoat", "clearcoat-roughness", "clearcoat-normal", "sheen-color", "sheen-roughness",
]);
const MATERIAL_TEXTURE_SLOTS = Object.freeze({
  baseColor: "base-color",
  metallicRoughness: "metallic-roughness",
  normal: "normal",
  occlusion: "occlusion",
  emissive: "emissive",
  transmission: "transmission",
  clearcoat: "clearcoat",
  clearcoatRoughness: "clearcoat-roughness",
  clearcoatNormal: "clearcoat-normal",
  sheenColor: "sheen-color",
  sheenRoughness: "sheen-roughness",
} as const satisfies Readonly<Record<keyof GpuModelMaterialTextures, GpuModelTextureUsage>>);

const verifiedResources = new WeakSet<object>();
const verifiedResourceBytes = new WeakMap<object, Uint8Array>();
const verifiedResourceEvidence = new WeakMap<object, GpuModelResourceInspection>();
const validatedDocuments = new WeakSet<object>();

interface DocumentBudget {
  metadataValues: number;
  sceneEdges: number;
  primitiveAttributes: number;
  accessorElements: number;
  primitives: number;
  skinJoints: number;
  weightVertices: number;
  weightInfluences: number;
  animationSamplers: number;
  animationChannels: number;
  animationValues: number;
  blendShapeDeltas: number;
  blendShapeAccessorReferences: number;
  geometryIndexElements: number;
  geometryWorldAccessorInstances: number;
  geometryWorldVertices: number;
}

function fail(code: GpuModelDocumentErrorCode, path: string, detail: string): never {
  throw new GpuModelDocumentError(code, path, detail);
}

function readRecord(value: unknown, path: string, allowedKeys: readonly string[]): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail("invalid-type", path, "expected an object");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return fail("invalid-type", path, "expected a plain object");
  }
  const allowed = new Set(allowedKeys);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") return fail("unknown-key", path, "symbol keys are not permitted");
    if (PROHIBITED_KEYS.has(key)) return fail("unknown-key", `${path}.${key}`, "prohibited object key");
    if (!allowed.has(key)) return fail("unknown-key", `${path}.${key}`, "unknown key");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      return fail("invalid-type", `${path}.${key}`, "properties must be enumerable data properties");
    }
  }
  return value as UnknownRecord;
}

function requireKey(record: UnknownRecord, key: string, path: string): unknown {
  if (!Object.hasOwn(record, key)) return fail("invalid-value", `${path}.${key}`, "required key is missing");
  return record[key];
}

function readArray(value: unknown, path: string, maximum: number, minimum = 0): readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    return fail("invalid-type", path, "expected an array");
  }
  if (value.length < minimum || value.length > maximum) {
    return fail("limit-exceeded", path, `array length must be between ${minimum} and ${maximum}`);
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      return fail("invalid-type", `${path}[${index}]`, "array entries must be enumerable data properties");
    }
  }
  for (const key of Reflect.ownKeys(value)) {
    if (key === "length") continue;
    if (typeof key === "string" && /^(?:0|[1-9][0-9]*)$/u.test(key) && Number(key) < value.length) continue;
    return fail("unknown-key", path, "array properties and symbol keys are not permitted");
  }
  return value;
}

function hasInvalidText(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029) return true;
    if (code >= 0xd800 && code <= 0xdbff) {
      const trailing = value.charCodeAt(index + 1);
      if (!Number.isInteger(trailing) || trailing < 0xdc00 || trailing > 0xdfff) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}

function readString(value: unknown, path: string, maximum: number, pattern?: RegExp): string {
  if (typeof value !== "string") return fail("invalid-type", path, "expected a string");
  if (value.length === 0 || value.length > maximum) {
    return fail("limit-exceeded", path, `string length must be between 1 and ${maximum}`);
  }
  if (hasInvalidText(value)) return fail("invalid-value", path, "string must contain well-formed text without control characters");
  if (pattern && !pattern.test(value)) return fail("invalid-value", path, "string has an invalid format");
  return value;
}

function readId(value: unknown, path: string): string {
  return readString(value, path, GPU_MODEL_DOCUMENT_LIMITS.identifierLength, IDENTIFIER);
}

function readSha256(value: unknown, path: string): string {
  if (typeof value !== "string" || !SHA_256.test(value)) {
    return fail("invalid-value", path, "expected a lowercase hexadecimal SHA-256 digest");
  }
  return value;
}

function readBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") return fail("invalid-type", path, "expected a boolean");
  return value;
}

function readFinite(value: unknown, path: string, minimum?: number, maximum?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fail("invalid-value", path, "expected a finite number");
  const lower = minimum ?? -GPU_FLOAT_MAX;
  const upper = maximum ?? GPU_FLOAT_MAX;
  if (value < lower || value > upper) return fail("invalid-value", path, `number must be between ${String(lower)} and ${String(upper)}`);
  return Object.is(value, -0) ? 0 : value;
}

function readSafeInteger(value: unknown, path: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    return fail("invalid-value", path, `expected a safe integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function readEnum<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    return fail("invalid-value", path, `expected one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

function readNumberTuple(value: unknown, path: string, length: number, minimum?: number, maximum?: number): readonly number[] {
  const input = readArray(value, path, length, length);
  return Object.freeze(input.map((entry, index) => readFinite(entry, `${path}[${index}]`, minimum, maximum)));
}

function readOptional<T>(record: UnknownRecord, key: string, parser: (value: unknown, path: string) => T, path: string): T | undefined {
  if (!Object.hasOwn(record, key)) return undefined;
  return parser(record[key], `${path}.${key}`);
}

function assignOptional<T extends object, K extends PropertyKey, V>(target: T, key: K, value: V | undefined): void {
  if (value !== undefined) Object.assign(target, { [key]: value });
}

function consumeBudget(budget: DocumentBudget, key: keyof DocumentBudget, amount: number, maximum: number, path: string, label: string): void {
  budget[key] += amount;
  if (!Number.isSafeInteger(budget[key]) || budget[key] > maximum) {
    return fail("limit-exceeded", path, `document ${label} count exceeds the limit`);
  }
}

function readMetadataValue(value: unknown, path: string, depth: number, budget: DocumentBudget): GpuModelMetadataValue {
  consumeBudget(budget, "metadataValues", 1, GPU_MODEL_DOCUMENT_LIMITS.metadataValues, path, "metadata value");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return readFinite(value, path);
  if (typeof value === "string") return readString(value, path, GPU_MODEL_DOCUMENT_LIMITS.metadataStringLength);
  if (depth >= GPU_MODEL_DOCUMENT_LIMITS.metadataDepth) return fail("limit-exceeded", path, "metadata nesting is too deep");
  if (Array.isArray(value)) {
    const input = readArray(value, path, GPU_MODEL_DOCUMENT_LIMITS.metadataArrayLength);
    return Object.freeze(input.map((entry, index) => readMetadataValue(entry, `${path}[${index}]`, depth + 1, budget)));
  }
  if (typeof value !== "object" || value === null) return fail("invalid-type", path, "metadata value is not JSON-compatible");
  const record = value as object;
  const prototype = Object.getPrototypeOf(record);
  if (prototype !== Object.prototype && prototype !== null) return fail("invalid-type", path, "metadata objects must be plain objects");
  const keys = Reflect.ownKeys(record);
  if (keys.length > GPU_MODEL_DOCUMENT_LIMITS.metadataObjectKeys) return fail("limit-exceeded", path, "metadata object has too many keys");
  const output: Record<string, GpuModelMetadataValue> = {};
  for (const key of keys) {
    if (typeof key !== "string") return fail("unknown-key", path, "metadata symbol keys are not permitted");
    if (PROHIBITED_KEYS.has(key)) return fail("unknown-key", `${path}.${key}`, "prohibited metadata key");
    readString(key, `${path}.[key]`, GPU_MODEL_DOCUMENT_LIMITS.metadataKeyLength, METADATA_KEY);
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return fail("invalid-type", `${path}.${key}`, "metadata properties must be enumerable data properties");
    output[key] = readMetadataValue(descriptor.value, `${path}.${key}`, depth + 1, budget);
  }
  return Object.freeze(output);
}

function readMetadata(value: unknown, path: string, budget: DocumentBudget): GpuModelMetadata {
  const parsed = readMetadataValue(value, path, 0, budget);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return fail("invalid-type", path, "metadata must be an object");
  return parsed as GpuModelMetadata;
}

function parseCoordinateSystem(value: unknown): typeof CANONICAL_GPU_MODEL_COORDINATE_SYSTEM {
  const path = "$.coordinateSystem";
  const record = readRecord(value, path, ["unit", "upAxis", "forwardAxis", "handedness", "winding", "origin"]);
  for (const [key, expected] of Object.entries(CANONICAL_GPU_MODEL_COORDINATE_SYSTEM)) {
    if (requireKey(record, key, path) !== expected) return fail("invalid-value", `${path}.${key}`, "coordinate system is not canonical");
  }
  return CANONICAL_GPU_MODEL_COORDINATE_SYSTEM;
}

function parseMatrix(value: unknown, path: string, requireAffine = true): GpuModelMatrix4 {
  const matrix = readNumberTuple(value, path, 16) as GpuModelMatrix4;
  if (requireAffine && (matrix[3] !== 0 || matrix[7] !== 0 || matrix[11] !== 0 || matrix[15] !== 1)) {
    return fail("invalid-value", path, "matrix must be affine, with a [0, 0, 0, 1] projective row");
  }
  return matrix;
}

function parseBounds(value: unknown, path: string): GpuModelBounds {
  const record = readRecord(value, path, ["min", "max"]);
  const min = readNumberTuple(requireKey(record, "min", path), `${path}.min`, 3) as GpuModelVec3;
  const max = readNumberTuple(requireKey(record, "max", path), `${path}.max`, 3) as GpuModelVec3;
  for (let index = 0; index < 3; index += 1) {
    if (min[index]! > max[index]!) return fail("invalid-value", path, "bounds min cannot exceed max");
  }
  return { min, max };
}

function parseTransformTrs(value: unknown, path: string): GpuModelTransformTrs {
  const record = readRecord(value, path, ["translation", "rotation", "scale"]);
  const translation = readNumberTuple(requireKey(record, "translation", path), `${path}.translation`, 3) as GpuModelVec3;
  const rotation = readNumberTuple(requireKey(record, "rotation", path), `${path}.rotation`, 4) as GpuModelVec4;
  const scale = readNumberTuple(requireKey(record, "scale", path), `${path}.scale`, 3) as GpuModelVec3;
  const magnitude = Math.hypot(...rotation);
  if (!almostEqual(magnitude, 1, 1e-4)) return fail("invalid-value", `${path}.rotation`, "rotation quaternion must be normalized");
  return { translation, rotation, scale };
}

const blobSizeGetter = Object.getOwnPropertyDescriptor(Blob.prototype, "size")!.get!;
const blobTypeGetter = Object.getOwnPropertyDescriptor(Blob.prototype, "type")!.get!;
const blobSlice = Blob.prototype.slice;
const blobArrayBuffer = Blob.prototype.arrayBuffer;

function intrinsicBlobSize(blob: Blob): number {
  return Reflect.apply(blobSizeGetter, blob, []) as number;
}

function intrinsicBlobType(blob: Blob): string {
  return Reflect.apply(blobTypeGetter, blob, []) as string;
}

function intrinsicBlobSlice(blob: Blob, start: number, end: number, contentType?: string): Blob {
  return Reflect.apply(blobSlice, blob, contentType === undefined ? [start, end] : [start, end, contentType]) as Blob;
}

function intrinsicBlobArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return Reflect.apply(blobArrayBuffer, blob, []) as Promise<ArrayBuffer>;
}

function parseResourceHeader(value: unknown, path: string): GpuModelResource {
  const record = readRecord(value, path, ["id", "kind", "contentHash", "byteLength", "mimeType", "payload"]);
  const kind = readEnum(requireKey(record, "kind", path), `${path}.kind`, ["buffer", "image"] as const);
  const mimeType = readString(requireKey(record, "mimeType", path), `${path}.mimeType`, 128, MIME_TYPE).toLowerCase();
  if (kind === "image" ? !IMAGE_MIME_TYPES.has(mimeType) : !BUFFER_MIME_TYPES.has(mimeType)) {
    return fail("invalid-value", `${path}.mimeType`, `unsupported ${kind} MIME type`);
  }
  const payload = requireKey(record, "payload", path);
  if (!(payload instanceof Blob)) return fail("invalid-type", `${path}.payload`, "expected an immutable Blob payload");
  if (Object.getPrototypeOf(payload) !== Blob.prototype || Reflect.ownKeys(payload).some((key) => typeof key === "string")) {
    return fail("invalid-type", `${path}.payload`, "expected a native Blob without caller-defined properties");
  }
  const byteLength = readSafeInteger(requireKey(record, "byteLength", path), `${path}.byteLength`, 1);
  if (intrinsicBlobSize(payload) !== byteLength) return fail("payload-length-mismatch", `${path}.payload`, "payload byte length does not match byteLength");
  const payloadType = intrinsicBlobType(payload);
  if (payloadType && payloadType.toLowerCase() !== mimeType) return fail("invalid-value", `${path}.payload`, "payload MIME type does not match mimeType");
  return {
    id: readId(requireKey(record, "id", path), `${path}.id`),
    kind,
    contentHash: readSha256(requireKey(record, "contentHash", path), `${path}.contentHash`),
    byteLength,
    mimeType,
    payload,
  };
}

function resolveVerificationLimits(options?: GpuModelResourceVerificationOptions): VerificationLimits {
  const overrides = options?.limits;
  if (overrides === undefined) return GPU_MODEL_RESOURCE_VERIFICATION_LIMITS;
  const record = readRecord(overrides, "$.verification.limits", Object.keys(GPU_MODEL_RESOURCE_VERIFICATION_LIMITS));
  const output = { ...GPU_MODEL_RESOURCE_VERIFICATION_LIMITS };
  for (const [key, ceiling] of Object.entries(GPU_MODEL_RESOURCE_VERIFICATION_LIMITS) as Array<[keyof VerificationLimits, number]>) {
    if (!Object.hasOwn(record, key)) continue;
    const value = readSafeInteger(record[key], `$.verification.limits.${key}`, 1, ceiling);
    Object.assign(output, { [key]: value });
  }
  if (output.maxImageBytes > output.maxResourceBytes) output.maxImageBytes = output.maxResourceBytes;
  if (output.maxAggregateImageBytes > output.maxAggregateBytes) output.maxAggregateImageBytes = output.maxAggregateBytes;
  return Object.freeze(output);
}

function preflightResourceBudget(resources: readonly GpuModelResource[], limits: VerificationLimits): void {
  let aggregate = 0;
  let aggregateImages = 0;
  for (let index = 0; index < resources.length; index += 1) {
    const resource = resources[index]!;
    const path = `$.resources[${index}]`;
    if (resource.byteLength > limits.maxResourceBytes) return fail("resource-budget-exceeded", `${path}.byteLength`, "resource byte budget exceeded");
    if (resource.kind === "image" && resource.byteLength > limits.maxImageBytes) {
      return fail("resource-budget-exceeded", `${path}.byteLength`, "image resource byte budget exceeded");
    }
    aggregate += resource.byteLength;
    if (!Number.isSafeInteger(aggregate) || aggregate > limits.maxAggregateBytes) {
      return fail("resource-budget-exceeded", "$.resources", "aggregate resource byte budget exceeded");
    }
    if (resource.kind === "image") {
      aggregateImages += resource.byteLength;
      if (!Number.isSafeInteger(aggregateImages) || aggregateImages > limits.maxAggregateImageBytes) {
        return fail("resource-budget-exceeded", "$.resources", "aggregate image byte budget exceeded");
      }
    }
  }
}

function assertVerifiedResourceEvidence(
  resource: GpuModelResource,
  limits: VerificationLimits,
  path: string,
): void {
  const evidence = verifiedResourceEvidence.get(resource);
  if (!evidence) return fail("resource-unverified", path, "verified resource inspection evidence is unavailable");
  if (resource.kind !== "image") return;
  const width = evidence.width;
  const height = evidence.height;
  if (width === undefined || height === undefined) {
    return fail("resource-verification-failed", path, "verified image inspection evidence is incomplete");
  }
  if (width > limits.maxImageDimension || height > limits.maxImageDimension || width * height > limits.maxImagePixels) {
    return fail("resource-budget-exceeded", path, "image dimension budget exceeded");
  }
}

function cachedResourceWithinLimits(
  resource: GpuModelResource,
  limits: VerificationLimits,
  path: string,
): GpuModelResource {
  preflightResourceBudget([resource], limits);
  assertVerifiedResourceEvidence(resource, limits, path);
  return resource;
}

function verificationAbortError(signal: AbortSignal, path: string): GpuModelDocumentError {
  return signal.reason instanceof GpuModelDocumentError
    ? signal.reason
    : new GpuModelDocumentError("resource-verification-failed", path, "resource verification was aborted");
}

function throwIfVerificationAborted(signal: AbortSignal, path: string): void {
  if (signal.aborted) throw verificationAbortError(signal, path);
}

function createBlobChunks(
  blob: Blob,
  chunkBytes: number,
  observed: { bytes: number },
  signal: AbortSignal,
  path: string,
  snapshot?: Uint8Array,
): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      const size = intrinsicBlobSize(blob);
      for (let offset = 0; offset < size; offset += chunkBytes) {
        throwIfVerificationAborted(signal, path);
        const end = Math.min(size, offset + chunkBytes);
        const chunk = new Uint8Array(await intrinsicBlobArrayBuffer(intrinsicBlobSlice(blob, offset, end)));
        throwIfVerificationAborted(signal, path);
        observed.bytes += chunk.byteLength;
        if (snapshot) snapshot.set(chunk, offset);
        yield chunk;
      }
      throwIfVerificationAborted(signal, path);
    },
  };
}

interface VerificationDeadline {
  readonly signal: AbortSignal;
  race<T>(operation: () => Promise<T> | T): Promise<T>;
  throwIfAborted(): void;
  dispose(): void;
}

function createVerificationDeadline(timeoutMs: number, callerSignal: AbortSignal | undefined, path: string): VerificationDeadline {
  const controller = new AbortController();
  const abort = (detail: string): void => {
    if (!controller.signal.aborted) {
      controller.abort(new GpuModelDocumentError("resource-verification-failed", path, detail));
    }
  };
  const callerAbort = (): void => abort("resource verification was aborted");
  if (callerSignal?.aborted) callerAbort();
  else callerSignal?.addEventListener("abort", callerAbort, { once: true });
  const timeout = setTimeout(() => abort("resource verification deadline exceeded"), timeoutMs);
  timeout.unref?.();
  return {
    signal: controller.signal,
    async race<T>(operation: () => Promise<T> | T): Promise<T> {
      throwIfVerificationAborted(controller.signal, path);
      let abortListener: (() => void) | undefined;
      const aborted = new Promise<never>((_resolve, reject) => {
        abortListener = () => reject(verificationAbortError(controller.signal, path));
        controller.signal.addEventListener("abort", abortListener, { once: true });
        if (controller.signal.aborted) abortListener();
      });
      try {
        const running = Promise.resolve().then(() => {
          throwIfVerificationAborted(controller.signal, path);
          return operation();
        });
        return await Promise.race([running, aborted]);
      } finally {
        if (abortListener) controller.signal.removeEventListener("abort", abortListener);
      }
    },
    throwIfAborted(): void {
      throwIfVerificationAborted(controller.signal, path);
    },
    dispose(): void {
      clearTimeout(timeout);
      callerSignal?.removeEventListener("abort", callerAbort);
    },
  };
}

function parseInspection(value: unknown, path: string): GpuModelResourceInspection {
  const record = readRecord(value, path, ["valid", "detectedMimeType", "width", "height"]);
  const output: Record<string, unknown> = {
    valid: readBoolean(requireKey(record, "valid", path), `${path}.valid`),
    detectedMimeType: readString(requireKey(record, "detectedMimeType", path), `${path}.detectedMimeType`, 128, MIME_TYPE).toLowerCase(),
  };
  assignOptional(output, "width", readOptional(record, "width", (entry, entryPath) => readSafeInteger(entry, entryPath, 1), path));
  assignOptional(output, "height", readOptional(record, "height", (entry, entryPath) => readSafeInteger(entry, entryPath, 1), path));
  return output as unknown as GpuModelResourceInspection;
}

function bytesStartWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return bytes.byteLength >= signature.length && signature.every((value, index) => bytes[index] === value);
}

function validateImageMagic(resource: GpuModelResource, bytes: Uint8Array, inspection: GpuModelResourceInspection, path: string): void {
  if (inspection.width === undefined || inspection.height === undefined) {
    return fail("resource-verification-failed", path, "image inspection must report dimensions");
  }
  let signatureValid = false;
  if (resource.mimeType === "image/png") {
    signatureValid = bytes.byteLength >= 24 && bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (signatureValid) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (view.getUint32(16) !== inspection.width || view.getUint32(20) !== inspection.height) {
        return fail("resource-verification-failed", path, "image dimensions disagree with the PNG header");
      }
    }
  } else if (resource.mimeType === "image/jpeg") {
    signatureValid = bytes.byteLength >= 4 && bytesStartWith(bytes, [0xff, 0xd8, 0xff]) && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  } else if (resource.mimeType === "image/webp") {
    signatureValid = bytes.byteLength >= 16
      && bytesStartWith(bytes, [0x52, 0x49, 0x46, 0x46])
      && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
  } else if (resource.mimeType === "image/ktx2") {
    signatureValid = bytesStartWith(bytes, [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (!signatureValid) return fail("resource-verification-failed", path, "image signature is invalid for the declared MIME type");
}

async function verifyParsedResource(
  resource: GpuModelResource,
  port: GpuModelResourceVerificationPort,
  limits: VerificationLimits,
  options?: GpuModelResourceVerificationOptions,
  path = "$.resource",
): Promise<GpuModelResource> {
  if (options?.signal?.aborted) return fail("resource-verification-failed", path, "resource verification was aborted");
  if (verifiedResources.has(resource) && verifiedResourceBytes.has(resource)) {
    return cachedResourceWithinLimits(resource, limits, path);
  }
  preflightResourceBudget([resource], limits);
  if (typeof port !== "object" || port === null || typeof port.inspectResource !== "function" || typeof port.digestSha256 !== "function") {
    return fail("invalid-type", "$.verificationPort", "expected digest and inspection functions");
  }
  const deadline = createVerificationDeadline(limits.timeoutMs, options?.signal, path);
  try {
    const context: GpuModelResourceVerificationContext = Object.freeze({
      resourceId: resource.id,
      kind: resource.kind,
      declaredMimeType: resource.mimeType,
      byteLength: resource.byteLength,
      signal: deadline.signal,
    });
    const inspectionObserved = { bytes: 0 };
    let inspectionValue: unknown;
    try {
      inspectionValue = await deadline.race(() => port.inspectResource(
        createBlobChunks(resource.payload, limits.chunkBytes, inspectionObserved, deadline.signal, path),
        context,
      ));
    } catch (error) {
      if (error instanceof GpuModelDocumentError) throw error;
      deadline.throwIfAborted();
      return fail("resource-verification-failed", path, "resource inspection failed");
    }
    deadline.throwIfAborted();
    if (inspectionObserved.bytes !== resource.byteLength) return fail("resource-verification-failed", path, "resource inspection did not consume the complete payload");
    const inspection = parseInspection(inspectionValue, `${path}.inspection`);
    if (!inspection.valid) return fail("resource-verification-failed", path, "resource inspection rejected the payload");
    if (inspection.detectedMimeType !== resource.mimeType) return fail("resource-verification-failed", path, "detected MIME type does not match the declaration");
    if (resource.kind === "image") {
      const width = inspection.width;
      const height = inspection.height;
      if (width === undefined || height === undefined) return fail("resource-verification-failed", path, "image inspection did not report dimensions");
      if (width > limits.maxImageDimension || height > limits.maxImageDimension || width * height > limits.maxImagePixels) {
        return fail("resource-budget-exceeded", path, "image dimension budget exceeded");
      }
    } else if (inspection.width !== undefined || inspection.height !== undefined) {
      return fail("resource-verification-failed", path, "buffer inspection must not report image dimensions");
    }
    const snapshot = new Uint8Array(resource.byteLength);
    const digestObserved = { bytes: 0 };
    let digest: unknown;
    try {
      digest = await deadline.race(() => port.digestSha256(
        createBlobChunks(resource.payload, limits.chunkBytes, digestObserved, deadline.signal, path, snapshot),
        context,
      ));
    } catch (error) {
      if (error instanceof GpuModelDocumentError) throw error;
      deadline.throwIfAborted();
      return fail("resource-verification-failed", path, "resource digest verification failed");
    }
    deadline.throwIfAborted();
    if (digestObserved.bytes !== resource.byteLength) return fail("resource-verification-failed", path, "resource digest did not consume the complete payload");
    if (typeof digest !== "string" || !SHA_256.test(digest) || digest !== resource.contentHash) {
      return fail("resource-verification-failed", path, "resource digest does not match contentHash");
    }
    if (resource.kind === "image") validateImageMagic(resource, snapshot, inspection, path);
    const verified = Object.freeze({
      ...resource,
      payload: new Blob([snapshot], { type: resource.mimeType }),
    });
    verifiedResources.add(verified);
    verifiedResourceBytes.set(verified, snapshot);
    verifiedResourceEvidence.set(verified, Object.freeze({ ...inspection }));
    return verified;
  } finally {
    deadline.dispose();
  }
}

/** Verifies one bounded resource and returns a privately branded immutable value. */
export async function verifyGpuModelResource(
  value: unknown,
  port: GpuModelResourceVerificationPort,
  options?: GpuModelResourceVerificationOptions,
): Promise<GpuModelResource> {
  try {
    const limits = resolveVerificationLimits(options);
    const resource = typeof value === "object"
      && value !== null
      && verifiedResources.has(value)
      && verifiedResourceBytes.has(value)
      ? value as GpuModelResource
      : parseResourceHeader(value, "$.resource");
    return await verifyParsedResource(resource, port, limits, options);
  } catch (error) {
    if (error instanceof GpuModelDocumentError) throw error;
    throw new GpuModelDocumentError("invalid-type", "$.resource", "resource could not be safely inspected");
  }
}

function parseNode(value: unknown, path: string, budget: DocumentBudget): GpuModelNode {
  const record = readRecord(value, path, ["id", "name", "children", "meshId", "skinId", "localMatrix", "metadata"]);
  const children = Object.freeze(readArray(requireKey(record, "children", path), `${path}.children`, GPU_MODEL_DOCUMENT_LIMITS.nodes)
    .map((entry, index) => readId(entry, `${path}.children[${index}]`)));
  consumeBudget(budget, "sceneEdges", children.length, GPU_MODEL_DOCUMENT_LIMITS.sceneEdges, path, "scene edge");
  ensureUnique(children, `${path}.children`, "duplicate child node");
  const output: Record<string, unknown> = {
    id: readId(requireKey(record, "id", path), `${path}.id`),
    children,
    localMatrix: parseMatrix(requireKey(record, "localMatrix", path), `${path}.localMatrix`),
  };
  assignOptional(output, "name", readOptional(record, "name", (entry, entryPath) => readString(entry, entryPath, GPU_MODEL_DOCUMENT_LIMITS.nameLength), path));
  assignOptional(output, "meshId", readOptional(record, "meshId", readId, path));
  assignOptional(output, "skinId", readOptional(record, "skinId", readId, path));
  assignOptional(output, "metadata", readOptional(record, "metadata", (entry, entryPath) => readMetadata(entry, entryPath, budget), path));
  return output as unknown as GpuModelNode;
}

function parseAccessor(value: unknown, path: string, budget: DocumentBudget): GpuModelAccessor {
  const record = readRecord(value, path, ["id", "resourceId", "byteOffset", "byteStride", "count", "componentType", "elementType", "normalized", "min", "max"]);
  const componentType = readEnum(requireKey(record, "componentType", path), `${path}.componentType`, ["i8", "u8", "i16", "u16", "u32", "f32"] as const);
  const elementType = readEnum(requireKey(record, "elementType", path), `${path}.elementType`, ["scalar", "vec2", "vec3", "vec4", "mat2", "mat3", "mat4"] as const);
  const normalized = readOptional(record, "normalized", readBoolean, path);
  if (normalized === true && componentType === "f32") return fail("invalid-value", `${path}.normalized`, "floating-point accessors cannot be normalized");
  if (elementType.startsWith("mat") && componentType !== "f32") return fail("invalid-value", `${path}.componentType`, "matrix accessors must use f32 components");
  const expectedComponents = ELEMENT_COMPONENTS[elementType];
  const min = readOptional(record, "min", (entry, entryPath) => readNumberTuple(entry, entryPath, expectedComponents), path);
  const max = readOptional(record, "max", (entry, entryPath) => readNumberTuple(entry, entryPath, expectedComponents), path);
  if ((min === undefined) !== (max === undefined)) return fail("invalid-value", path, "accessor min and max must be supplied together");
  if (min && max) {
    const [componentMinimum, componentMaximum, integer] = COMPONENT_RANGES[componentType];
    for (let index = 0; index < expectedComponents; index += 1) {
      const minimum = min[index]!;
      const maximum = max[index]!;
      if (minimum > maximum) return fail("invalid-value", path, "accessor min cannot exceed max");
      if (minimum < componentMinimum || maximum > componentMaximum || (integer && (!Number.isInteger(minimum) || !Number.isInteger(maximum)))) {
        return fail("invalid-value", path, "accessor bounds are outside the component representation");
      }
    }
  }
  const count = readSafeInteger(requireKey(record, "count", path), `${path}.count`, 1, GPU_MODEL_DOCUMENT_LIMITS.weightVertices);
  consumeBudget(budget, "accessorElements", count * expectedComponents, GPU_MODEL_DOCUMENT_LIMITS.accessorElements, path, "accessor element component");
  const output: Record<string, unknown> = {
    id: readId(requireKey(record, "id", path), `${path}.id`),
    resourceId: readId(requireKey(record, "resourceId", path), `${path}.resourceId`),
    byteOffset: readSafeInteger(requireKey(record, "byteOffset", path), `${path}.byteOffset`),
    count,
    componentType,
    elementType,
  };
  assignOptional(output, "byteStride", readOptional(record, "byteStride", (entry, entryPath) => readSafeInteger(entry, entryPath, 1, 2_048), path));
  assignOptional(output, "normalized", normalized);
  assignOptional(output, "min", min);
  assignOptional(output, "max", max);
  return output as unknown as GpuModelAccessor;
}

function parsePrimitive(value: unknown, path: string, budget: DocumentBudget): GpuModelPrimitive {
  const record = readRecord(value, path, ["id", "topology", "attributes", "indicesAccessorId", "materialId", "metadata"]);
  const attributesInput = readArray(requireKey(record, "attributes", path), `${path}.attributes`, 64, 1);
  consumeBudget(budget, "primitiveAttributes", attributesInput.length, GPU_MODEL_DOCUMENT_LIMITS.primitiveAttributes, path, "primitive attribute");
  const attributes = Object.freeze(attributesInput.map((entry, index) => {
    const entryPath = `${path}.attributes[${index}]`;
    const attribute = readRecord(entry, entryPath, ["semantic", "accessorId"]);
    return {
      semantic: readString(requireKey(attribute, "semantic", entryPath), `${entryPath}.semantic`, 64, ATTRIBUTE_SEMANTIC),
      accessorId: readId(requireKey(attribute, "accessorId", entryPath), `${entryPath}.accessorId`),
    };
  }));
  ensureUnique(attributes.map(({ semantic }) => semantic), `${path}.attributes`, "duplicate attribute semantic");
  if (!attributes.some(({ semantic }) => semantic === "POSITION")) return fail("invalid-value", `${path}.attributes`, "primitive requires POSITION");
  const output: Record<string, unknown> = {
    id: readId(requireKey(record, "id", path), `${path}.id`),
    topology: readEnum(requireKey(record, "topology", path), `${path}.topology`, ["points", "lines", "line-strip", "triangles", "triangle-strip"] as const),
    attributes,
  };
  assignOptional(output, "indicesAccessorId", readOptional(record, "indicesAccessorId", readId, path));
  assignOptional(output, "materialId", readOptional(record, "materialId", readId, path));
  assignOptional(output, "metadata", readOptional(record, "metadata", (entry, entryPath) => readMetadata(entry, entryPath, budget), path));
  return output as unknown as GpuModelPrimitive;
}

function parseMesh(value: unknown, path: string, budget: DocumentBudget): GpuModelMesh {
  const record = readRecord(value, path, ["id", "name", "primitives", "metadata"]);
  const input = readArray(requireKey(record, "primitives", path), `${path}.primitives`, GPU_MODEL_DOCUMENT_LIMITS.primitives, 1);
  consumeBudget(budget, "primitives", input.length, GPU_MODEL_DOCUMENT_LIMITS.primitives, path, "primitive");
  const output: Record<string, unknown> = {
    id: readId(requireKey(record, "id", path), `${path}.id`),
    primitives: Object.freeze(input.map((entry, index) => parsePrimitive(entry, `${path}.primitives[${index}]`, budget))),
  };
  assignOptional(output, "name", readOptional(record, "name", (entry, entryPath) => readString(entry, entryPath, GPU_MODEL_DOCUMENT_LIMITS.nameLength), path));
  assignOptional(output, "metadata", readOptional(record, "metadata", (entry, entryPath) => readMetadata(entry, entryPath, budget), path));
  return output as unknown as GpuModelMesh;
}

function parseTextureTransform(value: unknown, path: string): GpuModelTextureTransform {
  const record = readRecord(value, path, ["offset", "rotationRadians", "scale"]);
  if (Reflect.ownKeys(record).length === 0) return fail("invalid-value", path, "texture transform cannot be empty");
  const output: Record<string, unknown> = {};
  assignOptional(output, "offset", readOptional(record, "offset", (entry, entryPath) => readNumberTuple(entry, entryPath, 2) as GpuModelVec2, path));
  assignOptional(output, "rotationRadians", readOptional(record, "rotationRadians", readFinite, path));
  assignOptional(output, "scale", readOptional(record, "scale", (entry, entryPath) => readNumberTuple(entry, entryPath, 2) as GpuModelVec2, path));
  return output as GpuModelTextureTransform;
}

function parseTextureBinding(value: unknown, path: string): GpuModelTextureBinding {
  const record = readRecord(value, path, ["textureId", "samplerId", "texCoordSet", "transform", "colorSpace", "intendedUsage"]);
  const output: Record<string, unknown> = {
    textureId: readId(requireKey(record, "textureId", path), `${path}.textureId`),
    colorSpace: readEnum(requireKey(record, "colorSpace", path), `${path}.colorSpace`, ["srgb", "linear", "normal-map", "data"] as const),
    intendedUsage: readEnum(requireKey(record, "intendedUsage", path), `${path}.intendedUsage`, TEXTURE_USAGES),
  };
  assignOptional(output, "samplerId", readOptional(record, "samplerId", readId, path));
  assignOptional(output, "texCoordSet", readOptional(record, "texCoordSet", (entry, entryPath) => readSafeInteger(entry, entryPath, 0, 7), path));
  assignOptional(output, "transform", readOptional(record, "transform", parseTextureTransform, path));
  return output as unknown as GpuModelTextureBinding;
}

function parseMaterialTextures(value: unknown, path: string): GpuModelMaterialTextures {
  const slots = Object.keys(MATERIAL_TEXTURE_SLOTS);
  const record = readRecord(value, path, slots);
  const output: Record<string, unknown> = {};
  for (const slot of slots) assignOptional(output, slot, readOptional(record, slot, parseTextureBinding, path));
  return output as GpuModelMaterialTextures;
}

function parseMaterial(value: unknown, path: string, budget: DocumentBudget): GpuModelMaterial {
  const keys = [
    "id", "name", "workflow", "alphaMode", "alphaCutoff", "doubleSided", "baseColorFactor",
    "metallicFactor", "roughnessFactor", "emissiveFactor", "transmissionFactor", "clearcoatFactor",
    "clearcoatRoughnessFactor", "sheenColorFactor", "sheenRoughnessFactor", "normalScale",
    "occlusionStrength", "textures", "extensions", "sourceMetadata",
  ];
  const record = readRecord(value, path, keys);
  const alphaMode = readEnum(requireKey(record, "alphaMode", path), `${path}.alphaMode`, ["opaque", "mask", "blend"] as const);
  const alphaCutoff = readOptional(record, "alphaCutoff", (entry, entryPath) => readFinite(entry, entryPath, 0, 1), path);
  if (alphaMode === "mask" && alphaCutoff === undefined) return fail("invalid-value", `${path}.alphaCutoff`, "mask materials require alphaCutoff");
  if (alphaMode !== "mask" && alphaCutoff !== undefined) return fail("invalid-value", `${path}.alphaCutoff`, "alphaCutoff is only valid for mask materials");
  const output: Record<string, unknown> = {
    id: readId(requireKey(record, "id", path), `${path}.id`),
    workflow: readEnum(requireKey(record, "workflow", path), `${path}.workflow`, ["metallic-roughness", "specular-glossiness", "unlit", "custom"] as const),
    alphaMode,
    baseColorFactor: readNumberTuple(requireKey(record, "baseColorFactor", path), `${path}.baseColorFactor`, 4, 0, 1) as GpuModelVec4,
    textures: parseMaterialTextures(requireKey(record, "textures", path), `${path}.textures`),
    extensions: readMetadata(requireKey(record, "extensions", path), `${path}.extensions`, budget),
    sourceMetadata: readMetadata(requireKey(record, "sourceMetadata", path), `${path}.sourceMetadata`, budget),
  };
  assignOptional(output, "name", readOptional(record, "name", (entry, entryPath) => readString(entry, entryPath, GPU_MODEL_DOCUMENT_LIMITS.nameLength), path));
  assignOptional(output, "alphaCutoff", alphaCutoff);
  assignOptional(output, "doubleSided", readOptional(record, "doubleSided", readBoolean, path));
  for (const key of ["metallicFactor", "roughnessFactor", "transmissionFactor", "clearcoatFactor", "clearcoatRoughnessFactor", "sheenRoughnessFactor", "occlusionStrength"] as const) {
    assignOptional(output, key, readOptional(record, key, (entry, entryPath) => readFinite(entry, entryPath, 0, 1), path));
  }
  assignOptional(output, "normalScale", readOptional(record, "normalScale", readFinite, path));
  assignOptional(output, "emissiveFactor", readOptional(record, "emissiveFactor", (entry, entryPath) => readNumberTuple(entry, entryPath, 3, 0) as GpuModelVec3, path));
  assignOptional(output, "sheenColorFactor", readOptional(record, "sheenColorFactor", (entry, entryPath) => readNumberTuple(entry, entryPath, 3, 0, 1) as GpuModelVec3, path));
  return output as unknown as GpuModelMaterial;
}

function parseTextureSampler(value: unknown, path: string): GpuModelTextureSampler {
  const record = readRecord(value, path, ["id", "wrapS", "wrapT", "minFilter", "magFilter", "mipFilter"]);
  const output: Record<string, unknown> = { id: readId(requireKey(record, "id", path), `${path}.id`) };
  assignOptional(output, "wrapS", readOptional(record, "wrapS", (entry, entryPath) => readEnum(entry, entryPath, ["repeat", "mirrored-repeat", "clamp-to-edge"] as const), path));
  assignOptional(output, "wrapT", readOptional(record, "wrapT", (entry, entryPath) => readEnum(entry, entryPath, ["repeat", "mirrored-repeat", "clamp-to-edge"] as const), path));
  assignOptional(output, "minFilter", readOptional(record, "minFilter", (entry, entryPath) => readString(entry, entryPath, 128, TOKEN), path));
  assignOptional(output, "magFilter", readOptional(record, "magFilter", (entry, entryPath) => readString(entry, entryPath, 128, TOKEN), path));
  assignOptional(output, "mipFilter", readOptional(record, "mipFilter", (entry, entryPath) => readEnum(entry, entryPath, ["nearest", "linear"] as const), path));
  return output as unknown as GpuModelTextureSampler;
}

function parseTexture(value: unknown, path: string, budget: DocumentBudget): GpuModelTexture {
  const record = readRecord(value, path, ["id", "fileName", "relativePath", "mimeType", "contentHash", "imageResourceId", "byteLength", "intendedUsage", "colorSpace", "sampler", "exportEmbeddingPolicy", "sourceMetadata"]);
  const usages = Object.freeze(readArray(requireKey(record, "intendedUsage", path), `${path}.intendedUsage`, TEXTURE_USAGES.length, 1)
    .map((entry, index) => readEnum(entry, `${path}.intendedUsage[${index}]`, TEXTURE_USAGES)));
  ensureUnique(usages, `${path}.intendedUsage`, "duplicate intended texture usage");
  const output: Record<string, unknown> = {
    id: readId(requireKey(record, "id", path), `${path}.id`),
    contentHash: readSha256(requireKey(record, "contentHash", path), `${path}.contentHash`),
    imageResourceId: readId(requireKey(record, "imageResourceId", path), `${path}.imageResourceId`),
    intendedUsage: usages,
    colorSpace: readEnum(requireKey(record, "colorSpace", path), `${path}.colorSpace`, ["srgb", "linear", "normal-map", "data"] as const),
    exportEmbeddingPolicy: readEnum(requireKey(record, "exportEmbeddingPolicy", path), `${path}.exportEmbeddingPolicy`, ["inherit-source", "prefer-embedded", "prefer-external", "forbid-embedding"] as const),
    sourceMetadata: readMetadata(requireKey(record, "sourceMetadata", path), `${path}.sourceMetadata`, budget),
  };
  assignOptional(output, "fileName", readOptional(record, "fileName", (entry, entryPath) => readString(entry, entryPath, 512, FILE_NAME), path));
  assignOptional(output, "relativePath", readOptional(record, "relativePath", (entry, entryPath) => readString(entry, entryPath, 2_048, RELATIVE_PATH), path));
  assignOptional(output, "mimeType", readOptional(record, "mimeType", (entry, entryPath) => readString(entry, entryPath, 128, MIME_TYPE).toLowerCase(), path));
  assignOptional(output, "byteLength", readOptional(record, "byteLength", (entry, entryPath) => readSafeInteger(entry, entryPath, 1), path));
  assignOptional(output, "sampler", readOptional(record, "sampler", parseTextureSampler, path));
  return output as unknown as GpuModelTexture;
}

function parseSkeleton(value: unknown, path: string, budget: DocumentBudget): GpuModelSkeleton {
  const record = readRecord(value, path, ["id", "name", "jointIds", "rootJointIds", "sourceMetadata"]);
  const jointIds = Object.freeze(readArray(requireKey(record, "jointIds", path), `${path}.jointIds`, GPU_MODEL_DOCUMENT_LIMITS.skinJoints, 1)
    .map((entry, index) => readId(entry, `${path}.jointIds[${index}]`)));
  const rootJointIds = Object.freeze(readArray(requireKey(record, "rootJointIds", path), `${path}.rootJointIds`, GPU_MODEL_DOCUMENT_LIMITS.skinJoints, 1)
    .map((entry, index) => readId(entry, `${path}.rootJointIds[${index}]`)));
  consumeBudget(budget, "skinJoints", jointIds.length + rootJointIds.length, GPU_MODEL_DOCUMENT_LIMITS.skinJoints, path, "rig joint");
  ensureUnique(jointIds, `${path}.jointIds`, "duplicate skeleton joint");
  ensureUnique(rootJointIds, `${path}.rootJointIds`, "duplicate root joint");
  const output: Record<string, unknown> = {
    id: readId(requireKey(record, "id", path), `${path}.id`),
    jointIds,
    rootJointIds,
    sourceMetadata: readMetadata(requireKey(record, "sourceMetadata", path), `${path}.sourceMetadata`, budget),
  };
  assignOptional(output, "name", readOptional(record, "name", (entry, entryPath) => readString(entry, entryPath, GPU_MODEL_DOCUMENT_LIMITS.nameLength), path));
  return output as unknown as GpuModelSkeleton;
}

function parseJoint(value: unknown, path: string, budget: DocumentBudget): GpuModelJoint {
  const record = readRecord(value, path, ["id", "name", "nodeId", "parentJointId", "restLocalTransform", "inverseBindMatrix", "sourceMetadata"]);
  const output: Record<string, unknown> = {
    id: readId(requireKey(record, "id", path), `${path}.id`),
    nodeId: readId(requireKey(record, "nodeId", path), `${path}.nodeId`),
    restLocalTransform: parseTransformTrs(requireKey(record, "restLocalTransform", path), `${path}.restLocalTransform`),
    sourceMetadata: readMetadata(requireKey(record, "sourceMetadata", path), `${path}.sourceMetadata`, budget),
  };
  assignOptional(output, "name", readOptional(record, "name", (entry, entryPath) => readString(entry, entryPath, GPU_MODEL_DOCUMENT_LIMITS.nameLength), path));
  assignOptional(output, "parentJointId", readOptional(record, "parentJointId", readId, path));
  assignOptional(output, "inverseBindMatrix", readOptional(record, "inverseBindMatrix", parseMatrix, path));
  return output as unknown as GpuModelJoint;
}

function parseWeightRows(value: unknown, path: string, rows: number, columns: number, integer: boolean, budget: DocumentBudget): readonly (readonly number[])[] {
  const input = readArray(value, path, rows, rows);
  consumeBudget(budget, "weightVertices", input.length, GPU_MODEL_DOCUMENT_LIMITS.weightVertices, path, "weight vertex");
  consumeBudget(budget, "weightInfluences", input.length * columns, GPU_MODEL_DOCUMENT_LIMITS.weightInfluences, path, "weight influence");
  return Object.freeze(input.map((row, rowIndex) => {
    const parsed = readNumberTuple(row, `${path}[${rowIndex}]`, columns, 0, integer ? Number.MAX_SAFE_INTEGER : 1);
    if (integer && parsed.some((entry) => !Number.isSafeInteger(entry))) return fail("invalid-value", `${path}[${rowIndex}]`, "joint indices must be safe integers");
    return parsed;
  }));
}

function parseVertexWeightSet(value: unknown, path: string, budget: DocumentBudget): GpuModelVertexWeightSet {
  const record = readRecord(value, path, ["primitiveId", "influencesPerVertex", "joints", "weights"]);
  const influences = readSafeInteger(requireKey(record, "influencesPerVertex", path), `${path}.influencesPerVertex`, 1, 32);
  if (influences % 4 !== 0) return fail("invalid-value", `${path}.influencesPerVertex`, "influencesPerVertex must be a multiple of four");
  const jointRows = readArray(requireKey(record, "joints", path), `${path}.joints`, GPU_MODEL_DOCUMENT_LIMITS.weightVertices, 1);
  const weightRows = readArray(requireKey(record, "weights", path), `${path}.weights`, GPU_MODEL_DOCUMENT_LIMITS.weightVertices, 1);
  if (jointRows.length !== weightRows.length) return fail("invalid-value", path, "joint and weight row counts must match");
  return {
    primitiveId: readId(requireKey(record, "primitiveId", path), `${path}.primitiveId`),
    influencesPerVertex: influences,
    joints: parseWeightRows(jointRows, `${path}.joints`, jointRows.length, influences, true, budget),
    weights: parseWeightRows(weightRows, `${path}.weights`, weightRows.length, influences, false, budget),
  };
}

function parseSkin(value: unknown, path: string, budget: DocumentBudget): GpuModelSkin {
  const record = readRecord(value, path, ["id", "skeletonId", "jointIds", "inverseBindMatrices", "weightSets", "sourceMetadata"]);
  const jointIds = Object.freeze(readArray(requireKey(record, "jointIds", path), `${path}.jointIds`, GPU_MODEL_DOCUMENT_LIMITS.skinJoints, 1)
    .map((entry, index) => readId(entry, `${path}.jointIds[${index}]`)));
  consumeBudget(budget, "skinJoints", jointIds.length, GPU_MODEL_DOCUMENT_LIMITS.skinJoints, path, "skin joint");
  ensureUnique(jointIds, `${path}.jointIds`, "duplicate skin joint");
  const inverseInput = readArray(requireKey(record, "inverseBindMatrices", path), `${path}.inverseBindMatrices`, GPU_MODEL_DOCUMENT_LIMITS.skinJoints, jointIds.length);
  if (inverseInput.length !== jointIds.length) return fail("invalid-value", `${path}.inverseBindMatrices`, "one inverse bind matrix is required per skin joint");
  const weightInput = readArray(requireKey(record, "weightSets", path), `${path}.weightSets`, GPU_MODEL_DOCUMENT_LIMITS.primitives, 1);
  const weightSets = Object.freeze(weightInput.map((entry, index) => parseVertexWeightSet(entry, `${path}.weightSets[${index}]`, budget)));
  ensureUnique(weightSets.map(({ primitiveId }) => primitiveId), `${path}.weightSets`, "duplicate primitive weight set");
  return {
    id: readId(requireKey(record, "id", path), `${path}.id`),
    skeletonId: readId(requireKey(record, "skeletonId", path), `${path}.skeletonId`),
    jointIds,
    inverseBindMatrices: Object.freeze(inverseInput.map((entry, index) => parseMatrix(entry, `${path}.inverseBindMatrices[${index}]`))),
    weightSets,
    sourceMetadata: readMetadata(requireKey(record, "sourceMetadata", path), `${path}.sourceMetadata`, budget),
  };
}

function parseBlendShapeDelta(value: unknown, path: string): GpuModelBlendShapeDelta {
  const record = readRecord(value, path, ["primitiveId", "positionAccessorId", "normalAccessorId", "tangentAccessorId"]);
  const output: Record<string, unknown> = { primitiveId: readId(requireKey(record, "primitiveId", path), `${path}.primitiveId`) };
  for (const key of ["positionAccessorId", "normalAccessorId", "tangentAccessorId"] as const) {
    assignOptional(output, key, readOptional(record, key, readId, path));
  }
  if (!output.positionAccessorId && !output.normalAccessorId && !output.tangentAccessorId) {
    return fail("invalid-value", path, "blend-shape delta requires at least one accessor");
  }
  return output as unknown as GpuModelBlendShapeDelta;
}

function parseBlendShape(value: unknown, path: string, budget: DocumentBudget): GpuModelBlendShape {
  const record = readRecord(value, path, ["id", "meshId", "name", "defaultWeight", "deltas", "sourceMetadata"]);
  const deltaInput = readArray(requireKey(record, "deltas", path), `${path}.deltas`, GPU_MODEL_DOCUMENT_LIMITS.primitives, 1);
  consumeBudget(
    budget,
    "blendShapeDeltas",
    deltaInput.length,
    GPU_MODEL_DOCUMENT_LIMITS.blendShapeDeltas,
    `${path}.deltas`,
    "blend-shape delta",
  );
  const deltas = Object.freeze(deltaInput.map((entry, index) => parseBlendShapeDelta(entry, `${path}.deltas[${index}]`)));
  ensureUnique(deltas.map(({ primitiveId }) => primitiveId), `${path}.deltas`, "duplicate blend-shape primitive delta");
  const output: Record<string, unknown> = {
    id: readId(requireKey(record, "id", path), `${path}.id`),
    meshId: readId(requireKey(record, "meshId", path), `${path}.meshId`),
    deltas,
    sourceMetadata: readMetadata(requireKey(record, "sourceMetadata", path), `${path}.sourceMetadata`, budget),
  };
  assignOptional(output, "name", readOptional(record, "name", (entry, entryPath) => readString(entry, entryPath, GPU_MODEL_DOCUMENT_LIMITS.nameLength), path));
  assignOptional(output, "defaultWeight", readOptional(record, "defaultWeight", (entry, entryPath) => readFinite(entry, entryPath, 0, 1), path));
  return output as unknown as GpuModelBlendShape;
}

function parseAnimationSampler(value: unknown, path: string, budget: DocumentBudget): GpuModelAnimationSampler {
  const record = readRecord(value, path, ["id", "inputAccessorId", "outputAccessorId", "inputTimesSeconds", "outputValues", "interpolation", "sourceMetadata"]);
  const timesInput = readArray(requireKey(record, "inputTimesSeconds", path), `${path}.inputTimesSeconds`, GPU_MODEL_DOCUMENT_LIMITS.animationValues, 1);
  const valuesInput = readArray(requireKey(record, "outputValues", path), `${path}.outputValues`, GPU_MODEL_DOCUMENT_LIMITS.animationValues, 1);
  consumeBudget(budget, "animationValues", timesInput.length + valuesInput.length, GPU_MODEL_DOCUMENT_LIMITS.animationValues, path, "animation value");
  const times = Object.freeze(timesInput.map((entry, index) => readFinite(entry, `${path}.inputTimesSeconds[${index}]`, 0)));
  for (let index = 1; index < times.length; index += 1) {
    if (times[index]! <= times[index - 1]!) return fail("invalid-value", `${path}.inputTimesSeconds`, "animation input times must be strictly increasing");
  }
  return {
    id: readId(requireKey(record, "id", path), `${path}.id`),
    inputAccessorId: readId(requireKey(record, "inputAccessorId", path), `${path}.inputAccessorId`),
    outputAccessorId: readId(requireKey(record, "outputAccessorId", path), `${path}.outputAccessorId`),
    inputTimesSeconds: times,
    outputValues: Object.freeze(valuesInput.map((entry, index) => readFinite(entry, `${path}.outputValues[${index}]`))),
    interpolation: readEnum(requireKey(record, "interpolation", path), `${path}.interpolation`, ["step", "linear", "cubic-spline"] as const),
    sourceMetadata: readMetadata(requireKey(record, "sourceMetadata", path), `${path}.sourceMetadata`, budget),
  };
}

function parseAnimationChannel(value: unknown, path: string, budget: DocumentBudget): GpuModelAnimationChannel {
  const record = readRecord(value, path, ["id", "samplerId", "targetType", "targetId", "sourceMetadata"]);
  return {
    id: readId(requireKey(record, "id", path), `${path}.id`),
    samplerId: readId(requireKey(record, "samplerId", path), `${path}.samplerId`),
    targetType: readEnum(requireKey(record, "targetType", path), `${path}.targetType`, ["node-translation", "node-rotation", "node-scale", "weights"] as const),
    targetId: readId(requireKey(record, "targetId", path), `${path}.targetId`),
    sourceMetadata: readMetadata(requireKey(record, "sourceMetadata", path), `${path}.sourceMetadata`, budget),
  };
}

function parseAnimation(value: unknown, path: string, budget: DocumentBudget): GpuModelAnimation {
  const record = readRecord(value, path, ["id", "name", "durationSeconds", "samplers", "channels", "sourceMetadata"]);
  const samplerInput = readArray(requireKey(record, "samplers", path), `${path}.samplers`, GPU_MODEL_DOCUMENT_LIMITS.animationSamplers, 1);
  const channelInput = readArray(requireKey(record, "channels", path), `${path}.channels`, GPU_MODEL_DOCUMENT_LIMITS.animationChannels, 1);
  consumeBudget(budget, "animationSamplers", samplerInput.length, GPU_MODEL_DOCUMENT_LIMITS.animationSamplers, path, "animation sampler");
  consumeBudget(budget, "animationChannels", channelInput.length, GPU_MODEL_DOCUMENT_LIMITS.animationChannels, path, "animation channel");
  const output: Record<string, unknown> = {
    id: readId(requireKey(record, "id", path), `${path}.id`),
    durationSeconds: readFinite(requireKey(record, "durationSeconds", path), `${path}.durationSeconds`, 0),
    samplers: Object.freeze(samplerInput.map((entry, index) => parseAnimationSampler(entry, `${path}.samplers[${index}]`, budget))),
    channels: Object.freeze(channelInput.map((entry, index) => parseAnimationChannel(entry, `${path}.channels[${index}]`, budget))),
    sourceMetadata: readMetadata(requireKey(record, "sourceMetadata", path), `${path}.sourceMetadata`, budget),
  };
  assignOptional(output, "name", readOptional(record, "name", (entry, entryPath) => readString(entry, entryPath, GPU_MODEL_DOCUMENT_LIMITS.nameLength), path));
  return output as unknown as GpuModelAnimation;
}

function parseAnalyticGeometry(value: unknown, path: string, budget: DocumentBudget): GpuModelAnalyticGeometry {
  const record = readRecord(value, path, ["id", "kind", "sourceResourceId", "sourceUnit", "tessellatedMeshId", "metadata"]);
  if (requireKey(record, "kind", path) !== "brep-placeholder") return fail("invalid-value", `${path}.kind`, "unsupported analytic geometry kind");
  const output: Record<string, unknown> = {
    id: readId(requireKey(record, "id", path), `${path}.id`),
    kind: "brep-placeholder",
    sourceResourceId: readId(requireKey(record, "sourceResourceId", path), `${path}.sourceResourceId`),
    sourceUnit: readEnum(requireKey(record, "sourceUnit", path), `${path}.sourceUnit`, ["metre", "millimetre", "centimetre", "inch", "foot", "unitless"] as const),
  };
  assignOptional(output, "tessellatedMeshId", readOptional(record, "tessellatedMeshId", readId, path));
  assignOptional(output, "metadata", readOptional(record, "metadata", (entry, entryPath) => readMetadata(entry, entryPath, budget), path));
  return output as unknown as GpuModelAnalyticGeometry;
}

function parseProvenance(value: unknown, budget: DocumentBudget): GpuModelProvenance {
  const path = "$.provenance";
  const record = readRecord(value, path, ["sourceFormat", "sourceContentHash", "converterId", "converterVersion", "provider", "sourceIdentifier", "metadata"]);
  const output: Record<string, unknown> = {
    sourceFormat: readString(requireKey(record, "sourceFormat", path), `${path}.sourceFormat`, 128, TOKEN),
    sourceContentHash: readSha256(requireKey(record, "sourceContentHash", path), `${path}.sourceContentHash`),
    converterId: readString(requireKey(record, "converterId", path), `${path}.converterId`, 128, TOKEN),
    converterVersion: readString(requireKey(record, "converterVersion", path), `${path}.converterVersion`, 128, TOKEN),
  };
  assignOptional(output, "provider", readOptional(record, "provider", (entry, entryPath) => readString(entry, entryPath, 128, TOKEN), path));
  assignOptional(output, "sourceIdentifier", readOptional(record, "sourceIdentifier", (entry, entryPath) => readString(entry, entryPath, 2_048), path));
  assignOptional(output, "metadata", readOptional(record, "metadata", (entry, entryPath) => readMetadata(entry, entryPath, budget), path));
  return output as unknown as GpuModelProvenance;
}

function parseDiagnostic(value: unknown, path: string, budget: DocumentBudget): GpuModelDiagnostic {
  const record = readRecord(value, path, ["severity", "code", "message", "path", "metadata"]);
  const output: Record<string, unknown> = {
    severity: readEnum(requireKey(record, "severity", path), `${path}.severity`, ["info", "warning", "error"] as const),
    code: readString(requireKey(record, "code", path), `${path}.code`, 128, TOKEN),
    message: readString(requireKey(record, "message", path), `${path}.message`, GPU_MODEL_DOCUMENT_LIMITS.diagnosticMessageLength),
  };
  assignOptional(output, "path", readOptional(record, "path", (entry, entryPath) => readString(entry, entryPath, 512), path));
  assignOptional(output, "metadata", readOptional(record, "metadata", (entry, entryPath) => readMetadata(entry, entryPath, budget), path));
  return output as unknown as GpuModelDiagnostic;
}

function ensureUnique(values: readonly string[], path: string, detail = "duplicate identity"): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return fail("duplicate-id", path, `${detail}: ${value}`);
    seen.add(value);
  }
}

function indexById<T extends { readonly id: string }>(values: readonly T[], path: string): ReadonlyMap<string, T> {
  ensureUnique(values.map(({ id }) => id), path);
  return new Map(values.map((value) => [value.id, value]));
}

function requireReference<T>(index: ReadonlyMap<string, T>, id: string, path: string, kind: string): T {
  const value = index.get(id);
  if (!value) return fail("missing-reference", path, `missing ${kind}: ${id}`);
  return value;
}

function almostEqual(left: number, right: number, epsilon = EPSILON): boolean {
  return Math.abs(left - right) <= epsilon * Math.max(1, Math.abs(left), Math.abs(right));
}

function matrixAlmostEqual(left: GpuModelMatrix4, right: GpuModelMatrix4): boolean {
  return left.every((value, index) => almostEqual(value, right[index]!));
}

function multiplyMatrices(left: GpuModelMatrix4, right: GpuModelMatrix4): GpuModelMatrix4 {
  const output = new Array<number>(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let value = 0;
      for (let inner = 0; inner < 4; inner += 1) value += left[inner * 4 + row]! * right[column * 4 + inner]!;
      output[column * 4 + row] = value;
    }
  }
  return Object.freeze(output) as unknown as GpuModelMatrix4;
}

function transformPosition(matrix: GpuModelMatrix4, position: readonly number[]): GpuModelVec3 {
  const [x, y, z] = position;
  return [
    matrix[0] * x! + matrix[4] * y! + matrix[8] * z! + matrix[12],
    matrix[1] * x! + matrix[5] * y! + matrix[9] * z! + matrix[13],
    matrix[2] * x! + matrix[6] * y! + matrix[10] * z! + matrix[14],
  ];
}

interface SceneValidation {
  readonly worldByNode: ReadonlyMap<string, GpuModelMatrix4>;
  readonly ancestryEntryByNode: ReadonlyMap<string, number>;
  readonly ancestryExitByNode: ReadonlyMap<string, number>;
}

function validateScene(roots: readonly string[], nodes: readonly GpuModelNode[], nodeIndex: ReadonlyMap<string, GpuModelNode>): SceneValidation {
  ensureUnique(roots, "$.roots", "duplicate root node");
  const parentCounts = new Map(nodes.map(({ id }) => [id, 0]));
  for (let nodeIndexValue = 0; nodeIndexValue < nodes.length; nodeIndexValue += 1) {
    const node = nodes[nodeIndexValue]!;
    for (let childIndex = 0; childIndex < node.children.length; childIndex += 1) {
      const childId = node.children[childIndex]!;
      requireReference(nodeIndex, childId, `$.nodes[${nodeIndexValue}].children[${childIndex}]`, "node");
      const parentCount = parentCounts.get(childId)! + 1;
      if (parentCount > 1) return fail("invalid-reference", `$.nodes[${nodeIndexValue}].children[${childIndex}]`, "node cannot have more than one parent");
      parentCounts.set(childId, parentCount);
    }
  }
  const rootSet = new Set(roots);
  for (let index = 0; index < roots.length; index += 1) {
    const root = roots[index]!;
    requireReference(nodeIndex, root, `$.roots[${index}]`, "node");
    if (parentCounts.get(root) !== 0) return fail("invalid-reference", `$.roots[${index}]`, "root node cannot have a parent");
  }
  for (const [nodeId, count] of parentCounts) {
    if (count === 0 && !rootSet.has(nodeId)) return fail("invalid-reference", "$.roots", `parentless node is missing from roots: ${nodeId}`);
  }
  const worldByNode = new Map<string, GpuModelMatrix4>();
  const queue = roots.map((root) => ({ id: root, world: requireReference(nodeIndex, root, "$.roots", "node").localMatrix }));
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const { id, world } = queue[cursor]!;
    if (worldByNode.has(id)) return fail("graph-cycle", "$.nodes", "scene graph contains a cycle");
    worldByNode.set(id, world);
    const node = requireReference(nodeIndex, id, "$.nodes", "node");
    for (const childId of node.children) {
      const child = requireReference(nodeIndex, childId, "$.nodes", "node");
      queue.push({ id: childId, world: multiplyMatrices(world, child.localMatrix) });
    }
  }
  if (worldByNode.size !== nodes.length) return fail("graph-cycle", "$.nodes", "scene graph contains a cycle or unreachable node");
  const ancestryEntryByNode = new Map<string, number>();
  const ancestryExitByNode = new Map<string, number>();
  const traversal = roots.slice().reverse().map((id) => ({ id, exiting: false }));
  let timestamp = 0;
  while (traversal.length > 0) {
    const current = traversal.pop()!;
    if (current.exiting) {
      ancestryExitByNode.set(current.id, timestamp);
      timestamp += 1;
      continue;
    }
    ancestryEntryByNode.set(current.id, timestamp);
    timestamp += 1;
    traversal.push({ id: current.id, exiting: true });
    const node = requireReference(nodeIndex, current.id, "$.nodes", "node");
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      traversal.push({ id: node.children[index]!, exiting: false });
    }
  }
  if (ancestryExitByNode.size !== nodes.length) return fail("graph-cycle", "$.nodes", "scene ancestry traversal is incomplete");
  return { worldByNode, ancestryEntryByNode, ancestryExitByNode };
}

function isAncestor(scene: SceneValidation, possibleAncestor: string, nodeId: string): boolean {
  const ancestorEntry = scene.ancestryEntryByNode.get(possibleAncestor);
  const ancestorExit = scene.ancestryExitByNode.get(possibleAncestor);
  const nodeEntry = scene.ancestryEntryByNode.get(nodeId);
  const nodeExit = scene.ancestryExitByNode.get(nodeId);
  return ancestorEntry !== undefined
    && ancestorExit !== undefined
    && nodeEntry !== undefined
    && nodeExit !== undefined
    && ancestorEntry < nodeEntry
    && nodeExit < ancestorExit;
}

function validateAttributeAccessor(semantic: string, accessor: GpuModelAccessor, path: string): void {
  const unsigned = accessor.componentType === "u8" || accessor.componentType === "u16";
  if (semantic === "POSITION") {
    if (accessor.componentType !== "f32" || accessor.elementType !== "vec3" || accessor.normalized === true) {
      return fail("invalid-reference", path, "POSITION accessor must be a non-normalized f32 vec3");
    }
    if (!accessor.min || !accessor.max) return fail("invalid-reference", path, "POSITION accessor requires min and max bounds");
  } else if (semantic === "NORMAL" && (accessor.componentType !== "f32" || accessor.elementType !== "vec3" || accessor.normalized === true)) {
    return fail("invalid-reference", path, "NORMAL accessor must be a non-normalized f32 vec3");
  } else if (semantic === "TANGENT" && (accessor.componentType !== "f32" || accessor.elementType !== "vec4" || accessor.normalized === true)) {
    return fail("invalid-reference", path, "TANGENT accessor must be a non-normalized f32 vec4");
  } else if (semantic.startsWith("TEXCOORD_") && (accessor.elementType !== "vec2" || (accessor.componentType !== "f32" && !(unsigned && accessor.normalized === true)))) {
    return fail("invalid-reference", path, "texture-coordinate accessor must be f32 or normalized unsigned vec2");
  } else if (semantic.startsWith("COLOR_") && (!(accessor.elementType === "vec3" || accessor.elementType === "vec4") || (accessor.componentType !== "f32" && !(unsigned && accessor.normalized === true)))) {
    return fail("invalid-reference", path, "colour accessor must be f32 or normalized unsigned vec3/vec4");
  } else if (semantic.startsWith("JOINTS_") && (accessor.elementType !== "vec4" || !unsigned || accessor.normalized === true)) {
    return fail("invalid-reference", path, "joint accessor must be a non-normalized unsigned vec4");
  } else if (semantic.startsWith("WEIGHTS_") && (accessor.elementType !== "vec4" || (accessor.componentType !== "f32" && !(unsigned && accessor.normalized === true)))) {
    return fail("invalid-reference", path, "weight accessor must be f32 or normalized unsigned vec4");
  }
}

interface AccessorReader {
  readonly accessor: GpuModelAccessor;
  readonly components: number;
  readRaw(index: number): readonly number[];
  read(index: number): readonly number[];
}

function createAccessorReader(accessor: GpuModelAccessor, resource: GpuModelResource, path: string): AccessorReader {
  const bytes = verifiedResourceBytes.get(resource);
  if (!bytes) return fail("resource-unverified", path, "accessor requires a privately verified resource");
  const componentBytes = COMPONENT_BYTES[accessor.componentType];
  const components = ELEMENT_COMPONENTS[accessor.elementType];
  const elementBytes = componentBytes * components;
  const stride = accessor.byteStride ?? elementBytes;
  if (stride < elementBytes) return fail("invalid-value", `${path}.byteStride`, "byteStride cannot be smaller than one element");
  if ((accessor.byteOffset % componentBytes) !== 0 || (stride % componentBytes) !== 0) {
    return fail("invalid-value", path, "accessor offset and stride must align to the component size");
  }
  const extent = accessor.byteOffset + stride * (accessor.count - 1) + elementBytes;
  if (!Number.isSafeInteger(extent) || extent > bytes.byteLength) return fail("invalid-reference", path, "accessor range exceeds its verified buffer resource");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const rawComponent = (offset: number): number => {
    switch (accessor.componentType) {
      case "i8": return view.getInt8(offset);
      case "u8": return view.getUint8(offset);
      case "i16": return view.getInt16(offset, true);
      case "u16": return view.getUint16(offset, true);
      case "u32": return view.getUint32(offset, true);
      case "f32": return view.getFloat32(offset, true);
    }
  };
  const normalize = (value: number): number => {
    if (accessor.normalized !== true) return value;
    switch (accessor.componentType) {
      case "i8": return Math.max(value / 127, -1);
      case "u8": return value / 255;
      case "i16": return Math.max(value / 32_767, -1);
      case "u16": return value / 65_535;
      case "u32": return value / 4_294_967_295;
      case "f32": return value;
    }
  };
  const readRaw = (index: number): readonly number[] => {
    if (!Number.isSafeInteger(index) || index < 0 || index >= accessor.count) return fail("invalid-reference", path, "accessor index is out of range");
    const offset = accessor.byteOffset + stride * index;
    return Object.freeze(Array.from({ length: components }, (_, component) => rawComponent(offset + component * componentBytes)));
  };
  return {
    accessor,
    components,
    readRaw,
    read(index: number) {
      return Object.freeze(readRaw(index).map(normalize));
    },
  };
}

interface AccessorPayloadEvidence {
  readonly min: readonly number[];
  readonly max: readonly number[];
}

function validateAccessorPayload(reader: AccessorReader, path: string): AccessorPayloadEvidence {
  const actualMin = new Array<number>(reader.components).fill(Number.POSITIVE_INFINITY);
  const actualMax = new Array<number>(reader.components).fill(Number.NEGATIVE_INFINITY);
  for (let item = 0; item < reader.accessor.count; item += 1) {
    const values = reader.readRaw(item);
    for (let component = 0; component < reader.components; component += 1) {
      const value = values[component]!;
      if (!Number.isFinite(value)) return fail("invalid-value", path, "accessor payload contains a non-finite value");
      actualMin[component] = Math.min(actualMin[component]!, value);
      actualMax[component] = Math.max(actualMax[component]!, value);
    }
  }
  if (reader.accessor.min && reader.accessor.max) {
    for (let component = 0; component < reader.components; component += 1) {
      const minimumMatches = reader.accessor.componentType === "f32"
        ? almostEqual(actualMin[component]!, reader.accessor.min[component]!)
        : actualMin[component] === reader.accessor.min[component];
      const maximumMatches = reader.accessor.componentType === "f32"
        ? almostEqual(actualMax[component]!, reader.accessor.max[component]!)
        : actualMax[component] === reader.accessor.max[component];
      if (!minimumMatches || !maximumMatches) {
        return fail("invalid-reference", path, "declared accessor min/max do not match verified payload bytes");
      }
    }
  }
  return Object.freeze({
    min: Object.freeze(actualMin),
    max: Object.freeze(actualMax),
  });
}

function actualAccessorBounds(reader: AccessorReader, evidence: AccessorPayloadEvidence, path: string): GpuModelBounds {
  if (reader.components !== 3) return fail("invalid-reference", path, "position reader must have three components");
  return {
    min: evidence.min as GpuModelVec3,
    max: evidence.max as GpuModelVec3,
  };
}

function assertBoundsEqual(actual: GpuModelBounds, declared: GpuModelBounds, path: string): void {
  for (let component = 0; component < 3; component += 1) {
    if (Math.abs(actual.min[component]! - declared.min[component]!) > BOUNDS_ABSOLUTE_EPSILON
      || Math.abs(actual.max[component]! - declared.max[component]!) > BOUNDS_ABSOLUTE_EPSILON) {
      return fail("invalid-reference", path, "declared bounds do not match byte-verified POSITION data");
    }
  }
}

function validateReferences(document: GpuModelDocument, budget: DocumentBudget): void {
  const nodes = indexById(document.nodes, "$.nodes");
  const resources = indexById(document.resources, "$.resources");
  const accessors = indexById(document.accessors, "$.accessors");
  const meshes = indexById(document.meshes, "$.meshes");
  const materials = indexById(document.materials, "$.materials");
  const textures = indexById(document.textures, "$.textures");
  const skeletons = indexById(document.skeletons, "$.skeletons");
  const joints = indexById(document.joints, "$.joints");
  const skins = indexById(document.skins, "$.skins");
  const blendShapes = indexById(document.blendShapes, "$.blendShapes");
  indexById(document.animations, "$.animations");
  indexById(document.analyticGeometry, "$.analyticGeometry");
  const scene = validateScene(document.roots, document.nodes, nodes);

  const readers = new Map<string, AccessorReader>();
  const payloadEvidence = new Map<string, AccessorPayloadEvidence>();
  for (let index = 0; index < document.accessors.length; index += 1) {
    const accessor = document.accessors[index]!;
    const resource = requireReference(resources, accessor.resourceId, `$.accessors[${index}].resourceId`, "resource");
    if (resource.kind !== "buffer") return fail("invalid-reference", `$.accessors[${index}].resourceId`, "accessor resource must be a buffer");
    const reader = createAccessorReader(accessor, resource, `$.accessors[${index}]`);
    payloadEvidence.set(accessor.id, validateAccessorPayload(reader, `$.accessors[${index}]`));
    readers.set(accessor.id, reader);
  }

  const primitiveById = new Map<string, { primitive: GpuModelPrimitive; mesh: GpuModelMesh; path: string; position: GpuModelAccessor }>();
  const weightedPrimitiveIds = new Set<string>();
  const maximumIndexByAccessor = new Map<string, number>();
  for (let meshIndex = 0; meshIndex < document.meshes.length; meshIndex += 1) {
    const mesh = document.meshes[meshIndex]!;
    for (let primitiveIndex = 0; primitiveIndex < mesh.primitives.length; primitiveIndex += 1) {
      const primitive = mesh.primitives[primitiveIndex]!;
      const path = `$.meshes[${meshIndex}].primitives[${primitiveIndex}]`;
      if (primitiveById.has(primitive.id)) return fail("duplicate-id", path, `duplicate primitive ID: ${primitive.id}`);
      const positionAttribute = primitive.attributes.find(({ semantic }) => semantic === "POSITION")!;
      const position = requireReference(accessors, positionAttribute.accessorId, `${path}.attributes`, "accessor");
      for (let attributeIndex = 0; attributeIndex < primitive.attributes.length; attributeIndex += 1) {
        const attribute = primitive.attributes[attributeIndex]!;
        const accessor = requireReference(accessors, attribute.accessorId, `${path}.attributes[${attributeIndex}].accessorId`, "accessor");
        validateAttributeAccessor(attribute.semantic, accessor, `${path}.attributes[${attributeIndex}]`);
        if (accessor.count !== position.count) return fail("invalid-reference", `${path}.attributes[${attributeIndex}]`, "vertex attribute count must match POSITION");
      }
      const jointSets = primitive.attributes.filter(({ semantic }) => semantic.startsWith("JOINTS_")).map(({ semantic }) => semantic.slice("JOINTS_".length)).sort();
      const weightSets = primitive.attributes.filter(({ semantic }) => semantic.startsWith("WEIGHTS_")).map(({ semantic }) => semantic.slice("WEIGHTS_".length)).sort();
      if (jointSets.length > 0 || weightSets.length > 0) {
        if (jointSets.length !== weightSets.length || jointSets.some((suffix, index) => suffix !== weightSets[index] || Number(suffix) !== index)) {
          return fail("invalid-reference", `${path}.attributes`, "JOINTS_n and WEIGHTS_n attributes must be paired and contiguous from zero");
        }
        weightedPrimitiveIds.add(primitive.id);
      }
      const positionReader = requireReference(readers, position.id, `${path}.attributes`, "accessor reader");
      const actual = actualAccessorBounds(
        positionReader,
        requireReference(payloadEvidence, position.id, `${path}.attributes`, "accessor payload evidence"),
        `${path}.attributes.POSITION`,
      );
      assertBoundsEqual(actual, { min: position.min as GpuModelVec3, max: position.max as GpuModelVec3 }, `${path}.attributes.POSITION`);
      if (primitive.indicesAccessorId) {
        const indices = requireReference(accessors, primitive.indicesAccessorId, `${path}.indicesAccessorId`, "accessor");
        if (indices.elementType !== "scalar" || !(indices.componentType === "u8" || indices.componentType === "u16" || indices.componentType === "u32") || indices.normalized === true) {
          return fail("invalid-reference", `${path}.indicesAccessorId`, "index accessor must be an unsigned non-normalized scalar");
        }
        const indexReader = requireReference(readers, indices.id, `${path}.indicesAccessorId`, "accessor reader");
        let maximumIndex = maximumIndexByAccessor.get(indices.id);
        if (maximumIndex === undefined) {
          consumeBudget(
            budget,
            "geometryIndexElements",
            indices.count,
            GPU_MODEL_DOCUMENT_LIMITS.geometryIndexElements,
            `${path}.indicesAccessorId`,
            "geometry index element",
          );
          maximumIndex = 0;
          for (let item = 0; item < indices.count; item += 1) {
            maximumIndex = Math.max(maximumIndex, indexReader.read(item)[0]!);
          }
          maximumIndexByAccessor.set(indices.id, maximumIndex);
        }
        if (maximumIndex >= position.count) return fail("invalid-reference", `${path}.indicesAccessorId`, "index payload references a vertex outside POSITION");
      }
      if (primitive.materialId) {
        const material = requireReference(materials, primitive.materialId, `${path}.materialId`, "material");
        const semantics = new Set(primitive.attributes.map(({ semantic }) => semantic));
        for (const [slot, binding] of Object.entries(material.textures)) {
          if (!binding) continue;
          const requiredSemantic = `TEXCOORD_${String(binding.texCoordSet ?? 0)}`;
          if (!semantics.has(requiredSemantic)) {
            return fail(
              "invalid-reference",
              `${path}.materialId`,
              `material texture binding ${slot} requires primitive attribute ${requiredSemantic}`,
            );
          }
        }
      }
      primitiveById.set(primitive.id, { primitive, mesh, path, position });
    }
  }

  interface MeshValidationEvidence {
    readonly primitiveIds: ReadonlySet<string>;
    readonly positionReaders: readonly AccessorReader[];
  }
  const meshEvidenceById = new Map<string, MeshValidationEvidence>();
  for (const mesh of document.meshes) {
    const primitiveIds = new Set<string>();
    const positionIds = new Set<string>();
    for (const primitive of mesh.primitives) {
      primitiveIds.add(primitive.id);
      positionIds.add(requireReference(primitiveById, primitive.id, `$.meshes.${mesh.id}`, "primitive").position.id);
    }
    const positionReaders = Object.freeze([...positionIds].map((positionId) =>
      requireReference(readers, positionId, `$.meshes.${mesh.id}`, "POSITION reader")));
    meshEvidenceById.set(mesh.id, Object.freeze({ primitiveIds, positionReaders }));
  }

  const worldGeometry: Array<{
    readonly nodeIndex: number;
    readonly world: GpuModelMatrix4;
    readonly positionReaders: readonly AccessorReader[];
  }> = [];
  for (let nodeIndex = 0; nodeIndex < document.nodes.length; nodeIndex += 1) {
    const node = document.nodes[nodeIndex]!;
    if (node.skinId && !node.meshId) return fail("invalid-reference", `$.nodes[${nodeIndex}].skinId`, "a skinned node must also reference a mesh");
    if (node.skinId) requireReference(skins, node.skinId, `$.nodes[${nodeIndex}].skinId`, "skin");
    if (!node.meshId) continue;
    requireReference(meshes, node.meshId, `$.nodes[${nodeIndex}].meshId`, "mesh");
    const meshEvidence = requireReference(meshEvidenceById, node.meshId, `$.nodes[${nodeIndex}].meshId`, "mesh validation evidence");
    const world = requireReference(scene.worldByNode, node.id, `$.nodes[${nodeIndex}]`, "world transform");
    const positionReaders = Object.freeze(meshEvidence.positionReaders.map((reader) => {
      consumeBudget(
        budget,
        "geometryWorldAccessorInstances",
        1,
        GPU_MODEL_DOCUMENT_LIMITS.geometryWorldAccessorInstances,
        `$.nodes[${nodeIndex}].meshId`,
        "world-geometry accessor instance",
      );
      consumeBudget(
        budget,
        "geometryWorldVertices",
        reader.accessor.count,
        GPU_MODEL_DOCUMENT_LIMITS.geometryWorldVertices,
        `$.nodes[${nodeIndex}].meshId`,
        "world-geometry vertex",
      );
      return reader;
    }));
    worldGeometry.push({ nodeIndex, world, positionReaders });
  }
  if (worldGeometry.length === 0) return fail("invalid-reference", "$.bounds", "document bounds require scene-referenced byte-verified POSITION geometry");

  const worldMin = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const worldMax = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const { nodeIndex, world, positionReaders } of worldGeometry) {
    for (const reader of positionReaders) {
      for (let vertex = 0; vertex < reader.accessor.count; vertex += 1) {
        const transformed = transformPosition(world, reader.read(vertex));
        for (let component = 0; component < 3; component += 1) {
          const value = transformed[component]!;
          if (!Number.isFinite(value)) return fail("invalid-value", `$.nodes[${nodeIndex}].localMatrix`, "world transform produced non-finite bounds");
          worldMin[component] = Math.min(worldMin[component]!, value);
          worldMax[component] = Math.max(worldMax[component]!, value);
        }
      }
    }
  }
  assertBoundsEqual(
    { min: worldMin as unknown as GpuModelVec3, max: worldMax as unknown as GpuModelVec3 },
    document.bounds,
    "$.bounds",
  );

  for (let index = 0; index < document.textures.length; index += 1) {
    const texture = document.textures[index]!;
    const resource = requireReference(resources, texture.imageResourceId, `$.textures[${index}].imageResourceId`, "resource");
    if (resource.kind !== "image") return fail("invalid-reference", `$.textures[${index}].imageResourceId`, "texture resource must be an image");
    if (texture.contentHash !== resource.contentHash) return fail("invalid-reference", `$.textures[${index}].contentHash`, "texture hash must match its verified image resource");
    if (texture.mimeType !== undefined && texture.mimeType !== resource.mimeType) return fail("invalid-reference", `$.textures[${index}].mimeType`, "texture MIME type must match its image resource");
    if (texture.byteLength !== undefined && texture.byteLength !== resource.byteLength) return fail("invalid-reference", `$.textures[${index}].byteLength`, "texture byteLength must match its image resource");
  }
  for (let materialIndex = 0; materialIndex < document.materials.length; materialIndex += 1) {
    const material = document.materials[materialIndex]!;
    for (const [slot, expectedUsage] of Object.entries(MATERIAL_TEXTURE_SLOTS) as Array<[keyof GpuModelMaterialTextures, GpuModelTextureUsage]>) {
      const binding = material.textures[slot];
      if (!binding) continue;
      const texture = requireReference(textures, binding.textureId, `$.materials[${materialIndex}].textures.${slot}.textureId`, "texture");
      if (binding.intendedUsage !== expectedUsage) return fail("invalid-reference", `$.materials[${materialIndex}].textures.${slot}.intendedUsage`, "texture usage does not match its material slot");
      if (!texture.intendedUsage.includes(binding.intendedUsage)) return fail("invalid-reference", `$.materials[${materialIndex}].textures.${slot}`, "texture does not declare the binding usage");
      if (texture.colorSpace !== binding.colorSpace) return fail("invalid-reference", `$.materials[${materialIndex}].textures.${slot}.colorSpace`, "binding and texture color spaces must match");
      if (binding.samplerId !== undefined && binding.samplerId !== texture.sampler?.id) return fail("invalid-reference", `$.materials[${materialIndex}].textures.${slot}.samplerId`, "binding sampler does not match the texture sampler");
    }
  }

  const skeletonForJoint = new Map<string, string>();
  const jointIdsBySkeleton = new Map<string, ReadonlySet<string>>();
  for (let skeletonIndex = 0; skeletonIndex < document.skeletons.length; skeletonIndex += 1) {
    const skeleton = document.skeletons[skeletonIndex]!;
    const skeletonJointIds = new Set(skeleton.jointIds);
    const skeletonJointNodes = new Set<string>();
    const expectedRoots = new Set<string>();
    jointIdsBySkeleton.set(skeleton.id, skeletonJointIds);
    for (let jointIndex = 0; jointIndex < skeleton.jointIds.length; jointIndex += 1) {
      const jointId = skeleton.jointIds[jointIndex]!;
      const joint = requireReference(joints, jointId, `$.skeletons[${skeletonIndex}].jointIds[${jointIndex}]`, "joint");
      if (skeletonForJoint.has(jointId)) return fail("invalid-reference", `$.skeletons[${skeletonIndex}].jointIds[${jointIndex}]`, "joint cannot belong to more than one skeleton");
      skeletonForJoint.set(jointId, skeleton.id);
      requireReference(nodes, joint.nodeId, `$.joints.${joint.id}.nodeId`, "node");
      if (skeletonJointNodes.has(joint.nodeId)) return fail("duplicate-id", `$.skeletons[${skeletonIndex}].jointIds`, `duplicate joint node: ${joint.nodeId}`);
      skeletonJointNodes.add(joint.nodeId);
      if (joint.parentJointId === undefined) expectedRoots.add(joint.id);
    }
    const declaredRoots = new Set(skeleton.rootJointIds);
    if (expectedRoots.size !== declaredRoots.size || [...expectedRoots].some((id) => !declaredRoots.has(id))) {
      return fail("invalid-reference", `$.skeletons[${skeletonIndex}].rootJointIds`, "rootJointIds must exactly identify parentless skeleton joints");
    }
    for (let rootIndex = 0; rootIndex < skeleton.rootJointIds.length; rootIndex += 1) {
      const rootJoint = requireReference(joints, skeleton.rootJointIds[rootIndex]!, `$.skeletons[${skeletonIndex}].rootJointIds[${rootIndex}]`, "joint");
      if (!skeletonJointIds.has(rootJoint.id)) return fail("invalid-reference", `$.skeletons[${skeletonIndex}].rootJointIds[${rootIndex}]`, "root joint is not a member of the skeleton");
      requireReference(scene.worldByNode, rootJoint.nodeId, `$.joints.${rootJoint.id}.nodeId`, "scene node");
    }
  }
  if (skeletonForJoint.size !== document.joints.length) return fail("invalid-reference", "$.joints", "every joint must belong to exactly one skeleton");
  for (let jointIndex = 0; jointIndex < document.joints.length; jointIndex += 1) {
    const joint = document.joints[jointIndex]!;
    const node = requireReference(nodes, joint.nodeId, `$.joints[${jointIndex}].nodeId`, "node");
    if (joint.parentJointId) {
      const parent = requireReference(joints, joint.parentJointId, `$.joints[${jointIndex}].parentJointId`, "joint");
      if (skeletonForJoint.get(parent.id) !== skeletonForJoint.get(joint.id)) return fail("invalid-reference", `$.joints[${jointIndex}].parentJointId`, "parent joint must belong to the same skeleton");
      if (!isAncestor(scene, parent.nodeId, node.id)) return fail("invalid-reference", `$.joints[${jointIndex}].parentJointId`, "parent joint node must be an ancestor of the child joint node");
    }
  }

  const skinUse = new Map<string, Set<string>>();
  for (const node of document.nodes) {
    if (!node.skinId || !node.meshId) continue;
    const set = skinUse.get(node.skinId) ?? new Set<string>();
    set.add(node.meshId);
    skinUse.set(node.skinId, set);
  }
  const skinValidatedPrimitiveIds = new Set<string>();
  for (let skinIndex = 0; skinIndex < document.skins.length; skinIndex += 1) {
    const skin = document.skins[skinIndex]!;
    const skeleton = requireReference(skeletons, skin.skeletonId, `$.skins[${skinIndex}].skeletonId`, "skeleton");
    const skeletonJointIds = requireReference(jointIdsBySkeleton, skeleton.id, `$.skins[${skinIndex}].skeletonId`, "skeleton joint set");
    for (let jointIndex = 0; jointIndex < skin.jointIds.length; jointIndex += 1) {
      const joint = requireReference(joints, skin.jointIds[jointIndex]!, `$.skins[${skinIndex}].jointIds[${jointIndex}]`, "joint");
      if (!skeletonJointIds.has(joint.id)) return fail("invalid-reference", `$.skins[${skinIndex}].jointIds[${jointIndex}]`, "skin joint is not a member of its skeleton");
      if (joint.inverseBindMatrix && !matrixAlmostEqual(joint.inverseBindMatrix, skin.inverseBindMatrices[jointIndex]!)) {
        return fail("invalid-reference", `$.skins[${skinIndex}].inverseBindMatrices[${jointIndex}]`, "skin matrix does not match authored joint inverse bind matrix");
      }
    }
    const usedMeshes = skinUse.get(skin.id);
    if (!usedMeshes || usedMeshes.size === 0) return fail("invalid-reference", `$.skins[${skinIndex}]`, "skin must be linked from a node that also references a mesh");
    const expectedPrimitiveIds = new Set<string>();
    for (const meshId of usedMeshes) {
      requireReference(meshes, meshId, `$.skins[${skinIndex}]`, "mesh");
      const meshEvidence = requireReference(meshEvidenceById, meshId, `$.skins[${skinIndex}]`, "mesh validation evidence");
      for (const primitiveId of meshEvidence.primitiveIds) expectedPrimitiveIds.add(primitiveId);
    }
    const weightSetByPrimitive = new Map(skin.weightSets.map((weightSet) => [weightSet.primitiveId, weightSet]));
    if (weightSetByPrimitive.size !== expectedPrimitiveIds.size || [...expectedPrimitiveIds].some((id) => !weightSetByPrimitive.has(id))) {
      return fail("invalid-reference", `$.skins[${skinIndex}].weightSets`, "skin weight sets must exactly cover linked mesh primitives");
    }
    for (const primitiveId of expectedPrimitiveIds) {
      skinValidatedPrimitiveIds.add(primitiveId);
      const primitiveEntry = requireReference(primitiveById, primitiveId, `$.skins[${skinIndex}].weightSets`, "primitive");
      const weightSet = requireReference(weightSetByPrimitive, primitiveId, `$.skins[${skinIndex}].weightSets`, "weight set");
      const jointsBySet = new Map<number, GpuModelAccessor>();
      const weightsBySet = new Map<number, GpuModelAccessor>();
      for (const attribute of primitiveEntry.primitive.attributes) {
        const jointMatch = /^JOINTS_([0-7])$/u.exec(attribute.semantic);
        const weightMatch = /^WEIGHTS_([0-7])$/u.exec(attribute.semantic);
        if (jointMatch) jointsBySet.set(Number(jointMatch[1]), requireReference(accessors, attribute.accessorId, primitiveEntry.path, "joint accessor"));
        if (weightMatch) weightsBySet.set(Number(weightMatch[1]), requireReference(accessors, attribute.accessorId, primitiveEntry.path, "weight accessor"));
      }
      if (jointsBySet.size === 0 || jointsBySet.size !== weightsBySet.size) return fail("invalid-reference", primitiveEntry.path, "JOINTS_n and WEIGHTS_n attributes must be paired");
      for (let setIndex = 0; setIndex < jointsBySet.size; setIndex += 1) {
        if (!jointsBySet.has(setIndex) || !weightsBySet.has(setIndex)) return fail("invalid-reference", primitiveEntry.path, "joint and weight attribute sets must be contiguous from zero");
      }
      if (weightSet.influencesPerVertex !== jointsBySet.size * 4) return fail("invalid-reference", `$.skins[${skinIndex}].weightSets`, "influencesPerVertex does not match joint/weight attribute sets");
      if (weightSet.joints.length !== primitiveEntry.position.count || weightSet.weights.length !== primitiveEntry.position.count) {
        return fail("invalid-reference", `$.skins[${skinIndex}].weightSets`, "weight row count must match POSITION");
      }
      for (let vertex = 0; vertex < primitiveEntry.position.count; vertex += 1) {
        const decodedJoints: number[] = [];
        const decodedWeights: number[] = [];
        for (let setIndex = 0; setIndex < jointsBySet.size; setIndex += 1) {
          decodedJoints.push(...requireReference(readers, jointsBySet.get(setIndex)!.id, primitiveEntry.path, "joint reader").read(vertex));
          decodedWeights.push(...requireReference(readers, weightsBySet.get(setIndex)!.id, primitiveEntry.path, "weight reader").read(vertex));
        }
        let total = 0;
        for (let influence = 0; influence < decodedJoints.length; influence += 1) {
          const jointIndexValue = decodedJoints[influence]!;
          const weight = decodedWeights[influence]!;
          if (!Number.isSafeInteger(jointIndexValue) || jointIndexValue < 0 || jointIndexValue >= skin.jointIds.length) return fail("invalid-reference", primitiveEntry.path, "joint payload index exceeds the skin joint list");
          if (!Number.isFinite(weight) || weight < 0 || weight > 1) return fail("invalid-value", primitiveEntry.path, "weight payload contains an invalid value");
          if (weightSet.joints[vertex]![influence] !== jointIndexValue || !almostEqual(weightSet.weights[vertex]![influence]!, weight)) {
            return fail("invalid-reference", `$.skins[${skinIndex}].weightSets`, "authored weight rows do not match verified accessor bytes");
          }
          total += weight;
        }
        if (!almostEqual(total, 1, 1e-4)) return fail("invalid-value", primitiveEntry.path, "vertex weights must sum to one without repair");
      }
    }
  }
  for (const primitiveId of weightedPrimitiveIds) {
    if (!skinValidatedPrimitiveIds.has(primitiveId)) return fail("invalid-reference", `$.meshes[].primitives.${primitiveId}`, "joint/weight attributes require a linked skin and mesh node");
  }

  for (let shapeIndex = 0; shapeIndex < document.blendShapes.length; shapeIndex += 1) {
    const shape = document.blendShapes[shapeIndex]!;
    const mesh = requireReference(meshes, shape.meshId, `$.blendShapes[${shapeIndex}].meshId`, "mesh");
    const meshEvidence = requireReference(meshEvidenceById, mesh.id, `$.blendShapes[${shapeIndex}].meshId`, "mesh validation evidence");
    for (let deltaIndex = 0; deltaIndex < shape.deltas.length; deltaIndex += 1) {
      const delta = shape.deltas[deltaIndex]!;
      const path = `$.blendShapes[${shapeIndex}].deltas[${deltaIndex}]`;
      if (!meshEvidence.primitiveIds.has(delta.primitiveId)) return fail("invalid-reference", `${path}.primitiveId`, "blend-shape primitive is not part of its mesh");
      const base = requireReference(primitiveById, delta.primitiveId, path, "primitive").position;
      for (const key of ["positionAccessorId", "normalAccessorId", "tangentAccessorId"] as const) {
        const accessorId = delta[key];
        if (!accessorId) continue;
        consumeBudget(
          budget,
          "blendShapeAccessorReferences",
          1,
          GPU_MODEL_DOCUMENT_LIMITS.blendShapeAccessorReferences,
          `${path}.${key}`,
          "blend-shape accessor reference",
        );
        const accessor = requireReference(accessors, accessorId, `${path}.${key}`, "accessor");
        if (accessor.componentType !== "f32" || accessor.elementType !== "vec3" || accessor.count !== base.count || accessor.normalized === true) {
          return fail("invalid-reference", `${path}.${key}`, "blend-shape accessor has an invalid representation");
        }
        requireReference(payloadEvidence, accessor.id, `${path}.${key}`, "verified accessor payload evidence");
      }
    }
  }

  for (let animationIndex = 0; animationIndex < document.animations.length; animationIndex += 1) {
    const animation = document.animations[animationIndex]!;
    const samplers = indexById(animation.samplers, `$.animations[${animationIndex}].samplers`);
    indexById(animation.channels, `$.animations[${animationIndex}].channels`);
    const usedSamplerIds = new Set<string>();
    const targetTypesBySampler = new Map<string, GpuModelAnimationTargetType>();
    for (let channelIndex = 0; channelIndex < animation.channels.length; channelIndex += 1) {
      const channel = animation.channels[channelIndex]!;
      const path = `$.animations[${animationIndex}].channels[${channelIndex}]`;
      const sampler = requireReference(samplers, channel.samplerId, `${path}.samplerId`, "animation sampler");
      usedSamplerIds.add(sampler.id);
      const previousTarget = targetTypesBySampler.get(sampler.id);
      if (previousTarget && previousTarget !== channel.targetType) return fail("invalid-reference", `${path}.samplerId`, "one animation sampler cannot drive incompatible target types");
      targetTypesBySampler.set(sampler.id, channel.targetType);
      if (channel.targetType === "weights") requireReference(blendShapes, channel.targetId, `${path}.targetId`, "blend shape");
      else requireReference(nodes, channel.targetId, `${path}.targetId`, "node");
    }
    if (usedSamplerIds.size !== animation.samplers.length) return fail("invalid-reference", `$.animations[${animationIndex}].samplers`, "animation contains an unused sampler");
    for (let samplerIndex = 0; samplerIndex < animation.samplers.length; samplerIndex += 1) {
      const sampler = animation.samplers[samplerIndex]!;
      const path = `$.animations[${animationIndex}].samplers[${samplerIndex}]`;
      const input = requireReference(accessors, sampler.inputAccessorId, `${path}.inputAccessorId`, "accessor");
      const output = requireReference(accessors, sampler.outputAccessorId, `${path}.outputAccessorId`, "accessor");
      if (input.componentType !== "f32" || input.elementType !== "scalar" || input.normalized === true) return fail("invalid-reference", `${path}.inputAccessorId`, "animation input must be a non-normalized f32 scalar accessor");
      if (input.count !== sampler.inputTimesSeconds.length) return fail("invalid-reference", `${path}.inputTimesSeconds`, "authored input time count does not match its accessor");
      const inputReader = requireReference(readers, input.id, `${path}.inputAccessorId`, "accessor reader");
      for (let key = 0; key < input.count; key += 1) {
        const decoded = inputReader.read(key)[0]!;
        if (!Number.isFinite(decoded) || !almostEqual(decoded, sampler.inputTimesSeconds[key]!)) return fail("invalid-reference", `${path}.inputTimesSeconds`, "authored input times do not match verified accessor bytes");
      }
      if (sampler.inputTimesSeconds.at(-1)! > animation.durationSeconds + EPSILON) return fail("invalid-value", `${path}.inputTimesSeconds`, "animation key time exceeds clip duration");
      const targetType = requireReference(targetTypesBySampler, sampler.id, path, "sampler target type");
      const expectedElementType: GpuModelAccessorElementType = targetType === "node-rotation" ? "vec4" : targetType === "weights" ? "scalar" : "vec3";
      if (output.componentType !== "f32" || output.elementType !== expectedElementType || output.normalized === true) return fail("invalid-reference", `${path}.outputAccessorId`, "animation output has an invalid accessor representation");
      const multiplier = sampler.interpolation === "cubic-spline" ? 3 : 1;
      if (output.count !== input.count * multiplier) return fail("invalid-reference", `${path}.outputAccessorId`, "animation input and output element counts are inconsistent");
      const expectedValues = output.count * ELEMENT_COMPONENTS[output.elementType];
      if (sampler.outputValues.length !== expectedValues) return fail("invalid-reference", `${path}.outputValues`, "authored output value count does not match its accessor");
      const outputReader = requireReference(readers, output.id, `${path}.outputAccessorId`, "accessor reader");
      let flatIndex = 0;
      for (let element = 0; element < output.count; element += 1) {
        for (const decoded of outputReader.read(element)) {
          if (!Number.isFinite(decoded) || !almostEqual(decoded, sampler.outputValues[flatIndex]!)) return fail("invalid-reference", `${path}.outputValues`, "authored output values do not match verified accessor bytes");
          flatIndex += 1;
        }
      }
    }
  }

  for (let index = 0; index < document.analyticGeometry.length; index += 1) {
    const analytic = document.analyticGeometry[index]!;
    const source = requireReference(resources, analytic.sourceResourceId, `$.analyticGeometry[${index}].sourceResourceId`, "resource");
    if (source.kind !== "buffer") return fail("invalid-reference", `$.analyticGeometry[${index}].sourceResourceId`, "analytic source must be a buffer resource");
    if (analytic.tessellatedMeshId) requireReference(meshes, analytic.tessellatedMeshId, `$.analyticGeometry[${index}].tessellatedMeshId`, "mesh");
  }
}

function parseVerifiedResource(value: unknown, path: string): GpuModelResource {
  if (typeof value !== "object" || value === null || !verifiedResources.has(value) || !verifiedResourceBytes.has(value)) {
    return fail("resource-unverified", path, "expected a privately verified resource; use createAndVerifyGpuModelDocument");
  }
  return value as GpuModelResource;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || value instanceof Blob) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const DOCUMENT_KEYS = Object.freeze([
  "schemaVersion", "coordinateSystem", "roots", "nodes", "resources", "accessors", "meshes", "materials", "textures",
  "skeletons", "joints", "skins", "blendShapes", "animations", "analyticGeometry", "bounds", "provenance", "diagnostics", "metadata",
] as const);

function parseGpuModelDocument(value: unknown): GpuModelDocument {
  const path = "$";
  const record = readRecord(value, path, DOCUMENT_KEYS);
  const schemaVersion = requireKey(record, "schemaVersion", path);
  if (schemaVersion !== GPU_MODEL_DOCUMENT_SCHEMA_VERSION) return fail("invalid-value", "$.schemaVersion", "unsupported schema version");
  const parseCollection = <T>(key: string, maximum: number, parser: (entry: unknown, entryPath: string) => T, minimum = 0): readonly T[] => {
    const input = readArray(requireKey(record, key, path), `$.${key}`, maximum, minimum);
    return Object.freeze(input.map((entry, index) => parser(entry, `$.${key}[${index}]`)));
  };
  const budget: DocumentBudget = {
    metadataValues: 0,
    sceneEdges: 0,
    primitiveAttributes: 0,
    accessorElements: 0,
    primitives: 0,
    skinJoints: 0,
    weightVertices: 0,
    weightInfluences: 0,
    animationSamplers: 0,
    animationChannels: 0,
    animationValues: 0,
    blendShapeDeltas: 0,
    blendShapeAccessorReferences: 0,
    geometryIndexElements: 0,
    geometryWorldAccessorInstances: 0,
    geometryWorldVertices: 0,
  };
  const roots = Object.freeze(readArray(requireKey(record, "roots", path), "$.roots", GPU_MODEL_DOCUMENT_LIMITS.roots, 1)
    .map((entry, index) => readId(entry, `$.roots[${index}]`)));
  const document: GpuModelDocument = {
    schemaVersion,
    coordinateSystem: parseCoordinateSystem(requireKey(record, "coordinateSystem", path)),
    roots,
    nodes: parseCollection("nodes", GPU_MODEL_DOCUMENT_LIMITS.nodes, (entry, entryPath) => parseNode(entry, entryPath, budget), 1),
    resources: parseCollection("resources", GPU_MODEL_DOCUMENT_LIMITS.resources, parseVerifiedResource, 1),
    accessors: parseCollection("accessors", GPU_MODEL_DOCUMENT_LIMITS.accessors, (entry, entryPath) => parseAccessor(entry, entryPath, budget)),
    meshes: parseCollection("meshes", GPU_MODEL_DOCUMENT_LIMITS.meshes, (entry, entryPath) => parseMesh(entry, entryPath, budget)),
    materials: parseCollection("materials", GPU_MODEL_DOCUMENT_LIMITS.materials, (entry, entryPath) => parseMaterial(entry, entryPath, budget)),
    textures: parseCollection("textures", GPU_MODEL_DOCUMENT_LIMITS.textures, (entry, entryPath) => parseTexture(entry, entryPath, budget)),
    skeletons: parseCollection("skeletons", GPU_MODEL_DOCUMENT_LIMITS.skeletons, (entry, entryPath) => parseSkeleton(entry, entryPath, budget)),
    joints: parseCollection("joints", GPU_MODEL_DOCUMENT_LIMITS.joints, (entry, entryPath) => parseJoint(entry, entryPath, budget)),
    skins: parseCollection("skins", GPU_MODEL_DOCUMENT_LIMITS.skins, (entry, entryPath) => parseSkin(entry, entryPath, budget)),
    blendShapes: parseCollection("blendShapes", GPU_MODEL_DOCUMENT_LIMITS.blendShapes, (entry, entryPath) => parseBlendShape(entry, entryPath, budget)),
    animations: parseCollection("animations", GPU_MODEL_DOCUMENT_LIMITS.animations, (entry, entryPath) => parseAnimation(entry, entryPath, budget)),
    analyticGeometry: parseCollection("analyticGeometry", GPU_MODEL_DOCUMENT_LIMITS.analyticGeometry, (entry, entryPath) => parseAnalyticGeometry(entry, entryPath, budget)),
    bounds: parseBounds(requireKey(record, "bounds", path), "$.bounds"),
    provenance: parseProvenance(requireKey(record, "provenance", path), budget),
    diagnostics: parseCollection("diagnostics", GPU_MODEL_DOCUMENT_LIMITS.diagnostics, (entry, entryPath) => parseDiagnostic(entry, entryPath, budget)),
    metadata: readMetadata(requireKey(record, "metadata", path), "$.metadata", budget),
  };
  if (document.meshes.length === 0) return fail("invalid-value", "$.meshes", "v1 document bounds require at least one canonical mesh");
  validateReferences(document, budget);
  const frozen = deepFreeze(document);
  validatedDocuments.add(frozen);
  return frozen;
}

/**
 * Creates a document only from privately verified resource values. This
 * synchronous factory never hashes or inspects caller-controlled bytes.
 */
export function createGpuModelDocument(value: unknown): GpuModelDocument {
  if (typeof value === "object" && value !== null && validatedDocuments.has(value)) return value as GpuModelDocument;
  try {
    return parseGpuModelDocument(value);
  } catch (error) {
    if (error instanceof GpuModelDocumentError) throw error;
    throw new GpuModelDocumentError("invalid-type", "$", "input could not be safely inspected");
  }
}

/** Non-narrowing probe for the synchronous, privately verified factory. */
export function canCreateGpuModelDocument(value: unknown): boolean {
  try {
    createGpuModelDocument(value);
    return true;
  } catch {
    return false;
  }
}

/** Only privately branded factory output narrows to GpuModelDocument. */
export function isGpuModelDocument(value: unknown): value is GpuModelDocument {
  return typeof value === "object" && value !== null && validatedDocuments.has(value);
}

/**
 * Preflights all resource budgets, verifies every raw resource through the
 * injected streaming port, then performs the complete synchronous contract
 * validation. Structured clones intentionally re-enter verification.
 */
export async function createAndVerifyGpuModelDocument(
  value: unknown,
  port: GpuModelResourceVerificationPort,
  options?: GpuModelResourceVerificationOptions,
): Promise<GpuModelDocument> {
  try {
    const limits = resolveVerificationLimits(options);
    if (options?.signal?.aborted) return fail("resource-verification-failed", "$.resources", "resource verification was aborted");
    if (isGpuModelDocument(value)) {
      preflightResourceBudget(value.resources, limits);
      value.resources.forEach((resource, index) => assertVerifiedResourceEvidence(resource, limits, `$.resources[${index}]`));
      return value;
    }
    const record = readRecord(value, "$", DOCUMENT_KEYS);
    const resourceInput = readArray(requireKey(record, "resources", "$"), "$.resources", GPU_MODEL_DOCUMENT_LIMITS.resources, 1);
    const parsed = resourceInput.map((entry, index) => {
      if (typeof entry === "object" && entry !== null && verifiedResources.has(entry) && verifiedResourceBytes.has(entry)) return entry as GpuModelResource;
      return parseResourceHeader(entry, `$.resources[${index}]`);
    });
    ensureUnique(parsed.map(({ id }) => id), "$.resources");
    preflightResourceBudget(parsed, limits);
    const verified: GpuModelResource[] = [];
    for (let index = 0; index < parsed.length; index += 1) {
      verified.push(await verifyParsedResource(parsed[index]!, port, limits, options, `$.resources[${index}]`));
    }
    const candidate: Record<string, unknown> = {};
    for (const key of DOCUMENT_KEYS) {
      if (Object.hasOwn(record, key)) candidate[key] = record[key];
    }
    candidate.resources = verified;
    return createGpuModelDocument(candidate);
  } catch (error) {
    if (error instanceof GpuModelDocumentError) throw error;
    throw new GpuModelDocumentError("invalid-type", "$", "input could not be safely inspected or verified");
  }
}

/** Version of the bounded compiler projection used by the ChatGPT PVOX demo. */
export const GPU_MODEL_STATIC_DEMO_PROFILE_VERSION = "plasius.gpu-model-static-demo/1" as const;

/** Remotely evaluated parent gate required before the demo projection may run. */
export const GPU_MODEL_STATIC_DEMO_FEATURE_FLAG = "asset.pipeline.pvox-models.enabled" as const;

/** Fixed-point PVOX coordinate ceiling; callers cannot override or raise it. */
export const GPU_MODEL_STATIC_DEMO_MAX_ABSOLUTE_COORDINATE_METRES = 1_048_576 as const;

/** Largest axis extent representable between the fixed coordinate endpoints. */
export const GPU_MODEL_STATIC_DEMO_MAX_EXTENT_METRES = GPU_MODEL_STATIC_DEMO_MAX_ABSOLUTE_COORDINATE_METRES * 2;

/** Largest three-axis diagonal representable inside the fixed coordinate cube. */
export const GPU_MODEL_STATIC_DEMO_MAX_DIAGONAL_METRES = Math.hypot(
  GPU_MODEL_STATIC_DEMO_MAX_EXTENT_METRES,
  GPU_MODEL_STATIC_DEMO_MAX_EXTENT_METRES,
  GPU_MODEL_STATIC_DEMO_MAX_EXTENT_METRES,
);

/** Non-raiseable ceilings for the bounded static PVOX demonstration profile. */
export const GPU_MODEL_STATIC_DEMO_LIMITS = Object.freeze({
  maxTriangles: 200_000,
  maxNodes: 4_096,
  maxPrimitives: 16_384,
  maxMaterials: 4_096,
  maxResourceBytes: 16 * 1024 * 1024,
  maxAggregateResourceBytes: 16 * 1024 * 1024,
} as const);

/** Exact spatial promise required from source adapters before demo compilation. */
export const GPU_MODEL_STATIC_DEMO_NORMALIZATION_CONTRACT = Object.freeze({
  ...CANONICAL_GPU_MODEL_COORDINATE_SYSTEM,
  floorPlane: "y=0",
  horizontalCenter: "bounds-centre-xz-at-origin",
} as const);

export interface GpuModelStaticDemoLimits {
  readonly maxTriangles: number;
  readonly maxNodes: number;
  readonly maxPrimitives: number;
  readonly maxMaterials: number;
  readonly maxResourceBytes: number;
  readonly maxAggregateResourceBytes: number;
}

/** Callers pass the remotely evaluated parent gate; local defaults fail closed. */
export interface GpuModelStaticDemoCompilerOptions {
  readonly pvoxModelsEnabled: boolean;
  readonly limits?: Partial<GpuModelStaticDemoLimits>;
}

/** URI-free evidence retained by a compiler projection. */
export interface GpuModelStaticDemoSourceEvidence {
  readonly sourceFormat: string;
  readonly sourceContentHash: string;
  readonly converterId: string;
  readonly converterVersion: string;
  readonly provider?: string;
}

/** Fixed, texture-free surface properties for one material region. */
export interface GpuModelStaticDemoMaterial {
  readonly sourceMaterialId: string | null;
  readonly sourceMaterialName?: string;
  readonly sourceWorkflow: "metallic-roughness" | "unlit";
  readonly baseColorFactor: GpuModelVec4;
  readonly metallicFactor: number;
  readonly roughnessFactor: number;
  readonly emissiveFactor: GpuModelVec3;
  readonly doubleSided: boolean;
}

export type GpuModelTriangleVec3 = readonly [GpuModelVec3, GpuModelVec3, GpuModelVec3];

/** One byte-verified source triangle transformed into canonical world space. */
export interface GpuModelStaticDemoWorldTriangle {
  readonly sourceNodeId: string;
  readonly sourceMeshId: string;
  readonly sourcePrimitiveId: string;
  readonly sourceTriangleIndex: number;
  readonly materialIndex: number;
  readonly positions: GpuModelTriangleVec3;
  readonly normals: GpuModelTriangleVec3;
  readonly bounds: GpuModelBounds;
}

/** Immutable, compiler-safe hand-off from model core to the PVOX compiler. */
export interface GpuModelStaticDemoCompilerInput {
  readonly profileVersion: typeof GPU_MODEL_STATIC_DEMO_PROFILE_VERSION;
  readonly canonicalDocumentHash: string;
  readonly coordinateSystem: typeof CANONICAL_GPU_MODEL_COORDINATE_SYSTEM;
  readonly bounds: GpuModelBounds;
  readonly sourceEvidence: GpuModelStaticDemoSourceEvidence;
  readonly materials: readonly GpuModelStaticDemoMaterial[];
  readonly worldTriangles: readonly GpuModelStaticDemoWorldTriangle[];
}

const CANONICAL_DOCUMENT_ENCODING_VERSION = "plasius.gpu-model-document-canonical-json/1" as const;

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return fail("invalid-value", "$", "canonical encoding encountered a non-finite number");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || value === null || value instanceof Blob) {
    return fail("invalid-type", "$", "canonical encoding encountered an unsupported value");
  }
  const entries = Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
}

function canonicalDocumentRecord(document: GpuModelDocument): Readonly<Record<string, unknown>> {
  const resources = document.resources.map(({ payload: _payload, ...resource }) => resource);
  return {
    encodingVersion: CANONICAL_DOCUMENT_ENCODING_VERSION,
    document: { ...document, resources },
  };
}

/**
 * Encodes the complete verified document deterministically. Resource payloads
 * are represented by their privately verified SHA-256 identities, not copied
 * into the encoding a second time. Object keys are sorted; semantic array order
 * is preserved.
 */
export function encodeGpuModelDocumentCanonical(document: GpuModelDocument): Uint8Array {
  if (!isGpuModelDocument(document)) return fail("invalid-type", "$", "canonical encoding requires a verified GPU model document");
  return new TextEncoder().encode(canonicalJson(canonicalDocumentRecord(document)));
}

/** Computes the lowercase SHA-256 identity of the canonical whole document. */
export async function hashGpuModelDocumentCanonical(document: GpuModelDocument): Promise<string> {
  const bytes = encodeGpuModelDocumentCanonical(document);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return fail("unsupported-feature", "$", "SHA-256 Web Crypto is unavailable");
  const digest = await subtle.digest("SHA-256", Uint8Array.from(bytes).buffer);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

function resolveStaticDemoLimits(options: GpuModelStaticDemoCompilerOptions): Readonly<GpuModelStaticDemoLimits> {
  const record = readRecord(options, "$.options", ["pvoxModelsEnabled", "limits"]);
  const enabled = readBoolean(requireKey(record, "pvoxModelsEnabled", "$.options"), "$.options.pvoxModelsEnabled");
  if (!enabled) return fail("feature-disabled", "$.options.pvoxModelsEnabled", `${GPU_MODEL_STATIC_DEMO_FEATURE_FLAG} is disabled`);
  if (!Object.hasOwn(record, "limits")) return GPU_MODEL_STATIC_DEMO_LIMITS;
  const overrides = readRecord(record.limits, "$.options.limits", Object.keys(GPU_MODEL_STATIC_DEMO_LIMITS));
  const limits: Record<string, number> = { ...GPU_MODEL_STATIC_DEMO_LIMITS };
  for (const [key, ceiling] of Object.entries(GPU_MODEL_STATIC_DEMO_LIMITS)) {
    if (Object.hasOwn(overrides, key)) limits[key] = readSafeInteger(overrides[key], `$.options.limits.${key}`, 1, ceiling);
  }
  return Object.freeze(limits) as unknown as Readonly<GpuModelStaticDemoLimits>;
}

/** Proves metre/Y-up/-Z/floor-centred normalization against verified bounds. */
export function assertGpuModelStaticDemoNormalization(document: GpuModelDocument): void {
  if (!isGpuModelDocument(document)) return fail("invalid-type", "$", "normalization requires a verified GPU model document");
  const extents = document.bounds.max.map((value, index) => value - document.bounds.min[index]!);
  const diagonal = Math.hypot(...extents);
  if (!Number.isFinite(diagonal) || diagonal <= 0) return fail("invalid-value", "$.bounds", "static demo bounds must have a finite non-zero diagonal");
  if ([...document.bounds.min, ...document.bounds.max].some((value) => Math.abs(value) > GPU_MODEL_STATIC_DEMO_MAX_ABSOLUTE_COORDINATE_METRES)) {
    return fail("limit-exceeded", "$.bounds", "static demo coordinate magnitude exceeds the fixed PVOX ceiling");
  }
  if (extents.some((extent) => extent > GPU_MODEL_STATIC_DEMO_MAX_EXTENT_METRES)
    || diagonal > GPU_MODEL_STATIC_DEMO_MAX_DIAGONAL_METRES) {
    return fail("limit-exceeded", "$.bounds", "static demo extent exceeds the fixed PVOX ceiling");
  }
  const tolerance = Math.min(1e-3, Math.max(1, diagonal) * EPSILON);
  const floorAligned = Math.abs(document.bounds.min[1]) <= tolerance;
  const centeredX = Math.abs(document.bounds.min[0] + document.bounds.max[0]) <= tolerance * 2;
  const centeredZ = Math.abs(document.bounds.min[2] + document.bounds.max[2]) <= tolerance * 2;
  if (!floorAligned || !centeredX || !centeredZ) {
    return fail("invalid-value", "$.bounds", "static demo geometry must be floor-centred at the canonical origin");
  }
}

function determinant3(matrix: GpuModelMatrix4): number {
  const a00 = matrix[0], a01 = matrix[4], a02 = matrix[8];
  const a10 = matrix[1], a11 = matrix[5], a12 = matrix[9];
  const a20 = matrix[2], a21 = matrix[6], a22 = matrix[10];
  return a00 * (a11 * a22 - a12 * a21)
    - a01 * (a10 * a22 - a12 * a20)
    + a02 * (a10 * a21 - a11 * a20);
}

function normalizedVector(value: readonly number[], path: string): GpuModelVec3 {
  const length = Math.hypot(value[0]!, value[1]!, value[2]!);
  if (!Number.isFinite(length) || length <= 1e-12) return fail("invalid-value", path, "triangle or normal vector is degenerate");
  return Object.freeze([value[0]! / length, value[1]! / length, value[2]! / length]) as GpuModelVec3;
}

function faceNormal(positions: GpuModelTriangleVec3, path: string): GpuModelVec3 {
  const ab = positions[1].map((value, index) => value - positions[0][index]!) as number[];
  const ac = positions[2].map((value, index) => value - positions[0][index]!) as number[];
  return normalizedVector([
    ab[1]! * ac[2]! - ab[2]! * ac[1]!,
    ab[2]! * ac[0]! - ab[0]! * ac[2]!,
    ab[0]! * ac[1]! - ab[1]! * ac[0]!,
  ], path);
}

function transformNormal(matrix: GpuModelMatrix4, normal: readonly number[], determinant: number, fallback: GpuModelVec3): GpuModelVec3 {
  const a00 = matrix[0], a01 = matrix[4], a02 = matrix[8];
  const a10 = matrix[1], a11 = matrix[5], a12 = matrix[9];
  const a20 = matrix[2], a21 = matrix[6], a22 = matrix[10];
  const transformed = [
    ((a11 * a22 - a12 * a21) * normal[0]! + (a12 * a20 - a10 * a22) * normal[1]! + (a10 * a21 - a11 * a20) * normal[2]!) / determinant,
    ((a02 * a21 - a01 * a22) * normal[0]! + (a00 * a22 - a02 * a20) * normal[1]! + (a01 * a20 - a00 * a21) * normal[2]!) / determinant,
    ((a01 * a12 - a02 * a11) * normal[0]! + (a02 * a10 - a00 * a12) * normal[1]! + (a00 * a11 - a01 * a10) * normal[2]!) / determinant,
  ];
  const length = Math.hypot(...transformed);
  return !Number.isFinite(length) || length <= 1e-12
    ? fallback
    : Object.freeze(transformed.map((value) => value / length)) as unknown as GpuModelVec3;
}

function triangleBounds(positions: GpuModelTriangleVec3): GpuModelBounds {
  const min = [0, 1, 2].map((component) => Math.min(...positions.map((position) => position[component]!))) as unknown as GpuModelVec3;
  const max = [0, 1, 2].map((component) => Math.max(...positions.map((position) => position[component]!))) as unknown as GpuModelVec3;
  return { min, max };
}

function assertStaticDemoTriangleCoordinates(positions: GpuModelTriangleVec3, path: string): void {
  for (let corner = 0; corner < positions.length; corner += 1) {
    for (let component = 0; component < positions[corner]!.length; component += 1) {
      if (Math.abs(positions[corner]![component]!) > GPU_MODEL_STATIC_DEMO_MAX_ABSOLUTE_COORDINATE_METRES) {
        return fail("limit-exceeded", path, "static demo triangle coordinate exceeds the fixed PVOX ceiling");
      }
    }
  }
}

function staticDemoMaterial(material: GpuModelMaterial): GpuModelStaticDemoMaterial {
  if (material.workflow !== "metallic-roughness" && material.workflow !== "unlit") {
    return fail("unsupported-feature", `$.materials.${material.id}.workflow`, "static demo supports metallic-roughness and unlit materials only");
  }
  const unsupportedSurfaceExtension = (material.transmissionFactor ?? 0) > 0
    || (material.clearcoatFactor ?? 0) > 0
    || (material.sheenColorFactor?.some((value) => value > 0) ?? false)
    || Object.keys(material.extensions).length > 0;
  if (material.alphaMode !== "opaque" || material.baseColorFactor[3] !== 1 || unsupportedSurfaceExtension) {
    return fail("unsupported-feature", `$.materials.${material.id}`, "static demo supports opaque fixed-factor materials without unsupported surface extensions");
  }
  if (Object.keys(material.textures).length > 0) {
    return fail("unsupported-feature", `$.materials.${material.id}.textures`, "static demo accepts fixed surface factors, not texture bindings");
  }
  const output: Record<string, unknown> = {
    sourceMaterialId: material.id,
    sourceWorkflow: material.workflow,
    baseColorFactor: material.baseColorFactor,
    metallicFactor: material.metallicFactor ?? 0,
    roughnessFactor: material.roughnessFactor ?? 1,
    emissiveFactor: material.emissiveFactor ?? [0, 0, 0],
    doubleSided: material.doubleSided ?? false,
  };
  if (material.name !== undefined) output.sourceMaterialName = material.name;
  return output as unknown as GpuModelStaticDemoMaterial;
}

function defaultStaticDemoMaterial(): GpuModelStaticDemoMaterial {
  return {
    sourceMaterialId: null,
    sourceWorkflow: "metallic-roughness",
    baseColorFactor: [1, 1, 1, 1],
    metallicFactor: 0,
    roughnessFactor: 1,
    emissiveFactor: [0, 0, 0],
    doubleSided: false,
  };
}

/**
 * Produces the only compiler input accepted by the bounded ChatGPT-to-PVOX
 * demonstration. This is a strict projection, not a tolerant repair step.
 */
export async function createGpuModelStaticDemoCompilerInput(
  document: GpuModelDocument,
  options: GpuModelStaticDemoCompilerOptions,
): Promise<GpuModelStaticDemoCompilerInput> {
  if (!isGpuModelDocument(document)) return fail("invalid-type", "$", "static demo compilation requires a verified GPU model document");
  const limits = resolveStaticDemoLimits(options);
  assertGpuModelStaticDemoNormalization(document);

  if (document.nodes.length > limits.maxNodes) return fail("limit-exceeded", "$.nodes", "static demo node limit exceeded");
  const primitiveCount = document.meshes.reduce((total, mesh) => total + mesh.primitives.length, 0);
  if (primitiveCount > limits.maxPrimitives) return fail("limit-exceeded", "$.meshes", "static demo primitive limit exceeded");
  if (document.materials.length > limits.maxMaterials) return fail("limit-exceeded", "$.materials", "static demo material limit exceeded");
  if (document.textures.length > 0) return fail("unsupported-feature", "$.textures", "static demo does not retain texture resources");
  for (const [key, values] of [
    ["skeletons", document.skeletons], ["joints", document.joints], ["skins", document.skins],
    ["blendShapes", document.blendShapes], ["animations", document.animations], ["analyticGeometry", document.analyticGeometry],
  ] as const) {
    if (values.length > 0) return fail("unsupported-feature", `$.${key}`, "static demo supports rigid triangle geometry only");
  }
  let aggregateResourceBytes = 0;
  for (let index = 0; index < document.resources.length; index += 1) {
    const resource = document.resources[index]!;
    if (resource.kind !== "buffer") return fail("unsupported-feature", `$.resources[${index}]`, "static demo permits buffer resources only");
    if (resource.byteLength > limits.maxResourceBytes) return fail("limit-exceeded", `$.resources[${index}].byteLength`, "static demo resource limit exceeded");
    aggregateResourceBytes += resource.byteLength;
    if (!Number.isSafeInteger(aggregateResourceBytes) || aggregateResourceBytes > limits.maxAggregateResourceBytes) {
      return fail("limit-exceeded", "$.resources", "static demo aggregate resource limit exceeded");
    }
  }

  const nodes = indexById(document.nodes, "$.nodes");
  const meshes = indexById(document.meshes, "$.meshes");
  const accessors = indexById(document.accessors, "$.accessors");
  const resources = indexById(document.resources, "$.resources");
  const scene = validateScene(document.roots, document.nodes, nodes);
  const readers = new Map<string, AccessorReader>();
  const readerFor = (accessor: GpuModelAccessor, path: string): AccessorReader => {
    const existing = readers.get(accessor.id);
    if (existing) return existing;
    const resource = requireReference(resources, accessor.resourceId, path, "resource");
    const reader = createAccessorReader(accessor, resource, path);
    readers.set(accessor.id, reader);
    return reader;
  };

  const materials: GpuModelStaticDemoMaterial[] = document.materials.map(staticDemoMaterial);
  const materialIndices = new Map(document.materials.map((material, index) => [material.id, index]));
  let defaultMaterialIndex: number | undefined;
  const worldTriangles: GpuModelStaticDemoWorldTriangle[] = [];

  for (let nodeIndex = 0; nodeIndex < document.nodes.length; nodeIndex += 1) {
    const node = document.nodes[nodeIndex]!;
    if (node.skinId !== undefined) return fail("unsupported-feature", `$.nodes[${nodeIndex}].skinId`, "static demo nodes cannot reference skins");
    if (!node.meshId) continue;
    const mesh = requireReference(meshes, node.meshId, `$.nodes[${nodeIndex}].meshId`, "mesh");
    const world = requireReference(scene.worldByNode, node.id, `$.nodes[${nodeIndex}]`, "world transform");
    const determinant = determinant3(world);
    if (!Number.isFinite(determinant) || Math.abs(determinant) <= 1e-12) {
      return fail("invalid-value", `$.nodes[${nodeIndex}].localMatrix`, "static demo world transform must be invertible");
    }
    for (let primitiveIndex = 0; primitiveIndex < mesh.primitives.length; primitiveIndex += 1) {
      const primitive = mesh.primitives[primitiveIndex]!;
      const path = `$.meshes.${mesh.id}.primitives[${primitiveIndex}]`;
      if (primitive.topology !== "triangles") return fail("unsupported-feature", `${path}.topology`, "static demo requires explicit triangle topology");
      const unsupportedAttribute = primitive.attributes.find(({ semantic }) => semantic !== "POSITION" && semantic !== "NORMAL");
      if (unsupportedAttribute) return fail("unsupported-feature", `${path}.attributes`, `static demo does not consume ${unsupportedAttribute.semantic}`);
      const positionAttribute = primitive.attributes.find(({ semantic }) => semantic === "POSITION");
      if (!positionAttribute) return fail("invalid-reference", `${path}.attributes`, "static demo requires POSITION");
      const positionAccessor = requireReference(accessors, positionAttribute.accessorId, `${path}.attributes.POSITION`, "accessor");
      const positionReader = readerFor(positionAccessor, `${path}.attributes.POSITION`);
      const normalAttribute = primitive.attributes.find(({ semantic }) => semantic === "NORMAL");
      const normalReader = normalAttribute
        ? readerFor(requireReference(accessors, normalAttribute.accessorId, `${path}.attributes.NORMAL`, "accessor"), `${path}.attributes.NORMAL`)
        : undefined;
      const indexReader = primitive.indicesAccessorId
        ? readerFor(requireReference(accessors, primitive.indicesAccessorId, `${path}.indicesAccessorId`, "accessor"), `${path}.indicesAccessorId`)
        : undefined;
      const elementCount = indexReader?.accessor.count ?? positionAccessor.count;
      if (elementCount % 3 !== 0) return fail("invalid-value", path, "triangle element count must be divisible by three");
      const triangleCount = elementCount / 3;
      if (worldTriangles.length + triangleCount > limits.maxTriangles) return fail("limit-exceeded", path, "static demo triangle limit exceeded");
      let materialIndex: number;
      if (primitive.materialId !== undefined) {
        const resolvedMaterialIndex = materialIndices.get(primitive.materialId);
        if (resolvedMaterialIndex === undefined) return fail("missing-reference", `${path}.materialId`, `missing material index: ${primitive.materialId}`);
        materialIndex = resolvedMaterialIndex;
      } else {
        if (defaultMaterialIndex === undefined) {
          if (materials.length >= limits.maxMaterials) return fail("limit-exceeded", "$.materials", "static demo material limit exceeded");
          defaultMaterialIndex = materials.length;
          materials.push(defaultStaticDemoMaterial());
        }
        materialIndex = defaultMaterialIndex;
      }
      for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
        const sourceIndices = [0, 1, 2].map((corner) => {
          const element = triangleIndex * 3 + corner;
          return indexReader ? indexReader.read(element)[0]! : element;
        });
        if (determinant < 0) [sourceIndices[1], sourceIndices[2]] = [sourceIndices[2]!, sourceIndices[1]!];
        const positions = Object.freeze(sourceIndices.map((index) => Object.freeze(transformPosition(world, positionReader.read(index))))) as unknown as GpuModelTriangleVec3;
        assertStaticDemoTriangleCoordinates(positions, `${path}.triangles[${triangleIndex}]`);
        const fallback = faceNormal(positions, `${path}.triangles[${triangleIndex}]`);
        const normals = Object.freeze(sourceIndices.map((index) => normalReader
          ? transformNormal(world, normalReader.read(index), determinant, fallback)
          : fallback)) as unknown as GpuModelTriangleVec3;
        worldTriangles.push({
          sourceNodeId: node.id,
          sourceMeshId: mesh.id,
          sourcePrimitiveId: primitive.id,
          sourceTriangleIndex: triangleIndex,
          materialIndex,
          positions,
          normals,
          bounds: triangleBounds(positions),
        });
      }
    }
  }
  if (worldTriangles.length === 0) return fail("invalid-value", "$.meshes", "static demo requires at least one world triangle");

  const sourceEvidence: GpuModelStaticDemoSourceEvidence = {
    sourceFormat: document.provenance.sourceFormat,
    sourceContentHash: document.provenance.sourceContentHash,
    converterId: document.provenance.converterId,
    converterVersion: document.provenance.converterVersion,
    ...(document.provenance.provider !== undefined ? { provider: document.provenance.provider } : {}),
  };
  return deepFreeze({
    profileVersion: GPU_MODEL_STATIC_DEMO_PROFILE_VERSION,
    canonicalDocumentHash: await hashGpuModelDocumentCanonical(document),
    coordinateSystem: CANONICAL_GPU_MODEL_COORDINATE_SYSTEM,
    bounds: document.bounds,
    sourceEvidence,
    materials,
    worldTriangles,
  }) as unknown as GpuModelStaticDemoCompilerInput;
}
