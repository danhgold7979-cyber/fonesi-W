# Increment061 — reject parser-normalized frozen URL whitespace

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`, P11/S096.2 hardening.
Plan-first commit: `7c9e5812ff34bd7adb699d832eeda2ee09dd1b59`. Exact tested source SHA: `aad5e5b0567b14fa3c7940f6927a8038b77db2af`.

## Source changes

- `packages/database/src/unicode-compose.ts`: added a non-mutating guard for URL strings whose leading/trailing whitespace or embedded ASCII tab/line-break bytes may be silently discarded by WHATWG URL parsing. The existing bounded `URL_UNSAFE` blocker is used; the original URL is never trimmed, normalized or rewritten.
- `packages/database/src/unicode-compose.test.ts`: added five negative cases for embedded tab, embedded LF, embedded CRLF, leading whitespace and trailing whitespace. Existing valid Vietnamese Unicode URL path fixture remains accepted with exact value preserved.
- No DTO, schema, command, lease, job/effect state, UI permission, or Android/provider behavior changed.

## Exact-source CI

| Workflow | Ubuntu | Windows |
|---|---|---|
| [Push CI 40861500669](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40861500669) | SUCCESS | SUCCESS |
| [PR CI 40861511277](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40861511277) | SUCCESS | SUCCESS |

Ubuntu: **420/420 unit/integration tests across 41 files**, **31/31 Chromium UI tests**. Generated contracts, typecheck, lint, build and both plan validators passed.
Windows: **419 passed + 1 platform-only skip across 41 files**. Generated contracts, typecheck, lint, build, `start-windows.ps1 -VerifyOnly` and both plan validators passed.

## State and remaining gates

Status: **TESTED_S096_URL_PREFLIGHT_PARSER_WHITESPACE_NOT_ACCEPTED**.

The preflight now rejects URLs whose parser could silently ignore edge whitespace or ASCII tabs/line breaks. It still preserves valid frozen Unicode URL bytes. This is fixture/CI evidence only: no physical Android Unicode input/readback, app-profile certification, exact MediaStore picker selection, compose-screen target/content verification, provider posting, cleanup, USB/LAN fleet test or installer acceptance occurred. `canType`, `canSelect` and `canDispatch` remain false. S087, S095, S096/AT-096 and P11 remain NOT_ACCEPTED. Overall completion percentage remains unreported; CI counts do not measure the 15-phase / 125-step / 375-task scope.
