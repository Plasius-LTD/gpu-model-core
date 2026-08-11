# ADR-0005: Model GPU compatibility belongs to the immutable model version

## Status

- Accepted
- Date: 2026-07-15
- Version: 1.0

## Context

Runtime shader selection needs an exact model-facing GPU interface, byte-layout
identity, and semantic inventory. If model packages author offsets or layouts,
CPU and final assembled WGSL can drift. If a model embeds every compatible
style, adding a cartoon or anime profile would require republishing unchanged
model bytes.

## Decision

Every GPU-compatible model/resource uses the flat `ModelAssetManifest` defined
by `@plasius/asset-contracts`. Its `assetId` and `version` identify the model,
and its GPU projection contains:

- one exact immutable `GpuInterfaceRef`;
- the same reflected `modelAbiHash` carried by that reference;
- unique bounded semantic tokens provided by the model; and
- an optional exact default `ShaderStyleProfileRef`.

The model contract does not own compatible-profile discovery, catalog channels,
promotion metadata, qualification evidence, or caller-authored layout fields.
Those remain in the durable asset catalog and shader lifecycle. Final assembled
WGSL remains the sole layout source of truth.

The package maps those published flat fields to the
`ModelGpuCompatibilityDescriptor` validated by `@plasius/gpu-shader`. Its
resource reader accepts only enumerable own data properties on a plain JSON
object. Ordinary accessors are rejected without reading their values. Proxy
prototype/property-descriptor traps may run because ECMAScript exposes no
portable proxy detector; trap exceptions are replaced by a constant error and
their causes are not retained. This preserves one lifecycle shape and one ABI
grammar without claiming that reflection over a hostile proxy is side-effect
free.

Hash-string parsing proves only lowercase SHA-256 grammar and equality between
contract fields. It does not hash or fetch bytes. Reflected ABI hashes are
generated from final assembled WGSL, and model storage/runtime must verify
manifest and file digests against the exact uploaded or fetched bytes before
the parsed contract is authoritative.

## Consequences

- Models and styles version independently.
- Profiles sharing `modelAbiHash` can switch without model-buffer repacking.
- New compatible profiles are catalog discoveries, not model mutations.
- Mutable aliases, ABI drift, duplicate/invalid semantics, and sidecar layout
  authority fail closed.
- Grammar-valid hashes remain untrusted until their owning reflection or
  storage boundary verifies the corresponding source/bytes.
- Consumers must resolve promotion and qualification state through the asset
  catalog rather than adding it to model manifests.

## Rollout and rollback

The parent conversion feature remains controlled by
`gpu.model.conversion.enabled`. Shader-store use additionally inherits
`asset.pipeline.shader-store.enabled`. Rollback disables catalog loading and
pins the last verified package/model versions; it never edits immutable model
bytes.
