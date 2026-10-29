# Increment024 — P04/S031/S037: portable workflow clipboard results

Baseline: `feat/studio-workspace@87935843613c6194d9a0ba1ed1bd9d9cb89f4801`. Code/evidence commit `b6a4026615a79c60ce2190cf0688fe57d7eb6e39`; October 28, 2026.

## Implemented
- `packages/editor/src/portable-clipboard.ts`: bounded versioned external clipboard, transitively copies local subflow/loop graph dependencies, validates untrusted JSON/IDs/internal connections/group membership, rejects missing/recursive refs, and remaps all IDs while pasting.
- `packages/editor/src/index.ts`: editor command exports.
- `apps/desktop/src/renderer/Editor.tsx`: Ctrl+C/X/V and canvas menu, OS clipboard if permitted, clear in-editor fallback when OS denies; Cut is synchronous and undoable; no arbitrary privileged clipboard IPC.
- `packages/editor/src/portable-clipboard.test.ts`: transitive dependencies, copy/paste into another same-app workflow, repeat paste unique IDs, undo/redo and no source mutation, invalid/cross-app/cyclic/oversized payload rejection.
- `tests/ui/portable-clipboard.spec.ts`: browser transfer across editors and ignore normal external text.
- `.github/workflows/check.yml`: Ubuntu Playwright browser regression added to existing Ubuntu/Windows checks.
- Regression fixes after CI: strict optional groups type, menu paste availability after editor change, synchronous Cut when clipboard permission denied, precise UI card locator.

## Verified checks
- [GitHub Actions 40638326588](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40638326588) at `b6a4026`: success Ubuntu and Windows.
- Ubuntu: `pnpm check` 230/230 tests PASS (25 files); `pnpm test:ui` 23/23 browser scenarios PASS; `pnpm check:plan` PASS.
- Windows hosted runner: `pnpm check` 229 passed, 1 pre-existing platform-specific Unix SDK fixture skipped (25 files); Windows PowerShell setup, VerifyOnly, `pnpm check:plan` PASS.
- Earlier browser run 40638046289 FAILED with 2 reproducible defects; both fixed and retested on the final code commit. Never use the earlier red run as acceptance.

## Acceptance boundary
This is a **TESTED increment**, **NOT full P04 ACCEPTED**. System clipboard interaction on user Win10 GUI and Electron desktop plus multi-monitor/DPI NOT_RUN. Device input, APK/network, Facebook/TikTok adapter, no-duplicate external effects, true 20→300 phone scale, offline installer and publication NOT_RUN. No real Android device, account or external publishing was used. PR remains review-gated and `main` remains untouched.
