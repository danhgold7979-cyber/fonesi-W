# Increment088 — P05/S048 typed handler contracts and provider capability boundaries

Date: 2026-10-30. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`.
Verified baseline HEAD: `79a1c0c31c58ce5c15d3c877cca41d4e512f561b`.
Increment087 fixed Facebook workflow catalog source is committed at `1aeb2bdd31281e1028dd90e6621b3c6a32a83b4b`; selector/dialog test corrections are at the current baseline. Its exact-source CI #40995947177 is still running at plan creation. Do not modify `main`.

## Why this increment comes next

The current source already has:
- 40 node definitions and generated config schemas.
- A validated immutable workflow compiler/IR and static effect-path audit.
- A TRACE interpreter and TRACE debugger with pause/step/breakpoint behavior.
- Device/ADB Inspector, package discovery and manual device actions.
- P11 preflight, staging, effect journal, verification-review and ordered comment safety slices.

However, the node catalog still marks the 40 nodes PLANNED and there is no single runtime handler registry or typed provider-port boundary. A workflow can be authored and traced, but missing production providers are not yet represented through a complete, consistent 40-node execution contract. S048 is an explicit prerequisite for S049 DEVICE_TEST capability gating and P11/S103 runtime. Do not jump to Facebook adapter implementation while this boundary is missing.

## Goal

Implement S048.1–S048.3 as a real, testable handler contract layer inside the existing `@autoreels/workflow-engine` package:

1. Exactly one handler contract for every generated node type (40/40).
2. Pure-engine handlers implement deterministic, bounded data/control semantics.
3. Device/app/recognition/media/transaction/verification nodes route only through explicit typed provider ports.
4. Missing provider or missing capability returns a typed `UNSUPPORTED` result; it never returns success or a fake post/comment receipt.
5. Irreversible publish/comment taps require a matching journaled effect permit; cleanup requires a separately verified terminal cleanup permit.
6. All provider calls carry AbortSignal, operation/attempt identity, exact device-app profile and explicit timeout/retry semantics.

## Source facts and boundaries

- `NODE_DEFINITIONS` is the authoritative generated 40-node registry. Do not edit generated files directly.
- The existing TRACE implementation remains TRACE-only. It must not be replaced by or mislabeled as DEVICE_TEST/REAL_JOB.
- `WorkflowReceipt`/profile contracts are readiness evidence, not a provider implementation.
- The existing DB/host effect journal remains the authority for durable intent/attempt state. The handler contract must not invent a second journal or issue raw UI taps directly.
- No Facebook/Instagram production adapter exists yet. The registry must report unsupported until a real provider is supplied and profile-gated.

## Scope

### S048.1 — handler contracts and complete registry

- Define a typed execution context containing frozen workflow/node refs, bindings, operation ID, attempt number, AbortSignal, optional exact DeviceAppProfile and safe log callback.
- Define discriminated results: DONE/control-flow, UNSUPPORTED, REVIEW, CANCELLED and typed ERROR.
- Define a total NodeType → handler-kind registry, checked against all 40 `NODE_DEFINITIONS` entries at module load/test time.
- Implement actual pure semantics for the pure data/control nodes that do not require an Android/provider port: start/end, condition expression evaluation, safe local assignment, typed row mapping, output mapping, log redaction, wait specification, loop/subflow/break/continue control directives and explicit review.
- Keep the handler layer independent from the TRACE implementation; share only validated DSL/evaluation primitives where safe.

### S048.2 — provider interfaces and capability gates

- Define narrow provider ports for app lifecycle, device input, recognition/readback, media staging/selection/cleanup, external verification and transaction journaling.
- Provider availability must be queried against the exact observed device/app/version/locale/selector profile. A generic package registration or workflow name is not certification.
- Route each provider-backed node to exactly one declared port category.
- Absent provider, unsupported node, stale/unknown profile or missing capability returns `UNSUPPORTED` with a stable reason code and no side effect.
- Do not create a default fake provider or fixture success path in production.

### S048.3 — timeout, cancellation and retry semantics

- Every provider request receives AbortSignal, bounded timeout, operation ID, attempt ordinal and exact profile.
- Use typed errors with `retryScope: NONE | READ | SAFE_OPERATION | VERIFY_FIRST` and `requiresReview`.
- Unknown result from irreversible effects becomes REVIEW/VERIFY_FIRST; never retry PUBLISH/COMMENT by generic retry policy.
- A `tap` classified as PUBLISH/COMMENT requires a matching effect permit from the durable journal boundary.
- `cleanup` requires a terminal, verified cleanup permit and cannot run from an ordinary media provider call.
- Provider output must not be able to manufacture verified post IDs, comment IDs, SUCCESS state or certification receipts.

## Expected files

- `packages/workflow-engine/src/handlers/types.ts`
- `packages/workflow-engine/src/handlers/pure.ts`
- `packages/workflow-engine/src/handlers/registry.ts`
- `packages/workflow-engine/src/handlers/index.ts`
- `packages/workflow-engine/src/handlers/handlers.test.ts`
- `packages/workflow-engine/src/index.ts` — export the new contract surface only.

Do not add a new workspace package, database migration, Android adapter, Facebook selector, account credential store or real post command in this increment.

## Failure/state cases

- Unknown node type or registry mismatch: fail compilation/registry initialization.
- Missing provider/capability/profile: UNSUPPORTED with stable reason; no port call.
- Stale/unknown device profile: UNSUPPORTED/REVIEW; never inherit certification from another phone or app version.
- Aborted signal: CANCELLED; no success event.
- Provider timeout after an irreversible operation: REVIEW / VERIFY_FIRST, not retryable failure.
- PUBLISH/COMMENT tap without matching effect permit: REVIEW before calling device port.
- Cleanup without verified terminal permit: REVIEW before calling media port.
- Provider exception without typed classification: ERROR requiring review; do not guess safe retry.
- TRACE remains read-only and cannot receive production effect permits.

## Test plan

- Registry contains exactly 40 unique node types and agrees with generated `NODE_DEFINITIONS` runtime classification.
- Every provider-backed node maps to one declared port category; every pure node has a real handler.
- Pure condition/setvar/row/output/log/wait/control-flow cases verify typed values, reserved keys, safe paths, bounded inputs and redaction.
- Missing provider and missing capability return UNSUPPORTED without invoking a provider.
- Profile mismatch/version/locale mismatch blocks provider calls.
- Abort, timeout, unknown error and typed retry-scope mapping are deterministic.
- PUBLISH/COMMENT tap without exact matching effect permit and cleanup without terminal cleanup permit are rejected before any provider invocation.
- Run generated-contract checks, typecheck, lint, all unit/integration tests, build, Chromium UI, Windows VerifyOnly and plan validators through exact-source GitHub Actions push CI. Record exact SHA and OS-specific results.

## Acceptance boundary

Increment088 may be marked TESTED only after exact-source Ubuntu+Windows CI passes. This increment completes the S048 handler/port contract layer only. It does not complete S046 interpreter, S047 DEVICE_TEST debugger, S049 DEVICE_TEST readiness, P11/S103 runtime, S089–S091 identity/provider risk gates or P12 Facebook adapters. No physical Android or Facebook posting/commenting is claimed.
