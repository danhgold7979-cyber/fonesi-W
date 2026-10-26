# AutoReels — Check First, Install Only What Is Missing

Workspace:

```text
E:\AutoReels
```

## Important behavior

The bootstrap script is conservative.

### Default run

```powershell
.\AutoReels_Environment_Bootstrap_V1_2.ps1
```

**CHECK ONLY.**

It does not install, uninstall, upgrade, or overwrite anything.

### Install mode

```powershell
.\AutoReels_Environment_Bootstrap_V1_2.ps1 -InstallMissing
```

It installs only missing/incompatible project requirements.

If Windows already has a different Node/Python/pnpm version, that installation is kept untouched. The required project version is installed side-by-side under:

```text
E:\AutoReels\.tools
```

## Folder layout

Typical result:

```text
E:\AutoReels
├─ .tools
│  ├─ node-v24.x.x
│  ├─ Python314
│  ├─ pnpm-12.6.0
│  ├─ PortableGit-...
│  ├─ android
│  │  └─ platform-tools
│  ├─ .downloads
│  ├─ environment-report.json
│  └─ Activate-AutoReels.ps1
└─ .git
```

Visual Studio Build Tools is the exception. It is a Microsoft system-level compiler toolchain and is installed to the Microsoft standard location. The bootstrap only adds it if the required C++ workload is missing.

## Exact workflow

### 1. Download the script

`AutoReels_Environment_Bootstrap_V1_2.ps1`

### 2. Open PowerShell

Run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

### 3. Check only

```powershell
.\AutoReels_Environment_Bootstrap_V1_2.ps1
```

Review the table:

```text
Component             Status
Git                   OK / MISSING / WRONG
Node                  OK / MISSING / WRONG
Python                OK / MISSING / WRONG
VS C++ Build Tools    OK / MISSING
ADB                   OK / MISSING
pnpm                  OK / MISSING / WRONG
```

No installation has occurred.

### 4. Install only missing/incompatible requirements

```powershell
.\AutoReels_Environment_Bootstrap_V1_2.ps1 -InstallMissing
```

A UAC prompt may appear only for Microsoft Visual Studio Build Tools.

### 5. Activate the project-local toolchain

Open a fresh PowerShell and run:

```powershell
. E:\AutoReels\.tools\Activate-AutoReels.ps1
```

This prepends project-local pinned tools for that PowerShell session. It does not permanently replace system Node/Python/Git.

### 6. Check again

```powershell
.\AutoReels_Environment_Bootstrap_V1_2.ps1
```

Target result:

```text
ENVIRONMENT BASELINE: PASS
```

## Baseline

The bootstrap expects:

```text
Node       24 LTS branch
Python     3.14.x
pnpm       exactly 12.6.0
Git        >= 2.50
ADB        current official Platform-Tools
C++        Visual Studio Build Tools / VC x64+x86 workload
```

Current pinned installer fallback in this script:

```text
Python 3.14.7
pnpm 12.6.0
```

Node 24 is resolved dynamically from the official Node release index.

Git Portable is resolved dynamically from the latest stable Git for Windows GitHub release.

Android Platform-Tools uses Google's official stable "latest Windows" URL.

## What the script does NOT do

It does not:

- uninstall an existing Node/Python/Git;
- replace a working system version;
- install Android Studio;
- download scrcpy yet;
- scaffold Electron yet;
- install project npm dependencies yet;
- change Facebook/Android settings;
- install arbitrary OEM USB drivers.

OEM USB drivers are device/vendor specific. If a phone never appears in ADB, install the correct OEM driver manually.

## Security/verification

- Node ZIP is checked against Node's official `SHASUMS256.txt`.
- Python and Microsoft installers are checked with Windows Authenticode.
- Git Portable is downloaded from the official Git for Windows GitHub release.
- Platform-Tools is downloaded from Google's official stable download URL.
- npm registry integrity protects the pinned pnpm package.

## After PASS

Do not install random Electron/React packages manually.

The next controlled step is Phase 0 scaffold in `E:\AutoReels`.
