# Increment029 — P08/S072 operator-confirmed ADB identity conflict recovery

**Baseline:** `feat/studio-workspace@c55ca58235e8c1806c956c37f05b40713cffbcef`; separate source branch `phase/p08-operator-resolution-2026-10-28`. Detailed implementation plan `INCREMENT-029_PLAN.md` committed before code. Last verified source commit `0188886417e468c544455e743029b4206139c70b`.

## Implemented

1. Append-only **schema v13**: short-lived resolution previews and durable, redacted resolution audit. No rewrite of older migration checksums. Existing stable deviceId/fingerprint/Process/job references are not changed by recovery.
2. Private `StudioDatabase.previewDeviceConflictResolution`/`applyDeviceConflictResolution`: validate a fresh connected ADB observation against *historically registered verified fingerprint*, current host/transport generation/profile revision, one connected transport, valid clocks, inactive lease and no active/uncertain job or journal. Preview token binds SHA-256 digest of these facts and expires after 60 seconds. Apply rejects expired/reused/tampered/stale tokens, wrong confirmation name and changed identity, fully transactionally.
3. Native `HostDeviceService`: only privileged host can read fresh `adb devices` and metadata. User-facing APIs accept *only* id/revision and token/name; never a raw serial, fingerprint, hostId, or trusted boolean. Configuration barrier prevents local actor overlap; a second live ADB probe is required after **native Electron OS confirmation**. Loopback authoring host has no callback and cannot perform the mutation.
4. UI Device Details: conflict warning, explicit preview reasons, correct-name input, physical-check acknowledgment and native confirmation button. On successful audit, all device transport generations are fenced, captures invalidated, **enabled=false** and another scan is required before explicit manual enable. No Android input, account binding rewrite, fake post or automatic publishing.
5. Additional tests cover SQLite stored token/TTL/replay/revision/generation, mismatch/ambiguous transport/lease and audit persistence without raw hardware serial; real TCP ADB fixture old→wrong→old identity, native consent, subsequent handset swap; Chromium negative gate for authoring host. Backup regression now compares compiled `SCHEMA_VERSION` rather than obsolete v12 literal.

## CI evidence

- [GitHub Actions 40644592569](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40644592569) at `0188886417`: **SUCCESS Ubuntu and Windows**.
- Ubuntu `pnpm check`: 258 passed / 27 test files, 0 failed/skipped. `pnpm test:ui`: 24 passed, 0 failed. `pnpm check:plan`: pass.
- Hosted Windows `pnpm check`: 257 passed, 1 **pre-existing Unix executable SDK fixture** skipped / 27 files; setup/launcher VerifyOnly, type/lint/build/plan checks pass.
- Red intermediate CI was caused by fixed schema-v12 literals in two pre-existing backup assertions, corrected to dynamic SCHEMA_VERSION. Do not count intermediate red runs as passed.

## Open gates, explicitly NOT_RUN

- Win10 x64 interactive Electron native dialog; 2 physical Android devices over USB and LAN; hands-on confirmation of serial collisions, user-facing safety UX and long session races. Fixture properties are controllable for reproducible tests but are **not proof of physical authenticity**.
- Cross-host identity trust, device duplication/spoofing resistance beyond property fingerprint+physical confirmation, retained terminal effects, real worker/device execution, Facebook/TikTok adapter, 20→100→300 fleet tests, installer, backup/restore during a *physical* upgrade.
- Therefore status: **IMPLEMENTED + TESTED IN CI, NOT P08/S072 ACCEPTED, NOT RELEASE READY**. `main` remains untouched.
