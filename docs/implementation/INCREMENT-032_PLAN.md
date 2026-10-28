# Increment032 — P09/S083 bounded relative selector and ordered fallback

Plan BEFORE code, 2026-10-28. Baseline `feat/studio-workspace@d25110f00e60e866258e593b79ab666fd8ac83be`. Reviewed V2 master `16_MASTER_EXECUTION_PLAN.md` and `17_STEP_RUNBOOK.md` S083.1, `docs/implementation/P09_PLAN.md`, `packages/contracts/src/inspector.ts`, `packages/devices/src/xml.ts`, Inspector UI/tests and P08 code. P06 PR#7 is independently blocked by schema v13 and increment029 collision; this slice touches no DB, API, or migrations.

## Problem and boundaries
Existing v1 exact/contains selector matches one flat node set, but cannot express an ancestor condition or multiple ordered fallbacks. The v2 query is **read-only on a frozen XML snapshot**. It cannot send Android input, infer OCR confidence or claim provider certification. Never silently choose the first of 2+ matches.

## Detailed tasks
1. Extend inspector contracts with `uiSelectorV2Schema`: strict `version:2`, 1–5 ordered strategies, each with 1–12 whitelisted v1 predicates and optional ancestor selector + maxDepth 1–20, boolean flags. No regex/eval/XPath/SQL/JS; unknown keys rejected. Keep existing v1 schema and suggested selectors unchanged.
2. Add pure `inspectUiSelectorMatches(nodes,raw)`: for v2 try ordered strategies until a **nonempty** result; return matched nodes, selected 1-based strategy index, per-strategy match counts, ambiguity flag. If a strategy has 2+ matches, report ambiguity and **STOP** rather than falling through to potentially misleading later strategy. 0 matches continue; all zero => zero. Bound nodes and ancestry traversal, reject repeated/cyclic IDs/parents, do not use password text/description.
3. Preserve old `queryUiElements` API by mapping through the new inspector query, with v1 results unchanged. UI uses rich report for fallbacks and count; no new privileged API. Existing `suggestUiSelector` produces v1 until v2 optional editor is requested.
4. Unit tests: v1 parity, valid ancestor chain and maxDepth, zero primary fallback, ambiguity stopping, unreadable password, malformed and prototype-pollution payloads, oversized strategies, invalid parent cycles. UI browser test with actual XML snapshot v2 fallback count and no physical input.
5. CI checks `pnpm check`, Ubuntu Chromium `pnpm test:ui`, plan validators, Windows hosted. Record receipt after green, separate PR into `feat/studio-workspace`; never merge main.

## Open gates
This is S083.1 logic + inspector UI only. XPath, OCR/image recognition, real multi-touch, Android hardware inspector geometry/latency and full P09 acceptance remain NOT_RUN/OPEN.
