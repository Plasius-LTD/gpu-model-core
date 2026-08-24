# ADR-0007: Canonical document is resource-addressed and renderer-neutral

- Status: Accepted
- Date: 2026-08-20
- Owners: Plasius LTD
- Parent architecture: [ADR 0094 in `plasius-ltd-site`](https://github.com/Plasius-LTD/plasius-ltd-site/blob/main/docs/adrs/adr-0094-gpu-model-family-and-canonical-proxy-conversion.md)

## Context

Format adapters, cleanup workers, and renderer bridges need one immutable model
representation. Passing a validated source-format artifact as the canonical
model would couple every downstream consumer to that parser and would violate
ADR 0094's hub-and-spoke boundary.

## Decision

`GpuModelDocument` is a versioned, renderer-neutral scene document in metres,
Y-up, -Z-forward, right-handed, counter-clockwise coordinates. Geometry is
described through resource-addressed accessors and primitives. Images and
buffers are immutable `Blob` resources bound to SHA-256 metadata; adapters do
not expose mutable typed-array storage through the public contract.

The document represents scene nodes, mesh primitives, authored material and
texture fidelity, distinct skeleton/joint/skin concepts, vertex weight sets,
blend shapes, animation clips, analytic CAD placeholders, bounds, provenance,
diagnostics, and bounded JSON metadata. Runtime construction validates all
identities and references, rejects cycles and unsafe/non-finite values, copies
caller-owned input, and deeply freezes the result. Format parsing, renderer
uploads, promotion rights, and catalog identity remain outside this package.

Resource validity is an identity property, not a structural property. Raw
resources must pass an asynchronous, injected streaming digest/inspection port.
The verifier enforces byte and image budgets before expensive work, checks MIME
and dimensions, compares the computed SHA-256 digest, retains a private byte
snapshot for semantic validation, creates the returned `Blob` from that exact
snapshot, and brands the immutable result in a private `WeakSet`. A single
internal deadline `AbortSignal` reaches both injected worker operations and the
chunk iterable. Cached attestation retains inspection evidence so idempotent
re-verification can still apply cancellation and caller-tightened limits. The
synchronous document factory accepts only branded resource objects. A
structured clone loses the brand and must be reverified.

Accessor min/max, geometry finiteness, primitive indices, skin joint indices and
weights, animation sample values, and canonical world-space bounds are checked
against verified bytes. Aggregate index and instanced-world traversal work is
bounded, while accessor evidence and repeated position/index reads are cached
per validation. A textured material may be used only by primitives that carry
its selected `TEXCOORD_n` attribute. Node and inverse-bind matrices are affine.
This keeps document validity bound to the exact payload rather than to
attacker-controlled metadata claims.

Task `gpu-model-core#13`, under the separate PVOX Feature #2012, adds an
additive compiler projection rather than changing the canonical document owned
by Task #3. Canonical encoding sorts object keys, preserves semantic array
order, and represents every resource through its privately verified hash. The
bounded `plasius.gpu-model-static-demo/1` projection exposes only fixed surface
properties, safe source/converter evidence, and byte-verified world triangles.
It intentionally strips URLs and arbitrary metadata from the compiler surface.

The projection requires callers to pass a positive remote evaluation of
`asset.pipeline.pvox-models.enabled`. It proves the advertised floor-centred
coordinate promise from world bounds, enforces the PVOX-aligned non-raiseable
absolute coordinate ceiling of 1,048,576 metres plus derived extent/diagonal
ceilings, applies strict demo limits, and rejects
dynamic, textured, non-triangle, singular-transform, or otherwise unsupported
documents before `@plasius/gpu-model-voxel` can compile them.

## Consequences

- glTF and future format packages must translate into this document rather
  than publishing a format-specific object as `canonicalModel`.
- renderer packages consume the same model regardless of source format.
- byte payloads remain immutable and worker-cloneable, while content hashes
  can bind conversion and rendering evidence.
- callers must inject an inspector/digest implementation and use the async raw
  factory; the sync factory is reserved for already-attested composition.
- skeletons, joints, skins, blend shapes, material extensions, texture
  transforms, and animation source metadata remain renderer-independent.
- resource-graph, diagnostics/repair, and registry Tasks may extend their
  dedicated contracts additively without moving format or renderer ownership
  into core.
- the strict GLB adapter depends on Task #3 document verification; the PVOX
  compiler depends only on Task #13's frozen projection and canonical hash.
- this projection is a bounded demonstration seam and is not evidence that the
  full provider-to-PVOX production pipeline or native renderer traversal exists.

## Rollout and rollback

The general document inherits `gpu.model.conversion.enabled`. The PVOX demo
projection additionally requires `asset.pipeline.pvox-models.enabled` and
fails closed when its caller reports that gate disabled. Disable the PVOX flag
to stop new demo projections; disable the general flag and pin consumers to the
preceding package release to roll back the broader boundary. The package layer
has no user-visible capability.
