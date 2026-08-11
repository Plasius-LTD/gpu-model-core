# Changelog

All notable changes to this project will be documented in this file.

The format is based on **[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)**,
and this project adheres to **[Semantic Versioning](https://semver.org/spec/v2.0.0.html)**.

Versioned sections are created and promoted only by the approved release
pipeline.

---

## [Unreleased]

- **Added**
  - Bootstrapped the dedicated package repository from the shared package
    baseline.
  - Added the `gpu.model.conversion.enabled` rollout reference and package
    smoke-test surface.
  - Added canonical immutable model GPU-interface, ABI-hash, semantic, and
    optional default-style-profile contracts backed by `@plasius/gpu-shader`
    and the flat `ModelAssetManifest` from `@plasius/asset-contracts`.
  - Re-exported the shader framework's `asSha256Hex` grammar validator and
    branded `Sha256Hex` type for type-safe model-manifest construction.
  - Added safe model/resource extraction that rejects inherited and
    accessor-backed GPU contract fields.

- **Changed**
  - Documented external promoted-catalog discovery so compatible shader styles
    can be added without republishing model versions.
  - Replaced inherited schema ADRs, contribution guidance, and CLA project
    labels with portable `@plasius/gpu-model-core` documentation.
  - Clarified that digest parsers validate grammar/equality while final-WGSL
    reflection and model storage/runtime own hash derivation and exact-byte
    verification.

- **Fixed**
  - Removed inherited template-package release entries that did not represent
    releases of `@plasius/gpu-model-core`.

- **Security**
  - Bound release publication to the immutable workflow-dispatch commit and
    fail closed when protected `main` advances during release preparation.
  - Constrained transitive `esbuild` resolution to the remediated `0.28.1`
    line and retained a zero-vulnerability full dependency audit.
  - Sanitized both prototype and property-descriptor proxy inspection failures
    without retaining provider exceptions as public error causes.
  - Excluded contributor agreement records and non-portable filenames from the
    public package policy.
