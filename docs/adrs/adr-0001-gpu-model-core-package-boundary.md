# ADR-0001: GPU model core package boundary

## Status

- Accepted
- Date: 2026-07-15
- Version: 1.0

## Context

Model conversion, storage, and rendering need one portable contract for model
documents, resource graphs, adapter diagnostics, and GPU compatibility. Keeping
those types inside an application repository would couple every converter and
runtime consumer to that application's release cycle. Reimplementing them in
multiple GPU packages would allow model identities and resource semantics to
drift.

## Decision

`@plasius/gpu-model-core` is the browser-safe shared package for canonical GPU
model and resource contracts. It owns model-facing projections and adapters,
but reuses established `@plasius/*` authorities instead of copying them:

- `@plasius/asset-contracts` owns immutable asset-manifest lifecycle shapes;
- `@plasius/gpu-shader` owns reflected GPU-interface, ABI, semantic, and exact
  shader-reference grammar; and
- model storage owns byte hashing, immutable publication, catalog promotion,
  and fetched-byte digest verification.

The package does not reflect WGSL, publish assets, select promoted profiles, or
make caller-authored CPU layout metadata authoritative.

## Consequences

- Conversion and runtime packages share one independently versioned contract.
- Final assembled WGSL remains the GPU layout source of truth.
- Model, shader, and style assets remain independently versioned.
- Changes to upstream contract grammar require explicit dependency updates and
  requalification rather than local forks.
- Storage/network side effects stay outside this browser-safe package.

## Alternatives considered

- Keep types in each consumer: rejected because identities and semantics would
  drift.
- Put model lifecycle contracts in the renderer: rejected because storage and
  conversion also require them without a rendering dependency.
- Copy upstream asset and shader contracts: rejected because copied grammar
  would create multiple authorities.

