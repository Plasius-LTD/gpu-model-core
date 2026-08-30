
# Changelog

All notable changes to this project will be documented in this file.

The format is based on **[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)**, and this project adheres to **[Semantic Versioning](https://semver.org/spec/v2.0.0.html)**.

---

## [Unreleased]

- **Added**
  - (placeholder)

- **Changed**
  - Aligned GitHub CI, release preparation, immutable package sealing, npm OIDC
    publication, privacy checks, and first-publication safeguards with the
    released `@plasius/schema` v1.4.2 package template.

- **Fixed**
  - Added trusted same-repository pull-request validation and moved all CI jobs
    to GitHub-hosted Linux so protected release checks cannot wait on an
    unavailable self-hosted runner.
  - Retried the protected release-metadata merge while required checks complete,
    allowing the approved CD path to proceed when repository auto-merge is
    unavailable.

- **Security**
  - Revalidated the complete npm tar stream against the same normalized public
    inventory policy before publication; the temporary bootstrap remains
    isolated from the default trusted-publishing path.

## [0.1.0] - 2026-08-25

- Added a fail-closed, version-`0.1.0`-only first-publication bootstrap that is available solely through `cd.yml` and the `production` environment, refuses an existing npm package, and is removed after trusted publishing is bound.

- **Added**
  - Bootstrapped the dedicated package repository from the schema baseline.
  - Added the gpu.model.conversion.enabled rollout reference and package smoke test.
  - Added Project-tracked Tasks for the canonical schema, diagnostics, resource graph, and adapter registry implementation boundaries.
  - Added the versioned, renderer-neutral `GpuModelDocument` contract with complete material/texture fidelity, distinct skeleton/joint/skin graphs, authored vertex weights, blend shapes, animation timing/source metadata, analytic placeholders, and provenance.
  - Added injected streaming resource verification, private resource/document attestation, asynchronous raw-document construction, and a non-narrowing synchronous construction probe.
  - Added deterministic canonical whole-document encoding and SHA-256 identity over privately verified resource identities.
  - Added the flag-gated `plasius.gpu-model-static-demo/1` compiler projection with bounded world triangles, fixed surface materials, safe provenance evidence, and explicit normalization proof for the ChatGPT-to-PVOX GPU Demo slice.

- **Changed**
  - Bound npm publication to the exact prepared `main` commit after successful push-triggered CI.
  - Made release-only Codecov coverage uploads best-effort; CI coverage gates remain independent while Codecov quota or service failures emit warnings without blocking publication.
  - Forwarded an explicitly selected first-publication bootstrap policy from the `prepare` dispatch to the exact-commit `publish` dispatch while preserving token-free defaults and prohibiting automatic credential fallback.
  - Raised all package coverage gates to at least 80% and included the canonical `tests/` tree in TypeScript validation.
  - Bound accessor min/max, indices, skin weights, animation values, and world-space document bounds to privately verified resource bytes.
  - Kept the Task #13 demo compiler projection additive to the Task #3 general canonical document and fail-closed for dynamic, textured, non-triangle, over-budget, singular, or non-floor-centred inputs.

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - Made resource re-verification idempotent while still enforcing tighter cached limits and cancellation, and cross-checked every material texture binding against the primitive's required `TEXCOORD_n` attribute.
  - Removed multiplicative mesh-instance, rig-ancestry, and blend-shape validation paths by indexing reusable evidence once and applying aggregate work ceilings.
  - (placeholder)

- **Security**
  - Removed the npm write-token path, added a fail-closed npm 11.5.1-or-newer OIDC guard, and denied fork PR code access to self-hosted CI.
  - Required an npm `E404` package-absence result before the one-time `0.1.0` credential may be used; registry and transport failures now fail closed.
  - Pinned patched `brace-expansion`, `nanoid`, and `postcss` transitive build dependencies so the complete release toolchain passes the high-severity audit gate.
  - Added fail-closed source and npm-package admission for the administrative contributor registry and pinned the CI/CD runtime to Node.js 24.18.0 LTS.
  - Updated transitive development-tool overrides for `brace-expansion` and `nanoid` to patched releases after dependency advisory review; runtime dependencies remain unaffected.
  - Added fail-closed resource/image budgets, MIME and image inspection, affine-matrix enforcement, and control/bidirectional-text escaping for bounded validation errors.
  - Bound returned resource payloads to the exact digest snapshot, propagated a real internal deadline signal through verification ports and chunks, capped aggregate instanced-geometry work, cached repeated geometry evidence, and fixed the static PVOX coordinate ceiling at 1,048,576 metres.
  - Replaced coordinate-relative bounds tolerance with tight absolute equality and independently rejected computed static-demo triangle coordinates outside the PVOX range.
  - (placeholder)

## [1.2.17] - 2026-06-28

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.16] - 2026-06-22

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.15] - 2026-06-22

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.12] - 2026-06-01

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.11] - 2026-05-13

