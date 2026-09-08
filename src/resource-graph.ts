import {
  isGpuModelDocument,
  type GpuModelAccessor, type GpuModelAnimation, type GpuModelDocument,
  type GpuModelJoint, type GpuModelMaterial, type GpuModelProvenance,
  type GpuModelResource, type GpuModelSkeleton, type GpuModelSkin,
  type GpuModelTexture, type GpuModelTextureEmbeddingPolicy,
} from "./model-document.js";

/** Fixed work ceilings for one resource graph; callers cannot raise them. */
export const GPU_MODEL_RESOURCE_GRAPH_LIMITS = Object.freeze({
  nodes: 65_536, edges: 262_144, packages: 256, pathLength: 1_024,
});
/** Versioned graph schema, independent of any adapter or renderer. */
export const GPU_MODEL_RESOURCE_GRAPH_SCHEMA_VERSION = "plasius.gpu-model-resource-graph/1" as const;
const KINDS = ["resource", "accessor", "texture", "material", "skeleton", "skin", "animation", "provenance", "package"] as const;
/** Logical namespaces; content hashes remain on the verified byte resources. */
export type GpuModelResourceGraphKind = typeof KINDS[number];
/** An explicit logical reference within a single canonical document/graph. */
export interface GpuModelResourceReference { readonly kind: GpuModelResourceGraphKind; readonly id: string }
/** Source location metadata only; external paths never grant I/O permission. */
export type GpuModelResourceLocation =
  | { readonly kind: "embedded" }
  | { readonly kind: "external"; readonly relativePath: string };
/** Exactly one descriptor is required per verified document resource. */
export interface GpuModelResourceBinding {
  readonly resourceId: string;
  readonly location: GpuModelResourceLocation;
  readonly exportEmbeddingPolicy: GpuModelTextureEmbeddingPolicy;
}
/** Conversion package membership; not an asset promotion or archive-writing contract. */
export interface GpuModelConversionResourcePackage {
  readonly id: string;
  readonly members: readonly GpuModelResourceReference[];
}
/** Raw descriptors are validated at construction, including nested properties. */
export interface GpuModelResourceGraphInput {
  readonly resources: readonly GpuModelResourceBinding[];
  readonly packages: readonly GpuModelConversionResourcePackage[];
}
interface NodeValues {
  resource: { readonly resource: GpuModelResource; readonly location: GpuModelResourceLocation; readonly exportEmbeddingPolicy: GpuModelTextureEmbeddingPolicy };
  accessor: GpuModelAccessor;
  texture: GpuModelTexture;
  material: GpuModelMaterial;
  skeleton: { readonly skeleton: GpuModelSkeleton; readonly joints: readonly GpuModelJoint[] };
  skin: GpuModelSkin;
  animation: GpuModelAnimation;
  provenance: GpuModelProvenance;
  package: GpuModelConversionResourcePackage;
}
/** Discriminated immutable node; dependencies use canonical tuple keys. */
export type GpuModelResourceGraphNode = {
  [K in GpuModelResourceGraphKind]: {
    readonly kind: K; readonly id: string; readonly key: string;
    readonly value: NodeValues[K]; readonly dependencies: readonly string[];
  }
}[GpuModelResourceGraphKind];
/** Validated dependency DAG. Canonical payload arrays retain their semantic order. */
export interface GpuModelResourceGraph {
  readonly schemaVersion: typeof GPU_MODEL_RESOURCE_GRAPH_SCHEMA_VERSION;
  readonly nodes: readonly GpuModelResourceGraphNode[];
}
/** Fixed, value-free errors suitable for worker or adapter diagnostics. */
export class GpuModelResourceGraphError extends TypeError {
  constructor(public readonly code: "invalid-value" | "limit-exceeded" | "unverified-document" | "duplicate-reference" | "missing-reference" | "graph-cycle") {
    super(`Invalid GPU model resource graph: ${code}`);
    this.name = "GpuModelResourceGraphError";
  }
}
function fail(code: GpuModelResourceGraphError["code"] = "invalid-value"): never { throw new GpuModelResourceGraphError(code); }
function identifier(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)) fail();
  return value;
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (typeof value !== "string" || !choices.includes(value as T)) fail();
  return value as T;
}
/** Collision-free stable logical key; identifiers use the canonical v1 grammar. */
export function gpuModelResourceKey(kind: GpuModelResourceGraphKind, id: string): string {
  return JSON.stringify([choice(kind, KINDS), identifier(id)]);
}
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail();
  const names = Reflect.ownKeys(value);
  if (names.length !== keys.length || names.some(key => typeof key !== "string" || !keys.includes(key))) fail();
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) fail();
    result[key] = descriptor.value;
  }
  return result;
}
function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail();
  if (value.length > maximum) fail("limit-exceeded");
  if (Reflect.ownKeys(value).length !== value.length + 1) fail();
  const output: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) fail();
    output.push(descriptor.value);
  }
  return output;
}
function relativePath(value: unknown): string {
  if (typeof value !== "string" || value.length > GPU_MODEL_RESOURCE_GRAPH_LIMITS.pathLength
    || !/^[A-Za-z0-9._/-]+$/u.test(value)) fail();
  for (const part of value.split("/")) {
    if (!part || part.length > 255 || part === "." || part === ".." || part.endsWith(".")
      || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/iu.test(part)) fail();
  }
  return value;
}
function parseLocation(value: unknown): GpuModelResourceLocation {
  // Inspect the discriminant without invoking caller-owned accessors.
  if (typeof value !== "object" || value === null) fail();
  const kind = Object.getOwnPropertyDescriptor(value, "kind");
  if (!kind || !("value" in kind)) fail();
  if (kind.value === "embedded") { record(value, ["kind"]); return Object.freeze({ kind: "embedded" }); }
  const location = record(value, ["kind", "relativePath"]);
  if (location.kind !== "external") fail();
  return Object.freeze({ kind: "external", relativePath: relativePath(location.relativePath) });
}
const graphs = new WeakSet<object>();
/** Narrows only graphs created in this package instance; clones are untrusted. */
export function isGpuModelResourceGraph(value: unknown): value is GpuModelResourceGraph {
  return typeof value === "object" && value !== null && graphs.has(value);
}
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

