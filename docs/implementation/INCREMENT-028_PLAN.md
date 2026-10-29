# Increment028 — P05/S045 structural effect-path safety audit

Baseline: `feat/studio-workspace@91294aa20295d3d009de9585a343d5788c601cc5` (P04/P07/P08 already integrated). Reviewed V2 `16_MASTER_EXECUTION_PLAN.md`, S045 and AT-045 in `17_STEP_RUNBOOK.md`, P05_PLAN, INCREMENT-014_PLAN and current `validateBundle/compileWorkflow` behavior.

## Existing limitation

Existing `validateBundle` checks an irreversible `tap.effectClassification=publish|comment` only when its *immediate predecessors* are `transaction`. This cannot prove a durable intent on **all reachable control-flow paths** (e.g. a transaction.error route leading to publish), cannot prove verify-before-cleanup and does not distinguish structural IR from device/provider certification. A graph may compile without a complete effect audit. Never treat code shape as real post evidence.

## Ordered implementation steps

1. **Pure static analysis, P05/S045.2:** Walk every resolved graph from its start over all port-labelled paths. Track per-path pending effect/verified status and typed durable intent `PUBLISH` vs `COMMENT`. A transaction grants intent only on `next`, not `error`; no shared global flag. Each irreversible tap requires matching intent. Each post consumes its intent. A second effect cannot follow while first is unverified. An `end` with uncertain effect and any `cleanup` without verified completion are rejected. `review` remains safe stop for uncertainty. A `verify.true` marks an outstanding declared effect verified, `verify.false/error` does not. Unknown external-write tap cannot be automatically deemed safe. Track states with a bounded per-(node,state) visited set; no exponential path explosion or silent truncation.
2. **IR contract, P05/S045.1–3:** `compileWorkflow` always returns immutable IR for valid draft/TRACE but attaches `effectPathAudit` (checked/issue list). Add `assertEffectPathsSafe(ir)` fail-closed runtime-admission helper. This is **NOT** a complete DEVICE_TEST/REAL_JOB gate: provider/identity/target/effect journal/physical proof remain separate. Leave existing semantics for pure workflow draft+TRACE.
3. **Regression tests:** branch bypass through transaction.error, conditional bypass, mismatched kind, missing intent, unknown-classification, two effects without distinct verify/intents, cleanup without verified publication, successful transaction→publish→verify(true)→cleanup vs verify(false)→review and direct explicit review. Immutable source map and no Android input. Verify all existing compiler/DB/editor/browser tests.
4. **Evidence:** `pnpm check`, `pnpm check:plan`, GitHub Actions Ubuntu/Windows and Playwright regressions (enabled by previous increment). Record CI exactly; no unrun checks called PASS, no unauthorized device action. Commit feature only after plan commit and use separate PR against `feat/studio-workspace`, no merge into `main`.

## Scope boundaries

No actual scheduler dispatch, hardware provider, comment retry, publish verification or irreversible cleanup is implemented here. No new public IPC or permissions. Graph subflows/loop bodies are each conservatively audited within own scope; cross-graph effect-state propagation and per-target provider policies are separate future gates and MUST be marked `OPEN`. A structurally clear IR never declares a real Facebook/TikTok post succeeded.
