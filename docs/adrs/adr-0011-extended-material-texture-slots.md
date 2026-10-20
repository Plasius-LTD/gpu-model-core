# ADR-0011: Validate additional material texture bindings in canonical core

Date: 2026-10-20
Status: Accepted
Tracking: [core #41](https://github.com/Plasius-LTD/gpu-model-core/issues/41),
[glTF #14](https://github.com/Plasius-LTD/gpu-model-gltf/issues/14),
[Feature #1150](https://github.com/Plasius-LTD/plasius-ltd-site/issues/1150).

## Context

The existing gpu-shared glTF loader and gpu-renderer material normalization
carry volume thickness, specular strength/color, iridescence factor/thickness
and anisotropy textures. Core 0.4.6 has no typed slots/usages for those bindings.
glTF material fidelity cannot pass through canonical validation using them.

Storing image references only in extension metadata would lose the existing
resource graph and validation guarantees. Reimplementing canonical references
inside a format package would split ownership and violate the hub-and-spoke
model. Narrowing glTF support to the old slot list would omit existing consumer
semantics. These alternatives are rejected.

## Decision

Extend the optional `GpuModelMaterialTextures` fields and `GpuModelTextureUsage`
union, runtime admission list and slot-to-usage table:

| Slot | Intended usage |
| --- | --- |
| thickness | thickness |
| specular | specular |
| specularColor | specular-color |
| iridescence | iridescence |
| iridescenceThickness | iridescence-thickness |
| anisotropy | anisotropy |

All use the existing binding parser, primitive UV-set validation and canonical
reference checks. Image bytes remain privately verified and content-addressed;
texture hash/MIME/byte length must agree with the image. Slot/declared usage,
binding/texture colour space and sampler identity must agree. Transforms retain
offset/scale/rotation radians. Separate texture interpretations may share image
bytes. Resource graph construction already enumerates all material bindings;
no alternate graph or format-specific edge is introduced.

The format adapter owns KHR semantics, factors, channel selection, defaults and
unsupported-feature diagnostics. This change does not admit arbitrary slots,
validate KHR extension metadata, parse models, decode images or render them.
It adds no runtime dependency or I/O and changes no validation/work ceilings.
The finite optional slot table adds constant work per material within existing
document/graph limits; total declared edge limits still apply.

## Compatibility, rollout and release

This is an additive minor package change. Existing valid documents retain their
encoding/hash because no fields/defaults are injected. New-slot documents need
the release introducing this contract or later; older releases reject them.
The document schema identifier remains v1. Consumers must retain and verify the
producer's package/profile version instead of assuming every v1 producer admits
the same optional extension set.

The static-demo compiler still rejects every texture binding. Core validation
always applies and does not fetch flags. Consumer adoption inherits the remote
`gpu.model.conversion.enabled` decision; no capability or local override is
added. Rollback disables adoption and retains the last validated core/importer
and existing loader. glTF #14, export #16, conformance #17 and gpu-shared #55
retain their own acceptance gates; this prerequisite does not complete them.

Release through the existing PR/exact-SHA CI and main `cd.yml` production/npm
OIDC path. The pipeline owns version/changelog promotion. Verify registry
availability, tarball integrity/provenance and installed ESM/CJS behavior before
any downstream dependency update. No site/ACA deployment is part of this change.

## Verification and NFRs

Requirement-derived fixtures cover each slot, immutable transforms and UV
selection, deterministic encoding/hash, graph edges with shared image bytes,
unknown slots/usages, missing texture/UV references, usage/sampler/colour-space
mismatch and tampered image evidence. Texture-free compiler rejection and its
disabled gate remain covered; the existing golden hash protects old documents.
Run tests/coverage (80%+ and changed source in LCOV), lint/typecheck/build,
privacy/public-package checks, audits and installed ESM/CJS probes.

Security/privacy reuse strict keys, verified bytes and bounded typed errors.
Metadata is authored data, not a public logging/redaction boundary. Cancellation,
deadline, memory and graph-work controls remain on existing verification paths;
there are no retries or new external services. Browser portability uses existing
Blob and verification ports with no platform imports. Accessibility, SEO and
device UI checks are N/A because no UI changes. Renderer/format conformance
remains downstream acceptance, not an assertion made by canonical slot admission.
