# 02 — IMPLEMENTATION PLAN

# COMPLETENESS RULE — APPLIES TO EVERY PHASE

Before any phase is marked complete, apply `19_DEFINITION_OF_DONE.md`.

For all feature IDs owned by that phase in `18_UI_BACKEND_TRACEABILITY.md`:

```text
PLANNED -> IMPLEMENTED -> TESTED -> ACCEPTED
```

The phase cannot close with:
- missing backend wiring;
- simulation-only production controls;
- untested interactive controls;
- renderer-only state that should persist;
- UI button without an owning feature ID.

See `20_BACKEND_IPC_CONTRACT.md` and `21_COMPLETENESS_AUDIT.md`.

---

## Planning principle

Do not start with Facebook posting automation.

Build infrastructure in dependency order so that each later layer has:
- stable persistence;
- device locking;
- diagnostics;
- deterministic recovery.

## Phase 0 — Repository and engineering baseline

Deliverables:
- Git repository.
- Electron + TypeScript + React + Vite scaffold.
- pnpm or npm lockfile.
- ESLint.
- Prettier.
- Vitest.
- structured logger.
- build scripts.
- CI.
- development environment documentation.
- production dependency bundling; no runtime CDN.

Exit criteria:
- application opens and closes cleanly;
- renderer sandbox enabled;
- tray/background mode skeleton works;
- CI builds on Windows.

## Phase 1 — SQLite and domain layer

Implement:
- migrations;
- repository pattern;
- transactions;
- WAL mode;
- settings persistence;
- database backup primitive.

Tables:
- devices
- device_connections
- login_sessions
- identities
- identity_metrics
- campaigns
- media
- ignored_files
- schedule_slots
- jobs
- job_attempts
- post_transactions
- comment_transactions
- proxy_profiles
- device_network_state
- diagnostics
- app_settings

Exit:
- restart loses no application state;
- migrations are deterministic;
- DB backup/restore test passes.

## Phase 2 — ADB Device Registry

Implement:
- locate/bundle Android platform-tools strategy;
- `adb devices -l`;
- USB recognition;
- TCP/LAN recognition;
- reconnect;
- get-state;
- IP metadata;
- Android properties;
- package listing;
- device heartbeat;
- disconnect/reconnect events;
- per-device mutex.

Exit:
- connect/disconnect several real devices;
- UI updates without restart;
- a failed phone does not affect others.


## Phase 2.5 — Technical Risk Gate (mandatory)

Before building the full stream/account/posting stack, execute `27_TECHNICAL_RISK_GATE.md`.

Required spikes:
- embedded scrcpy/Tango;
- Unicode text injection;
- PC media staging and exact Facebook picker selection;
- account/Page scanner;
- Facebook state detection;
- post-verification feasibility;
- proxy routing feasibility;
- ADB coexistence.

Exit:
- core assumptions have PASS evidence;
- failed assumptions are redesigned before dependent phases continue.


## Phase 3 — scrcpy stream/control

Milestones:
1. one phone stream;
2. one phone input;
3. embedded stream;
4. multiple streams;
5. adaptive preview quality;
6. focused high-quality stream;
7. offscreen throttling.

Exit:
- Overview displays real phone frames;
- focused phone control is responsive;
- Ctrl+wheel behaviors match V17.

## Phase 4 — Manual multi-device control

Implement:
- `SelectedDeviceIds`;
- MASTER;
- Selecto selection;
- Ctrl+A;
- normalized pointer mapping;
- tap;
- swipe;
- Back/Home/Recent;
- worker ownership handoff.

Exit:
- select 3–5 phones of different resolutions;
- operate MASTER;
- all selected devices receive equivalent input.

## Phase 5 — Campaign / folder / media engine

Implement:
- Campaign CRUD.
- One folder per Campaign.
- Chokidar watcher.
- 10-second reconciliation.
- media fingerprinting.
- bounded thumbnail worker queue.
- ignored files.
- missing/recovered files.
- virtualized media table.
- Excel import/export.

