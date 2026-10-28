# Increment044 — P11/S095 durable Android media-transfer intent journal

Date: 2026-10-28. Baseline `feat/studio-workspace@76dcb09e03dc57e7e735d8bc327befecd76d8093`; [pre-code plan](INCREMENT-044_PLAN.md) committed at `412755b5fbacf9941cc9df28db552b439a75059f`. Main source `fa87929583f69b61f7dcb4273e86ed770b4f3ecf`; tests `d69c17c11b81a4f7827ebb91fb96d9b0c47bb3db`, fixed failed assertion `c5daa5bedb8afa47ee383e87451e33a8fd6e5f61`. Changes committed/pushed only to `feat/studio-workspace`.

## Implemented
- Append-only SQLite v15 `device_stage_transfers` table with immutable per-job asset ordinal and per-device remote path uniqueness, host/owner/generation, snapshot and asset hash/bytes, generated remote nonce/path, and state timestamps. Prior migration v1–v14 SQL and checksums are unchanged. v13→v15 migration regression checks device audit and content epoch plus new empty stage table.
- `prepareClaimedDeviceStage` enforces current JOB lease and job claim, verified enabled device, immutable PREFLIGHT snapshot/job revision and source-owned READY media at exact ordinal, no prior external effects, and unique staging intent. Atomically inserts `INTENT`, remote destination and queue audit before any Android byte write.
- `beginClaimedDeviceStageAttempt` revalidates same generation and changes to `TRANSFER_UNCERTAIN` **before** ADB Sync; `recordClaimedDeviceStageSyncAck` records only `SYNC_ACK_UNVERIFIED`, not Android index, a verified post or a success.
- All stage commands are private `DbClient.internal` (not public StudioApi/preload/HTTP). After a stage is recorded, device queue claim returns NEEDS_REVIEW, claim-expiration recovery routes job to NEEDS_REVIEW (including INTENT before dispatch), RUNNING transition and claimed external effect are blocked, and restore refuses workspaces with any unresolved stage. Neither source file nor remote file is deleted by these routines.
- SQLite regression covers intent→uncertain→ACK, persisted nonce, recovery after reopen, expiring claim before transfer, wrong owner generation/host/snapshot/media, forged public API, and transactional rollback on forced insert failure. All tests use synthetic SQLite fixtures only.

## Verified remote checks on final SHA
- [GitHub Actions 40663045369](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40663045369): SUCCESS Ubuntu + hosted Windows.
- [GitHub Actions 40663053325](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40663053325): SUCCESS Ubuntu + hosted Windows.
- Ubuntu `pnpm check`: **320/320 tests /38 files**; `pnpm test:ui`: **30/30 Chromium**. Windows `pnpm check`: **319 pass/1 pre-existing Unix-only SDK fixture skip /38 files**.
- TypeScript strict/lint/build/generated contract checks, Python plan validators and Windows source launcher VerifyOnly PASS.
- Earlier unit regression code had one false test assertion (`toMatchObject({canDispatch:undefined})` on a DTO that deliberately omits dispatch flag). Fixed by explicit `Object.hasOwn(stage,'canDispatch') === false` and reran CI.

## OPEN / NOT_RUN
**TESTED_DURABLE_STAGE_JOURNAL_NOT_S095_ACCEPTED**. No trusted JOB runtime actor binding stage journal to fenced ADB Sync, no actual remote hash/MediaStore index, no physical phone, no app/target profile/locale identity certificate, no remote transfer/review resolution or cleanup, no Facebook/TikTok post verification, no Windows10 20→300 device benchmarks, offline installer, main merge or release. This stage ledger is a safety prerequisite, not authorization for dispatch.
