# 03 — ARCHITECTURE

## Recommended stack

```text
Electron
TypeScript
React
Vite
better-sqlite3
Node worker_threads where appropriate
```

The final HTML is a frozen reference, not the production framework.

## Proposed repository

```text
facebook-auto-farm/
├─ apps/
│  └─ desktop/
├─ src/
│  ├─ main/
│  │  ├─ electron/
│  │  ├─ ipc/
│  │  ├─ tray/
│  │  └─ lifecycle/
│  ├─ preload/
│  ├─ renderer/
│  │  ├─ devices/
│  │  ├─ campaigns/
│  │  ├─ media/
│  │  ├─ timeline/
│  │  ├─ accounts/
│  │  ├─ network/
│  │  └─ apk/
│  ├─ database/
│  ├─ devices/
│  │  ├─ adb/
│  │  ├─ scrcpy/
│  │  ├─ registry/
│  │  └─ worker/
│  ├─ facebook/
│  │  ├─ detector/
│  │  ├─ selectors/
│  │  ├─ account-scanner/
│  │  ├─ identity/
│  │  ├─ reels/
│  │  ├─ post/
│  │  └─ comment/
│  ├─ scheduler/
│  ├─ media/
│  ├─ network/
│  ├─ diagnostics/
│  └─ system/
├─ tests/
├─ docs/
└─ vendor/
```

## Main / Renderer separation

### Main owns

- SQLite.
- child processes.
- ADB.
- scrcpy sessions/control.
- folder watchers.
- scheduler.
- workers.
- proxy/VPN/APK actions.
- hardware telemetry.
- filesystem.

### Renderer owns

- UI state.
- visualization.
- virtualized lists.
- selection.
- timeline interactions.
- user intents.

Renderer never executes arbitrary shell commands.

## Preload contract

Expose a typed narrow API:

```text
devices.*
streams.*
manualControl.*
campaigns.*
media.*
jobs.*
timeline.*
accounts.*
network.*
apk.*
system.*
diagnostics.*
```

Validate all arguments in Main.

## DeviceWorker

One worker/controller per device.

It owns:

- ADB transport;
- screen/control session;
- device mutex;
- active job;
- queue;
- Facebook current state;
- current account/Page state;
- recovery.

No other subsystem clicks a device directly.

## Facebook semantic abstraction

State machine does not know raw coordinates.

Example interface:

```text
detectState()
ensureFacebookOpen()
ensureAccount(accountId)
ensureIdentity(identityId)
openCreateReel()
selectMedia(mediaId)
fillReelDetails(snapshot)
publishOnce()
verifyPost(transaction)
postComment(transaction)
```

Selectors are versioned separately.

## Resource management

Registered-device count can be unbounded by business logic, but active resource use is adaptive:

- MASTER: high quality/FPS.
- visible preview: configured FPS/quality.
- offscreen: last-frame or 1 FPS.
- disconnected: no stream.
- inactive media rows: virtualized, not mounted in DOM.

## Work ownership

Manual control and automation cannot concurrently own the same device.

```text
AUTOMATION owns device
-> manual request
-> pause at safe point
-> release automation input
-> manual owns device
-> user finishes
-> detect current state
-> resume or NEEDS_REVIEW
```
