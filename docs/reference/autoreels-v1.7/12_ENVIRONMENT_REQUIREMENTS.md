# 12 — WINDOWS ENVIRONMENT REQUIREMENTS

## Production development path

```text
E:\AutoReels
```

Requirements for this folder:

- local disk;
- NTFS strongly recommended;
- not inside OneDrive/Dropbox/network share;
- writable by current user;
- no spaces/non-ASCII in the project path;
- at least 30 GB free before starting development; 50+ GB recommended for SDK/binaries/build caches.

## Operating system

Recommended:

```text
Windows 11 x64
```

Windows 10/older is not the primary development target.

## Required tools

### Git

Use maintained Git for Windows.

Baseline:
```text
Git >= 2.50
```

### Node.js

Pin development to:

```text
Node.js 24 LTS
```

Do not develop with Node Current (26.x) unless the project intentionally upgrades the baseline.

The repository must later declare the expected Node version and package manager version.

### npm

Bundled with Node. Required for initial package-manager bootstrap and tooling.

### pnpm

Pin:

```text
pnpm 12.6.x
```

The production repository should contain:

```json
"packageManager": "pnpm@12.6.0"
```

Important: modern pnpm restricts dependency build scripts. Native/postinstall packages required by the project must be explicitly approved/pinned in project configuration instead of solving failures ad hoc on each machine.

### Python

Pin the Windows development baseline to:

```text
Python 3.14.x x64
```

Current node-gyp supports Python 3.14. Avoid multiple ambiguous Python installations where possible.

### Visual Studio Build Tools

Install Visual Studio Build Tools 2022 (17.14+) or a supported newer release.

Required workload:

```text
Desktop development with C++
```

Required components include:
- MSVC C++ x64/x86 build tools;
- Windows 10/11 SDK;
- MSBuild.

This is required so Electron native dependencies can rebuild when a prebuilt binary is unavailable.

### node-gyp

Do not globally pin an old node-gyp.

Use the version brought by the actual dependency/npm toolchain. Python 3.12+ requires node-gyp 10+, and current development should use current node-gyp.

### Android SDK Platform-Tools

Install current official Platform-Tools.

Baseline when this pack was created:

```text
Platform-Tools 37.0.1
```

`adb.exe` must be available in PATH or configured by the application.

Android Studio itself is not required.

### Android phone preparation

For every test device:

- Developer Options enabled.
- USB debugging enabled.
- RSA authorization accepted.
- `adb devices -l` shows state `device`, not `unauthorized`.
- Correct OEM USB driver installed when Windows requires one.

ADB-over-LAN will be tested separately after USB is stable.

## Not required before Phase 0

Do not manually install these globally yet:

- scrcpy;
- ffmpeg;
- Electron;
- Vite;
- React;
- better-sqlite3;
- Chokidar;
- Selecto;
- Interact.js;
- Choices.js;
- SheetJS.

They will be installed/pinned by the repository or vendor setup at their implementation phase.

## Windows settings that reduce blockers

Recommended:

- Long paths enabled.
- USB selective suspend disabled on dedicated farm machines if it causes disconnects.
- Powered USB hubs for large physical device counts.
- Keep the source folder outside antivirus/sync-heavy directories when build performance is poor.

## Architecture baseline

Primary target:

```text
Windows x64
```

ARM64 can be added later as a separate tested target; do not mix architecture assumptions in Phase 0.