- **Added**
  - (placeholder)

- **Changed**
  - Refreshed development dependencies to the latest stable published versions.
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.10] - 2026-04-21

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.9] - 2026-04-21

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.8] - 2026-04-02

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.7] - 2026-03-27

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.6] - 2026-03-09

- **Added**
  - Added field exposure metadata (`.exposure(...)`, `.internal()`, `.public()`) for separating validation/storage concerns from client-facing serialization.
  - Added schema-driven `serialize()` support that strips unknown fields and omits `internal` fields by default.

- **Changed**
  - Schema descriptions and rendered schema metadata now include field exposure information.

- **Fixed**
  - Prevented server-only fields from being treated as implicitly safe for client responses when callers serialize entities through the schema contract.

- **Security**
  - (placeholder)

## [1.2.5] - 2026-03-04

- **Added**
  - (placeholder)

- **Changed**
  - Added template-level dual-module packaging policy that mandates runtime-safe CommonJS boundaries when emitting `dist-cjs/*.js` under `type: module`.

- **Fixed**
  - Established publish-time guardrails (`build` + `pack:check`) in template governance to prevent dual-module regressions in downstream `@plasius/*` packages.

- **Security**
  - (placeholder)

## [1.2.2] - 2026-02-28

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.1] - 2026-01-22

- **Added**
  - Monthly GitHub Actions workflow to run `npm audit fix` on a schedule and open a PR with the results.

- **Changed**
  - Restore `main`, `module`, and `types` fields alongside the export map for broader CJS/ESM tool compatibility.
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.2.0] - 2025-12-31

- **Added**
  - Additional validator coverage for names, safe text, percentages, rich text, user IDs, languages (BCP47), and ISO country/currency codes.

- **Changed**
  - README usage examples refreshed to match current `createSchema` signature, field helpers, and default-handling behavior.
  - Optionality tracking consolidated to a single flag (`isRequired`, default `true`) used across validation, descriptions, and type inference; `.optional()`/`.default()` set `isRequired` to `false`.
  - Validation helpers re-export `validateLanguage` (BCP 47).

- **Fixed**
  - Ref logging keeps `type/id` when no nested shape is provided.
  - Optional PII fields no longer emit null/undefined artifacts when absent during storage/read/scrub.
  - Validation deep-clone now preserves non-JSON-safe values (e.g., `Date`) without mutating caller data.
  - PII helpers align array item encryption/hashing across storage/read/scrub, including nested object items.
  - Defaults are now applied during validation for top-level fields, nested objects, and array items.
  - `prepareForRead` now returns hashed values written by `prepareForStorage`, preventing loss of hash-only PII fields.
  - Composition validation now uses the item ref type for array-of-ref fields, correctly resolving and validating referenced entities.
  - Arrays of primitives now run their item validators (e.g., `.pattern()`, `.min()`) for every element instead of accepting invalid values.
  - Arrays of refs now validate nested ref shapes (defaults, required fields, and validators) instead of only checking `type/id`.
  - Single ref fields now enforce `refType` during validation, preventing mismatched entity links earlier.
  - PII helpers (`prepareForStorage`, `prepareForRead`, `sanitizeForLog`, `scrubPiiForDelete`) now recurse through nested objects, arrays, and refs so nested PII is transformed/sanitized/scrubbed correctly.
  - Validation now deep-clones inputs before applying defaults to avoid mutating caller-owned objects.
  - Schema descriptions now surface optionality, system/immutable flags, deprecation metadata, and normalize nullable fields (`enum`, `refType`, `pii`, `deprecatedVersion`) to `null`.
  - Composition validation rejects mismatched reference types before resolution.
  - Numeric enums are enforced during validation instead of accepting out-of-range values.
  - Immutable flags are honored for nested object/array/ref children when validating updates against an existing entity.
  - PII strict/warn enforcement now applies to nested fields (objects, arrays, refs), blocking empty high-PII subfields.
  - ISO 3166-1 list updated to include `PS`; ISO 4217 list updated to include `SLE` (while retaining `SLL` for legacy data).

