# Increment039 — P11/S094 persisted-only job preflight diagnostics

Date: 2026-10-28. Plan `INCREMENT-039_PLAN.md` was committed first at `81e1cfa40cc53e195d2c6924fce61ab5ed44721a`. Initial code at `564442b3b483f081b47a565ad1b99032a1c597a3`; follow-up Electron preload `c469c2eb2b4337b5dfb20d1f25eaf7247c640086`; corrected lazy test assertion `e86b5de222d5fc18932d938fee65f8dcbce7eef9`; verified final source SHA `f7df8b3a21cd888e5acf1b83b792c0d5ab656ea2` fixes resolved-effect status semantics. All changes pushed directly to `feat/studio-workspace`, no new phase branch, `main` untouched.

## Implemented

- New `JobPreflightReport` is a bounded redacted diagnostic, explicitly `scope: PERSISTED_ONLY`, `canDispatch: false`. No job snapshot payload, caption, account, target, host grant, source path, hardware serial or fingerprint is sent to the client.
- `StudioDatabase.inspectJobPreflight` reads one pinned SQLite job with immutable hash validation. It checks waiting state, archived Process/device binding drift, pinned version/hash and static effect-path compilation, enabled device/verified identity/lease, prior effects and 0–250 referenced media assets versus pinned/source hash and READY/CHANGED/MISSING state. Inputs and observations are read-only. Duplicate/oversize/untracked assets block and no potentially ambiguous media source is trusted.
- External effect `CONFIRMED`/other resolved record is treated as already recorded (blocked for replay) rather than as an unresolved review; `INTENT`, `ATTEMPT_UNCERTAIN`, `NEEDS_REVIEW` require explicit review. Neither path permits dispatch.
- The report **always** includes `LIVE_PROFILE_NOT_CERTIFIED`, because real app/account/target/version/locale, provider, device and live media bytes are not certified. It is not a DEVICE_TEST, lease, executable runner or effect journal advance.
- Strict public host schema `jobPreflight({id})`, typed StudioApi, sandboxed Electron preload, and a read-only modal reachable from each Schedule LIST row. This does not modify selected schedule operations or frozen jobs.
- SQLite tests: no side effects, invalid/public requests, disabled/conflict/busy device, Process archived, pinned version mismatch, prior uncertain/resolved effects, changed media and restart, invalid clock and corrupt snapshot. Browser E2E confirms blocked safe report with no leaked caption, no claims and unchanged scheduled job.

## Remote CI results on the final source SHA

- [Actions 40656226032](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40656226032): **SUCCESS**, Ubuntu + hosted Windows.
- [Actions 40656233702](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40656233702): **SUCCESS**, Ubuntu + hosted Windows.
- Ubuntu `pnpm check`: **291 PASS / 33 files**, `pnpm test:ui`: **30 PASS Chromium**.
- Windows `pnpm check`: **290 PASS + 1 pre-existing Unix-only SDK test skipped / 33 files**.
- Both CI runs passed generated schema check, typecheck, lint, build, plan validators and Windows source launcher VerifyOnly.
- Intermediate code commits initially failed due to missing preload method and an incorrectly eager `expect(db.getJob(...)).toThrow()` test assertion. Both were fixed and CI rerun; they are not described as passed source revisions.
- An earlier documentation-only CI of Increment038 (`c61d042`) had one intermittent Windows-hosted 10s SQLite migration-test timeout; subsequent source CI at `e86b5de` and final `f7df8b3a` passed. This does not certify absence of future hosted-runner timing variance.

## Explicit NOT_RUN / acceptance

**TESTED_PERSISTED_ONLY_PREFLIGHT_NOT_P11_ACCEPTED.** No actual Android/device stream, real-time app version/certification/identity/target/foreground probe, media file rehash at job dispatch, network/routing verification, real workflow JOB executor, external Facebook Reels/TikTok publish/comment verification or retry policy certification. Physical Windows10, 20→100→300 real device benchmarks, offline installer, packaging and release are NOT_RUN. No main merge or release.
