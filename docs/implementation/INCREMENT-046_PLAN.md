# Increment046 — bounded Android remote-byte readback verification

Date: 2026-10-28. Repository: `danhgold7979-cyber/fonesi-W`; branch `feat/studio-workspace`. Baseline `a66dd15c242f2a4dd3ef2b997095d1aa39087dad`. This plan is committed before implementation. Scope: P11/S095, a host-only verification slice; not full MediaStore or publishing acceptance.

## Problem

Increment045 joins owned host staging, durable SQLite intent/uncertainty, and ADB Sync upload. A Sync `OKAY` only proves the transport accepted the transfer; it does not prove that bytes now stored at the exact Android destination match the pinned asset. S095 requires durable transfer/index readiness and crash reconciliation, so the next smallest safe step is an independent remote byte readback.

## Implementation steps

1. **ADB Sync receive primitive** — add a scoped `AdbClient.readOwnedStage` (or equivalent) using ADB Sync v1 `RECV` against a generated path only: `/sdcard/Download/AutoReelsStudio/job-<jobId>/asset-<ordinal>-<nonce>.<allowlisted-extension>`. Do not accept arbitrary paths. Require `scoped(beforeDispatch)`; fence before I/O and at least every 1 MiB while reading. Parse bounded `DATA` frames (maximum 64 KiB), `DONE`, and bounded `FAIL`; stream SHA-256 without writing a second local copy. Enforce expected byte ceiling (512 MiB), exact final byte count, hash, timeout, abort, socket budget, EOF and backpressure/lease failure. No retry or cleanup on ambiguity.
2. **Append-only SQLite migration v16** — add nullable `remote_readback_hash`, `remote_readback_bytes`, and `remote_readback_at` to `device_stage_transfers`. Preserve v1–v15 migration SQL/checksums and all historical rows. Extend the private stage DTO with nullable readback evidence. This evidence records byte equality only; do not change `state=SYNC_ACK_UNVERIFIED`, job phase, or any dispatch permission.
3. **Private DB verification command** — add `stage.verifyRemoteBytes` to the internal worker union/dispatcher only. Require a live JOB lease + claim generation, same device/job/snapshot/revision, verified device identity, stage state `SYNC_ACK_UNVERIFIED`, and supplied observed hash/byte count exactly equal to pinned expected hash/bytes. Store evidence atomically and append a redacted queue audit event. Refuse wrong hashes, byte counts, stale leases, duplicate/mismatched stage and all public dispatcher routes.
4. **Host coordinator integration** — add a private `HostStageTransferService.verifyRemoteBytes` method. Resolve the durable stage row from SQLite; validate host/device/serial/generation freshness; derive the only permitted remote path from its persisted nonce/ordinal and allowlisted extension; call scoped ADB readback; persist evidence only after exact match. Return a redacted receipt with `scope: 'REMOTE_BYTES_ONLY'` and `canDispatch: false`. It must not invoke on startup, schedule, public HTTP, renderer or automatically after upload; a caller must explicitly invoke it inside a trusted future JOB actor.
5. **Regression coverage** — update ADB Sync fixture to model RECV with exact byte stream and cover successful exact readback, wrong hash, wrong length, FAIL/missing file, malformed/oversized DATA frame, truncated response, cancellation, stale fence during a multi-frame read and no arbitrary remote path. Add DB migration test v15→v16 preserving v1–v15 checksums, stage intent/state and audit history; DB tests for strict matching/duplicate/stale lease/public command rejection. Add host coordinator tests proving durable evidence only after readback match, no dispatch flag, no mutation on mismatch and restart persistence.
6. Run `pnpm check` on Ubuntu and Windows, `pnpm test:ui` on Chromium and `pnpm check:plan`; fix red tests before recording results. Record exact SHA, CI receipts and limitations in `INCREMENT-046_RESULTS.md`, `PROGRESS.md`, and checkpoint-039.

## Files expected to change

- `packages/devices/src/index.ts` and `packages/devices/src/sync.test.ts`
- `packages/contracts/src/media.ts`
- `packages/database/src/schema.ts`, `packages/database/src/index.ts`, new/updated migration regression tests
- `apps/desktop/src/host/internal.ts`, `apps/desktop/src/host/stage-transfer-service.ts`
- `tests/stage-transfer-host.test.ts`
- `docs/implementation/INCREMENT-046_PLAN.md`, results/progress and evidence checkpoint

## Safety invariants

- The ADB remote path is reconstructed from the durable stage row, not caller input.
- Readback must be bounded and streaming; no full media buffering and no writing to user source directories.
- Hash/byte mismatch, unknown file, missing file, stale lease/transport, timeout, abort, or truncated response must fail closed and must not authorize retries or dispatch.
- Persist evidence only after successful exact hash/byte comparison. The record is still **remote byte equality**, not Android MediaStore index, picker selection, app identity, publish outcome or proof that an external post exists.
- Preserve user media/history and existing migration checksums. No public IPC/API, social-app input, installer, release or merge to `main`.

## Acceptance boundary

Status after this increment may be **TESTED_REMOTE_BYTE_READBACK_NOT_S095_ACCEPTED** only if exact-source CI passes. Physical Android transfer/readback, Android MediaStore row/index proof, exact picker selection correlation, uncertainty reconciliation/owned cleanup, app profile and real posting verification, Windows 10 GUI/USB/LAN, 20→100→300 device throughput, installer and release remain NOT_RUN unless separately evidenced.