- **Security**
  - (placeholder)

## [1.1.1] - 2025-09-24

- **Added**
  - new Schema upgrade pathway

- **Changed**
  - package.json update to include:
    - "sideEffects": false,
    - "files": ["dist"],
  - package.json removed:
    - "main": "./dist/index.cjs",
    - "module": "./dist/index.js",
    - "types": "./dist/index.d.ts",

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [1.1.0] - 2025-09-18

- **Added**
  - field().upgrade() function now added to allow upgrades of older data sets to newer data.
  - min/max/pattern/default FieldBuilder elements added for validation.
  - Added new validator for language code BCP 47 format.
  - Added new validator options for ISO DATE TIME filtering to Date or Time or Both
  - Added new pre-built field() types including PII flags and validators for:
    - email
    - phone
    - url
    - uuid
    - dateTimeISO
    - dateISO
    - timeISO
    - richText
    - generalText
    - latitude
    - longitude
    - version
    - countryCode
    - languageCode
  - New field().xxx tests for the above types.

- **Changed**
  - Updated CD Pipeline to accept a new param for version Major, Minor or Patch update

- **Fixed**
  - validateISODateTime for dateTime now accepts string matches that might not be the same as the date.toISOString() return value but are still valid ISO Date Time Strings.

- **Security**
  - (placeholder)

## [1.0.18] - 2025-09-17

- **Fixed**
  - CD pipeline reorder fix to restore CHANGELOG.md versions

## [1.0.17] - 2025-09-17

- **Added**
  - chore: Code coverage added

## [1.0.13] - 2025-09-16

- **Changed**
  - ./src/schema.ts Added comments defining functionality on all externally facing functions.

- **Fixed**
  - ./src/schema.ts Validation no longer mutates the input, internal system fields are set only on result if not previously present.

---

## [1.0.0] - 2025-09-16

- **Added**
  - Initial public release of `@plasius/schema`.
  - Fluent field builder API: `field().string().required()`, `field().number().min()`, etc.
  - Type inference utilities to derive TypeScript types from schema definitions.
  - Built-in validators for common standards:
    - ISO-3166 country codes
    - ISO-4217 currency codes
    - RFC 5322 email format
    - E.164 phone format
    - WHATWG URL format
    - ISO 8601 date/time
    - OWASP-guided text/name constraints
    - UUID (RFC 4122) and SemVer 2.0.0
  - PII annotations and helpers for redaction/masking before logging.
  - Lightweight validation runner with success/error result types.

- **Changed**
  - N/A (initial release)

- **Fixed**
  - N/A (initial release)

---

## Release process (maintainers)

1. Update `CHANGELOG.md` under **Unreleased** with user‑visible changes.
2. Bump version in `package.json` following SemVer (major/minor/patch).
3. Move entries from **Unreleased** to a new version section with the current date.
4. Tag the release in Git (`vX.Y.Z`) and push tags.
5. Publish to npm (via CI/CD or `npm publish`).

> Tip: Use Conventional Commits in PR titles/bodies to make changelog updates easier.

---

[Unreleased]: https://github.com/Plasius-LTD/gpu-model-core/compare/v0.1.0...HEAD
[1.0.0]: https://github.com/Plasius-LTD/schema/releases/tag/v1.0.0
[1.0.13]: https://github.com/Plasius-LTD/schema/releases/tag/v1.0.13
[1.0.17]: https://github.com/Plasius-LTD/schema/releases/tag/v1.0.17
[1.0.18]: https://github.com/Plasius-LTD/schema/releases/tag/v1.0.18
[1.1.0]: https://github.com/Plasius-LTD/schema/releases/tag/v1.1.0
[1.1.1]: https://github.com/Plasius-LTD/schema/releases/tag/v1.1.1
[1.2.0]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.0
[1.2.1]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.1

## [1.2.1] - 2026-02-11

- **Added**
  - Initial release.

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)
[1.2.2]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.2
[1.2.5]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.5
[1.2.6]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.6
[1.2.7]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.7
[1.2.8]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.8
[1.2.9]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.9
[1.2.10]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.10
[1.2.11]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.11
[1.2.12]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.12
[1.2.15]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.15
[1.2.16]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.16
[1.2.17]: https://github.com/Plasius-LTD/schema/releases/tag/v1.2.17
[0.1.0]: https://github.com/Plasius-LTD/gpu-model-core/releases/tag/v0.1.0
