# TDR-0001: Canonical document v1 validation

- Status: Accepted
- Date: 2026-08-20
- Task: `Plasius-LTD/gpu-model-core#3`

## Provenance and dependent demo slice

Task #3 owns the broad `GpuModelDocument` validation work in this draft and
remains under Feature #1148. Task #13 / Feature #2012 depends on that work and
adds only canonical encoding, hashing, normalization proof, and a bounded
compiler-safe projection for the ChatGPT-to-PVOX demonstration. It does not
transfer ownership of format parsing or PVOX binary layout into model core.

## Contract

The v1 document uses stable string IDs, SHA-256 resource identities, immutable
`Blob` payloads, and explicit arrays for every cross-reference. Its exact basis
is metre units, Y up, -Z forward, right handed, counter-clockwise winding, and a
floor-centred origin. Construction is strict: unknown schema versions or keys,
duplicate identities, missing or mistyped references, scene cycles, multiple
parents, unsafe metadata keys, non-finite or non-GPU-representable values, and
payload-length mismatches fail before a model can reach cleanup or rendering.

`createAndVerifyGpuModelDocument` is the raw-input entry point. It preflights
all resource budgets, streams each immutable `Blob` through an injected
inspection and SHA-256 port, privately attests successful resources, validates
the complete document, makes a caller-independent copy, and freezes every
mutable container. `createGpuModelDocument` is synchronous and accepts only
resources carrying that private in-process attestation.

`isGpuModelDocument` narrows only privately branded factory output. It never
parses arbitrary input. `canCreateGpuModelDocument` is the non-narrowing,
non-throwing probe. Structured-clone output is deliberately untrusted and must
pass through asynchronous resource verification again.

## Bounds

V1 applies fixed document ceilings to collection sizes, nested-reference totals,
accessor components, authored weight/animation values, identifiers, names,
messages, metadata depth, the document-wide metadata value count, and metadata
strings. Verification defaults cap one resource at 100 MiB, aggregate resources
at 164 MiB, one or aggregate images at 64 MiB, and image dimensions at 4096 by
4096. Callers may tighten these ceilings but cannot raise them through this
public API.

The inspection port must consume the full bounded stream, identify MIME, and
report dimensions for images. The digest port independently consumes the full
stream and returns a lowercase SHA-256 digest. Port failures are translated to
stable errors without leaking provider details. The private verified byte
snapshot is then authoritative for accessor span/alignment/min/max checks,
finite geometry and animation values, index ranges, joint/weight pairing, and
world-space bounds under affine transforms.

A document must contain scene-referenced byte-verified mesh geometry; analytic
geometry placeholders may be retained alongside that canonical mesh fallback.
Skeletons, joints and skins are distinct. Skeleton ancestry, exact
root membership, skin-to-mesh linkage, inverse-bind ordering, explicit authored
weight rows, blend-shape deltas, clip duration/timing, texture usage/colour
space/transforms, and namespaced material extension payloads are preserved and
validated. Tolerant repair and conversion-loss policy remain Task #4 concerns;
external/package resource-graph expansion remains Task #5.

## Compatibility

The initial bootstrap exports remain unchanged. The schema is additive and
versioned by `GPU_MODEL_DOCUMENT_SCHEMA_VERSION`. Future incompatible shapes
must use a new schema version rather than weakening v1 validation.

## Static demo compiler profile

`plasius.gpu-model-static-demo/1` is created only from a privately branded v1
document and only after the caller supplies a positive evaluation of
`asset.pipeline.pvox-models.enabled`. Its non-raiseable defaults are 200,000
world triangles, 4,096 nodes, 16,384 primitives, 4,096 materials, 16 MiB per
resource, and 16 MiB aggregate resources. Callers may tighten those values.

The profile rejects skins, skeletons, joints, blend shapes, animation, analytic
geometry, images, texture bindings, custom/specular-glossiness workflows,
transmission, non-opaque alpha, non-triangle topology, unsupported vertex
attributes, incomplete triangle groups, singular transforms, and bounds that
do not prove the canonical floor-centred origin. Negative-determinant transforms
have their winding corrected; normals are transformed by inverse transpose and
fall back to verified face normals when an authored normal is unusable.

The frozen result contains a canonical document hash, canonical bounds and
basis, URI-free source evidence, fixed material regions, and world triangles
with source node/mesh/primitive identity. `@plasius/gpu-model-voxel` is the next
owner in the dependency chain and must not reach into private resource bytes or
reinterpret unverified adapter output.
