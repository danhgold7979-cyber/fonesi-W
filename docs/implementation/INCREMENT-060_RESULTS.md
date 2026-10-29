# Increment060 — frozen Unicode field validation, never Android typing

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`, P11/S096.2 partial.
Plan first: [INCREMENT-060_PLAN.md](INCREMENT-060_PLAN.md) commit `81e1c24dc0f24834b116c69ebae6ce08afda7a16`.
Initial feature SHA `08abe72d70744beedc62edd53bac8f321f4006d1`; lint fix `976ea787c4d45a1dc479e1c8530c076415e03cb1`.
**Exact tested source SHA `976ea787c4d45a1dc479e1c8530c076415e03cb1`.**

## Implemented source and safety

- `packages/contracts/src/schedule.ts`: typed `FrozenUnicodePreflight` with sanitized ordered field ordinal, ROW/PROCESS scope, TEXT/URL kind and bounded blocker codes; global status `BLOCKED`/`EXACT_FROZEN_TEXT_METHOD_UNVERIFIED`/`NO_TEXT_FIELDS`. No raw text, field name/key, caption, URL, SHA-256 fingerprint, media owner, account or secret leaves private code. `canType:false`, `canDispatch:false` unconditionally.
- New `packages/database/src/unicode-compose.ts`: `deriveFrozenUnicodeTextPlan` reads ONLY the immutable job `snapshot.bundle.inputs`, `snapshot.fields` and `snapshot.processFields`, never draft/current process/global values. Strict field scope, declared key uniqueness, required/non-empty text, valid URL protocol without embedded username/password and finite input budgets. Rejects lone high/low UTF-16 surrogate (which UTF-8 encoding would replace silently), NUL/control/bidi override and lone carriage return, oversized UTF-8 values and undeclared field keys. Exact original strings are retained privately, including NFC versus decomposed graphemes, ZWJ emoji, Vietnamese and CRLF/LF; no trimming, normalization or shell quoting. Private SHA-256 of exact UTF-8 bytes supports future comparison; errors return no private text entries. All results remain non-dispatchable because no Android Unicode input method is certified.
- `packages/database/src/index.ts`: integrates private plan computation into existing bounded `jobStageReview` and returns only the public redacted `frozenUnicode` summary, without changing SQLite schema v20, lease, effect or job state.
- `apps/desktop/src/renderer/JobStageReviewDialog.tsx`: a read-only `Nội dung Unicode đã ghim (chưa nhập Android)` section shows blocked reasons or exact frozen field count by scope/type, with explicit no-Android-input warnings. No paste, type or posting controls.
- New `packages/database/src/unicode-compose.test.ts`: actual Unicode code-point/UTF-8 digest comparisons, preservation of Vietnamese/ZWJ emoji/combining characters/multiline CRLF, URL, exact typed row/process scope and no mutation; rejects unsafe Unicode, over-budget strings, duplicate/undeclared fields, wrong types, missing required fields and wrong-scope fallback. `packages/database/src/device-stage.test.ts` updates real SQLite report assertions to keep `canType:false`. `tests/ui/schedule.spec.ts` verifies UI redaction (existing private caption fixture is not rendered), no input control and correct operator warning.

## CI and correction

The initial feature commit `08abe72d70744beedc62edd53bac8f321f4006d1` passed TypeScript but lint rejected a control-character class inside a regular expression (`no-control-regex`). Source fix `976ea787c4d45a1dc479e1c8530c076415e03cb1` retains the exact security behavior using character-code numeric comparisons and a separate bidi control test; no permissive exception was added.

| Exact-source workflow | Ubuntu | Windows |
|---|---|---|
| [Push 40856058879](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40856058879) | **SUCCESS** | **SUCCESS** |
| [PR 40856067558](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40856067558) | **SUCCESS** | **SUCCESS** |

Ubuntu: **415 passed / 415 unit/integration (41 files)**, **31/31 Chromium UI**; generated/typecheck/lint/build and plan validators PASS.
Windows: **414 passed + 1 platform-only skip (41 files)**; generated/typecheck/lint/build, `start-windows.ps1 -VerifyOnly` and plan validators PASS. CI runs on `976ea787c4d45a1dc479e1c8530c076415e03cb1`, not the subsequent documentation commit.

## State and remaining gates

Status: **TESTED_S096_FROZEN_UNICODE_PREFLIGHT_NOT_ACCEPTED**.

This increment creates an exact **private source-text/encoding preflight**, not an Android typing implementation. No adb input text, clipboard/IME helper, selector tap, media picker, external post or output verification occurred. It does NOT certify Unicode input on any physical Android, regardless of tests. S087 R2, S095 R3, S096 AT-096 and the P11 phase remain NOT_ACCEPTED. Physical Windows 10 + two Android phones, profile-specific Unicode method/readback, exact picker, safe effect journal, Facebook/TikTok live post verification, 20→100→300 load and installer/release remain OPEN. `main` remains unchanged. 15 phase / 125 step / 375 task percentage is not inferred from these tests.
