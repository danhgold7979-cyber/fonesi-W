# Increment029 — P08/S072 operator-verified recovery of latched ADB identity conflicts

**Plan before source changes (2026-10-28).** Repository `fonesi-W`; source branch `phase/p08-operator-resolution-2026-10-28` based on `feat/studio-workspace@c55ca58235e8c1806c956c37f05b40713cffbcef`. Read `AGENTS.md`, V2 master execution plan, P08/S072 runbook, P08_PLAN, Increment026–027 results, and current device-registry/host/renderer IPC contracts. Scope is one bounded sub-step, **not full P08, not release or hardware acceptance**. Increment028 is occupied by concurrent P05 work.

## Threat model and required invariants

- A reused USB/TCP alias might point at the wrong handset. A previously verified fingerprint is never replaced by operator choice. A spoofed/partial ADB metadata, stale generation, expired token, existing device owner, active/uncertain job or conflicting phone must fail closed. No bypass based on only model, hostname or transport serial.
- The browser renderer cannot submit a fingerprint, serial, raw transport observation, arbitrary hostId or verified indicator. All identity evidence is re-read from the real local ADB host by privileged device service.
- An explicit, native **Electron OS confirmation dialog** and a separately typed registered device name are mandatory. Loopback authoring host and non-native hosts may view blocked state but cannot clear a conflict.
- Only an exact match of the historical verified fingerprint can be reactivated. Unknown/new identities, competing aliases, multiple active transports, status `UNAUTHORIZED` or no live ADB remain `CONFLICT`. No automatic job, input, account/target reassignment or publication is issued.
- On apply: transactionally recheck profile revision, active lease/uncertain jobs, transport generation, hash of fresh proof and ≤60-second durable preview; invalidate transport generation, clear captures, append an allowlisted audit event, and require a fresh post-resolution scan before any input is enabled. Refuse stale/replayed token.
- Audit metadata never serializes raw hardware serial, pairing code, profile secrets or ADB output. A physical user acknowledgment is user-provided, not independent hardware certification.

## Ordered implementation by layer

1. P08/S072.2 persistence: add append-only schema v13 for short-lived resolution previews and event log; no rewrite to old migration checksums. Build `previewDeviceConflictResolution` + `applyDeviceConflictResolution` around a private `TransportObservation` from the trusted host. Require physical confirmation and exact registered device name. Return only typed blocker codes and safe metadata. Explicit `RESOLUTION_NOT_READY` on mismatch.
2. P08/S072.3 host boundary: add public **narrow named** `previewDeviceConflictResolution(id,revision)`/`applyDeviceConflictResolution(token,name)` commands. The host performs fresh ADB `devices` and `metadata` probes before both preview and apply; validates token scope; serialized configuration barrier excludes concurrent manual actors. Apply requires an injected native OS confirmation callback. No raw observation is passed from UI.
3. P08/S072.3 UI: show a clear warning and preview blockers in Device Details only for `CONFLICT`, one explicit name-confirm input, opt-in checkbox, and apply button enabled only when preview is eligible. Refresh after apply; do not claim automation ready, and reset pending confirmation on snapshot changes.
4. Regression: SQLite real DB with conflicting reused serial, matching original, changed physical identity, stale revision/gen/TTL/token, lease or uncertain effect, replay and restart/audit persistence. ADB host test adapter and browser negative gate as available. `pnpm check`, `pnpm test:ui`, `pnpm check:plan`, GitHub Ubuntu/Windows CI.
5. Docs/results/receipt after evidence, distinct `IMPLEMENTED`/`TESTED`/`ACCEPTED`. Commit code to feature branch then PR to `feat/studio-workspace`, never merge to `main`.

## Acceptance boundary

A green CI proves behavior only for fixtures and hosted runners. Windows10 physical USB/LAN with two Android handsets, user confirmation and spoofing risk, device transport race/soak, 20→300 scale, live publishing and app-version certification remain **NOT_RUN** until measured. Unsafe conflict states remain locked by default.
