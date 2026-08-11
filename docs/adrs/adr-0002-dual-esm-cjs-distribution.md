# ADR-0002: Dual ESM and CJS distribution

## Status

- Accepted
- Date: 2026-07-15
- Version: 1.0

## Context

`@plasius/gpu-model-core` is consumed by browser-oriented ESM bundles, Node.js
tools, and existing CommonJS build pipelines. The package must expose the same
API and type declarations to each consumer without ambiguous module resolution.

## Decision

Build the package with `tsup` and publish an explicit root export map:

- `import` resolves to `dist/index.js`;
- `require` resolves to `dist/index.cjs`; and
- `types` resolves to `dist/index.d.ts`.

The package remains `type: module`. `pack:check` installs the exact tarball into
an isolated consumer and verifies TypeScript, browser bundling, Node ESM, and
Node CommonJS resolution before publication. `prepublishOnly` runs both the
build and this package check.

## Consequences

- ESM and CommonJS consumers receive equivalent model contracts.
- Package regressions fail before the approved CD workflow can publish.
- Both runtime outputs and declaration entrypoints must remain synchronized.
- New subpaths require explicit export-map and installed-tarball tests.

## Alternatives considered

- ESM-only: rejected while supported CommonJS consumers remain.
- CommonJS-only: rejected because browsers and modern tooling are ESM-first.
- Implicit entrypoint discovery: rejected because it is ambiguous across Node,
  TypeScript, and bundlers.

