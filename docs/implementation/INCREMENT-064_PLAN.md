# Increment064 — P11/S097.1–S097.3 trusted host effect attempt boundary (non-provider-certified)

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`. Plan-first baseline HEAD `7b7592e5f6c7fdbc85ec6b0fb178361443a76cd8` (Increment063/checkpoint-056, Ubuntu/Windows push+PR CI SUCCESS).
Owner steps: S097.1 durable intent, S097.2 exact-lease dispatch boundary, S097.3 crash/replay-safe uncertainty. S096 and S097 hardware acceptance remain NOT_RUN.

## Problem and dependencies

The existing database has transactional `prepareClaimedEffect` and `beginClaimedEffectAttempt`, but no trusted host coordinator that enforces their correct order around a provider adapter call. A future Android provider could otherwise send a publish tap before SQLite persists `ATTEMPT_UNCERTAIN`, or mistake a transport ACK for a confirmed post. A fail-closed host boundary is needed before connecting a certified provider.

## Planned source

1. New `apps/desktop/src/host/claimed-effect-service.ts`: implement `HostClaimedEffectService` with a **private injected** `ExternalEffectAdapter` (absent by default) and an internal DB port. No public command, IPC, HTTP route or renderer button. Input includes pinned job/node/revision/snapshot hash, durable effect key/payload digest and trusted live JOB lease. Only trusted host constructs the adapter and passes in claims; no `at` timestamp from renderer. Derive clocks at the host boundary.
2. If provider is absent, request invalid or signal already aborted, do not create intent or call device adapter. First DB transaction `effect.prepareClaimed` commits INTENT/POST_INTENT. If signal is aborted after intent, leave INTENT for review without calling provider; do not auto-cancel/rollback.
3. A separate `effect.beginClaimedAttempt` commits ATTEMPT_UNCERTAIN (and POST_PENDING for PUBLISH) before any external callback. If its transaction fails or lease/revision changed, never call provider and leave durable INTENT. After successful begin, invoke the trusted injected adapter once only. A fulfilled ACK means `ACK_UNVERIFIED`, not posted/confirmed; a rejection/timeout/unknown response remains `ATTEMPT_UNCERTAIN` and requires independent verification/review, **not** blind retry. Do not capture/log adapter exception details or raw payload/identifiers in public outputs.
4. Preserve cancellation semantics: pre-intent cancellation has zero journal/device activity; cancellation after intent preserves durable INTENT; cancellation after attempt preserves uncertainty and does not retry.
5. In `packages/database/src/claimed-effect.test.ts`, use *real SQLite* and private dispatchInternal with a fake effect adapter (no ADB) to test order, no-ACK, adapter throw, restart and recovery, stale claim/duplicate keys, DB write failure and abort windows. Assert callback sees ATTEMPT_UNCERTAIN already persisted and public dispatcher cannot forge any new command. No side-effect success is claimed by fixture.
6. Run GitHub Actions exact-source generated-contract/typecheck/lint/test/build, Ubuntu Chromium UI, Windows VerifyOnly and both plan validators. Fix source/test issues. Only after confirmed run results, create `INCREMENT-064_RESULTS.md`, checkpoint-057, and update PROGRESS/COMPLETION_PLAN with exact SHA/OS.

## Security, state transitions and acceptance

No new SQLite schema. The only persisted transitions are the existing proven DB methods: RUNNING→POST_INTENT→POST_PENDING and INTENT→ATTEMPT_UNCERTAIN (comment flows preserve their separate state). The host adapter is unconfigured in production and this increment does not dispatch a physical Android action, provide a certified Facebook/TikTok provider, or grant real posting rights. Read-only/default behavior stays fail closed. `ACK_UNVERIFIED` cannot be mapped to CONFIRMED/POSTED/SUCCESS. Existing claim generation, immutable snapshot checks and durable idempotency are mandatory. Physical Windows10+Android USB/LAN, picker, Unicode, identity, app profile and provider posting/recovery must be tested later before S097/AT-097 or P11 acceptance. Do not infer progress percentage from fixture counts.
