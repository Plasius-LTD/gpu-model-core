# ADR-0013: Preserve authored empty animation clips

Date: 2026-10-22. Status: Accepted.
Tracking: [core #47](https://github.com/Plasius-LTD/gpu-model-core/issues/47),
[FBX #27](https://github.com/Plasius-LTD/gpu-model-fbx/issues/27),
[Feature #1151](https://github.com/Plasius-LTD/plasius-ltd-site/issues/1151).

## Context

FBX27 explicitly requires named multiple/empty takes. Published core0.6.0 rejects
an empty canonical clip at `$.animations[0].samplers` because both arrays have a
minimum length of one. This was reproduced against the registry-installed core
used by FBX0.5.0. Source metadata alone cannot provide the canonical clip ID,
duration, collection/graph membership and validation shared by consumers.

## Decision

Allow zero-length sampler and channel arrays on `GpuModelAnimation`. Keep both
keys required and keep the current upper/aggregate limits. No other shape,
default, reference rule or schema identifier changes. The existing reference
pass rejects channels without valid samplers, unused samplers, invalid targets,
duplicate IDs and forged time/value payloads. Thus only the both-empty case is
newly accepted; no extra early return bypasses the normal document validation.

An empty clip retains ID, optional name, finite nonnegative duration in seconds,
and bounded source metadata. Zero duration is valid, as it already is for
populated clips. No accessor or payload is synthesized. The existing resource
graph retains the animation node with no accessor dependencies, and packages
may refer to that node. Encoding/revalidation preserves identity and ordering.
Clips count toward the4096 animation ceiling and existing aggregate metadata
budget even when they have no channels. Empty clips are still animation content
for capability-loss diagnostics and static-compiler refusal.

Adapters own source-specific spans, rates, layers, interpolation and coordinate
conversion. Negative original starts can be retained in bounded source metadata;
that evidence is opaque to core, not a new executable timing contract. An adapter
must independently validate source timing and qualify any normalization/sampling.
This prerequisite supplies no FBX parser, exporter, animation evaluator, posed
geometry, new resource port or swept-bounds promise.

## Alternatives and compatibility

Do not invent a constant dummy channel: it creates target/resource dependencies
and changes authored semantics. Do not silently drop empty takes or put their
identity only in adapter metadata: consumers lose canonical graph membership.
Do not special-case the FBX package's validator: the canonical package owns this
contract and must be released first.

Use an additive minor package release under the existing v1 schema ID. Existing
valid documents, fields and canonical encodings remain unchanged. Old validators
reject newly representable empty clips; consumers assuming at least one channel
must qualify support before adopting. This does not complete FBX27/Feature1151.

## Rollout and release

Inherit `gpu.model.conversion.enabled` at the producer/consumer boundary. Core
performs no flag I/O and validation is unconditional. Disabled/rollback selects
the prior compatible producer/core/consumer set; it never weakens admission.
No capability or local override applies to this contract-only extension.

Use focused PR/exact-head and exact-main CI, then existing main/cd.yml with the
GitHub production environment and npm OIDC. The release pipeline promotes the
version and Unreleased notes. Verify registry bytes/provenance and installed
ESM/CJS/strict declarations before downstream adoption. No dependencies, workflow
policies, runtime controls, site deployment or credentials change.

## Validation and NFRs

Requirements-derived tests fail before the change and cover zero/nonzero empty
clips, mixed clips, source evidence/immutability, canonical roundtrip and graph
membership. Reject asymmetric references, forged populated values, invalid or
missing keys, durations/metadata, duplicate identities and count/metadata limits.
Keep old golden encodings, all existing animation tests, static refusal and
disabled/enabled/rollback compiler controls. Run full tests/80%+ LCOV with the
changed source present, lint/types/build, privacy/package and dependency audits,
then actual packed/installed consumers and verified release evidence.

Security/privacy: closed-key/finite/bounded admission and private byte validation
remain active; no new transport, storage, logs or secrets. Reliability and
performance: no new retry/concurrency/global cache, no new evaluation loops;
existing clip/metadata/resource ceilings and cancellation/deadline behavior stay
in force. Observability remains finite safe errors. Portability adds no platform
imports. Maintainability/testability keep the contract in its owning package
with explicit controls. Synthetic fixtures are Plasius-owned Apache-2.0 data.
UI accessibility/SEO, server latency/scaling, browser rendering and ACA secretref
are N/A to this package data contract; downstream qualification remains required.
