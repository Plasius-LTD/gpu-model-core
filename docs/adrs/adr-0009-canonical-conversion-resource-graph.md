# ADR-0009: Canonical conversion resource graph

Status: Accepted
Date: 2026-09-08
Task: gpu-model-core#5
Parent Feature: plasius-ltd-site#1148

## Context

Adapters need deterministic resource relationships and conversion package
membership without owning renderer structures or weakening verified byte identity.
The canonical document already owns material, texture, rig and animation fidelity.

## Decision

Build an additive immutable graph from a privately verified GpuModelDocument.
Reuse its frozen values and verified Blob resources. Namespaced kind/id tuple
keys distinguish equal local identifiers in different collections. Sort graph
nodes and dependency keys by code-unit order; retain semantic order within the
canonical values (joints, animation samples and mesh attributes).

Include resource, accessor, texture, material, skeleton, skin, animation and
provenance nodes. Skeleton data retains joints; skin and animation dependencies
reach their buffers through accessors. Document scene/geometry remains in the
canonical document and is not reinterpreted by the graph. Packages contain
explicit typed graph references and may contain other packages. Reject duplicate
identities, repeated package members, missing references and package cycles.
The complete graph is a dependency DAG; scene target associations remain in the
canonical payload rather than creating artificial animation/skin feedback edges.

Each byte resource has exactly one location binding: embedded or external with
a portable package-relative path, plus the existing embedding-policy vocabulary.
An external origin still requires verified resolved bytes in the document. Core
never fetches URLs, reads files, writes archives, or authorizes an output path.
Reject ambiguous paths (absolute paths, traversal, empty segments, backslashes,
percent escapes, URL query/fragment/scheme syntax, reserved device names and
trailing dots), duplicate paths ignoring ASCII case and incompatible embedded
origins with forbid-embedding. Exporters must independently enforce the recorded
policy and root confinement; prefer-* policies express preference, not proof of
export completion. Texture-specific policies remain on canonical texture values.

Bound graph nodes, dependency edges, packages and descriptor input. Descriptor
validation rejects accessors, sparse arrays, unexpected keys and non-plain
objects without invoking input getters. Errors contain fixed codes and no input
values. Synchronous work is capped; no retries, external I/O or global caches.
The graph is privately branded; a structural clone must be rebuilt from a
reverified document. Byte hashes identify content, while tuple keys identify
logical resources, so distinct logical resources may share a content hash.

## Alternatives

A separate generic graph/payload validator would duplicate core's attestation
and fidelity contract. Putting package promotion in this graph would duplicate
asset-contracts. Both are rejected. This API describes conversion packages only.

## Rollout and release

Inherit gpu.model.conversion.enabled: the remote evaluator in the consuming
runtime controls adoption, with no additional capability or stored flag mutation.
Keep downstream adoption disabled until adapter conformance passes. Rollback
disables conversion adoption and pins the prior public package version.
Release the additive API through main cd.yml / production / npm OIDC. No site
consumer or Azure runtime changes occur; backend secretref verification is N/A.

## Validation

Synthetic embedded/external fixtures, all canonical graph kinds, deterministic
reordering, malformed/missing/duplicate/cyclic references, hostile descriptors,
byte attestation, immutability, fixed work bounds, and packed ESM/CJS imports.
Run full coverage, changed-file LCOV, typecheck, lint, build, dependency audit,
privacy and package gates before PR CI and release verification.
