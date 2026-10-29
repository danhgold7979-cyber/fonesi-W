# Increment043 — P11/S095 bounded ADB Sync transport-only capability

Date 2026-10-28. Plan first committed at `e197802593bb98e354f8362e07c6b8df60e1c15f` (`INCREMENT-043_PLAN.md`), baseline `d73b0953706131aba4b5a6760f299e578cba3d20`. Source `e63f580db4d3f7a5dfcf73bbc66af3e1e9fa5cb7`, Windows exact stage-file path compatibility fix `53c8d259ef7c4e7d3c2cea3793ee88e4e9ae742b`. No public IPC/API, main merge or release.

## Implemented

- `AdbClient.sendOwnedStage` supports ADB Sync v1 SEND/DATA/DONE framing, bounded 64-KiB data chunks, LE payload length/mode/timestamp, TCP backpressure, exact `OKAY`/bounded `FAIL`/EOF and cancellation.
- Requires a `scoped(beforeDispatch)` JOB-owner fencing callback; unscoped calls fail before device input. Callback is re-run during long transfers and before DONE; caller must supply private trust/lease proof, not user input.
- Only accepts a staged local file in the fixed `owned-media-stage/job-<id>/asset-<ordinal>.<ext>` layout. Validates regular/non-symlinked source and parent dirs, pinned file size/hash via pre-transfer streamed SHA-256, then hashes transmitted bytes again. 512-MiB bounded first-slice limit. Generates remote path within fixed `/sdcard/Download/AutoReelsStudio/job-<id>/` using caller-provided durable 32-hex nonce; no arbitrary remote path injection.
- Uses restricted shell_v2 quoting for Android directory creation and the shared transport path. Never retries automatically on failed/unknown ACK and never cleans up an unverified Android remote location.
- Returns private `SYNC_ACK_UNVERIFIED` (canDispatch:false) and remote path reserved for future durable device staging ledger. This is **not** MediaStore indexing, selected asset proof, published post or finalized job state.
- TCP ADB fixture tests SEND/DATA bytes, generated paths and owner callback, unscoped/source/hash/nonce rejection before IO, remote FAIL/truncated ACK uncertainty, abort/symlink boundary.
- Windows CI exposed case-normalization differences in `realpath`; fixed using inode/lstat regular file+parent directory symlink checks, no weakened trust of user-selected remote destinations.

## Exact-source validation

- [GitHub Actions 40661785292](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40661785292) SUCCESS Ubuntu and Windows.
- [GitHub Actions 40661790899](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40661790899) SUCCESS Ubuntu and Windows.
- Ubuntu `pnpm check`: **314 PASS /37 test files**, Chromium **30 PASS**.
- Windows `pnpm check`: **313 PASS +1 existing Unix-only SDK skip /37 files**. Generated/type/lint/build, Windows VerifyOnly and plan validators PASS.

## Acceptance boundary

**TESTED_ADB_SYNC_PROTOCOL_NOT_S095_ACCEPTED**. No durable on-device media ledger yet, no MediaStore insert/index/correlation, Android physical device, verified publish/target/account, automatic dispatch, cleanup or 20–300 physical-device throughput. Future owned JOB actor must durably commit destination/attempt BEFORE calling `sendOwnedStage`, then re-probe remote media and correlate exact selected item. No `main` merge/installer release.
