# 15 — TOOLCHAIN BOOTSTRAP

Before installing anything on a development machine:

1. Run `tools/AutoReels_Environment_Bootstrap_V1_2.ps1` with no flags.
2. Review missing/incompatible tools.
3. Run it again with `-InstallMissing` only if needed.
4. Activate project-local tools:
   `. E:\AutoReels\.tools\Activate-AutoReels.ps1`
5. Run check-only again.
6. Do not start Phase 0 until the environment baseline is PASS.

The installer is side-by-side by design. Existing system Node/Python/Git are not removed or replaced.
