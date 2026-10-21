# TDR-0002: Adapter handoff for node animation fidelity

Date: 2026-10-21. Tracking: core #44 / Feature site #1150 / glTF #15.
Decision: [ADR-0012](../adrs/adr-0012-node-scoped-animation-bindings.md).

| Source semantics | Canonical handoff | Validation / responsibility |
| --- | --- | --- |
| Authored rest translation, quaternion and signed scale | node.restLocalTransform plus localMatrix | Keep authored components after canonical basis conversion; T*R*S must agree with matrix |
| Node override, mesh defaults or all-zero morph rest state | node.morphWeights ordered complete effective bindings | Adapter resolves defaults and source order; core checks unique same-mesh full coverage |
| Shared mesh used by two nodes | Independent arrays on each node referencing shared shape IDs | Preserve resource/mesh identity; do not duplicate geometry |
| Mesh target default | blendShape.defaultWeight | Finite signed value, no clamp |
| Animated node weight vector | channel.targetType=node-weights, targetId=node ID | Requires explicit node bindings; one channel per clip/node |
| Step/linear weight output | f32 scalar count K*N | K keys, N ordered node bindings |
| Cubic-spline output | f32 scalar count K*3*N | Per key: N incoming tangents, N values, N outgoing tangents |
| Legacy single-shape weight channel | targetType=weights, targetId=shape ID | Existing K or 3*K scalar contract unchanged |

The schema factory preserves values; it does not sample animation, deform
geometry, validate all glTF semantics or calculate swept bounds. The adapter
must validate source references/interpolation/extension support, convert basis,
resolve default weights and preserve the canonical binding order on export.
An exporter cannot reconstruct source target order by sorting shape IDs.

Bindings: 65,536/node, 262,144/document. Existing animation/accessor aggregate
limits apply, including repeated samplers. All scalars remain byte-verified;
JSON authored values cannot override resource bytes. No new I/O or dependency.
Synchronous validation is bounded, with abort/deadline checks inherited from
resource verification rather than an asynchronous animation worker.

Release the additive core minor through approved main/production CD first,
verify registry/provenance and installed module behavior, then let glTF #15 adopt
an exact released compatible version. Inherit gpu.model.conversion.enabled at
the consumer boundary and keep the old compatible producer/core/consumer set
for rollback. Core must never skip validation based on rollout state.

Tests cover required valid semantics, hostile/malformed cases and limits plus
old encodings and strict/static refusal. A real animated import/export fixture
and browser/GPU rendering still belong to downstream tasks; passing core tests
alone cannot establish those acceptances.
