# Increment050 — reconciliation evidence classification and lease-fence invariants

Date: 2026-10-28. Repository: `danhgold7979-cyber/fonesi-W`; branch: `feat/studio-workspace`.
Plan-first baseline: `91e9da36fc53bac13cb92357b2ce512a790e9cb9`.
Scope: tighten the internal SQLite reconciliation audit contract and add regression coverage. This does not accept S095 or enable dispatch.

## Why this increment

The v18 audit accepts a typed classification and typed MediaStore status, but the database method should reject contradictory combinations rather than trust a caller that can reach the private worker. Reconciliation records must be internally consistent and fenced by the live JOB lease, claim generation and current job revision.

## Implementation steps

1. Enforce classification/evidence consistency in `recordClaimedDeviceStageReconciliation`:
   - `MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED` requires exact observed hash/bytes and `mediaStoreStatus=INDEXED_EXACT`.
   - `REMOTE_BYTES_MATCHED` requires exact observed hash/bytes and a status that means no MediaStore match was asserted (`NOT_INDEXED` or null only if the remote probe explicitly returned without a MediaStore probe).
   - `REMOTE_MISSING` must not carry a claimed matching hash/byte pair.
   - `REMOTE_MISMATCH` cannot carry the exact expected hash and byte count together.
   - `PROBE_UNSUPPORTED` must not claim `INDEXED_EXACT`.
2. Keep idempotency semantics: identical request/evidence returns the original audit row; any changed classification/hash/bytes/MediaStore status for the same stage/request ID fails closed.
3. Add database tests for contradictory classifications, wrong lease generation, stale job revision, expired lease, idempotent same evidence, changed-evidence conflict, and zero audit rows after rejection.
4. Add host tests for unsupported/ambiguous MediaStore outcomes remaining non-dispatchable and not mutating stage/job state.
5. Run Ubuntu/Windows `pnpm check`, Ubuntu Chromium UI, Windows `VerifyOnly`, and plan validation. Fix all failures; record exact-source CI, test counts and checkpoint-043.

## Expected files

- `packages/database/src/index.ts`
- `packages/database/src/device-stage.test.ts`
- `tests/stage-transfer-host.test.ts`
- `docs/implementation/INCREMENT-050_RESULTS.md`
- `docs/evidence/implementation/checkpoint-043.json`
- `docs/implementation/PROGRESS.md`

## Safety invariants

No public command, upload retry, remote deletion, stage/job state transition, posting dispatch, schema downgrade or migration edits. Rejected evidence must not create audit rows or queue events. The only allowed outcome is a non-dispatchable audit observation.

## Acceptance boundary

After exact-source CI passes, the strongest status is `TESTED_RECONCILIATION_CLASSIFICATION_AND_FENCING_NOT_S095_ACCEPTED`. Physical Android, exact picker correlation, real posting, Windows 10 hardware and fleet scale remain separate unrun acceptance gates.
