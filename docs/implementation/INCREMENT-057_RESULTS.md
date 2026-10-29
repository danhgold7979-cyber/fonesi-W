# Increment057 — native-confirmed cleanup review request after fresh Android observation

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`; branch `feat/studio-workspace`; P11/S095.2–S095.3.
Plan first: [INCREMENT-057_PLAN.md](INCREMENT-057_PLAN.md) at `24767b25a477d2c1e2cc2063cbadff40b8e18e05`.
**Exact tested source SHA `3787893c7edf4678bc80a68a81a83a2b1bd0e8a1`**.

## Implemented actual source

- `packages/contracts/src/schedule.ts`: a new native-only `NativeStageCleanupReviewResult` and `requestCleanupReview(jobId,ordinal)` with explicit `LIVE_ANDROID_REVIEW_REQUEST_ONLY` scope, `REVIEW_REQUEST_RECORDED` or `CANCELLED`, classification, MediaStore status, recordedAt and fixed `canDelete:false`/`canDispatch:false`. Does not expose request ID, stage ID, snapshot hash, path, nonce, lease or serial.
- `apps/desktop/src/host/native-stage-review.ts`: shares strict private stage selection between re-observation and request action; requires `NEEDS_REVIEW`, exact host, job and ordinal. On a new explicit action acquires a fresh verified one-transport MANUAL actor lease, calls existing ADB Sync RECV+MediaStore reconciliation *once*, rejects anything except `REMOTE_BYTES_MATCHED` and `NOT_INDEXED`, and within **the same lease** calls existing private `HostStageTransferService.requestOwnedCleanupReview` for native confirmation and transactionally fenced journaling. Never uploads/deletes anything or grants dispatch.
- `apps/desktop/src/main/index.ts` / `preload.cts`: additional separate native `studio:stage-cleanup-review` bridge, strict `{jobId, ordinal 0..31}` validation and mainFrame/allowed file URL verification. Not in public `StudioApi`, `ApiCommand` or loopback HTTP.
- `apps/desktop/src/renderer/JobStageReviewDialog.tsx`: an explicit native-only button to record a cleanup *review* request; only visible for stage `SYNC_ACK_UNVERIFIED` with persisted remote byte match and no stored MediaStore row; always calls a new live probe under current ownership. Displays success only after durable journal receipt, cancel otherwise; single-flight, clear loading/errors, refreshes evidence. Dialog title no longer incorrectly says wholly read-only, while Android operations themselves stay read-only.
- `tests/stage-transfer-host.test.ts`: real SQLite and private host with simulated ADB readback plus MediaStore, verifies 1 lease/1 read, native yes/no, audit before confirmation, exact append-only review on restart, redacted result, unchanged stage/job, failed indexed/ambiguous/unsupported observations before prompt, wrong host/ordinal/revision and revoked MANUAL lease after confirmation. Public dispatcher rejects forgery.
- `tests/ui/schedule.spec.ts`: loopback UI shows no native controls; raw `stage.cleanupReviewRecord` via public `/api` remains rejected.

## Exact-source CI (not a physical Android test)

| CI workflow | Ubuntu / Windows | Conclusion |
|---|---|---|
| [Push 40849181946](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40849181946) | ubuntu-latest + windows-latest, exact SHA `3787893c7edf4678bc80a68a81a83a2b1bd0e8a1` | **SUCCESS** |
| [PR 40849189338](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40849189338) | ubuntu-latest + windows-latest, same SHA | **SUCCESS** |

Ubuntu: **369/369 unit/integration tests (39 files)** and **31/31 Chromium UI**; generated contracts, typecheck, lint, build and plan validators pass.
Windows: **368 passed + 1 platform-only skipped test (39 files)**; generated/type/lint/build, Windows `start-windows.ps1 -VerifyOnly` and plan validators pass.

No schema migration in this increment (SQLite remains **v20**).

## Acceptance boundary and next dependency

Status: **TESTED_NATIVE_CONFIRM_CLEANUP_REQUEST_NOT_S095_ACCEPTED**.

The feature records an explicit *historical request for further cleanup review*, **not a deletion approval or permission to post**. The native confirmation dialog itself has only injected callback fixture coverage, not a physical Windows 10 Electron UI acceptance run. Remote bytes and MediaStore status come from an ADB simulator in tests; no real Android USB/LAN/picker evidence is claimed. Native stage selection and stage state remain unchanged, and review requests are not a worker queue. No Android unlink, MediaStore delete, upload retry, posting, job requeue or main merge. S095 AT-095 and P11 still NOT_ACCEPTED. The follow-up is physical-device evidence and strictly fenced postconditions before any owned deletion, plus S096 exact-media selection/Unicode, P12 Facebook/TikTok verification, P13 fleet and P14 installer/release. Total 15-phase/125-step/375-task acceptance percentage remains uncomputed.
