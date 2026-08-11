# @plasius/gpu-model-core

Canonical model document, resource graph, diagnostics, and adapter contracts.

This repository is the dedicated package boundary recorded in
[ADR 0001](docs/adrs/adr-0001-gpu-model-core-package-boundary.md).

## GPU compatibility contract

Final assembled WGSL is the source of truth for model-facing GPU layouts. This
package exposes the canonical model/resource boundary while delegating GPU
reference, digest-grammar, semantic, and immutable-version validation to
`@plasius/gpu-shader` and reusing the flat `ModelAssetManifest` from
`@plasius/asset-contracts`:

```ts
import { createModelAssetManifest } from "@plasius/asset-contracts";
import {
  asSha256Hex,
  readModelGpuCompatibility,
  type GpuCompatibleModelResource,
} from "@plasius/gpu-model-core";

const resource: GpuCompatibleModelResource = createModelAssetManifest({
  assetKind: "model",
  assetId: "model-character",
  version: "2026.07.15-1",
  entrypoint: "model.glb",
  files: [{
    path: "model.glb",
    byteLength: 1024,
    sha256: asSha256Hex("0".repeat(64)),
    contentType: "model/gltf-binary",
    role: "model",
  }],
  sourceAdapter: "local-import",
  createdAt: "2026-07-15T00:00:00.000Z",
  gpuInterface: {
    interfaceId: "interface.character",
    interfaceVersion: "2026.07.15-1",
    manifestUri: "https://assets.example.invalid/gpu-interfaces/interface.character/2026.07.15-1/manifest.json",
    manifestSha256: asSha256Hex("1".repeat(64)),
    interfaceAbiHash: asSha256Hex("2".repeat(64)),
    modelAbiHash: asSha256Hex("3".repeat(64)),
  },
  modelAbiHash: asSha256Hex("3".repeat(64)),
  providedSemantics: ["position", "normal", "material.base-color"],
  defaultStyleProfile: null,
});

const gpu = readModelGpuCompatibility(resource);
```

The descriptor contains an exact `GpuInterfaceRef`, the reflected
`modelAbiHash`, provided semantic tokens, and an optional exact default style
profile. It deliberately contains no compatible-profile list, channel,
promotion state, or mutable version alias. Compatible realistic, cartoon,
anime, and future profiles are discovered from the promoted catalog, so adding
a compatible profile never requires republishing a model.

Both parsing APIs return detached, deeply frozen values. The resource reader
maps the canonical flat `assetId`, `version`, `gpuInterface`, `modelAbiHash`,
`providedSemantics`, and `defaultStyleProfile` fields to the shader descriptor.
Every field must be an own data property; inherited or accessor-backed values
are rejected without reading ordinary getters. The resource itself must be a
plain JSON object and every compatibility field must be enumerable so storage
and runtime see the same serialized contract. JavaScript has no portable way to
identify every `Proxy`: prototype and property-descriptor traps may run while
the boundary is inspected, but thrown trap details are replaced by one constant
error without retaining the original cause.

`asSha256Hex` checks only lowercase 64-character hexadecimal grammar. It does
not hash bytes, fetch an asset, or prove that bytes match a digest. Model and
interface ABI hashes must come from final-WGSL reflection, while manifest/file
digests must come from the model-storage publication path after hashing the
exact fetched or uploaded bytes. The parsers enforce shape, equality, and
immutable references; storage/runtime remain responsible for digest-byte
verification before trusting an asset.

## Rollout

- Feature flag: gpu.model.conversion.enabled
- Shader-store feature flag inherited by this contract: asset.pipeline.shader-store.enabled
- Capability: none for this package-only layer
- Rollback: disable shader-store catalog loading and pin the last validated
  package/model versions. Immutable model bytes are never edited during
  rollback.

## Development

Requires Node.js 24 and npm.

```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run build
npm run test:coverage
npm run pack:check
```

## Architecture

- [ADR 0001: GPU model core package boundary](docs/adrs/adr-0001-gpu-model-core-package-boundary.md)
- [ADR 0002: Dual ESM and CJS distribution](docs/adrs/adr-0002-dual-esm-cjs-distribution.md)
- [ADR 0003: Dual module runtime boundary enforcement](docs/adrs/adr-0003-dual-module-runtime-boundary.md)
- [ADR 0005: Model GPU compatibility belongs to the immutable model version](docs/adrs/adr-0005-model-gpu-compatibility-contract.md)
- [TDR 0001: Canonical GPU compatibility fields and parser boundary](docs/tdrs/tdr-0001-model-gpu-compatibility-parser-boundary.md)
- [Model GPU compatibility contract](docs/design/model-gpu-compatibility-contract.md)

## License

Apache-2.0. See LICENSE, SECURITY.md, and the files under legal/.
