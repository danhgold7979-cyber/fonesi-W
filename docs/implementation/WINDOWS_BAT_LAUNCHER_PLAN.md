# Windows BAT launcher plan

Date: 2026-10-29.
Repository: `danhgold7979-cyber/fonesi-W`.
Branch: `feat/studio-workspace`.
Planning baseline: `fb87f306b7221cf1e98d7247d0e2fd71a116bb63`.

## Goal

Add a simple `Start-FonesiW.bat` entry point for users who expect a .bat launcher, while reusing the existing, tested-by-CI `Start-AutoReels.cmd` / `scripts/start-windows.ps1` startup path.

## Scope

- Add root file `Start-FonesiW.bat`.
- It changes to its own directory, calls `Start-AutoReels.cmd`, and returns the child exit code.
- Update `docs/implementation/WINDOWS_START.md` and `README.md` to mention the new entry point and source ZIP download for `feat/studio-workspace`.
- Update `docs/implementation/PROGRESS.md` with exact commit and CI status after implementation.
- Do not alter the existing launcher, package scripts, dependencies, database, app behavior, or any other branch.

## Error behavior

- If the existing launcher fails, the BAT wrapper must propagate its non-zero exit code.
- Keep the existing launcher as the single source of startup/setup logic.
- No admin elevation, policy changes, credentials, or auto-posting.

## Validation

- Review the BAT source and documentation diff.
- Ensure branch/HEAD is still the expected parent before creating and moving the ref; no force push.
- Verify the resulting commit and GitHub Actions on the exact new SHA.
- Do not claim a local Windows GUI run; CI and user-machine execution are separate evidence.

## Acceptance boundary

This is a convenience launcher only. It does not certify application completeness, physical Android, USB/LAN, publishing, or scale acceptance.
