# AutoReels — Install Before Coding

Pinned development baseline:

```text
Workspace: E:\AutoReels
Node:      24 LTS
pnpm:      12.6.x
Python:    3.14.x x64
Git:       maintained current Git for Windows
C++:       Visual Studio Build Tools + Desktop development with C++
ADB:       official Android SDK Platform-Tools (baseline 37.0.1)
OS:        Windows 11 x64 recommended
```

Install in this order:

1. Git for Windows.
2. Node.js 24 LTS x64.
3. Python 3.14 x64.
4. Visual Studio Build Tools:
   - Desktop development with C++
   - MSVC x64/x86 tools
   - Windows 10/11 SDK
5. Android SDK Platform-Tools.
6. pnpm 12.6.x.

After Node/npm are installed:

```powershell
npm install -g pnpm@12.6.0
pnpm --version
```

Optional but recommended for robust node-gyp Visual Studio detection:

```powershell
Install-Module VSSetup -Scope CurrentUser
```

Add Platform-Tools to PATH, then verify:

```powershell
adb version
adb devices -l
```

Every connected test phone should show:

```text
device
```

not:

```text
unauthorized
offline
```

Then run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\AutoReels_PreCode_GateA_V1_1.ps1
```

Do not scaffold or install project dependencies until `GATE A: PASS`.
