# PROJECT INTRODUCTION — FACEBOOK AUTO FARM

## Project name

**Facebook Auto Farm**

## Production workspace

```text
E:\AutoReels
```

This path is fixed for local Windows development unless a documented change request changes it.

## Current status

```text
SPEC/UI FREEZE: FINAL V17
UI SHA-256: fe9e23625d1a50f384ea34eb4003c4049820f68524d0e450c2e70d85b5434b49
CURRENT PHASE: PHASE 0 READY
```

## Mission

Build a Windows desktop Android device-farm manager for scheduling and operating Facebook Reels through the Android Facebook application UI.

## Core product rules

- No hard business limit on registered devices.
- No hard business limit on videos/media.
- Campaign owns one media folder.
- Manual Facebook login.
- Automatic UI-based account/profile/Page discovery after login.
- One active automation job per device.
- Manual control and automation share the same device mutex.
- SQLite persistence and restart recovery.
- Immutable job snapshots.
- No blind retry from POST_PENDING.
- Comment retry never reposts media.
- Proxy and VPN are mutually exclusive.
- Security challenges stop at NEEDS_REVIEW.
- Reuse maintained official/open-source projects before writing custom infrastructure.

## Canonical references

Read in this order:

1. `PROJECT_KNOWLEDGE_MASTER.md`
2. `10_DECISION_LOG.md`
3. `01_MASTER_SPEC.md`
4. `02_IMPLEMENTATION_PLAN.md`
5. `12_ENVIRONMENT_REQUIREMENTS.md`
6. `13_PRE_CODE_CHECKLIST.md`
7. `Facebook_Auto_Farm_FINAL_V17.html`

Production code must not be built by continuing to expand the single-file HTML prototype.


## Implementation completeness contract

Before declaring any phase complete, read:
- `18_UI_BACKEND_TRACEABILITY.md`
- `19_DEFINITION_OF_DONE.md`
- `20_BACKEND_IPC_CONTRACT.md`
- `21_COMPLETENESS_AUDIT.md`

A visible production button with no real backend is a release-blocking defect.
