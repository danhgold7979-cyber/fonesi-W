# Increment050 — reconciliation classification and lease-fence invariants

Date: 2026-10-28. Repository: `danhgold7979-cyber/fonesi-W`; branch `feat/studio-workspace`.
Tested source SHA: `1c260738cf4451cad4bab4efa0ae2c7ee38ba16c`.
Plan-first reference: [INCREMENT-050_PLAN.md](INCREMENT-050_PLAN.md).

## Implemented and validated

- Database rejects contradictory reconciliation classification and MediaStore status combinations.
- A matching MediaStore row requires `INDEXED_EXACT`; a remote-byte-only result requires `NOT_INDEXED`; unsupported and ambiguous probe outcomes remain explicit and non-dispatchable.
- Added regression tests for wrong lease generation, stale job revision and expired lease; rejected attempts leave no audit rows.
- Added host tests for unsupported/ambiguous probes; stage/job state remains unchanged and `canDispatch: false`.
- CI caught a fixture assertion comparing a pre-readback stage object to its updated persisted state; the helper now returns the actual persisted stage snapshot.

## Exact-source CI

- [Ubuntu workflow 40720165384](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40720165384): **SUCCESS** — 338/338 tests across 39 files; 30/30 Chromium UI; generated contracts, TypeScript, lint, build and plan validators passed.
- [Windows workflow 40720179769](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40720179769): **SUCCESS** — 337 passed + 1 platform-only skip across 39 files; generated contracts, TypeScript, lint, build, Windows `VerifyOnly` and plan validators passed.

## Acceptance boundary

Status: **TESTED_RECONCILIATION_CLASSIFICATION_AND_FENCING_NOT_S095_ACCEPTED**.

Still not accepted or not run: read-only reconciliation after JOB claim expiry using an explicit operator-review lease, physical Android, exact picker correlation, ownership-ledger cleanup, actual Facebook/TikTok publishing and post verification, Windows 10 USB/LAN, 20→100→300 device load, installer/release and merge to `main`.