/**
 * Project verified canonical content and explicit package descriptors into a DAG.
 * No file/network resolution, hash calculation or exporter execution occurs here.
 */
export function createGpuModelResourceGraph(document: unknown, input: unknown): GpuModelResourceGraph {
  try { return buildGraph(document, input); }
  catch (error) {
    if (error instanceof GpuModelResourceGraphError) throw error;
    // Hostile proxy traps must not leak caller-controlled error messages.
    fail();
  }
}

function buildGraph(document: unknown, input: unknown): GpuModelResourceGraph {
  if (!isGpuModelDocument(document)) fail("unverified-document");
  const raw = record(input, ["resources", "packages"]);
  const resourceInputs = array(raw.resources, GPU_MODEL_RESOURCE_GRAPH_LIMITS.nodes);
  const packageInputs = array(raw.packages, GPU_MODEL_RESOURCE_GRAPH_LIMITS.packages);
  const nodes = new Map<string, GpuModelResourceGraphNode>();
  let edgeCount = 0;
  const add = <K extends GpuModelResourceGraphKind>(kind: K, id: string, value: NodeValues[K], dependencies: readonly string[]) => {
    const key = gpuModelResourceKey(kind, id);
    if (nodes.has(key)) fail("duplicate-reference");
    if (nodes.size >= GPU_MODEL_RESOURCE_GRAPH_LIMITS.nodes) fail("limit-exceeded");
    edgeCount += dependencies.length;
    if (edgeCount > GPU_MODEL_RESOURCE_GRAPH_LIMITS.edges) fail("limit-exceeded");
    nodes.set(key, Object.freeze({ kind, id, key, value, dependencies: Object.freeze([...new Set(dependencies)].sort(compare)) }) as GpuModelResourceGraphNode);
  };
  const resources = new Map(document.resources.map(resource => [resource.id, resource]));
  const paths = new Set<string>();
  for (const entry of resourceInputs) {
    const binding = record(entry, ["resourceId", "location", "exportEmbeddingPolicy"]);
    const id = identifier(binding.resourceId);
    const resource = resources.get(id);
    if (!resource) fail("missing-reference");
    const location = parseLocation(binding.location);
    const exportEmbeddingPolicy = choice(binding.exportEmbeddingPolicy, ["inherit-source", "prefer-embedded", "prefer-external", "forbid-embedding"] as const);
    if (location.kind === "embedded" && exportEmbeddingPolicy === "forbid-embedding") fail();
    if (location.kind === "external") {
      const path = location.relativePath.toLowerCase();
      if (paths.has(path)) fail("duplicate-reference");
      paths.add(path);
    }
    add("resource", id, Object.freeze({ resource, location, exportEmbeddingPolicy }), []);
  }
  for (const path of paths) {
    for (let index = path.indexOf("/"); index !== -1; index = path.indexOf("/", index + 1)) {
      if (paths.has(path.slice(0, index))) fail("duplicate-reference");
    }
  }
  if (nodes.size !== resources.size) fail("missing-reference");
  addDocumentNodes(document, add);
  for (const entry of packageInputs) {
    const pkg = record(entry, ["id", "members"]);
    const id = identifier(pkg.id);
    const members: GpuModelResourceReference[] = [];
    const dependencies = new Set<string>();
    for (const entry of array(pkg.members, GPU_MODEL_RESOURCE_GRAPH_LIMITS.edges - edgeCount)) {
      const reference = record(entry, ["kind", "id"]);
      const member = Object.freeze({ kind: choice(reference.kind, KINDS), id: identifier(reference.id) });
      const key = gpuModelResourceKey(member.kind, member.id);
      if (dependencies.has(key)) fail("duplicate-reference");
      dependencies.add(key); members.push(member);
    }
    members.sort((a, b) => compare(gpuModelResourceKey(a.kind, a.id), gpuModelResourceKey(b.kind, b.id)));
    add("package", id, Object.freeze({ id, members: Object.freeze(members) }), [...dependencies]);
  }
  validateDag(nodes);
  const result = Object.freeze({ schemaVersion: GPU_MODEL_RESOURCE_GRAPH_SCHEMA_VERSION, nodes: Object.freeze([...nodes.values()].sort((a, b) => compare(a.key, b.key))) });
  graphs.add(result);
  return result;
}

