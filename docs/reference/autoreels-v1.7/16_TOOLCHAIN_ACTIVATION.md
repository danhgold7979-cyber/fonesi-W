# 16 — TOOLCHAIN ACTIVATION FIX

After environment discovery/bootstrap, use:

```powershell
. E:\AutoReels\.tools\Activate-AutoReels.ps1
```

The activation script must resolve critical project-local tools before unrelated system tools.

Expected critical paths:

```text
pnpm -> E:\AutoReels\.tools\pnpm-12.6.0\pnpm.cmd
adb  -> E:\AutoReels\.tools\android\platform-tools\adb.exe
```

Why this matters:

An older activation script could leave a different global `pnpm` or an ADB shipped inside another application earlier in the PowerShell command-resolution path. The fixed V1.3 script rebuilds PATH priority deterministically and prints each resolved executable.

Do not begin Phase 0 until the activation output and environment bootstrap agree on the same critical tool paths.
