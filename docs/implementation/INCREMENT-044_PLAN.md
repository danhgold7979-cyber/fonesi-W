# Increment044 — P11/S095 durable Android stage-transfer intent ledger

Date: 2026-10-28. Baseline `feat/studio-workspace@53c8d259ef7c4e7d3c2cea3793ee88e4e9ae742b`. Reviewed V2.1 S019/S074/S095/S097/S099 and acceptance gates, current SQLite schema v14 migration 13/14 checks, P11 strict claimed-effect journal, JOB claim/recovery, private host media plan, Increment042 owned host staging and Increment043 ADB Sync protocol implementation. Plan committed **before** source changes.

## Problem

Host staging is durable, ADB Sync transfer is an isolated leased transport primitive, but the database has no durable remote destination and attempt state before an Android byte write. A restart after SEND without an ACK would otherwise risk a second upload with a different path and unowned files. ADB ACK cannot be considered a MediaStore index or post.

## Increment order

1. Add append-only SQLite migration **v15** for `device_stage_transfers` (immutable job/device/host/asset ordinal, pinned snapshot/media hash/bytes, generated nonce/remote path, claim generation, state and UTC times), preserving all v1–v14 SQL/checksums and historical user/job/effect data. Enforce per-job-ordinal uniqueness and remote path uniqueness, index by device/job for bounded query and recovery.
2. Private `StudioDatabase.prepareClaimedDeviceStage` requires strict live `JOB` lease/claim generation and enabled verified device, `PREFLIGHT` job state, matching snapshot hash/revision/device, no previous external intent and exact unique READY pinned media binding on current host. Derive and **persist** an unguessable nonce + fixed remote path from job and media extension before Android transfer. Do not accept arbitrary path or nonce from UI/host. Duplicate ordinal or different job scope fails closed.
3. `beginClaimedDeviceStageAttempt`: atomic `INTENT → TRANSFER_UNCERTAIN` with lease/claim recheck and queue event **before** invoking ADB Sync. ADB Sync transport acceptance may be recorded only as `SYNC_ACK_UNVERIFIED`, never INDEXED/POSTED/SUCCESS. Missing ACK/expired lease/crash leaves uncertain state and cannot auto-replay. A future verified MediaStore reader must complete index/selection proof, not this primitive.
4. Add private-only worker commands, not StudioApi/preload/HTTP. Read-only status for trusted host/debugger may be exposed privately; never leak source paths, raw ADB serials, account credentials or media content in public DTOs.
5. Extend `recoverExpiredClaims` and `claimDueJob`: any staged transfer record on the phone triggers review/blocks requeue until explicit verified reconciliation, including state INTENT when host died before dispatch. Backup restore refuses active/uncertain remote staging; no automatic cleanup of Android or PC media.
6. Test with real SQLite and 2 database workers where helpful: strict active JOB owner/generation, wrong host/snapshot/ordinal, idempotency refusal, intent→uncertain→sync ACK and crash/reopen, expired claim into NEEDS_REVIEW without replay, no duplicate device claim or public command, pre-v15 upgrade preserving prior migration checksums and device audit. Test fixtures are not physical Android or proof of an actual remote path.
7. Run Ubuntu/Windows `pnpm check`, Chromium `pnpm test:ui` and `pnpm check:plan`; fix test issues, record exact SHA/CI counts and limitations. Do not merge main, deploy, publish installer, or report full S095/P11 accepted.

## External gates still open

Actual private JOB actor chaining ledger to fenced `AdbClient.sendOwnedStage`, Android MediaStore index probe and content picker correlation, ADB disconnect/restart reconciliation, verified cleanup, real app/target/identity profile, phone fleet load and installer. This ledger is a safe staging precondition, not a dispatch authorization.
