# Increment051 — operator-review reconciliation after JOB lease expiry

Date: 2026-10-28. Repository: `danhgold7979-cyber/fonesi-W`; branch: `feat/studio-workspace`.
Plan-first baseline: Increment050 tested source `1c260738cf4451cad4bab4efa0ae2c7ee38ba16c`.
Scope: enable a deliberate, read-only re-observation of an uncertain owned stage after crash recovery has moved its job to `NEEDS_REVIEW`. This does not requeue the job or enable dispatch.

## Problem

The current reconciler correctly requires a live JOB lease. After a crash, `recoverExpiredClaims` moves jobs with a durable stage to `NEEDS_REVIEW`; the old JOB lease is expired and cannot safely be reused. There is currently no explicit MANUAL-lease path for a fresh read-only observation, so the operator cannot gather new remote evidence through the coordinator without first leaving the existing review boundary.

## Implementation steps

1. Add a read-only DB assertion for review reconciliation. It requires a live `MANUAL` lease for the same device, job state `NEEDS_REVIEW`, exact expected job revision/snapshot, a durable stage tied to the historical JOB claim generation, expired historical claim, stage state `TRANSFER_UNCERTAIN` or `SYNC_ACK_UNVERIFIED`, and no current active JOB lease/claim for that job. The existing recovery path deletes `job_claims`, so change it to retain the expired historical claim row only for stage-backed jobs routed to `NEEDS_REVIEW`; repeat recovery must be idempotent, while ordinary preflight-only jobs remain requeueable and have their stale claim removed.
2. Extend schema v19 reconciliation audit with `lease_owner_kind` and `lease_generation`. Existing rows migrate deterministically as JOB lease generation = historical claim generation. Preserve all v1–v18 migration SQL.
3. Record which lease authorized each audit observation. A review observation retains the stage's original `claim_generation` and separately stores the current MANUAL lease owner kind/generation. Idempotency includes these fields.
4. Extend the private coordinator with a review-mode reconciliation path. It uses the current MANUAL lease and fresh verified transport generation, reloads the pinned job media snapshot, reads only the existing durable owned path and probes the exact MediaStore row. It must not upload, delete, create a new nonce/path, mutate stage/job state, or set dispatch permission.
5. Keep the existing JOB-lease path unchanged. Review mode is permitted only for `NEEDS_REVIEW` jobs after expired-claim recovery; it must not be exposed through public HTTP/preload or a generic button without an explicit operator-review flow.
6. Add regression tests for: successful review-mode read-only observation after expiry; rejection while JOB lease is still active; rejection of stale/expired MANUAL lease; wrong device/host/snapshot/revision; historical claim generation mismatch; audit stores MANUAL generation; stage/job remain unchanged; no upload/delete/dispatch; schema v18→v19 and old audit-row migration.
7. Run Ubuntu/Windows `pnpm check`, Ubuntu Chromium UI, Windows `VerifyOnly`, and plan validators. Fix all failures and record exact-source CI and checkpoint-044.

## Expected files

- `packages/contracts/src/media.ts`
- `packages/database/src/schema.ts`, `packages/database/src/index.ts`, `packages/database/src/device-stage.test.ts`, `packages/database/src/database.test.ts` (v18→v19 migration regression)
- `apps/desktop/src/host/internal.ts`, `apps/desktop/src/host/stage-transfer-service.ts`
- `tests/stage-transfer-host.test.ts`
- `docs/implementation/INCREMENT-051_RESULTS.md`
- `docs/evidence/implementation/checkpoint-044.json`
- `docs/implementation/PROGRESS.md`

## Safety invariants

A MANUAL lease authorizes only a read-only observation. It never replaces the expired JOB claim, does not make the job runnable, does not erase review state and cannot authorize any side effect. Historical observations are not treated as current. No remote cleanup, upload retry, post dispatch or stage/job mutation is allowed.

## Acceptance boundary

The strongest status after exact-source CI is `TESTED_MANUAL_REVIEW_RECONCILIATION_NOT_S095_ACCEPTED`. Physical Android, exact picker correlation, owned cleanup, real publishing, Windows 10 hardware and fleet scale remain separate gates.
