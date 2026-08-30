# @plasius/gpu-model-core

Canonical model document, resource graph, diagnostics, and adapter contracts.

This repository is the dedicated package boundary defined by ADR 0094.

## Implementation tracker

The canonical conversion architecture is defined by [ADR 0094 in `plasius-ltd-site`](https://github.com/Plasius-LTD/plasius-ltd-site/blob/main/docs/adrs/adr-0094-gpu-model-family-and-canonical-proxy-conversion.md). The package implementation work is split into Project-tracked Tasks:

- [Bootstrap package boundary](https://github.com/Plasius-LTD/gpu-model-core/issues/1)
- [Canonical GPU model document schema](https://github.com/Plasius-LTD/gpu-model-core/issues/3)
- [Diagnostics and repair contracts](https://github.com/Plasius-LTD/gpu-model-core/issues/4)
- [Canonical model resource graph](https://github.com/Plasius-LTD/gpu-model-core/issues/5)
- [Adapter capability and conversion registry contracts](https://github.com/Plasius-LTD/gpu-model-core/issues/6)
- [Verified static-model document for the ChatGPT PVOX demo](https://github.com/Plasius-LTD/gpu-model-core/issues/13)

The general package Tasks inherit `gpu.model.conversion.enabled` from Feature
#1148 and remain independent of format-specific loaders and renderers. Task #13
is an additive dependent slice under Feature #2012 and also requires
`asset.pipeline.pvox-models.enabled` before its compiler projection can run.

## Canonical document v1

`GpuModelDocument` is the immutable, renderer-neutral hand-off between source
format adapters, model processing, and render bridges. Raw resources cross an
asynchronous verification boundary before document construction: an injected
worker port streams every `Blob` through payload inspection and SHA-256 digest
verification. Only privately attested resources are accepted by the synchronous
factory. This prevents a shape-compatible object, forged digest string, or
structured clone from claiming that bytes were verified.

```ts
import {
  CANONICAL_GPU_MODEL_COORDINATE_SYSTEM,
  GPU_MODEL_DOCUMENT_SCHEMA_VERSION,
  createAndVerifyGpuModelDocument,
  type GpuModelResourceVerificationPort,
} from "@plasius/gpu-model-core";

declare const untrustedAdapterOutput: unknown;
declare const verificationPort: GpuModelResourceVerificationPort;
const document = await createAndVerifyGpuModelDocument(
  untrustedAdapterOutput,
  verificationPort,
);

document.schemaVersion === GPU_MODEL_DOCUMENT_SCHEMA_VERSION; // true
document.coordinateSystem === CANONICAL_GPU_MODEL_COORDINATE_SYSTEM; // true
```

Adapter output includes roots, nodes, verified resources, accessors, meshes,
materials, first-class texture fidelity nodes, distinct skeletons, joints and
skins, blend shapes, animation clips, analytic geometry, bounds, provenance,
diagnostics, and bounded JSON metadata. Material texture transforms, colour
space, usage, extension payloads, authored rig weights, clip timing, and source
metadata survive the canonical boundary.

Verification applies non-raiseable defaults of 100 MiB per resource, 164 MiB
aggregate resources, 64 MiB aggregate images, and 4096 pixels per image axis.
It verifies detected MIME and image dimensions before hashing that image, then
constructs the returned `Blob` from the exact digest-verified byte snapshot.
One internal deadline signal is propagated to both worker-port calls and every
stream chunk. Re-verifying an attested resource or document is idempotent, but
still honours cancellation and re-applies any tighter byte/image/aggregate
limits using retained inspection evidence.

The document validator then reads only the private snapshot to reject
non-finite accessor data, false min/max claims, out-of-range indices and skin
joint indices, mismatched weights, texture bindings whose required
`TEXCOORD_n` is absent from a material-using primitive, and bounds that do not
match canonical `POSITION` bytes under affine world transforms. Payload,
index, and instanced world-geometry work has aggregate ceilings; accessor
evidence, mesh primitive/position indexes, and repeated position/index scans
are cached within one validation. Scene ancestry uses one bounded interval
index rather than per-joint parent walks. Blend-shape delta/accessor work is
bounded across the document and reuses the verified payload evidence.

`createGpuModelDocument` remains available for trusted composition code that
already holds privately verified resources. `isGpuModelDocument` narrows only
values returned by a factory; `canCreateGpuModelDocument` is the non-narrowing
probe. A structured clone deliberately loses private attestation and must pass
through `createAndVerifyGpuModelDocument` again. Format parsing, renderer
uploads, catalogue rights, promotion identity, tolerant repair, and target loss
reporting stay outside this Task's package boundary.

## Bounded static PVOX demo projection

Task #13 adds a deliberately narrower compiler hand-off without changing the
general document owned by Task #3. Consumers first create a privately verified
`GpuModelDocument`, evaluate the remote
`asset.pipeline.pvox-models.enabled` flag, and then request a compiler-safe
world-triangle projection:

```ts
import {
  createGpuModelStaticDemoCompilerInput,
  type GpuModelDocument,
} from "@plasius/gpu-model-core";

declare const verifiedDocument: GpuModelDocument;
declare const pvoxModelsEnabled: boolean; // remote flag evaluation

const compilerInput = await createGpuModelStaticDemoCompilerInput(
  verifiedDocument,
  { pvoxModelsEnabled },
);

compilerInput.canonicalDocumentHash; // SHA-256 of canonical document bytes
compilerInput.worldTriangles; // verified positions, normals, bounds and regions
```

The profile accepts at most 200,000 explicit world-space triangles, 4,096
nodes, 16,384 primitives, 4,096 fixed-factor materials, and 16 MiB of verified
buffer resources. Every world-space coordinate additionally has a fixed,
non-raiseable magnitude ceiling of 1,048,576 metres, with consistent axis
extent and diagonal bounds. The compiler also checks every computed triangle
coordinate against that ceiling; security bounds use tight absolute equality
instead of coordinate-relative tolerance. It accepts only rigid `triangles`, opaque texture-free
metallic-roughness or unlit materials, invertible transforms, and geometry
whose verified bounds prove metre/Y-up/-Z-forward/floor-centred normalization.
Skins, animation, morphs, analytic geometry, images, texture bindings, custom
material workflows, strips, lines, and points fail closed.

`encodeGpuModelDocumentCanonical` sorts object keys while preserving semantic
array order. Verified resource bytes are bound through their privately checked
SHA-256 identities, so canonical encoding does not duplicate source payloads.
`hashGpuModelDocumentCanonical` provides the stable whole-document identity.
The projection retains safe source/converter hashes and material-region IDs,
but deliberately excludes source URLs and arbitrary metadata from the PVOX
compiler surface.

The dependency flow is:

```text
strict source adapter
  -> createAndVerifyGpuModelDocument (Task #3 / Feature #1148)
  -> createGpuModelStaticDemoCompilerInput (Task #13 / Feature #2012)
  -> @plasius/gpu-model-voxel
```

This bounded demo contract does not implement provider acquisition, general
source repair, native sparse GPU traversal, deformation, destruction, or the
full production Partner-to-PVOX acceptance plan. See the
[static demo compiler-input design](docs/design/static-demo-compiler-input.md).

## Rollout

- Canonical-document feature flag: `gpu.model.conversion.enabled`
- Static PVOX demo feature flag: `asset.pipeline.pvox-models.enabled`
- Capability: none for this package-only layer
- Rollback: disable `asset.pipeline.pvox-models.enabled` to stop new demo projections, disable `gpu.model.conversion.enabled` for the broader conversion boundary, and keep consumers pinned to the last validated package release

## Development

Requires Node.js 24 and npm.

```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run build
npm run pack:check
```

## License

Apache-2.0. See LICENSE, SECURITY.md, and the files under legal/.

<!-- BEGIN PLASIUS RELEASE INTEGRITY -->
## Release integrity

CI keeps the administrative contributor registry outside Git and npm package
artifacts using normalized path checks and sealed-tar revalidation. The
GitHub-hosted Node.js 24.18.0 release path follows the released
`@plasius/schema` v1.4.2 template: release metadata lands through a protected
pull request, exact-main CI must pass, and the immutable tarball is published
through npm OIDC. Package-specific adaptations are limited to GitHub-hosted CI
while the organisation runner is unavailable, current Node-24-compatible action
majors with best-effort Codecov CLI upload, and a protected-merge retry when
repository auto-merge is unavailable. Version `0.1.0` may use the explicit,
time-limited `bootstrap_first_publish` production gate only while the package is absent;
that credential is removed after the npm trusted publisher binding is active.
<!-- END PLASIUS RELEASE INTEGRITY -->
