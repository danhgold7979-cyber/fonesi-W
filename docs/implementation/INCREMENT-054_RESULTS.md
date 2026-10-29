# Increment054 — native-confirmed durable cleanup-review request journal

Date: 2026-10-29. Repository: `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`.
Scope: P11/S095.3, review-intent recording only. Source baseline Increment053 `72bc44fd14b8949578f508cdd42f7ff2abc053e6`.
Plan first: [INCREMENT-054_PLAN.md](INCREMENT-054_PLAN.md), commit `e85c296835b54757d028276ee880c9f8cfd421cb`.
Feature implementation commit: `26b74fc7f2d9aa02629d9436fb5b35ff0c30615a`. **Tested source SHA: `017cc4fa89e01bf9cef24cc67a1cadd8108d2a8d`**.

## Actual changes

- `packages/database/src/schema.ts`: append-only SQLite migration **v20** creates `device_stage_cleanup_reviews`. Each row references a durable owned stage, job, device, host, pinned snapshot hash and revision, historical JOB claim generation, current MANUAL lease generation, exact reconciliation ID, request ID and timestamp. A unique stage/lease-generation/observation tuple prevents duplicate requests under different IDs. Database triggers block UPDATE and DELETE of review rows. Prior v1–v19 migration SQL is unchanged.
- `packages/contracts/src/media.ts`: typed private review receipt with constant `REVIEW_REQUESTED_HARDWARE_PENDING`, `canDelete:false` and `canDispatch:false`, without host/phone/path/hash/payload secrets.
- `packages/database/src/index.ts`: `recordOwnedStageCleanupReviewRequest` validates exact request ID and explicit confirmed flag, enters `BEGIN IMMEDIATE`, reruns strict Increment053 preflight and checks exact latest matching reconciliation under the same current MANUAL generation; inserts immutable request only if still eligible. Same-ID replay requires exact identity/observation under current lease and returns identical receipt. Different request ID for the same observation, changed lease/job/host/observation, effects, indexed MediaStore or stale proof fail closed. `listOwnedStageCleanupReviewRequests` returns bounded, redacted persisted history on reopen; no executor consumes it.
- `apps/desktop/src/host/internal.ts`: trusted private DB-worker record/history commands. Public StudioApi/renderer/preload/HTTP are not authorized for these commands.
- `apps/desktop/src/host/stage-transfer-service.ts`: `requestOwnedCleanupReview` does read-only preflight, calls native-confirmation callback (required), cancels cleanly without a DB write, aborts cleanly, and rechecks in transactional SQLite after the prompt. No ADB DELETE, SEND or remote shell operation.
- `apps/desktop/src/main/index.ts`: supplies an Electron `showMessageBox` callback with cancel as default and clear warning that recording a request will **not delete any file, requeue a job or publish**. Loopback host lacks callback and cannot produce the request. Existing host services do not yet expose a user-triggered hardware review command.
- Regression tests in `packages/database/src/device-stage.test.ts`, `tests/stage-transfer-host.test.ts` and migration tests cover idempotency, duplicate blocking, cancel, abort, stale/manual generation, native callback absence, post-prompt TOCTOU, restart, append-only triggers, v18/v19 to v20 upgrades, no job/stage/queue mutation, no public request and no Android side effects.

## Exact-source CI

| Workflow | OS and result |
|---|---|
| [Push 40843034728](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40843034728) | **SUCCESS** Ubuntu + Windows on `017cc4fa89e01bf9cef24cc67a1cadd8108d2a8d` |
| [PR 40843045014](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40843045014) | **SUCCESS** Ubuntu + Windows on `017cc4fa89e01bf9cef24cc67a1cadd8108d2a8d` |

Ubuntu: 359/359 unit/integration (39 files), 31/31 Chromium UI; generated contracts, typecheck, lint, build and both plan validators passed.
Windows: 358 passed + 1 platform-only skip (39 files); generated contracts/typecheck/lint/build, Windows `VerifyOnly`, plan validators passed.

Initial feature SHA `26b74fc7f2d9aa02629d9436fb5b35ff0c30615a` failed typecheck at SQLite `latest.id` SQL binding because `SQLOutputValue | undefined` was passed. Fixed after validation with `String(latest.id)` at tested SHA `017cc4fa89e01bf9cef24cc67a1cadd8108d2a8d`; subsequent exact-source push and PR workflows succeeded. These are CI/fixture tests, not physical Windows 10 GUI or Android test receipts.

## Limits and next step

Status: **TESTED_DURABLE_NATIVE_REVIEW_REQUEST_NOT_S095_ACCEPTED**.

The journal is an immutable historical *operator request*, **not permission to delete**. Current UI does not yet offer a hardware-backed, verified operator re-observation/confirmation workflow; the native-confirmation callback is wired in main and independently tested with injected host callbacks. All `canDelete`/`canDispatch` values remain false. No remote file is removed, no account/profile is published and no job is made runnable.

Remaining: physical Windows10 with at least two Android phones, exact MediaStore/picker/negative publish evidence, fresh USB/LAN transport and native operator flow, guarded remote deletion protocol with crash-recovery and postconditions, P12 Facebook/TikTok adapters, P13 20→100→300-device scale and P14 installer/release. P11/S095 and overall product are **not ACCEPTED**; verified completion percentage cannot be derived from test totals.
