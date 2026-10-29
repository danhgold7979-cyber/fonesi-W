# Increment042 — P11/S095 host-only owned staging ledger

Date 2026-10-28. Plan `INCREMENT-042_PLAN.md` committed **before coding** as `147b15aea2566479f29d21b5c1734893ee264879`. Source/test at `583197a1`, integration regression `a6d9f77`, build correction `03a4dc1`, and final deadlock fix and verified source `0605b7a3c31f2ef713786cb6cd8d1740a98d5a53`. All commits pushed to `feat/studio-workspace`; `main` unchanged.

## Implemented

- `packages/media/src/staging.ts` adds `HostStagingLedger`: an app-owned private `owned-media-stage` directory under canonical app user-data, rejecting symlink staging roots. Planned media ownership is bound to approved, host-scoped `JobMediaPreflightPlan` from the private DB worker; <=32 files, 4 GiB/file, 8 GiB/attempt, 64 MiB minimum disk reserve.
- Generates safe fixed staging names by ordinal and allowlisted media extension. Exclusive per-job lock, private pending directory, positional 256 KiB reads/writes through non-following source handles, before/after source inode/mtime/size/realpath check, pinned SHA-256 of copied file and fsync before atomically renaming to job namespace. No overwrite or cleanup of an unrecognized final directory.
- Manifest has exact host/job/revision/snapshot hash and ordered asset IDs/hash/size, canonical digest. Reuse requires validating manifest owner/digest, names, no extra files/symlinks and all current staged bytes; corrupt/foreign namespace fails closed. Only pending namespace created by the current operation may be cleaned up; stale locks or pending after process crash are deliberately not silently repaired.
- Internal `HostMediaService.stageJobHostMedia(jobId)` uses private `job.mediaPlan` before/after staging, rejects changed job/source metadata, returns redacted `HOST_STAGED_NOT_ANDROID`/canDispatch:false. Electron main and authoring host provide owned data root; no public API, preload, Android action, posting effect or destructive source action.
- Unit + actual SQLite/host integration verify real byte copy, manifest reuse, tamper/foreign contents, wrong host, source changes, no-media, no data deletion, no job/effect/lease mutation and command isolation. This is local staging only, not Android MediaStore transfer.

## Failures fixed during implementation

- Initial CI failed strict TS6133 unused import, removed.
- Subsequent CI showed 10s test hangs from FileHandle stream autoClose false. Replaced transfer with bounded positional 256 KiB reads/writes and retained stable file identity/SHA checks, **not** increased test timeout.
- Full exact-source CI rerun:
  - [Actions 40660619480](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40660619480) SUCCESS Ubuntu/Windows
  - [Actions 40660627363](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40660627363) SUCCESS Ubuntu/Windows
  - Ubuntu: 310/310 unit/integration (36 files) + 30/30 Chromium.
  - Hosted Windows: 309 passed, 1 existing Unix-only SDK fixture skipped (36 files); Windows VerifyOnly, generated/type/lint/build/plan validators PASS.

## Acceptance boundary

**TESTED_HOST_OWNED_STAGING_NOT_S095_ACCEPTED**. No Android ADB sync upload, MediaStore indexing, on-device actual selected asset verification, verified per-device generation ownership or cleanup after confirmed external result. No physical Win10 USB/LAN, Facebook/TikTok publish, 20–300-device throughput, final installer/deployment or main merge. Manifest is durable local ownership evidence, **not** a posting receipt.
