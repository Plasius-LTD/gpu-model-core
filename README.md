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

All implementation Tasks inherit `gpu.model.conversion.enabled` from Feature #1148 and remain independent of format-specific loader repositories and renderer integration packages.

## Bootstrap status

This initial repository contains the approved schema baseline, legal and governance files, and a package smoke-test surface. Functional model conversion work is tracked in the repository's [TASK] issues and must flow through the canonical GPU model boundary.

## Rollout

- Feature flag: gpu.model.conversion.enabled
- Capability: none for this package-only layer
- Rollback: disable the feature flag and keep the published package version pinned to the last validated release

## Development

Requires Node.js 24 and npm.

```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run build
npm pack --dry-run
```

## License

Apache-2.0. See LICENSE, SECURITY.md, and the files under legal/.

<!-- BEGIN PLASIUS RELEASE INTEGRITY -->
## Release integrity

CI keeps the administrative contributor registry outside Git and npm package
artifacts using exact, case-normalised path checks. CI runs on approved
self-hosted runners. Release preparation and npm publication use GitHub-hosted
runners with Node.js 24.18.0 LTS. CD remains disabled until the npm trusted
publisher binding is verified and the legacy token fallback is removed.
<!-- END PLASIUS RELEASE INTEGRITY -->
