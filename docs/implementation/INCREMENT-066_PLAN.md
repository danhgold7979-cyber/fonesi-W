# Increment066 — P11/S099/S101 persisted effect uncertainty operator review (no repost controls)

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, development branch `feat/studio-workspace`. Plan-first baseline `4fd8fe219056dd64b50d8bbb8c885b9798621ceb` (Increment065/checkpoint-058 recorded; exact-source CI push 40870893059 and PR 40870900256 SUCCESS Ubuntu and Windows).

## Gap and dependencies

Increment064 creates a durable INTENT/ATTEMPT_UNCERTAIN host boundary. Increment065 filters potential provider posts without CONFIRMED state. The operator's existing Schedule staging review shows media/Unicode/compose and cleanup receipts, but does not show **persisted external effect uncertainty**. After restart a user can otherwise misread a missing visible staged file as safe to repost. S099 recovery and S101 manual review require a bounded redacted view of all unresolved effects without enabling any effect mutation.

## Implementation plan and ownership

1. `packages/contracts/src/schedule.ts`: add `PersistedEffectReview` with `scope:'PERSISTED_EFFECT_JOURNAL_NOT_PROVIDER_VERIFIED'`, status `NO_EFFECTS | REVIEW_REQUIRED | RECORDED_NOT_LIVE_VERIFIED`, bounded total/counts, newest 20 ordinal entries (kind PUBLISH/COMMENT/UNKNOWN and state from existing five effect states/UNKNOWN), `hasMore`, `hasUnresolved`. All `canConfirm`, `canRetry`, `canDispatch` are literal false. No effect ID/key/payload hash/evidence ref, account, post ID, caption or raw JSON.
2. `packages/database/src/index.ts`: extend existing **read-only** `jobStageReview` using scoped SQLite queries: newest 21 limited effect state/kind entries and independent global `EXISTS` for unresolved states `INTENT/ATTEMPT_UNCERTAIN/NEEDS_REVIEW`, even when unresolved rows are older than the first page. Never use only the top 20 to infer eligibility. Unknown/corrupt state fails closed as REVIEW_REQUIRED. No schema change or effects mutation. No direct new API command.
3. `apps/desktop/src/renderer/JobStageReviewDialog.tsx`: accessible "Nhật ký effect đã lưu (chưa xác minh bài đăng)" with redacted status, capped entries, explicit `ATTEMPT_UNCERTAIN` requires review and no publish/comment retry/confirm control.
4. `packages/database/src/device-stage.test.ts`: default no-effects DTO, SQLite INTENT/uncertain, confirmed-only record, hidden older uncertainty beyond 20, no source leaks and no job/effect/stage mutation across restart/public dispatcher.
5. `tests/ui/schedule.spec.ts`: real SQLite fixture with pending publish intent, read-only panel status, no raw effect IDs/hashes/posting controls, unchanged job after view.
6. Run exact-source GitHub Actions generated/typecheck/lint/unit/integration/build, Chromium UI Ubuntu, Windows VerifyOnly and V2.1 plan validators on Ubuntu/Windows. Correct all failures. Then write `INCREMENT-066_RESULTS.md`, checkpoint-059, PROGRESS and COMPLETION_PLAN with tested SHA/OS/CI evidence.

## State transitions and acceptance limitations

This increment is **read-only**, no effect state transition, Android input, provider posting, retries, cleanup or authorization. A historic `CONFIRMED` database row is a persisted record, not automatically a certified external post. User-visible status cannot certify a real provider. Physical Windows10+Android profile/Unicode/picker/publish/recovery gates, S098/AT-098, S099/AT-099, S101/AT-101 and P11 remain NOT_ACCEPTED. The eventual P12 app adapters, P13 operations/scale and P14 installer cannot be certified until their dependencies and hardware/clean-machine evidence are satisfied. Overall percentage not inferred from fixture count.
