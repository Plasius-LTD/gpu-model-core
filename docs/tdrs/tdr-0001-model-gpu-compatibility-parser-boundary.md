# TDR-0001: Canonical GPU compatibility fields and parser boundary

- Status: Accepted
- Date: 2026-07-15

## Decision

Use the flat `ModelAssetManifest` contract already published by
`@plasius/asset-contracts`: `assetId`, `version`, `gpuInterface`,
`modelAbiHash`, `providedSemantics`, and `defaultStyleProfile` are the canonical
model GPU fields. Do not add a nested competing shape.

`parseCanonicalModelGpuCompatibility(value)` delegates the complete descriptor
grammar to the shader framework. `readModelGpuCompatibility(resource)` snapshots
each required flat field through its own data-property descriptor, maps
`assetId` to descriptor `modelId`, and delegates to the same parser. The returned
value is a detached, deeply frozen snapshot.

## Boundary rules

- Exact model, interface, and default-profile versions only.
- The descriptor and interface reference carry equal `modelAbiHash` values.
- Provided semantics are bounded, safe, and unique.
- Unknown fields fail closed, including promotion state and compatible-profile
  lists.
- Model/resource objects may contain unrelated lifecycle fields, but every GPU
  projection field must be an own data property. Prototype and accessor values
  are rejected, as are non-enumerable fields and non-plain objects that cannot
  round-trip as the same JSON manifest.
- Ordinary getters are never invoked. Proxy reflection traps cannot be detected
  portably and may execute, so failures from `getPrototypeOf` or
  `getOwnPropertyDescriptor` are converted to one constant error with no cause.
- CPU offsets, sizes, alignments, and strides are never accepted here; they are
  generated from final assembled WGSL by `@plasius/gpu-shader`.
- SHA-256 helpers and parsers validate digest grammar and field equality only.
  Reflection owns ABI-hash derivation; model storage/runtime own exact-byte
  hashing and verification for manifests and files.

## Dependency rule

This package re-exports the asset lifecycle model-manifest type and shader
framework reference/descriptor types instead of copying them. A contract
grammar change therefore requires explicit dependency updates and
model-package requalification.
