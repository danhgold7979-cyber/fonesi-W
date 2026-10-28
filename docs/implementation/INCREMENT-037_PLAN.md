# Increment037 — P05/S045 conservative nested effect boundary admission

Date 2026-10-28. Baseline `feat/studio-workspace@58987bc9f39e5864dff4a0c8aca36e0eb4a6711d`. Reviewed V2.1 P05/S045, P11/S097 and latest `packages/workflow-engine/src/effects.ts`, `compiler.ts`, `effects.test.ts` before source changes. Parallel P11/P06 PRs touch separate modules; this slice only changes static workflow effect assessment and tests.

## Gap
Current `assessEffectPaths` analyzes each graph separately with initial empty intent state. It does not propagate outstanding external effect/verification state through `subflow.graphRef` or `loop.bodyGraphRef` calls. Thus a child may be locally well-formed, but invoking it from a caller that still has a pending publish could bypass the intended no-second-effect rule.

## Strictly bounded mitigation
1. Build a pure, bounded transitive local dependency-risk map on the validated workflow bundle (same immutable IR), following subflow and loop graphRef links. Detect cycles/unknown external dependencies conservatively.
2. Mark any graph as **journal-context sensitive** if it contains transaction, tap, verify or cleanup nodes, or calls a sensitive child. These nodes require effect/lease/verification state across frames, which the current static audit cannot prove.
3. For each subflow/loop invocation that reaches such a graph, append a named `NESTED_EFFECT_CONTEXT_UNSUPPORTED` ValidationIssue at the caller. The compiler retains this issue in `effectPathAudit`; the existing `assertStaticEffectPathsSafe` admission gate rejects real execution. Pure nested subflows remain allowed.
4. Do not claim to have implemented cross-frame journal propagation. This is a **temporary fail-closed static guard**, deliberately conservative; once P11 runtime can pass effect tokens across frames with receipts, replace with verified transfer semantics and relax only proven cases.
5. Tests include pure subflow accepted, nested effect reachable at two depths rejected, loop graph body with tap rejected, 2+ irreversible effects separated across caller/callee rejected without app input, and no mutation of input/compiled IR. Run `pnpm check`, Chromium and Ubuntu/Windows CI before PR merge.

## Acceptance boundary
No device or adapter execution; production Facebook/TikTok verification, Windows10 physical USB/LAN, P11 journal-runner propagation, scoped effect tokens and full P05/P11 acceptance remain NOT_RUN. No new schema, no main branch or release.
