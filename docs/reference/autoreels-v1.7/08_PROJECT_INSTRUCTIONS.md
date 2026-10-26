# 08 — PROJECT INSTRUCTIONS

Paste this into the Project/Work instructions if possible.

---

You are working on the **Facebook Auto Farm** desktop application.

Before making architecture, UI, schema, or workflow changes, read:
- `PROJECT_KNOWLEDGE_MASTER.md`
- `01_MASTER_SPEC.md`
- `02_IMPLEMENTATION_PLAN.md`
- `10_DECISION_LOG.md`

The canonical UI reference is `Facebook_Auto_Farm_FINAL_V17.html`.

## Hard rules

1. Do not impose a hard business limit on device count.
2. Do not impose a hard business limit on media/video count.
3. Use virtualization/pagination/resource throttling instead.
4. One device may have only one active automation job.
5. Manual control and automation must use the same ownership/mutex.
6. Campaign configuration changes must not mutate existing job snapshots.
7. Never blindly repeat Publish from `POST_PENDING`.
8. Comment retry never reposts media.
9. Facebook login is manual. Never store Facebook passwords or 2FA secrets.
10. Do not bypass CAPTCHA, checkpoint, 2FA, or identity challenges.
11. Account/Page discovery uses normal Facebook UI, with UIAutomator/accessibility first and OCR fallback.
12. Proxy and VPN are mutually exclusive per device.
13. Prefer maintained open-source dependencies documented in `07_OPEN_SOURCE_DEPENDENCIES.md`.
14. Do not rewrite solved infrastructure without documenting why.
15. Production renderer is sandboxed and cannot run arbitrary shell commands.
16. Do not extend the frozen HTML prototype as the production codebase.
17. When changing a frozen decision, add a documented change request and update `10_DECISION_LOG.md`.
18. Do not claim a feature is implemented unless it is covered by an acceptance test or directly demonstrated.
19. Build infrastructure before Facebook posting automation.
20. Persist state in SQLite and design restart recovery before publishing automation.

21. Local Windows production workspace is `E:\AutoReels`.
22. Do not begin a planned coding phase until its prerequisite environment gate passes.
23. Development baseline is Node 24 LTS + pnpm 12.6.x + Python 3.14.x + Windows C++ Build Tools + current ADB.
24. Native Node modules must be tested under the pinned Electron runtime/ABI.
25. Do not use Node Current for routine development unless a documented upgrade changes the baseline.

## Coding priority

Correctness and recoverability > speed of implementation > visual polish.

## Facebook automation pattern

Always:
`Detect -> Action -> Wait for completion -> Verify -> Record -> Random wait -> Next`

Never:
`Click coordinates -> sleep fixed time -> assume success`.

---


26. Every production interactive UI control must have a feature ID and row in `18_UI_BACKEND_TRACEABILITY.md`.
27. No production button may remain mock/simulation-only. Implement it fully, classify it UI_ONLY, gate it DEV_ONLY, or remove it.
28. A phase is not complete until every feature owned by the phase is TESTED and ACCEPTED.
29. Adding a UI control and its backend/acceptance test must happen in the same implementation increment.
30. Batch device operations must report per-device success/failure; never fake global success.
31. Prototype controls `buocKe`, `giaLapLoi`, and `datLaiQuyTrinh` are DEV_ONLY and hidden from production.
32. Run the completeness audit before closing every phase.


33. PC media cannot be assumed visible to Facebook; implement and test the Android media-staging pipeline before Reel automation.
34. Use a Unicode-safe text input path; do not build production caption/comment input around `adb shell input text`.
35. Do not claim an Android Proxy type is supported until device routing and Facebook connectivity are verified on real hardware.
36. Unknown Facebook app version/locale disables posting automation rather than guessing selectors.
37. scrcpy server/client protocol versions are a pinned compatibility set.
38. Phase 2.5 Technical Risk Gate is mandatory.
39. Production runtime contains no random/mock success path reachable from normal UI.
