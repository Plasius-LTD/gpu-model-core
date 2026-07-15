# ADR-0005: GPU model core package boundary

- Status: Accepted
- Date: 2026-07-15
- Owners: Plasius LTD
- Parent architecture: [ADR 0094 in `plasius-ltd-site`](https://github.com/Plasius-LTD/plasius-ltd-site/blob/main/docs/adrs/adr-0094-gpu-model-family-and-canonical-proxy-conversion.md)

## Context

The `@plasius/gpu-model-core` repository is the first package boundary in the GPU model conversion family. The repository must be ready for implementation without allowing format-specific loaders, exporters, or renderer concerns to leak into the canonical model contract.

## Decision

`@plasius/gpu-model-core` owns the canonical model document, shared resource graph, diagnostics and repair records, capability metadata, and source-to-canonical-to-target registry contracts. Format-specific packages own their file-format parsing and serialization. Renderer adapters own runtime buffer and scene integration. The site repository owns application wiring and user-facing rollout behavior.

Implementation is tracked by the Project-linked package issues for the schema (#3), diagnostics (#4), resource graph (#5), and adapter registry (#6). All Tasks inherit the `gpu.model.conversion.enabled` feature flag.

## Alternatives considered

- Keep all contracts in `plasius-ltd-site`: rejected because consumers and format packages would depend on a site-specific boundary.
- Create direct N-to-N format converters: rejected because each new format would multiply coupling and make fidelity loss inconsistent.
- Put renderer-specific types in the core package: rejected because renderer lifecycles and optimized buffers are not canonical authored model data.

## Consequences

- The core package remains portable and can be consumed by loaders, exporters, validation tools, and renderer adapters.
- Conversion paths have one place to represent diagnostics and loss reports.
- Each format and renderer repository must depend on the core contract rather than introduce parallel representations.

## Validation and rollout

The package baseline is validated with frozen installation, typecheck, tests, lint, build, public-package pack checks, and high/critical npm audit. The package-only bootstrap has no user-facing capability; disable `gpu.model.conversion.enabled` and keep consumers pinned to the last validated package version for rollback.
