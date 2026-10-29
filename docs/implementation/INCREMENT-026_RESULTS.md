# Increment026 — P08/S072 verified ADB identity and lease fence

Baseline `feat/studio-workspace@d3e2d2fad4b3bffbf956ef29897c47ce48aee91f`, source commit `2efa916ef60a8a042531e7b68fe3c75c30c51149`. Written phase plan first: `docs/implementation/INCREMENT-026_PLAN.md`.

## Implemented

- `packages/database/src/index.ts` rejects silent reassignment of a historically **verified** ADB (hostId, transport serial) to a contradictory verified hardware fingerprint. It latches the historical device `CONFLICT`, preserves its deviceId, fingerprint, metadata, name, enabled and scheduled job binding; invalidates transport identity verification and fences stale generations. If a second registered device already owns the new fingerprint it also gets `CONFLICT` rather than being auto-trusted through the reused alias.
- Unauthorized/offline metadata and partial/failed property probe cannot overwrite the verified profile or create a phantom device. A good USB/TCP same-fingerprint pair still merges to a single registered device and queue owner.
- `claimDueJob` refuses to allocate a new lease to a `CONFLICT` profile; returns `NEEDS_REVIEW` without marking a scheduled job as posted or changing its immutable snapshot.
- `packages/database/src/device-registry.test.ts` covers cloned/reused ADB serials, persisted conflict across scans/restart, known identity collision, partial metadata, healthy adjacent phone, stable USB+TCP merge and stale generation denial. `packages/database/src/queue.test.ts` covers job snapshot/process association and conflict claim denial.

## CI evidence

- [GitHub Actions #40641180092](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40641180092), code commit `2efa916e`: **SUCCESS** Ubuntu + Windows.
- Ubuntu: `pnpm check` 242 passed / 26 files, `pnpm test:ui` 23 passed / 0 failed. Windows hosted: `pnpm check` 241 passed / 1 pre-existing Unix-only SDK fixture skipped / 26 files; setup and launcher VerifyOnly successful. Both plan validators pass, TypeScript/lint/build pass.
- Earlier intermediate CI red runs were due to a partial-property metadata bug identified by the new regression suite. This was fixed in `048dad6` and subsequent commits; final code CI is green.

## Acceptance and next work

**Status: TESTED_INCREMENT, not P08/S072 ACCEPTED.** No Windows10 GUI / physical Samsung/other Android evidence, no audited operator-driven identity conflict resolution/clear UI, no cross-host multi-owner trust negotiation, no APK/network/real workflow effect or 20→300 phone performance evidence. Repeated matching scans do **not** auto-clear a latched conflict. No credentials or real device actions performed. Main remains untouched.
