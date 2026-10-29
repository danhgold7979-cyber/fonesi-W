# Increment046 — bounded Android remote-byte readback

Date: 2026-10-28. Repository `danhgold7979-cyber/fonesi-W`; branch `feat/studio-workspace`. Plan-first commit: [INCREMENT-046_PLAN.md](INCREMENT-046_PLAN.md), `031d4a35cdd3ad4ad41b32914cfc16347868c572`. Tested source SHA: `5f4a57f0aa067c0845ecdf4d41ec8094da11fdfe`.

## Implemented

- Added scoped `AdbClient.readOwnedStage` using ADB Sync v1 `RECV` on a deterministic path reconstructed from job ID, ordinal, nonce and allowlisted extension; caller-supplied arbitrary remote paths are not accepted.
- Readback streams bounded DATA frames and computes SHA-256 incrementally. It checks expected byte count/hash, timeout, cancellation, malformed/truncated protocol, response budget, and current JOB/transport fence. It does not create a second local media copy, retry an ambiguous transfer, or clean up remote files.
- Added append-only SQLite migration v16 with nullable `remote_readback_hash`, `remote_readback_bytes`, `remote_readback_at`; schema v1–v15 migration SQL/checksums remain unchanged.
- Added private internal command `stage.verifyRemoteBytes`. It requires a current JOB claim, same job/stage/device/host/snapshot/revision, `SYNC_ACK_UNVERIFIED` state and exact equality with pinned hash/bytes. Matching evidence is stored atomically and audited; duplicate or mismatched proof is rejected.
- Added private host coordinator `verifyRemoteBytes`; it derives the remote path from the durable intent, fences the transport before and after I/O, verifies against the immutable media plan, then persists only the matching readback receipt. Result remains `scope: REMOTE_BYTES_ONLY`, `canDispatch: false`. The stage state remains `SYNC_ACK_UNVERIFIED`; this does not assert MediaStore indexing.
- Tests cover RECV framing, correct byte equality, mismatch/no-persist, malformed/truncated/FAIL cases, migration v15→v16 preserving historical checksums/data, duplicate/stale claims and public API isolation.

## Exact-source CI

Both GitHub Actions runs for source SHA `5f4a57f0aa067c0845ecdf4d41ec8094da11fdfe` succeeded:

- [Ubuntu run 40690484383](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40690484383): `pnpm check` — 330/330 unit/integration tests across 39 files; `pnpm test:ui` — 30/30 Chromium; `pnpm check:plan` PASS.
- [Windows run 40690472581](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40690472581): `pnpm check` — 329 passed, 1 platform-only skip across 39 files; generated contracts, TypeScript, lint, build, Windows launcher VerifyOnly and plan validators PASS. Windows UI suite is not run in this workflow.

## Acceptance boundary

Status: **TESTED_REMOTE_BYTE_READBACK_NOT_S095_ACCEPTED**. CI uses fixtures; it is not evidence of physical Android upload/readback. Still NOT_RUN: actual phone transfer/readback, Android MediaStore row/index and picker correlation, crash reconciliation and safe owned-path cleanup, certified private JOB executor, Facebook/TikTok compose/publish verification, Windows 10 physical USB/LAN, 20→100→300 device benchmark, installer/release and merge to `main`. Remote hash equality is not MediaStore readiness, exact picker selection, or external posting success.
