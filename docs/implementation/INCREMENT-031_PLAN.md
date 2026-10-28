# Increment031 — P08/S072.3 view-only device resolution audit history

**Plan before implementation (2026-10-28)**. Base `feat/studio-workspace@d4da21dc58a16aed67c5308cbb9cccd7e6eeed83`, previous Increment029 P08 recovery merged via PR#8 and CI. Master V2.1 P08/S072, `docs/implementation/P08_PLAN.md`, device identity contracts, and Increment029 results reviewed. Independently active P06 PR#7 conflicts on schema v13 and Increment029 number; flagged in PR discussion. This increment neither modifies P06 nor alters migrations; plan ID031 and checkpoint024 reserved to avoid collisions.

## Scope

- Add a safe read-only `StudioDatabase.deviceResolutionHistory(deviceId,limit,cursor)` query of existing v13 `device_resolution_audit`. Project no raw transport serial, fingerprint/hash, host ID, credential, account, or full metadata. Return immutable auditId, deviceId, revisions and UTC timestamp only. Stable keyset ordering `created_at DESC,id DESC` and a scoped/versioned opaque cursor, max 50 rows and bounded input. Invalid/stale/cross-device cursors fail closed.
- Wire narrow `deviceResolutionHistory(id,cursor?)` public typed API through preload and host service. No SQL or filesystem API exposed, no Android traffic or clearing rights. Query must be safe on a disconnected device and across restart.
- Provide Device Details read-only history panel with explicit load and Next page, real empty state, no random/fake records. Changes in selected device reset the displayed history and cursor. Keep native recovery separate.
- Tests: real SQLite multiple resolution events, no secret leakage, cross-device cursor rejection, keyset page after restart, empty state, malformed/massive cursor, UI browser named-API read/empty-state and existing queue/device regressions. Do not falsely claim physical QA.
- Before acceptance: run GitHub Ubuntu+Windows `pnpm check`, Linux `pnpm test:ui`, `pnpm check:plan`, record test counts/receipt. PR to `feat/studio-workspace`, no `main` or installer publication.

## Gates

READ_ONLY tested increment is not full P08 or production certification. Physical Win10/USB/LAN audit collection, actual user consent, identity spoof tolerance, backend hardware scale remain NOT_RUN. Schema remains v13; preserve P06 PR#7 as independent unresolved integration conflict.