Exit:
- several thousand media rows do not freeze UI;
- new/deleted/reappearing files behave according to spec.

## Phase 6 — Scheduler and queue engine

Implement:
- UTC persistence.
- campaign timezone.
- slots.
- daily recurrence generation.
- device queues.
- device mutex.
- conflict detector.
- random anti-conflict spreading.
- overdue/waiting states.
- restart recovery.

Exit:
- multiple devices run independent schedules;
- same device cannot have two active jobs;
- restart preserves pending schedules.

## Phase 7 — Facebook login/session/account scanner

Implement detectors:
- Facebook app launched.
- login required.
- home state.
- profile/menu.
- profile switcher.
- Page list.

Scanner:
- UIAutomator first.
- resource/text/content-desc selectors.
- scroll-until-stable.
- deduplicate identities.
- Page count.
- cache timestamps.
- manual rescan.
- session expiry detection.

Exit:
- manually login on a test phone;
- tool recognizes state;
- scanner stores profiles/Pages;
- re-scan updates DB.

## Phase 8 — Identity metrics

Implement:
- navigation to identity;
- likes/followers parser;
- snapshots;
- 1/7/30 day comparisons;
- stale/missing data behavior.

Exit:
- metrics render in rich combobox;
- missing metric does not block job execution.

## Phase 9 — Facebook state engine

Create semantic states:

```text
HOME
PROFILE_MENU
PROFILE_SWITCHER
PAGE_HOME
CREATE_MENU
REEL_PICKER
REEL_EDITOR
REEL_DETAILS
PUBLISHING
POST_VIEW
COMMENTS
POPUP
CHECKPOINT
UNKNOWN
```

Create semantic actions independent from raw coordinates.

Exit:
- state classifier can traverse relevant screens without publishing.

## Phase 10 — Reel posting workflow

Implement state-machine transitions:
- preflight;
- account switch;
- Page/Profile switch;
- create Reel;
- choose exact media;
- Next;
- content;
- audience;
- Remix;
- Story;
- Publish.

No comment yet.

Exit:
- one controlled test Page can publish one Reel reliably.

## Phase 11 — Post transaction/idempotency

Implement:
- POST_INTENT.
- idempotency key.
- POST_PENDING.
- post search/verification.
- crash recovery.
- ambiguous state handling.

Exit:
- intentionally terminate app after Publish click;
- restart does not create a duplicate post.

## Phase 12 — Comment transaction

Implement:
- comment optional branch.
- COMMENT_INTENT.
- COMMENT_PENDING.
- exact content verification.
- comment-only retry.

Exit:
- comment error never reposts media.

## Phase 13 — VPN / Proxy / APK

VPN:
- installed-package discovery;
- known app adapters;
- optional branch;
- verification.

Proxy:
- parser;
- bulk checker;
- device assignment;
- post-assignment verification;
- VPN mutual exclusion.

APK:
- install/uninstall;
- bounded ADB concurrency.

## Phase 14 — Diagnostics and production hardening

Implement:
- diagnostic ZIP export;
- screenshots/XML;
- recent action log;
- crash handling;
- database backup;
- system telemetry;
- structured error codes;
- resource pressure policy.

Scale tests:
- 10 devices;
- 20 devices;
- 50+ registered devices;
- large media library.

Do not define success as “50 full-resolution streams at 60 FPS”. Success is stable adaptive operation.

## Phase 15 — Packaging/release

- Windows installer.
- bundled dependencies/binaries.
- first-run checks.
- updater strategy.
- release notes.
- migration policy.
- signed builds when distribution requires it.

## MVP cut line

MVP can be declared after Phase 12 if:
- several real phones work;
- campaign folders work;
- scheduling works;
- account/Page scan works;
- one reliable Reel flow works;
- duplicate prevention and recovery work.

Proxy/VPN/APK polish can follow if necessary.