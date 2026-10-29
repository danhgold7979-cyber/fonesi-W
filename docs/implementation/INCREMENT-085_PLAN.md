# Increment085 — P11/S102.3 persisted redacted cleanup recheck history in job staging review

Date: 2026-10-30. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`. Baseline HEAD `faa4afeb82c1dbc67102921995cfdfa9e93e3156` verified from GitHub before writing plan. Increment084/checkpoint-077 tested source `9cbfa78afea993f67b69c782f83e4f2cfce29f06`, [push CI 40921889192](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40921889192) Ubuntu+Windows SUCCESS. Do not modify `main`.

## Gap / dependencies
S102.3 cleanup-only rechecks are persisted immutably (v22) and native Electron can safely record 1–3, but their history is visible only through the trusted DB worker. After a restart, the operator cannot see which media slots have used 0/1/2/3 of their bounded review attempts, and the renderer still offers a clickable fourth attempt (which is rejected by native before ADB). A redacted persisted history and disabled exhausted action improve correctness and operator visibility without enlarging device privileges.

## Scope and files
1. `packages/contracts/src/schedule.ts`: add `cleanupRechecks` to `JobStageReviewPage` as a redacted, bounded <=96-item collection of stageOrdinal, attemptOrdinal, status, remote, mediaStore and recordedAt. No request IDs, stage IDs, actor, paths, hash, nonce, ADB serial or snapshot. Keep `canDispatch=false`.
2. `packages/database/src/index.ts`: in existing `jobStageReview`, read/validate the immutable v22 history via `listOwnedStageCleanupRechecks(jobId)`, project to redacted DTO without rights. Trust the 96-row cap and fail closed on corrupt/oversized persisted history; never introduce publication/cleanup authorization or mutate existing queue/recovery.
3. `apps/desktop/src/renderer/JobStageReviewDialog.tsx`: show per-stage attempt count `0/3` to `3/3` with last-recorded status; show bounded historical per-ordinal list with explicit `not delete/provider proof` wording. Disable `Ghi lần đối soát cleanup` button for 3/3 persisted records (and when the current native receipt reports attempt3) before a new request; existing native+SQLite caps remain authoritative. Never display raw private IDs/paths or a delete button.
4. `packages/database/src/device-stage.test.ts`: real SQLite case 0/3→3/3 and restart, exact historical projection, no effect/job/queue mutation or permission grant; verify redaction and no requestId/actor/nonce/remote path leakage. Adjust existing full-page expectation for the new empty collection.
5. `tests/ui/schedule.spec.ts`: public/browser fallback displays persisted-redacted history without native bridge or delete controls; mocked native path still rejects forged rights. Update if complete page contract changes.
6. Verify exact-source GitHub Actions **push** run Ubuntu/Windows: generated contracts, typecheck, lint, unit/integration, build, Chromium UI, Windows VerifyOnly and plan validators. Fix failing checks; record RESULTS/PROGRESS/COMPLETION_PLAN/checkpoint-078, SHA and observed CI only if successful.

## Outcomes / safety
- Persisted 0–2 native rechecks: show count and bounded recent status; native may request a new **read-only** observation under its MANUAL fence. Persisted 3/3: no new UI action, no native/ADB access; SQL authoritative limit protects races.
- Forged/excess journal rows, contradictory status, raw private path or overbudget collection: fail closed; existing job/queue/effect and PC media unaffected.
- Browser can read redacted historical DTO, but cannot submit private `stage.cleanupRecheckRecord`, own MANUAL lease or access Electron native operations.
- No Android deletion, MediaStore delete, certified provider post, user re-post or cleanup-only actual delete retry; S102.2–S102.3 and AT-102 still require Windows10+physical Android USB/LAN and provider attestation. S100.3, S101, S103, P12–P14 remain OPEN. No legitimate full-tool percent exists.
