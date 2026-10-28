# Increment043 — P08/P11 S095 bounded ADB Sync transport spike (no publishing)

Date 2026-10-28. Baseline `feat/studio-workspace@d73b0953706131aba4b5a6760f299e578cba3d20`. Reviewed master V2.1 S074/S088/S095, existing `AdbConnection` framed protocol, `AdbClient.device()` transport/lease fencing and shell v2, TCP ADB fixture, P11 Increment042 owned host staging and current CI. Plan committed **before implementation**.

## Goal

Implement a narrowly scoped **device-side transport primitive** for transferring bytes already verified in an owned host-stage file. ADB Sync `SEND/DATA/DONE` ACK is *transport acceptance only*, **not** remote byte hash, MediaStore readiness, selected content or Facebook/TikTok publishing. No public `StudioApi`, preload, GUI button, automatic dispatch or staged file cleanup.

## Detailed steps / guardrails

1. Add an internal-capable `AdbClient.sendOwnedStage` method (not a public host endpoint). It requires `AdbClient.scoped(beforeDispatch)` so a future JOB actor can verify current lease/generation. No unscoped `AdbClient` may upload. Parameters include serial, source file, frozen job ID, asset ordinal, stage nonce, pinned SHA-256 and size, optional abort. Validate IDs/hashes/filename, allowlisted extension and **owned-media-stage/job-<id>/asset-<ordinal>.<ext>** path structure. Never accept an arbitrary remote path: generate within `/sdcard/Download/AutoReelsStudio/job-<id>/asset-<ordinal>-<nonce>.<ext>`.
2. Check local file is a regular non-symlink; verify exact size and full SHA-256 **before** any device write. Reject >512 MiB for this bounded spike; future larger-file support needs measured throughput/backpressure. Use `O_NOFOLLOW` and bounded 64KiB reads. Recheck identity/size/mtime from open descriptor before handshake.
3. Scoped Android `mkdir -p` in the fixed, generated namespace; then ADB transport selection and `sync:` handshake. Bounded 64KiB DATA frames (v1 Sync protocol), correct LE mode/length/mtime, socket backpressure and abort/error/EOF handling. Reinvoke `beforeDispatch` during long transfer and immediately before DONE to fence owner/transport generation. Check actual bytes and SHA during upload, and parse the final `OKAY/FAIL` Sync response (bounded diagnostic, no arbitrary shell/strings). No automatic retry or deletion of a remote path when response is uncertain.
4. Return a private `{status:'SYNC_ACK_UNVERIFIED',bytes,remotePath}` report. Remote path is for the **future durable device staging ledger**, never for HTTP/renderer or a publish success claim. A runner must persist ownership and destination **before sending** and independently verify Android bytes/MediaStore after transfer; this increment does not claim those gates.
5. Tests: actual file in isolated app-owned staging structure and loopback TCP ADB Sync fixture; verify framing, exact ordered DATA bytes, generated remote path, lease callback, FAIL acknowledgement, incomplete/stalled response, invalid hashes, symlinks, wrong path, overbudget and abort. No physical Android or social-app login needed.
6. `pnpm check` Ubuntu/Windows, Chromium browser regression and plan validators, then evidence/results/checkpoint if exact-source CI is green. Preserve `main`, existing user media and job history; never publish installer.

## Acceptance boundary

**TESTED_ADB_SYNC_PROTOCOL_SPIKE** only after CI. There is still no S095 production Android MediaStore index, selected-item correlation, durable per-device remote ledger/reconcile, live device/target/profile certification, real publish/verification or 20–300 device hardware acceptance. An ACK is not proof of a complete workflow.
