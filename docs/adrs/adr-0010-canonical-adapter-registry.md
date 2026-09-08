# ADR-0010: Canonical adapter capability and conversion registry

Status: Accepted
Date: 2026-09-08
Task: gpu-model-core#6
Parent Feature: plasius-ltd-site#1148

## Context

ADR 0094 and completed Story #1155 specify portable IO unions, four adapter
operations and a canonical conversion boundary. Core now provides privately
verified documents, resource graphs and bounded diagnostics. Reuse them rather
than introducing parallel validation or importing parser/renderer packages.

## Decision

Preserve the seven source and seven target discriminants and documented fields
from #1155. Node streams use structural portable interfaces, avoiding a Node type
dependency for browser consumers. File/storage/URL descriptors remain inert;
resolution, security authorization, sniffing and dynamic discovery belong to
runtime or injected format adapters. Core never reads a path, fetches a URL,
consumes a stream or writes an output itself.

Register one adapter per explicit normalized format ID. Freeze copied capability
metadata; retain bound operation functions. Reject duplicate formats, missing
operations and extra direct-converter entry points. There is no direct N-to-N
route. Conversion invokes source load, target canonical validate, then target
export. Do not automatically inspect a single-use stream before loading it.
Every successful load must return a privately verified GpuModelDocument.

Preserve the documented result field names (diagnostics, warnings, repairs,
lossReports, optional document/resourcePackage) using the released diagnostic
vocabulary rather than the preliminary duplicated diagnostic structures in the
site design. A result factory supplies a privately recorded, immutable evaluated
report. Registry acceptance also checks the caller's mode and loss consent;
adapters cannot override strict mode or consent. Unsupported data stays blocking
as specified by the later fault-tolerance policy and ADR-0008. Per-stage ledgers
remain separate so source and target standard profiles are not conflated.

Capability flags declare representational limits. Canonical preflight records
loss for animation, skin/rig and analytic geometry unsupported by the target,
and refuses unconsented downgrade before export. Target validate must declare
other expected losses. Adapters must stage outputs and enforce policy before
committing side effects; core cannot roll back an injected adapter's external
writes or sandbox dishonest adapter code. Resource manifests describe output
entries, not asset promotion or byte attestation; canonical resource identity
continues to belong to the verified document and resource graph.

Bound registrations, descriptors, manifests and simultaneous operations. A shared
conversion deadline and AbortSignal reach every stage, with no retries. Timeout
or cancellation stops subsequent stages and returns fixed safe errors; an
unsettled adapter retains its concurrency slot until it settles. Synchronous
adapter code cannot be preempted: untrusted parsers require runtime worker
isolation. Input descriptors are copied without invoking getters; streams are
opaque capabilities and byte arrays are copied within a fixed bound. Hostile
Proxies require a serialized boundary outside this library.

## Alternatives

Direct source-target hooks multiply coupling and bypass the canonical ledger.
Reimplementing diagnostics would diverge from released repair/loss policy.
Automatic IO/sniffing/cache/worker management here would cross runtime ownership.
All are rejected. This additive contract does not introduce concrete adapters.

## Rollout and release

Inherit gpu.model.conversion.enabled, evaluated remotely by the consuming
runtime. No capability, stored flag change or site consumer is introduced.
Enable adoption only after adapter conformance; disable conversion and pin the
prior public version for rollback. Publish via main cd.yml, production and npm
OIDC. No Azure backend change: sensitive environment secretref checks are N/A.

## Validation

Requirements-derived tests cover every IO variant, all operations, canonical
routing, unsupported formats/forms, duplicate/direct registration, validated
identity, immutable metadata, loss consent, modes, malformed results, privacy,
deadlines, cancellation, capacity and manifests. Compile TypeScript examples;
run full coverage and changed-source LCOV, typecheck, lint, build, dependency and
privacy/package gates. Verify PR/main CI, release and public ESM/CJS artifacts.
