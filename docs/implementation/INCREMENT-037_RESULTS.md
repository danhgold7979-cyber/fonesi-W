# Increment037 — P05/S045 conservative nested-effect admission boundary

Baseline `feat/studio-workspace@58987bc9f39e5864dff4a0c8aca36e0eb4a6711d`, source SHA `4592b4419f164f0d96aa647cddbfae29f9ab9a7b`. Pre-code plan `INCREMENT-037_PLAN.md`.

## Implemented
- `assessEffectPaths` now constructs bounded, memoized transitive local graph dependency-risk state in addition to its existing intragraph proof.
- A `subflow.graphRef` or `loop.bodyGraphRef` that invokes a graph containing a transaction, tap, verify or cleanup (directly or in a grandchild) yields `NESTED_EFFECT_CONTEXT_UNSUPPORTED` at the caller. Cyclic or missing nested dependencies conservatively fail closed.
- The existing compiler `effectPathAudit.issues` and `assertStaticEffectPathsSafe` reject such a workflow for real execution until a journal-aware runtime can transfer effect/verification tokens across call frames. Pure nested graphs remain admitted.
- Tests cover safe pure child, individually valid effectful child refused at call site, transitive grandchild and loop body, no source mutation. No new schema, device command or provider call.

## Verified source CI
- [Actions 40651708189](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40651708189) **SUCCESS Ubuntu/Windows** at `4592b4419f164f0d96aa647cddbfae29f9ab9a7b`. Ubuntu `pnpm check`: 276 passed across31 files and Chromium `pnpm test:ui`:28 passed. Windows `pnpm check`:275 passed, one pre-existing Unix-only SDK fixture skipped /31 files. Typecheck, lint, build, Windows VerifyOnly and plan validators passed.
- This test count predates merged P11/P06 changes on feature branch. PR combined CI is required before merging and may have larger counts; never reuse source-only proof for changed integration code.

## Explicit NOT_RUN
Cross-frame journal token propagation, nested effect execution, real provider publish/comment verification, Windows10/Android phones, 20–300-device scaling, certified app selector matrix and full P05/P11 phase acceptance. This increment intentionally *restricts* nested effect admission until the later runtime is proven; it does not complete execution support.
