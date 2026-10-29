# Increment 026 — P08/S072 verified transport identity fencing

Date: 2026-10-28. Baseline `feat/studio-workspace@d3e2d2fad4b3bffbf956ef29897c47ce48aee91f`. Read master V2.1, S072 in `17_STEP_RUNBOOK.md`, `P08_PLAN.md`, `INCREMENT-007_PLAN.md`, progress and current DB registry tests before editing.

## Scope and problem

Current `reconcileDeviceTransports` can silently remap an already-verified `(hostId, transport serial)` to a newly seen hardware fingerprint. This can abandon historical device/process/job association and expose control on a new record without resolving the contradictory identity observation. The correction MUST prioritize ownership and user data integrity over convenience.

### Implementation gate

1. On a fresh fully verified hardware fingerprint that **differs** from the verified profile already bound to the same host transport serial, latch `CONFLICT` on the historical device and retain its original fingerprint, metadata, name, enabled, Process/job bindings and transport device_id. Invalidate current transport identity verification and increment generation to fence all stale screenshot/actor sessions. Keep the observation's connected/unauthorized state for diagnostic display only; do not enable manual or automation.
2. If the contradictory fresh fingerprint already matches another registered device, also latch `CONFLICT` on that known identity. Never auto-transfer the transport or move jobs between records. Unknown/failing metadata (provisional) must not trigger this mismatch rule; it continues to suspend fresh control but retains existing historical metadata.
3. Subsequent identical scans, disconnect/reconnect, restart, or return to original evidence **must not silently clear a latched conflict**; explicit resolution is a separate audited user operation before any input becomes available. Preserve the security reason visible in the existing Devices UI, rather than introducing a faux resolve button.
4. Existing USB+TCP for same actual verified fingerprint must still map to one device/lease. Other unrelated devices remain operational. No public IPC, OS/ADB permissions or schema migrations needed in this focused change.

## Implementation steps and tests

- P08/S072.1–2: update `packages/database/src/index.ts` to check the historical transport binding *before* auto-creating/rebinding a verified profile; transactionally latch conflicts, generation fence, and preserve original identity evidence.
- P08/S072.3: extend `packages/database/src/device-registry.test.ts` with same-serial conflicting metadata, old identity retention, duplicate transport/known-identity collision, restart/persistence/no spontaneous repair, stale-generation rejection, and USB/TCP same-device nonregression.
- Run `pnpm check` and plan validators; CI Ubuntu+Windows and Chromium browser regression on PR; record result and evidence separately. Never equate fixture success with actual physical phones or production app certification.
- Do not modify `main`; merge only into `feat/studio-workspace` after gates pass. Branch commits per increment.

## Exit criteria

Transition: VERIFIED_TRANSPORT -> CONFLICT with actor fencing under a contradictory fresh identity; no silent job/account reassignment. Historical stable device ID preserved; fresh privileges off until an explicitly designed and audited resolution flow. Tests for missing metadata, repeated scans, same-fingerprint USB/LAN, and unaffected devices pass. Win10 + 2 Android physical evidence and audited resolution workflow remain **OPEN / NOT_RUN**; S072 full phase acceptance cannot be claimed yet.
