# Increment034 — P09/S083.1 live bounded read-only selector probe

Created before coding on 2026-10-28. Source baseline `feat/studio-workspace@a2096d325c6417908c00c103e556018396087556`. Revisit V2.1 master, S082/S083/AT083 runbook, P09_PLAN, merged P09 Increment032 (v2 relative selectors/fallback), P08 identity lease/actor and P06 schema14 progression. This is not a complete P09 phase.

## Problem and risk

Inspector currently counts matches **on a frozen previously captured XML tree**, not the *current* phone. A green old snapshot or a selector rule does not prove a current Android match, much less safe publishing. New host selector probe is strictly read-only and must never tap, scroll or turn an ambiguous match into one target.

## Ordered implementation

1. **P09/S083.1 contracts:** add `DeviceSelectorLiveReport` with device ID, observed UTC capture time, device/transport generation, foreground, exact count, 0/1/n status and v2 strategy attempt counts. Return at most 100 **non-sensitive geometric summaries** (id/bounds/class/resourceID/package); never raw text/password XML, screenshots, app login/session data or hardware serial. Add typed `testDeviceSelector(id, selector)` public API, host Zod named command, preload.
2. **Host actor:** validate v1/v2 selector schema and JSON resource bounds **before** any ADB. Require an authorized/enabled verified connected device; share existing Inspector lease/fencing with manual/automation ownership. Re-capture screenshot+XML through existing correlated `inspectDevice`, evaluate `inspectUiSelectorMatches` on fresh tree, return exact match count/status/attempts and cap summaries. Expire the transient capture for this probe; do not authorize a tap using a probe result. Refuse offline/stale transport, expired lease, ambiguity or invalid input; never fake success.
3. **UI:** add explicitly labeled `Kiểm tra selector trên điện thoại` to Inspector, separate frozen snapshot count vs fresh host result, show status and fresh time/strategy/0-1-n outcomes, reset on edit/snapshot change/unmount. Do not auto-switch to control mode. Existing selector editor/stale warning remain.
4. **Regression:** real ADB TCP fixture tests for 1/0/multiple, v1 parity/v2 fallback, malformed input without ADB, no `input` shell side effects, manual lease exclusion/transport offline and captured image invalidation. Chromium browser test checks named UI action, real fixture match count, no touch and invalid input. Keep existing editor/phone/DB regressions.
5. **Evidence:** `pnpm check`, `pnpm test:ui`, `pnpm check:plan` and GitHub Actions Ubuntu/Windows by exact SHA; results/receipt and separate PR into `feat/studio-workspace`. Never merge main or publish installer.

## Acceptance boundaries

A live ADB fixture is a **protocol integration simulation**, not a physical phone acceptance. Real Android XML differences, secure/password views, app-version selector compatibility, OCR/image, device gesture capability and 20→300 fleet benchmarks are still NOT_RUN. Effect journal and actual publish verification belong to P11/P12. Do not claim S083/P09 fully ACCEPTED or make hardware throughput assertions.
