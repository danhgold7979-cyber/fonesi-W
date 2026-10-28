# Increment034 — P09/S083.1 read-only live ADB selector probe

Baseline `feat/studio-workspace@a2096d325c6417908c00c103e556018396087556`; source SHA `57b42a18301ea715db90e1a0aa0ac01c59104444`. Detailed plan committed before source: `INCREMENT-034_PLAN.md`.

## Implemented
- `DeviceSelectorLiveReport` projects `deviceId`, observed time, generation/revision, foreground, bounded sequential correlation, exact 0/1/n, v1/v2 fallback attempts and up to 100 geometric matches; no screenshot bytes, raw XML/password text, hardware serial, IPC input or access token in returned projection.
- Named `testDeviceSelector(id,selector)` API, host Zod validation and preload, no arbitrary ADB or SQL path. Selector JSON/schema checked before contacting ADB; invalid/unsafe v1/v2, regex/eval/unknown fields rejected as `INVALID_SELECTOR`.
- Device host uses existing `inspectDevice` read-only actor with per-device shared lease and generation/transport fences, captures real ADB PNG/XML/rotation and foreground. Query runs on its fresh bounded XML snapshot, then transient capture token is cleared: no read-only result can authorize tap. Unavailable/offline/busy device fails, not fake-success.
- Inspector adds explicit live test button separate from frozen snapshot match count; renders live count, UNIQUE/NONE/AMBIGUOUS and v2 selected strategy, stale state blocks action and report resets on edits/refresh.
- TCP ADB fixture integration tests for exact 0, 1 and 2 matches; fallback strategy2 and no tap; malformed selectors rejected before ADB; stale action capture denied; independent lease and offline host checks. Chromium regression clicks Inspector, checks live ambiguity and no Android input.

## Verified CI on source
- [GitHub Actions 40648794904](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40648794904) at `57b42a18`: **SUCCESS Ubuntu and Windows**.
- Ubuntu `pnpm check`: **272/272 passed in 30 files**; Chromium `pnpm test:ui`: **28/28 passed**.
- Windows hosted `pnpm check`: **271 passed, 1 pre-existing Unix-only SDK test skip /30 files**; Windows setup/VerifyOnly, TS/lint/build, plan validators PASS.

## Boundaries
**TESTED slice, not P09/S083 fully ACCEPTED**. TCP fixture is not a physical phone, no measured USB/LAN latency/throughput. Existing real ADB implementation can attempt read-only matches but has NOT_RUN physical certification, profile matrix, accessibility secure pages, OCR/image, Unicode input, multi-touch, app publishing/verification or installer. No `main` merge.
