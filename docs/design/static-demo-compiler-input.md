# Static demo compiler input

- Status: Implemented for Task `Plasius-LTD/gpu-model-core#13`
- Story: `Plasius-LTD/plasius-ltd-site#2094`
- Feature: `Plasius-LTD/plasius-ltd-site#2012`
- Predecessor dependency: `Plasius-LTD/gpu-model-core#3`
- Consumer: `@plasius/gpu-model-voxel`

## Purpose

The ChatGPT-to-PVOX GPU Demo needs a small, auditable hand-off between a strict
source adapter and deterministic voxel compilation. The full canonical model
document intentionally preserves much more source fidelity than this demo can
compile. Passing that general graph directly to the PVOX package would make the
consumer repeat security validation and invite accidental support claims.

## Boundary

`createGpuModelStaticDemoCompilerInput` accepts only a privately verified
`GpuModelDocument` and an explicit positive evaluation of
`asset.pipeline.pvox-models.enabled`. It produces a deeply frozen value with:

- the canonical whole-document SHA-256;
- the canonical metre/Y-up/-Z-forward/floor-centred basis and bounds;
- source format/content hash and converter identity, with no source URL;
- fixed, texture-free material regions identified by source material ID; and
- bounded world-space triangles with source node, mesh and primitive IDs,
  positions, normalized normals, material index, and per-triangle bounds.

The canonical encoder binds the whole document to verified resource content
hashes. It never serializes `Blob` objects or duplicates source payload bytes.
Object keys are lexically sorted and semantic array order remains significant.

## Validation order

1. Verify that the input carries the private Task #3 document attestation.
2. Require the caller-provided remote feature evaluation to be enabled.
3. Prove floor and horizontal-centre normalization from verified world bounds.
4. Reject dynamic, image, texture, non-triangle, unsupported-material, and
   unsupported-attribute content.
5. Enforce caller-tightenable but non-raiseable resource and scene limits.
6. Resolve only byte-verified accessors and canonical scene transforms.
7. Correct reflected winding, transform authored normals, and reject singular
   transforms, incomplete triangle groups, and degenerate triangles.
8. Hash the canonical document and freeze the compiler projection.

## Security and privacy

No external URI, file path, executable payload, shader, arbitrary metadata, or
unverified byte view appears in the compiler result. Material and provider text
cannot become instructions. The canonical source identifier remains bound by
the whole-document hash but is not copied into downstream PVOX input.

## Rollout and rollback

The site/backend owns remote evaluation of
`asset.pipeline.pvox-models.enabled`; core receives only its boolean decision
and fails closed on false or malformed options. Disable that flag to stop new
demo compilation. `gpu.model.conversion.enabled` remains the independent parent
gate for the general Task #3 document boundary.

## Explicit non-goals

This profile does not implement provider downloads, general GLB support,
textures, repair, LOD generation, physical-property inference, PVOX layout,
native sparse GPU traversal, destruction, animation, or production rollout.
Those remain owned by their tracked repositories and Features.
