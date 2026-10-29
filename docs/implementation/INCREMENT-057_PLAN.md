# Increment057 — native-only, operator-confirmed cleanup-review request after fresh Android re-observation

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`.
Baseline HEAD: `660eba688d1efd47138a29dc91eae12f6c7f5e64` (Increment056 TESTED/CI green, checkpoint-049).
Scope: P11/S095.2–S095.3, **non-destructive operator review request**. No deletion, upload retry, requeue, picker/post verification or phase acceptance.

## Gap and required behavior

Increment056 supplies a native-only live Android observation under a current MANUAL lease. Increment054 already saves an immutable cleanup-review request **after** a native yes/no dialog and a new transactional SQLite preflight, but this path has no operator action and cannot be reached from the Schedule. Wire one explicit, narrow action to execute a **fresh** owned remote bytes+MediaStore observation and, only if the latest observation meets S095.3 guard conditions, ask the native Electron dialog to record a historical request. Preserve one MANUAL lease and one trusted transport through observation, dialog and transactional insert; no stage ID, serial, owner, hash, nonce or lease from renderer.

## Planned source and tests

1. `packages/contracts/src/schedule.ts`: extend `NativeStageReviewApi` with `requestCleanupReview(jobId,ordinal)`. New redacted result includes jobId, ordinal, `LIVE_ANDROID_REVIEW_REQUEST_ONLY` scope, status `REVIEW_REQUEST_RECORDED | CANCELLED`, audited readback classification, MediaStore status and review timestamp or null. Always `canDelete:false`, `canDispatch:false`. No request ID or transferable capability.
2. `apps/desktop/src/host/native-stage-review.ts`: refactor existing owned-stage lookup into shared private `selectOwnedStage` (enforce NEEDS_REVIEW, host, ordinal, stage state). New `requestCleanupReview` must acquire one MANUAL actor lease through the already verified native device service; call existing read-only `reconcileStage` once and validate redacted receipt. Fail closed unless classification `REMOTE_BYTES_MATCHED` AND status `NOT_INDEXED`. Under same lease, call existing private `HostStageTransferService.requestOwnedCleanupReview` with trusted random request ID. This invokes existing native Electron yes/no modal and **revalidates database preconditions** in one transaction after dialog. On cancel return a clean redacted cancelled result; no cleanup request journal row. Preserve persisted reconciliation audit. No actual remote delete.
3. `apps/desktop/src/main/index.ts` + `preload.cts`: add another *separate* `studio:stage-cleanup-review` IPC with frame/URL authorization and zod strict `{jobId,ordinal}` only, same as stage re-observe. Preload only exposes exact method; never add to `StudioApi`, public `ApiCommand`, loopback host HTTP or worker authoring API.
4. `apps/desktop/src/renderer/JobStageReviewDialog.tsx`: native-only per-uncertain-stage explicit `Ghi yêu cầu rà soát cleanup (không xóa)` button. Separate action from read-only reobserve, single-flight busy/errors and clear status. State only `REVIEW_REQUEST_RECORDED` when after native yes + transactional write success, `CANCELLED` if no. Refresh stored request/audit history; show actual persisted result without ever claiming deletion authorization.
5. `tests/stage-transfer-host.test.ts`: real SQLite plus fake ADB adapter, verified remote readback, expired JOB claim; assert exactly one re-observation, explicit native yes/decline, immutable journal content on reopen, MANUAL release, no upload/delete/dispatch, and blocked indexed/ambiguous/unsupported/stale lease/wrong host/ordinal/job revision. Assert public dispatcher rejects forged command.
6. `tests/ui/schedule.spec.ts`: Chromium loopback has neither native button nor usable public cleanup request, even with forged IPC-style command.
7. Execute exact-source GitHub CI Ubuntu and Windows generated contracts/type/lint/build/unit, Chromium UI, Windows `VerifyOnly`, plan validators. Repair failures. Record `INCREMENT-057_RESULTS.md`, checkpoint-050 and PROGRESS/COMPLETION_PLAN only with verified exact SHA/OS results; commit/push and verify HEAD workflows.

## State transition and safety matrix

- Only a deliberate Electron native click can try. All stage/job/effect state remains unchanged; `NEEDS_REVIEW` stays latched.
- Fresh scan and single verified transport + current MANUAL lease → ADB Sync RECV and bounded MediaStore query → existing append-only audit. No automatic retry. If remote bytes mismatch, MediaStore row indexed/ambiguous/unsupported, stale source, no current transport/claim or no pinned prior readback, stop before modal and do not record request.
- Only good `REMOTE_BYTES_MATCHED` + `NOT_INDEXED` audit → private native dialog, default CANCEL. If cancelled/aborted/lease expired/conflicting audit while dialog open, zero immutable request rows.
- Confirmed yes → transactionally fenced `REVIEW_REQUESTED_HARDWARE_PENDING` history in SQLite v20, not an execution permit. `canDelete:false` / `canDispatch:false` always. No Android unlink, MediaStore delete, publish, provider input, queue claim or job completion.
- Window/HTTP cannot request by arbitrary raw stage ID/ADB serial; no privilege to loopback server. Reject foreign/unknown stage/ordinal and stale JOB generations before device input.

## Acceptance boundary

Maximum status `TESTED_NATIVE_CONFIRM_CLEANUP_REQUEST_NOT_S095_ACCEPTED` after exact-source CI. Android/Windows 10 physical, permission/picker, actual owned cleanup crash-safe protocol, fleet, publishing verification and P14 release stay open. 15 phases, 125 steps and 375 tasks remain unchanged.
