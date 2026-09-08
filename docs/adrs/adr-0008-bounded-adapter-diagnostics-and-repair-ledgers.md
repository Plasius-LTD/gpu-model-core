# ADR-0008: Bounded adapter diagnostics and repair ledgers

Status: Accepted
Date: 2026-09-08
Task: gpu-model-core#4
Parent Feature: plasius-ltd-site#1148

## Context

The published core document validator is intentionally strict. Format adapters
need the policy defined by site #1158 without importing site-only tooling.
The seven repair rules and format targets are inherited from that policy.

## Decision

Add a format-neutral, synchronous report evaluator to the existing package.
It validates untrusted report input, clones bounded JSON into immutable owned
records, and distinguishes blocking errors, completed repairs, unsupported data,
warnings and explicitly acknowledged conversion loss. Strict is the default.
Tolerant/forensic reports require an adapter's explicit applied-repair marker;
the core never claims to parse source formats or execute geometry repairs.
The exported action is a concrete conservative subset of its inherited policy:
invalid primitives are dropped rather than clamped, unsafe texture slots remain
unresolved, and missing materials use the canonical default. The applied marker
attests that the adapter verified that exact action. Unsafe/unknown rules remain blocking. Dropping a primitive, an unresolved texture
or a default-material fallback requires a matching loss entry; losses block
unless the caller explicitly opts into them.

Forensic mode requires bounded JSON source evidence, including on rejection.
It is stored separately from ordinary diagnostics. Overflow rejects the report;
no evidence is silently truncated. Callers must supply scrubbed, relevant data,
with non-finite source numbers represented as strings, and must never log raw
source/repair snapshots. This API cannot infer whether arbitrary text contains
personal data. It performs no I/O, logging, persistence or telemetry.

The existing GpuModelMetadataValue and diagnostic severity types are reused.
No dependency or additional package is needed. A standalone validator keeps
forensic budgets separate from the canonical document's metadata budget.

## Alternatives

Importing the site's CommonJS audit evaluator would couple the public package
to internal tooling and cannot prove actual adapter repairs. Teaching the core
format parsing or geometry repair would cross the planned adapter boundaries.
Relaxing the canonical document validator would weaken existing guarantees.

## Bounds and rollout

One report permits at most 4096 issues, 16384 JSON values, depth 12, 1024
members per object/array, 65536 UTF-16 units per source string and 1 MiB of
aggregate UTF-8 JSON input. Callers may lower the byte ceiling. Oversize,
accessor-bearing, exotic, cyclic or non-JSON values fail closed. JavaScript
Proxies are outside the inert-data boundary; parse serialized JSON before
passing data from executable/untrusted producers.

The inherited remotely evaluated flag gpu.model.conversion.enabled controls
adapter adoption; this library changes no stored flag. Keep it disabled until
adapter conformance passes. Rollback disables the flag and selects strict mode.
No UI capability is introduced.

## Validation and release

Synthetic fixtures are copied from site #1158 and cover glTF, OBJ, FBX and CAD.
Tests cover policy distinctions, mode semantics, complete repair records,
resource limits, immutable ownership, unsafe input and deterministic results.
The core fixtures verify reports only, not format parsing or repaired geometry.
An additive minor package release uses main cd.yml, production and npm OIDC.
No local publication, bootstrap reuse, or site consumption is included.
