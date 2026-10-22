# TDR-0003: Empty animation clip handoff

Date: 2026-10-22. Tracking: core47 / FBX27 / Feature1151.
Decision: [ADR-0013](../adrs/adr-0013-empty-animation-clips.md).

| Input | Canonical result / responsibility |
| --- | --- |
| Named take without motion | Animation with stable ID, name, samplers:[], channels:[] |
| Authored zero/nonzero span | Finite nonnegative durationSeconds; adapter validates/converts source units |
| Negative or nonzero source starts, reference spans, clip rate, empty layers | Bounded sourceMetadata evidence; core does not infer or evaluate timing |
| Mixed populated and empty takes | Preserve all identities and ordering; existing populated sampler/resource validation remains mandatory |
| Empty graph clip | Animation node with no accessor dependencies; explicit package membership is retained |
| Samplers without channels | Reject unused sampler; never treat it as empty |
| Channels without samplers | Reject missing reference; never ignore motion |
| Old consumer/core | Rejects empty clips until qualified/upgraded; use compatible producer/core/consumer sets |

Release the owning core minor first through the approved PR/CI/main/cd.yml/
production/npm OIDC flow. FBX27 must adopt an exact published version, provide
its own parser/worker/pose/browser/roundtrip evidence and retain its full scope.
This task does not add a consumer dependency or claim adapter completion.

Core remains independent of remote flag transport. Producers evaluate the
stored gpu.model.conversion.enabled flag before resource work. Disabled or
rollback selects the previous qualified set; canonical validation never bypasses
checks. Static projections still refuse animation and their gate fails closed.

Tests in empty-animation-clips.test.ts cover the table plus deterministic
serialization/private brands, no resource synthesis, mutation isolation, metadata
and clip ceilings, malformed keys and abort. Existing populated animation and
encoding controls run in the full suite. No new dependency, resource limit,
schema ID, local publication, site/ACA rollout or external fixture license.
