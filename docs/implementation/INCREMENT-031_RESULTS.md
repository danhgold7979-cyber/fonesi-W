# Increment031 — P08/S072 redacted device-resolution audit history

Baseline `feat/studio-workspace@d4da21dc58a16aed67c5308cbb9cccd7e6eeed83`, source commit `c9c02360da825dc7074f6073ee8ffa6fba4e763f`. Plan first: `docs/implementation/INCREMENT-031_PLAN.md`.

## Implemented
- `StudioDatabase.deviceResolutionHistory(deviceId,limit,cursor)`: existing v13 durable audit only, stable keyset `created_at DESC,id DESC`, max 50 rows. Reject unknown device, forged/cross-device/stale/invalid cursor and unbounded limit; cursor validated against an existing device-scoped audit anchor across restart.
- Typed `DeviceResolutionAuditEntry/Page` returns only audit ID, device ID, UTC timestamp and previous/new revision; no serial, host ID, raw metadata, fingerprint or proof hash. The private DB worker owns SQL; public API/preload has only a narrow `deviceResolutionHistory(id,cursor?)` call with fixed host page size 20.
- Device Details uses an explicit **Xem lịch sử khôi phục** button with real empty state and next page, without inventing events or changing device privileges. History resets on device identity/revision changes.
- Real SQLite tests verify seven identical-time events with deterministic ordering/page boundaries across restart, redaction, oversized/malformed/cross-device/forged cursor rejection. Browser test checks the empty state and rejects a malformed public cursor.

## CI
- [GitHub Actions run 40645667946](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40645667946) at `c9c02360`: SUCCESS Ubuntu and Windows.
- Ubuntu: `pnpm check` **260 passed / 27 files**, 0 fail/skip; `pnpm test:ui` **25 passed**, 0 failed.
- Windows hosted: `pnpm check` **259 passed, 1 pre-existing Unix-only SDK fixture skip / 27 files**. TypeScript, lint, build, Windows launcher VerifyOnly and `pnpm check:plan` all passed.

## Explicit NOT_RUN
Live Windows10 UX/accessibility/perf, physical Android recovery/replay and redaction review, 20→300-phone scale, Facebook/TikTok adapters, actual posting/verification, Windows installer. A readable audit log is not certification of physical identity. Full P08/S072 acceptance OPEN.

## Concurrent branch note
P06 PR #7 on older `c55ca582` declares a conflicting schema v13/Increment029. Warned on PR; **not merged, not altered**, requires preserving P08 v13 and appending P06 as v14 with separate increment/receipt. This P08 increment adds **no migration**.
