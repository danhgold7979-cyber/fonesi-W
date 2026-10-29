# 07 — OPEN SOURCE DEPENDENCIES

Prefer established projects instead of rewriting solved infrastructure.

Verify the latest stable version and license at implementation time and pin exact versions in the lockfile.

## Android

### scrcpy
Repository:
`https://github.com/Genymobile/scrcpy`

Use for:
- Android display/control foundation.
- USB/TCP/IP device control model.

Do not modify the core protocol unless necessary.

### Android Platform Tools / ADB
Use official Android SDK Platform Tools distribution.

Use for:
- discovery;
- transport;
- shell;
- package management;
- UIAutomator invocation;
- file/device operations.

## UI

### Selecto
`https://github.com/daybrush/selecto`

Use:
- marquee multi-select devices.

### Interact.js
`https://github.com/taye/interact.js`

Use:
- resize/drag interactions.

### screenfull
`https://github.com/sindresorhus/screenfull`

Use:
- fullscreen abstraction.

### Choices.js
`https://github.com/Choices-js/Choices`

Use:
- searchable rich Nick/Page combobox.

### TanStack Virtual
`https://github.com/TanStack/virtual`

Use:
- virtualized long media/device lists.

## Database/files/process

### better-sqlite3
`https://github.com/WiseLibs/better-sqlite3`

Use:
- local SQLite persistence.

### Chokidar
`https://github.com/paulmillr/chokidar`

Use:
- campaign folder watching.

### Execa
`https://github.com/sindresorhus/execa`

Use:
- child-process execution with argument arrays.

### systeminformation
`https://github.com/sebhildebrandt/systeminformation`

Use:
- CPU/RAM/GPU/disk telemetry in Electron Main.

### SheetJS
`https://github.com/SheetJS/sheetjs`

Use:
- Excel import/export.

## Packaging

### electron-builder
`https://github.com/electron-userland/electron-builder`

Use:
- Windows packaging and installer.

## Dependency rules

- Production must install/bundle dependencies locally.
- No runtime CDN dependency.
- Pin versions.
- Record license/version in `THIRD_PARTY_NOTICES.md`.
- Do not fork unless a concrete missing capability requires it.


## Embedded scrcpy / ADB client candidate — technical spike required

### Tango / ya-webadb libraries
Repository:
`https://github.com/yume-chan/ya-webadb`

Candidate packages:
- `@yume-chan/adb`
- `@yume-chan/adb-server-node-tcp`
- `@yume-chan/adb-scrcpy`
- `@yume-chan/scrcpy`
- `@yume-chan/scrcpy-decoder-webcodecs`

Use case:
- embedded scrcpy transport/control/decoding in Electron rather than native SDL windows.

Status:
**CANDIDATE until Technical Risk Gate passes.**

Do not independently auto-upgrade scrcpy-server and protocol client packages.

### Reference architecture only
A public phone-farm project using Tango + scrcpy may be studied for patterns, but code is only reused after license/relevance review.

## Optional media probe

A media-probe tool/library may be added after packaging/license review if Android/Facebook preflight requires codec/container metadata beyond browser APIs.

Do not add FFmpeg blindly before this requirement is proven.
