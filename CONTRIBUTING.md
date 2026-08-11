# Contributing to @plasius/gpu-model-core

Thank you for helping make model conversion and rendering contracts portable
and reliable. Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
Before a first contribution, complete the appropriate agreement under
[`legal/`](legal/CLA.md). Report vulnerabilities privately through
[SECURITY.md](SECURITY.md), never through a public issue or pull request.

## Before implementation

Non-trivial work follows [WORKFLOW.md](WORKFLOW.md) and must be represented in
the GitHub Project hierarchy (`Epic -> Feature -> Story -> Task`). Search for an
existing issue first, assign the active Task, and move it to `In Progress`
before editing. Public API or architecture changes require an ADR under
[`docs/adrs/`](docs/adrs/index.md).

The parent model-conversion feature uses the remotely controlled
`gpu.model.conversion.enabled` flag. Shader-store integration additionally
inherits `asset.pipeline.shader-store.enabled`. This package has no user-facing
entitlement capability of its own.

## Local development

Use Node.js 24 from `.nvmrc` and npm:

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run test:coverage
npm run pack:check
```

Do not edit `dist/`, `coverage/`, generated tarballs, or dependency contents by
hand.

## Contract design rules

- Reuse canonical `@plasius/*` contracts rather than copying their grammar.
- Treat final assembled WGSL reflection as the source of truth for model-facing
  GPU layouts and ABI hashes.
- Keep mutable catalog state, promotion, compatible-profile discovery, and
  qualification evidence outside immutable model manifests.
- Never accept caller-authored offsets, sizes, alignments, or strides as layout
  authority.
- Keep the root export browser-safe; filesystem, network, storage, and browser
  automation belong in their owning packages.
- Exact-version and digest parsers validate grammar and contract equality only.
  Byte owners must hash and verify exact uploaded or fetched bytes.
- Reject accessor-backed resource fields without invoking ordinary getters.
  JavaScript proxy reflection traps may run, so sanitize their failures and do
  not preserve provider errors as public causes.
- Preserve public API compatibility unless the tracked work intentionally
  defines a breaking change.

## Tests and quality

Derive tests from acceptance criteria before implementation. Fixes should add a
regression that fails before the fix when practical. Framework source must keep
at least 80% LCOV line coverage, and every changed TypeScript source file must
appear in combined LCOV.

Before requesting review, confirm:

- tests, coverage, lint, typecheck, build, dependency audits, and package
  verification pass;
- browser ESM, Node ESM, and Node CommonJS consumers remain valid;
- examples contain no secrets or real personal data;
- README, CHANGELOG, and applicable ADR/TDR/design documentation are updated;
  and
- CI is green after the branch is pushed.

## Dependencies

Minimize runtime dependencies. New model behavior should first reuse an
existing `@plasius/*` package; if the shared capability is missing, update and
release that owning package before consuming it here. Avoid unrelated dependency
churn and keep runtime dependency audits free of known high-severity issues.

## Commits, pull requests, and releases

Use a focused branch and Conventional Commit titles such as:

- `feat: add immutable model gpu compatibility projection`
- `fix: reject accessor-backed model resources`
- `test: cover model abi hash drift`
- `docs: clarify digest authority`

Pull requests should describe the problem, solution, compatibility impact,
validation evidence, and operational follow-up. Packages are published only by
`.github/workflows/cd.yml` from protected `main` through the `production`
environment. Never publish locally or bypass the approved release workflow.
