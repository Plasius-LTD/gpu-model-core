# ADR-0003: Dual Module Runtime Boundary Enforcement

## Status

- Proposed -> Accepted
- Date: 2026-03-01
- Version: 1.0
- Supersedes: N/A
- Superseded by: N/A

## Context

`@plasius/gpu-model-core` publishes dual ESM/CJS entrypoints while its package
root remains `type: module`. Without an explicit CommonJS filename boundary,
Node can interpret a generated CommonJS file as ESM and fail for `require(...)`
consumers at runtime.

## Decision

Emit CommonJS as `dist/index.cjs` alongside `dist/index.js`. The package does
not use a `dist-cjs/*.js` fallback. The export map, installed-tarball test, and
Node smoke tests must all agree on the `.cjs` path. `prepublishOnly` executes
both build and `pack:check`.

## Consequences

- Runtime compatibility is preserved for both ESM and CJS consumers.
- Packaging regressions are blocked before publish.
- Any future output-layout change requires an ADR update and matching package
  verification before release.
