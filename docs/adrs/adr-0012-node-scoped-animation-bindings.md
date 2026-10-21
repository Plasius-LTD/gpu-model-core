# ADR-0012: Preserve node-scoped morph bindings and authored rest TRS

Date: 2026-10-21
Status: Accepted
Tracking: [core #44](https://github.com/Plasius-LTD/gpu-model-core/issues/44),
[glTF #15](https://github.com/Plasius-LTD/gpu-model-gltf/issues/15),
[Feature #1150](https://github.com/Plasius-LTD/plasius-ltd-site/issues/1150).

## Context

Core 0.5.0 has mesh-owned blend shapes and legacy single-shape `weights`
channels. glTF animates a vector of morph weights on a node instance: two nodes
using the same mesh may have different rest weights and animation. A local
matrix also cannot preserve the chosen quaternion sign or signed-scale TRS
decomposition needed when only one TRS component is animated. glTF #15 explicitly
requires extending and releasing the owning canonical package first.

The normative source is the [Khronos glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html),
sections 3.5.3, 3.7.2.2, 3.7.4, 3.11 and node.weights. Format-to-canonical
coordinate conversion and animation parsing remain adapter responsibilities.

## Decision

Add optional `GpuModelNode.restLocalTransform` using the existing TRS type and
quaternion checks. Compose T*R*S and check it against the required affine
`localMatrix` using the existing relative 1e-5 matrix tolerance. Reject
non-finite composition. Retain the authored numbers; never decompose, clamp,
normalize or inject missing TRS. Negative and zero scale and quaternion sign
remain representable. Existing matrix-only documents remain valid.

Add optional ordered `GpuModelNode.morphWeights: GpuModelMorphWeight[]`, with
entries `{ blendShapeId, weight }`. Every entry references a unique shape owned
by the node's mesh, and the array exactly covers that mesh's shapes. Order is
explicit on each node and is the component order of its animated weight vector.
The adapter materializes effective source defaults/overrides, including zero
where appropriate; core does not infer the format's source target order.
Omission keeps the existing mesh-default contract. Weights and blend-shape
`defaultWeight` accept finite signed numbers without a [0,1] clamp.

Add `node-weights` to animation target types. Its `targetId` references a node
with explicit `morphWeights`; output is a non-normalized f32 scalar accessor.
For N bindings and K input times, output count is K*N for step/linear or K*3*N
for cubic spline, retaining each key's incoming tangent vector, value vector
and outgoing tangent vector. Sharing a sampler is permitted only for the same
target type and arity. Each clip has at most one node-weights channel per node.
Legacy `weights` continues to target one blend shape with one scalar per key;
its meaning and old document encodings do not change.

Reuse privately verified resource bytes, finite accessor parsing and authored
value/byte comparisons. All output scalars still consume existing accessor and
animation-value budgets. Bindings are limited to 65,536 per node and 262,144
across a document, checked before mapping the collection. A mesh shape-count
index and ID lookups bound reference checks to O(shapes + nodes + bindings).
Channel arity/target maps are bounded by existing sampler/channel ceilings.
The factories keep their existing abort/deadline/resource-port behavior; the
synchronous schema phase remains bounded and does not yield for cancellation.

## Alternatives and limits

Do not put canonical bindings exclusively in adapter metadata: that bypasses
reference validation and leaves every consumer to invent interpretation. Do
not duplicate a shared mesh/shape for every instance: this loses identity and
inflates resource/work counts. Do not change legacy `weights` in place: that
would reinterpret old documents. Do not derive TRS from a matrix: multiple
signed-scale decompositions exist and singular matrices lose information.

Core supplies no animation evaluator, glTF parser/exporter or renderer state.
Bounds continue to describe verified base positions transformed by localMatrix,
not a swept animation envelope or a certification of deformed rendering.
Rest TRS is optional for compatibility; adapters requiring exact component
round trips must supply it. New fields do not broaden strict/static compiler
acceptance: morph/skin/animation content is still refused by that projection.

## Rollout, compatibility and release

This is an additive minor package release under the existing v1 schema ID.
Old documents receive no new defaults and retain encoding/hash. Documents using
new fields need the producer's compatible core release; old core versions reject
them. New enum members require exhaustive TypeScript consumers to account for
`node-weights`; consumers must explicitly qualify support before adoption.

Inherit the remote `gpu.model.conversion.enabled` flag at the importer/consumer
boundary. Core validation is unconditional, performs no flag I/O, and has no
capability or local override. Disabled/rollback retains the previous compatible
producer/core/consumer set and loader. This prerequisite does not complete glTF
#15/#16/#17 or authorize loader cutover.

Use the existing PR, exact-SHA CI, main `.github/workflows/cd.yml`, production,
npm OIDC flow. The pipeline owns version/changelog promotion. Verify registry
identity, integrity, provenance and actual installed ESM/CJS/type consumers before
adoption. No dependency additions, new package, site or ACA deployment.

## Validation and NFRs

Requirement-derived tests first fail on 0.5.0. Cover separate instances, ordered
bindings, signed defaults, all interpolation modes, shared sampler arity,
invalid references/values/representations/duplicates, TRS consistency and
singular scales, immutable round trips, aggregate limits, abort and old controls.
Run all tests/coverage (80%+; changed source in LCOV), lint/types/build, privacy,
pack and audit checks. Existing golden encodings and static compiler/flag tests
remain controls. Runtime package probes check both module formats.

Security/privacy use closed keys, finite values, verified bytes and bounded
errors with no new logs. There is no network/retry/global cache or dependency
change. Reliability/performance use finite work ceilings and indexed references.
Maintenance remains in canonical core, documented and independently testable.
Portability uses existing TypeScript/Blob/ports; no platform imports are added.
UI accessibility, SEO and physical GPU rendering are N/A for this contract-only
change. Downstream glTF/browser/rendering qualification remains separately tracked.
