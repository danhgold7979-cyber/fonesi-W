# PROJECT KNOWLEDGE MASTER — FACEBOOK AUTO FARM V1.0

This is the condensed context file intended to be uploaded into ChatGPT Project/Work knowledge.

**Canonical UI:** `Facebook_Auto_Farm_FINAL_V17.html`  
**UI SHA-256:** `fe9e23625d1a50f384ea34eb4003c4049820f68524d0e450c2e70d85b5434b49`


## Production workspace

```text
E:\AutoReels
```

Current implementation state:

```text
PRE-CODE ENVIRONMENT GATE
then Phase 0 — Repository and engineering baseline
```

Before coding, `13_PRE_CODE_CHECKLIST.md` Gate A must pass.


## Mission

Build a Windows desktop Android device-farm manager for scheduling and operating Facebook Reels through the Android Facebook application UI.

The product should remain operable across many devices and large media libraries without business-rule caps.

## Non-negotiable decisions

- No hard device limit.
- No hard video limit.
- Campaign = one media folder + device/account/Page/schedule configuration.
- Manual Facebook login.
- Tool scans logged-in accounts/profiles/Pages through Facebook UI.
- No Facebook password/2FA storage.
- One active automation job per device.
- Manual broadcast control and automation share a device-control mutex.
- SQLite persistence.
- Immutable job snapshots.
- POST_PENDING cannot blindly Publish again.
- Comment retry cannot repost.
- Proxy and VPN mutually exclusive.
- Preview rendering is adaptive to available resources.
- Security challenges stop at NEEDS_REVIEW.
- Use official/maintained OSS wherever possible.

## UI behavior

Right device panel:
- Overview and selected-device tabs.
- Overview supports wrapping grid, Ctrl+wheel size, fullscreen, drag-select, Ctrl+A.
- selected-device screen supports Ctrl+wheel independent zoom.
- panel can be pulled left/right.
- double-click opens floating MASTER.
- MASTER can drag/resize/Ctrl+wheel.
- selected device group receives normalized manual input.

Account/Page field:
- searchable rich combobox;
- text includes name, Page count (for Nick), likes, followers, 1D/7D/30D delta;
- green increase / red decrease;
- variable/unlimited Page count.

System strip:
- CPU %, RAM %, GPU %, disk, preview FPS, preview quality.

Folder/media:
- Campaign-specific folder.
- live watcher.
- default reconciliation 10 seconds.
- unlimited media.
- filename becomes default caption.
- bulk metadata actions.
- Excel import/export.

Schedule:
- default 3/day: 06:00, 12:00, 18:00.
- unlimited number of daily slots.
- Timeline can select one/many phones.
- Ctrl+wheel zoom.
- drag time.
- target-specific colors.
- conflict only on same device/time.
- anti-conflict random 60–120 min.

## Account scan

Manual login -> LOGIN_OK -> scan.

Scanner:
- open profile/menu switcher;
- find “See all profiles” or current equivalent;
- UIAutomator/accessibility-first;
- scroll until no new items;
- persist profiles/Pages;
- count Pages;
- cache results.

States:
LOGIN_OK, LOGIN_REQUIRED, CHECKPOINT, SESSION_EXPIRED, UNKNOWN.

## Automation

Never rely on a fixed coordinate script alone.

Pattern:
Detect -> semantic action -> action complete -> verify -> log -> random wait -> next.

Reel states:
Prepare, Device, Network, VPN?, Facebook, Popup?, Account, Identity, Create Reel, Pick Video, Next, Description/Hashtag, Audience, Remix?, Story?, Publish, Verify Post, Comment?, Comment, Verify Comment, Complete.

Publish:
POST_INTENT -> click once -> POST_PENDING -> verify exact post -> POSTED.

## Technology direction

Production:
Electron + TypeScript + React + Vite.

Use:
- scrcpy
- ADB platform-tools
- Selecto
- Interact.js
- screenfull
- Choices.js
- TanStack Virtual
- better-sqlite3
- Chokidar
- Execa
- systeminformation
- SheetJS
- electron-builder

Do not use CDN dependencies in production.

## Read full detail

See:
- `01_MASTER_SPEC.md`
- `02_IMPLEMENTATION_PLAN.md`
- `03_ARCHITECTURE.md`
- `04_DATABASE_SCHEMA.md`
- `05_STATE_MACHINES.md`
- `06_ACCEPTANCE_TESTS.md`
- `10_DECISION_LOG.md`


## Implementation completeness contract

Before declaring any phase complete, read:
- `18_UI_BACKEND_TRACEABILITY.md`
- `19_DEFINITION_OF_DONE.md`
- `20_BACKEND_IPC_CONTRACT.md`
- `21_COMPLETENESS_AUDIT.md`

A visible production button with no real backend is a release-blocking defect.

## Final implementation gates

Before full automation:
- PC media staging -> Android -> MediaStore -> exact Facebook picker must be proven.
- Unicode caption/comment injection must be proven.
- embedded scrcpy client/server compatibility must be pinned and proven.
- Proxy support is adapter-based and must prove actual Android/Facebook routing.
- unknown Facebook version/locale blocks automation rather than guessing.
- Phase 2.5 Technical Risk Gate is mandatory.


## Android media staging final rule

- Never clear all videos from a phone.
- AutoReels owns only a dedicated Android staging directory.
- Prefer exactly one staged media item for the active job/device.
- Keep staging while publish status is unresolved.
- Cleanup AutoReels staging after SUCCESS and reconcile MediaStore.
- Never delete unrelated Android media.
