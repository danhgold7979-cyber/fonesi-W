# Increment061 — reject parser-normalized URL input in frozen Unicode preflight

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`.
Plan-first baseline: `a96107a2d934c0f4de9255f33033b85cf31073bc` (Increment060/checkpoint-053 documentation; exact tested source `976ea787c4d45a1dc479e1c8530c076415e03cb1`).
Owner step: P11/S096.2 hardening. This is a narrow correctness fix, not Android input or S096 acceptance.

## Problem and rationale

The current frozen Unicode preflight permits tab/newline characters in general TEXT fields so captions/comments can preserve exact multiline bytes. It then parses URL fields with the WHATWG `URL` constructor. That parser may ignore ASCII tab/CR/LF inside URLs and trim leading/trailing whitespace, so a URL containing those characters can be classified as `EXACT_FROZEN_TEXT` even though the parser interprets a different URL than the exact frozen string. This violates the preflight's promise to avoid lossy interpretation.

## Scope and implementation

1. In `packages/database/src/unicode-compose.ts`, before URL parsing, reject URL values when leading/trailing whitespace would be trimmed or when ASCII tab/line-break characters occur anywhere. Use the existing bounded `URL_UNSAFE` blocker; do not modify, trim, normalize, reserialize, or replace the original value.
2. Preserve valid Unicode URL paths (including Vietnamese characters) and percent-encoded whitespace when the original input contains no parser-ignored whitespace. Keep the exact UTF-8 hash/value behavior unchanged.
3. In `packages/database/src/unicode-compose.test.ts`, add negative cases for embedded tab, embedded LF, CRLF, and leading/trailing whitespace; add/retain a positive case for a valid Unicode URL path. Each invalid case must produce `BLOCKED`, no private entries, and `canType:false`/`canDispatch:false`.
4. Keep the existing public DTO and UI redaction unchanged. No database schema/migration, command, lease, effect journal, ADB, clipboard/IME, picker, publish, retry, cleanup, or dispatch behavior is introduced.
5. After source CI runs on the exact source SHA, update `INCREMENT-061_RESULTS.md`, `checkpoint-054.json`, `PROGRESS.md`, and `COMPLETION_PLAN.md` with exact commit/run/OS/test evidence and remaining acceptance limits.

## Test and failure matrix

- Valid URL `https://example.com/đường-dẫn?q=%20`: accepted unchanged; exact value and UTF-8 digest preserved.
- Embedded tab, LF, CRLF, leading whitespace, trailing whitespace: `URL_UNSAFE`; no value/hash entries escape in the summary.
- Existing Unicode safety tests: Vietnamese, ZWJ emoji, combining marks, CRLF caption/comment preservation, unsafe controls, surrogate validation, scope/declaration checks, size bounds and redaction remain unchanged.
- Run generated-contract check, typecheck, lint, unit/integration tests, Chromium UI tests, build, Windows VerifyOnly, and both plan validators through the repository CI on Ubuntu and Windows.

## Acceptance boundary

Expected best status: `TESTED_S096_URL_PREFLIGHT_PARSER_WHITESPACE_NOT_ACCEPTED`. This change improves input validation only. It does not prove a Unicode input method on Android, exact media picker selection, compose-screen target/content verification, provider posting, cleanup, fleet scale or installer readiness. `canType` and `canDispatch` remain false. P11 and AT-096 remain NOT_ACCEPTED; no overall completion percentage is inferred from CI counts.
