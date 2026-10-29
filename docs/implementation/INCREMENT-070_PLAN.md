# Increment070 — P11/S100.1 enforce frozen comment ordinal keys at durable effect intent

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`. Verified baseline HEAD `c3f5e80a182d0f6b23c4d7505c703aefcc3a892d` (Increment069/checkpoint-062, exact-source CI push 40885144542 and PR 40885154234 SUCCESS; checkpoint push 40885964425 and PR 40885971778 both SUCCESS Ubuntu/Windows). Never switch/merge `main`.

## Dependency and gap

Increment069 introduced private, immutable `FrozenCommentListPlan` and per-item deterministic effectKey/payloadHash bound to snapshot, ordinal, typed Unicode and one persisted PUBLISH effect. However, the existing durable `StudioDatabase.prepareClaimedEffect(kind:'COMMENT')` accepts any opaque 64-character effectKey/payloadHash after a journaled CONFIRMED PUBLISH, so future trusted host requests could bypass frozen item binding and send a different text or ordinal. This increment closes that real write-boundary gap. It does NOT certify any provider or enable public comment posting.

## Source, state and negative paths

1. `packages/database/src/index.ts`: extend the private `prepareClaimedEffect` request for COMMENT with optional typed `commentSource` binding: `postEffectId`, `fieldKey`, `scope:row|process`, `ordinal`. Require it for COMMENT, forbid for PUBLISH. Inside the same durable transaction, after existing phase, pending-effect, effect-key, and parent CONFIRMED checks, call `frozenCommentListPlan` for exact job + snapshot + parent publish; require an allowed ordinal, exact derived effectKey and payloadHash. Reject missing/wrong/mismatched values with finite, non-sensitive DomainError codes **before** INSERT/phase change. Keep global effect-key uniqueness; never permit duplicate ordinal under alternate text/key or cross-job/post reuse.
2. `apps/desktop/src/host/internal.ts`: pass private `commentSource` only as part of `effect.prepareClaimed`, not a new public request; avoid accidental exposure in renderer/HTTP/preload.
3. `apps/desktop/src/host/claimed-effect-service.ts`: extend host-only request to carry optional `commentSource` for COMMENT; validate required binding/ordinal, disallow it for PUBLISH, forward exactly to trusted worker before any adapter. No real adapter configured, and no Unicode content leaves host boundary.
4. `packages/database/src/claimed-effect.test.ts`: update existing comment-intent fixture to use the private frozen plan's ordinal-0 key only once PUBLISH is persisted CONFIRMED; preserve early phase and unverified-post blockers. Add SQLite transaction regression cases for arbitrary valid-format hash, wrong payload hash, missing ordinal binding, another ordinal with old key, wrong parent effect ID, wrong field/scope, PUBLISH with forged comment binding, duplicate comment attempt, public forged command and exact source/no mutation. Test a repeated comment string at ordinal 1 derives a distinct key. Keep replay/recovery and existing host publish tests.
5. Run generated contracts, TypeScript, lint, unit/integration, desktop build, Ubuntu Chromium, Windows VerifyOnly, plan validators on exact source SHA (push + PR on both OS). Correct real CI failures. Then create `INCREMENT-070_RESULTS.md`, `docs/evidence/implementation/checkpoint-063.json`, update PROGRESS and COMPLETION_PLAN with actual SHA/run/test counts and remaining hardware gates.

## Transitions and gate limits

Only existing authorized COMMENT transitions POSTED -> COMMENT_PENDING, with SQLite INTENT journal; behavior for invalid source fails before mutation. COMMENT remains controlled by a verified persistently recorded parent PUBLISH, and adapter is absent in production. PUBLISH path unchanged with no commentSource accepted. No post/comment network or Android input, no automatic retry or confirmation, no deletions, no migration.

Best status `TESTED_S100_COMMENT_INTENT_BINDING_NOT_ACCEPTED`. P11/S100/AT-100 still hardware OPEN; provider identity/target, exact Unicode phone input, comment existence check/only-comment retry, real Facebook/TikTok receipts, fleet 20–300, P12–P14 and installer remain NOT_RUN. No overall completion percentage inferred from test counts.
