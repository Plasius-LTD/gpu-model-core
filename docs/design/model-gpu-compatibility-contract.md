# Model GPU Compatibility Contract

## Purpose

Attach the minimum immutable GPU compatibility projection to a model version
while keeping changing catalog state outside model bytes.

## Data flow

1. Final assembled WGSL is reflected by `@plasius/gpu-shader`.
2. Reflection produces the exact interface identity and `modelAbiHash`.
3. Model processing publishes the flat `ModelAssetManifest` from
   `@plasius/asset-contracts`, including an exact interface reference, the same
   ABI hash, provided model semantics, and optionally one exact default style
   profile.
4. `@plasius/gpu-model-core` maps that projection to the shared shader
   descriptor, then validates and freezes it. Digest parsing at this step checks
   grammar and cross-field equality, not source bytes.
5. The catalog independently discovers every promoted compatible profile.
6. Model storage/runtime fetch the immutable assets, hash the exact bytes, and
   compare those digests with their references.
7. Runtime validates the selected exact profile against the descriptor before
   creating or switching pipelines.

## Invariants

- A model descriptor cannot supply CPU/GPU layout fields.
- `gpuInterface.modelAbiHash` equals `modelAbiHash` byte for byte.
- Versions are exact immutable tokens; aliases and ranges are invalid.
- Semantics are unique safe tokens derived from the model/interface lifecycle.
- `defaultStyleProfile` is exact or `null`.
- Catalog/promotion/evidence fields are not part of the model contract.
- No competing nested GPU manifest shape is introduced.
- Parsed contracts are detached and deeply frozen.
- ABI hashes originate in final-WGSL reflection; manifest and file digests are
  authoritative only after exact-byte verification by storage/runtime.
- Ordinary accessors are rejected without invocation. Proxy reflection traps
  can execute, but thrown details and causes do not cross the resource-reader
  diagnostic boundary.

## Profile evolution

The catalog may add `realistic`, `cartoon`, `anime`, or other profiles that
reference the same `modelAbiHash`. Discovery filters them by interface and
required semantics. The immutable model version does not change. A profile
requiring a missing semantic is not offered for that model.

## Validation

Tests cover valid descriptors, ABI drift, duplicate and invalid semantics,
mutable version aliases, optional default profiles, catalog-field rejection,
detachment/freezing, inherited fields, and accessor-backed fields.
An integration fixture constructs a real `ModelAssetManifest` through
`@plasius/asset-contracts` and proves the same fields are accepted directly.
Proxy regressions cover both prototype and property-descriptor trap failures
and prove provider details are not retained in public errors.
