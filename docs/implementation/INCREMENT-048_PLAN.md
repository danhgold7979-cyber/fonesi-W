# Increment048 — durable remote-stage reconciliation after restart

Date: 2026-10-28. Repository: `danhgold7979-cyber/fonesi-W`; branch `feat/studio-workspace`. Plan-first baseline: `b0136bf29d5a59bfbcaa384b6ca5c176d03c71c4`. Scope: P11/S095.2–S095.3 recovery classification only. No upload retry, remote deletion, MediaStore mutation, or publish dispatch.

## Why this increment follows 047

Increment044–047 now persist a job-unique remote destination, uncertainty before ADB SEND, transport ACK, matching remote-byte readback and optionally one exact MediaStore row. A restart can still leave a durable stage in one of several states. The implementation must expose a deterministic, read-only reconciliation decision rather than create a new nonce/path, infer success from stale evidence, or delete an uncertain file.

## Implementation steps

1. **Recovery classification contract** — add a private typed result that distinguishes `NO_STAGE`, `REVIEW_REQUIRED`, `REMOTE_BYTES_MATCHED`, `MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED`, `REMOTE_MISSING`, `REMOTE_MISMATCH`, and `PROBE_UNSUPPORTED`. A saved observation is historical evidence, not proof the current remote file still exists.
2. **Reconcile by durable identity** — private host coordinator loads stage rows from SQLite and verifies job/device/host/claim-generation/snapshot identity. It reconstructs remote path only from persisted job/ordinal/nonce/allowlisted extension; no caller-supplied path. The read-only probe must not create a second intent or call upload, MediaStore scan, shell cleanup, or any public API.
3. **Fresh observation only** — for a live JOB lease and fresh verified transport, independently read remote bytes and probe the exact MediaStore row. Compare the results to the durable intent and pinned media plan. Return explicit mismatch/missing/unsupported/review classifications. Existing mismatched or stale evidence must never be overwritten.
4. **Durable reconciliation audit** — add append-only SQLite migration v18 for a bounded reconciliation audit table keyed by a generated record ID and linked to stage/job/device, lease generation, classification, observed hash/bytes and timestamp. Store only redacted evidence; do not store arbitrary ADB output or user source paths. Make audit inserts idempotent for a single reconciliation request ID and immutable after commit.
5. **Private command boundary** — add a DB-worker-only command for recording reconciliation results. Require current JOB lease/claim and exact stage ownership. Reject public HTTP/service dispatch and duplicate request IDs. A reconciliation result must not change job state, stage state, existing MediaStore/readback evidence, or dispatch eligibility.
6. **Regression tests** — cover restart with uncertain intent, saved-but-stale readback, exact current remote bytes + MediaStore row, remote missing/changed bytes, MediaStore unsupported/not indexed/ambiguous, stale lease/generation, wrong job/device/path, duplicate reconciliation ID, SQLite reopen persistence, public command rejection, and no ADB upload/delete calls during reconciliation.
7. **Validate** — run `pnpm check` on Ubuntu and Windows, `pnpm test:ui` on Chromium and `pnpm check:plan`. Fix failures, then record exact source SHA, test counts and CI links in `INCREMENT-048_RESULTS.md`, `PROGRESS.md`, and checkpoint-041.

## Expected files

- `packages/contracts/src/media.ts`
- `packages/database/src/schema.ts`, `packages/database/src/index.ts`, reconciliation tests and migration-upgrade test
- `apps/desktop/src/host/internal.ts`, `apps/desktop/src/host/stage-transfer-service.ts`
- `packages/devices/src/index.ts` and protocol tests only if existing read-only probes need a narrow typed adjustment
- `tests/stage-transfer-host.test.ts`
- `docs/implementation/INCREMENT-048_PLAN.md`, results/progress and evidence checkpoint

## Safety invariants

- No blind retry, no new remote nonce/path, no automatic scanner invocation, and no remote cleanup in this increment.
- A previously saved remote hash or MediaStore row is not a fresh observation after restart.
- Missing/ambiguous/unsupported/mismatched evidence remains review-required; no classification is posting success.
- Reconciliation must never authorize dispatch, change the stage state to a terminal-success state, or mutate user source files.
- Preserve migration v1–v17 SQL/checksums and historical rows.
- Physical Android, exact picker selection, provider posting, Windows 10 USB/LAN and fleet scale remain separate hardware acceptance gates.

## Acceptance boundary

The strongest status allowed is `TESTED_DURABLE_STAGE_RECONCILIATION_NOT_S095_ACCEPTED` after exact-source CI passes. Physical Android proof and the S095 acceptance test `AT-095` remain unrun unless separately evidenced.


## Amendment — preserve the exact fresh MediaStore row observation

Before closing the increment, the reconciliation audit must retain the bounded exact-row fields returned by the probe: row ID, display name, relative path, MIME type and byte count. These fields are optional only for non-indexed/unsupported/mismatch outcomes. For `INDEXED_EXACT`, all fields must be validated against the durable owned stage and persisted atomically with the classification. Add immutable-update/delete SQLite triggers to make the append-only promise enforceable at the database boundary. This does not alter any migration v1–v17; the still-unreleased v18 migration is extended before acceptance. Add tests for exact row evidence, invalid row mismatch, duplicate request ID conflict and immutable audit rows.
