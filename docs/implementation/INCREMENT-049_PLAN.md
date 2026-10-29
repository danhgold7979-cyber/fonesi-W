# Increment049 — reconciliation idempotency and crash-reopen audit tests

Date: 2026-10-28. Repository: `danhgold7979-cyber/fonesi-W`; branch `feat/studio-workspace`.
Plan-first baseline: `f3b61dfa586a97ec94ffe4adb0778e5d4a82364e`.
Depends on Increment048; scope is persistence invariants and recovery test coverage, not physical-device acceptance.

## Steps

1. Add database tests for schema v18 reconciliation audit: same stage + same request ID + identical evidence returns the original immutable row; reuse of that ID with different classification/hash/bytes/MediaStore status fails closed.
2. Verify audit survives closing and reopening SQLite; verify stage row and job state remain unchanged before and after reopen.
3. Test lease/claim expiry, wrong generation, wrong stage/job identity and stale job revision rejection; ensure no audit row is created for rejected attempts.
4. Test classification consistency: byte-match requires exact observed hash/bytes; MediaStore-match cannot be recorded without the matching remote-byte observation; mismatch/missing/unsupported remain non-dispatchable.
5. Test host coordinator failure boundaries: readback unsupported or ambiguous probe never uploads, never deletes, never changes stage state and never returns dispatch permission.
6. Run Ubuntu/Windows `pnpm check`, Ubuntu Chromium UI suite, Windows `VerifyOnly`, and plan validators. Fix all failures and write exact-source result/checkpoint.

## Expected files

- `packages/database/src/device-stage-reconciliation.test.ts` (or equivalent focused test file)
- `tests/stage-transfer-host.test.ts`
- `docs/implementation/INCREMENT-049_RESULTS.md`
- `docs/evidence/implementation/checkpoint-042.json`
- `docs/implementation/PROGRESS.md`

## Safety invariants

No auto-retry, no remote delete, no post dispatch, no public API route, no weakening of lease fencing, no edit to migrations v1–v17. Do not treat a stale stored observation as a fresh remote observation. Physical Android, picker correlation, real posting, Windows 10 hardware and scale remain separate gates.

## Acceptance boundary

The strongest status after passing CI is `TESTED_RECONCILIATION_IDEMPOTENCY_AND_REOPEN_NOT_S095_ACCEPTED`; physical AT-095 remains unrun.