type AddNode = <K extends GpuModelResourceGraphKind>(kind: K, id: string, value: NodeValues[K], dependencies: readonly string[]) => void;
function addDocumentNodes(document: GpuModelDocument, add: AddNode): void {
  const key = gpuModelResourceKey;
  for (const value of document.accessors) add("accessor", value.id, value, [key("resource", value.resourceId)]);
  for (const value of document.textures) add("texture", value.id, value, [key("resource", value.imageResourceId)]);
  for (const value of document.materials) add("material", value.id, value, Object.values(value.textures).map(binding => key("texture", binding.textureId)));
  const joints = new Map(document.joints.map(joint => [joint.id, joint]));
  for (const skeleton of document.skeletons) add("skeleton", skeleton.id, Object.freeze({ skeleton, joints: Object.freeze(skeleton.jointIds.map(id => joints.get(id)!)) }), []);
  const primitives = new Map(document.meshes.flatMap(mesh => mesh.primitives.map(primitive => [primitive.id, primitive] as const)));
  for (const value of document.skins) {
    const dependencies = [key("skeleton", value.skeletonId)];
    for (const weightSet of value.weightSets) {
      for (const attribute of primitives.get(weightSet.primitiveId)!.attributes) {
        if (/^(JOINTS|WEIGHTS)_/u.test(attribute.semantic)) dependencies.push(key("accessor", attribute.accessorId));
      }
    }
    add("skin", value.id, value, dependencies);
  }
  for (const value of document.animations) add("animation", value.id, value, value.samplers.flatMap(sampler => [key("accessor", sampler.inputAccessorId), key("accessor", sampler.outputAccessorId)]));
  add("provenance", "source", document.provenance, []);
}

function validateDag(nodes: ReadonlyMap<string, GpuModelResourceGraphNode>): void {
  // Iterative Kahn traversal: O(nodes + edges), no call-stack dependence.
  const remaining = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  const queue: string[] = [];
  for (const node of nodes.values()) {
    remaining.set(node.key, node.dependencies.length);
    if (!node.dependencies.length) queue.push(node.key);
    for (const dependency of node.dependencies) {
      if (!nodes.has(dependency)) fail("missing-reference");
      const users = dependents.get(dependency) ?? [];
      users.push(node.key); dependents.set(dependency, users);
    }
  }
  for (let index = 0; index < queue.length; index++) {
    for (const dependent of dependents.get(queue[index]!) ?? []) {
      const count = remaining.get(dependent)! - 1;
      remaining.set(dependent, count);
      if (!count) queue.push(dependent);
    }
  }
  if (queue.length !== nodes.size) fail("graph-cycle");
}
