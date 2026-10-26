# 18 — UI ↔ BACKEND TRACEABILITY MATRIX

## Purpose

A production feature is not complete because the button is visible.

Every interactive control must be one of:

1. **BACKEND** — wired to a typed IPC call and real service implementation;
2. **UI_ONLY** — intentionally local visual behavior with no backend need;
3. **DEV_ONLY** — hidden in production builds;
4. **REMOVED** — not shipped.

There is no fifth state called “placeholder”, “mock”, “simulate”, or “later”.

## Required coverage fields

Each production control must have:

```text
Feature ID
UI control
User intent
IPC command/event
Main/domain service
Persistence/state
Failure behavior
Acceptance test
Owning phase
Status
```

Status lifecycle:

```text
PLANNED
IMPLEMENTED
TESTED
ACCEPTED
```

A feature is shippable only at `ACCEPTED`.

---

## A. Application shell / system

| ID | UI | Classification | Backend contract | Persistence | Test | Phase |
|---|---|---|---|---|---|---|
| APP-001 | Chạy nền Tắt/Bật | BACKEND | `app.setRunInBackground(enabled)` | app_settings | close window hides to tray when enabled; exits when disabled | 0 |
| APP-002 | Dark/Light | UI_ONLY + persistence | `settings.setTheme(theme)` optional IPC or renderer store | app_settings | restart preserves theme | 0 |
| APP-003 | CPU | BACKEND | `system.getMetrics()` / metrics event | none | value updates without blocking UI | 0 |
| APP-004 | RAM | BACKEND | same | none | same | 0 |
| APP-005 | GPU % | BACKEND | same | none | percentage only | 0 |
| APP-006 | Disk | BACKEND | same | none | real disk value for workspace/system | 0 |
| APP-007 | Preview FPS slider | BACKEND | `streams.setGlobalPreviewProfile({fps})` | app_settings | visible previews change; MASTER unaffected | 3 |
| APP-008 | Preview quality slider | BACKEND | `streams.setGlobalPreviewProfile({quality})` | app_settings | visible previews change; MASTER unaffected | 3 |

---

## B. Device sidebar

| ID | UI | Classification | Backend contract | Persistence | Test | Phase |
|---|---|---|---|---|---|---|
| DEV-001 | Search devices | UI_ONLY over backend device list | none | none | filter does not mutate devices | 2 |
| DEV-002 | Filter All/Ready/Running/Error | UI_ONLY | none | none | correct filter | 2 |
| DEV-003 | Quét máy | BACKEND | `devices.scan()` | devices | USB/LAN registry refreshes | 2 |
| DEV-004 | Thêm máy | BACKEND | `devices.addManualConnection(input)` | devices/device_connections | validates LAN address; USB is discovered, not manually invented | 2 |
| DEV-005 | Click device | UI_ONLY selection | none | optional lastSelectedDevice | detail view changes | 2 |
| DEV-006 | Ctrl/click multi-select | UI_ONLY | none | none | selected set correct | 4 |
| DEV-007 | Drag-select devices | UI_ONLY via Selecto | none | none | selected set correct | 4 |
| DEV-008 | Double-click device | UI_ONLY + stream request | `streams.focus(deviceId)` | none | floating MASTER opens real stream | 3/4 |
| DEV-009 | Right-click device/group | BACKEND actions below | typed per action | varies | action applies exactly to selected set | 4 |

### Device/group context actions

| ID | Action | IPC | Service | Test |
|---|---|---|---|---|
| DEV-CTX-001 | Open/focus | `streams.focus(deviceId)` | StreamManager | real focused stream |
| DEV-CTX-002 | Select/deselect | UI_ONLY | renderer | selected set |
| DEV-CTX-003 | Reconnect ADB | `devices.reconnect(ids[])` | DeviceRegistry | reconnect result per device |
| DEV-CTX-004 | Refresh screen | `streams.requestKeyFrame(ids[])` | StreamManager | new frame received |
| DEV-CTX-005 | Open/restart Facebook | `devices.openPackage(ids[], "com.facebook.katana", restart)` | AndroidAppService | Facebook foreground verified |
| DEV-CTX-006 | Clear background | **BACKEND, semantics locked below** | AndroidAppService | deterministic result |
| DEV-CTX-007 | Screenshot | `devices.captureScreenshot(ids[])` | Diagnostics | file paths returned |
| DEV-CTX-008 | Device info | `devices.getDetails(ids[])` | DeviceRegistry | real values |
| DEV-CTX-009 | Lock/unlock worker | `workers.setManualLock(ids[], locked)` | DeviceWorkerManager | automation ownership enforced |

### DEV-CTX-006 exact semantics

Production meaning of **Xóa nền**:

```text
force-stop the configured managed application(s) on selected device(s),
primarily Facebook, then verify process/app state.
```

Do **not** pretend Android has one universal reliable “Clear all recents” API across OEMs.

If a later requirement explicitly needs OEM Recents clearing, implement it as a separate adapter/action.

---

## C. Overview / screen control

| ID | UI | Class | Contract | Test | Phase |
|---|---|---|---|---|---|
| SCR-001 | Tổng quan tab | BACKEND render source | stream subscriptions | real frames | 3 |
| SCR-002 | Detail tab | BACKEND render source | focused preview subscription | real frame | 3 |
| SCR-003 | Select all | UI_ONLY | none | all IDs selected | 4 |
| SCR-004 | Clear selection | UI_ONLY | none | set empty | 4 |
| SCR-005 | Refresh all | BACKEND | `streams.requestKeyFrame(ids[])` | frames update | 3 |
| SCR-006 | Fullscreen | UI_ONLY via screenfull | none | full-screen works | 3 |
| SCR-007 | Overview Ctrl+wheel | UI_ONLY | none | wrap/no overlap | 3 |
| SCR-008 | Detail Ctrl+wheel | UI_ONLY | none | 30–500% / scroll | 3 |
| SCR-009 | Floating MASTER drag/resize/Ctrl+wheel | UI_ONLY | none | free movement/resize | 3 |
| SCR-010 | MASTER tap | BACKEND | `manualControl.tap(group, normalizedPoint)` | DeviceWorker control | normalized broadcast | 4 |
| SCR-011 | MASTER swipe | BACKEND | `manualControl.swipe(group, normalizedGesture)` | DeviceWorker control | normalized broadcast | 4 |
| SCR-012 | Back | BACKEND | `manualControl.key(group, BACK)` | none | all selected phones react | 4 |
| SCR-013 | Home | BACKEND | `manualControl.key(group, HOME)` | none | same | 4 |
| SCR-014 | Recent | BACKEND | `manualControl.key(group, RECENTS)` | none | same | 4 |
| SCR-015 | Clear background | BACKEND | DEV-CTX-006 | none | same | 4 |
| SCR-016 | Offscreen throttling | BACKEND | stream visibility policy | app_settings | ~1fps/last-frame | 3 |

---

## D. Quick apps

| ID | UI | Backend | Rule | Phase |
|---|---|---|---|---|
| QAPP-001 | Facebook | `devices.openApp(ids, FACEBOOK)` | known package | 2/4 |
| QAPP-002 | Gallery | `devices.openSystemRole(ids, GALLERY)` | resolve Android intent / OEM fallback | 4 |
| QAPP-003 | Files | `devices.openSystemRole(ids, FILES)` | resolve intent / OEM fallback | 4 |
| QAPP-004 | Settings | `devices.openSettings(ids)` | Android settings intent | 4 |
| QAPP-005 | VPN | `network.openActiveVpnApp(ids)` | only if configured | 13 |
| QAPP-006 | Browser | `devices.openSystemRole(ids, BROWSER)` | default browser intent | 4 |

If no compatible handler exists, return a visible structured error. Never silently no-op.

---

## E. Facebook login / Nick / Page

| ID | UI | Backend contract | DB | Test | Phase |
|---|---|---|---|---|---|
| ACC-001 | Manual login button | `accounts.openLogin(deviceId)` | login_sessions | Facebook opens/focuses | 7 |
| ACC-002 | Scan Nick/Page | `accounts.scan(deviceId)` | sessions/identities | actual UI scan | 7 |
| ACC-003 | Nick combobox | `accounts.list(deviceId)` | login_sessions | variable/unlimited list | 7 |
| ACC-004 | Page/Profile combobox | `identities.list(sessionId)` | identities | variable/unlimited list | 7 |
| ACC-005 | Like/Follow 1D/7D/30D | `metrics.list(identityId)` | identity_metrics | real snapshots / dash if absent | 8 |
| ACC-006 | Switch Nick | `facebook.ensureAccount(sessionId)` on job/manual intent | state cache | verify switch | 7/9 |
| ACC-007 | Switch Page/Profile | `facebook.ensureIdentity(identityId)` | state cache | verify switch | 7/9 |

Manual login never sends password via IPC.

---

## F. Workflow panel

Production rule:

The workflow graph is a **read-only visualization of the real state machine**.

The prototype buttons:

- `buocKe`
- `giaLapLoi`
- `datLaiQuyTrinh`

are classified **DEV_ONLY**.

They must be:
- hidden in production build;
- available only behind a development/diagnostic flag;
- connected to test harness, not fake production state.

Random delay min/max is a real Campaign/Job setting and must persist.

| ID | UI | Class | Contract | Phase |
|---|---|---|---|---|
| WF-001 | delay min | BACKEND config | `campaigns.updateDelay()` | 6/10 |
| WF-002 | delay max | BACKEND config | same | 6/10 |
| WF-003 | state graph | BACKEND event visualization | `jobs.stateChanged` | 6+ |
| WF-DEV-001 | step next | DEV_ONLY | test harness only | test |
| WF-DEV-002 | simulate error | DEV_ONLY | test harness only | test |
| WF-DEV-003 | reset workflow | DEV_ONLY | test harness only | test |

---

## G. Campaign / folder

| ID | UI | Contract | DB | Phase |
|---|---|---|---|---|
| CAM-001 | Campaign selector | `campaigns.list/get` | campaigns | 5 |
| CAM-002 | New Campaign | `campaigns.create()` | campaigns | 5 |
| CAM-003 | Choose folder | `campaigns.setFolder()` | campaigns | 5 |
| CAM-004 | Rescan | `media.reconcile(campaignId)` | media | 5 |
| CAM-005 | Auto scan on/off | `campaigns.setWatcherEnabled()` | app/campaign settings | 5 |
| CAM-006 | Reconcile interval | `campaigns.setReconcileInterval()` | settings | 5 |

Folder dialog is handled by Electron/Main with explicit path permission, not browser-only File System Access API in production.

---

## H. Media table and bulk editing

Dynamic media row controls must all persist.

| ID | UI/action | Contract | Phase |
|---|---|---|---|
| MED-001 | row select / select all | UI_ONLY | 5 |
| MED-002 | caption edit | `media.update(id,{caption})` | 5 |
| MED-003 | hashtag edit | `media.update(id,{hashtags})` | 5 |
| MED-004 | comment edit | `media.update(id,{comment})` | 5 |
| MED-005 | audience | `media.update(id,{audience})` | 5 |
| MED-006 | remix | `media.update(id,{remix})` | 5 |
| MED-007 | story | `media.update(id,{shareStory})` | 5 |
| MED-008 | date/time | `schedule.updateMedia()` or job creation | 6 |
| MED-009 | target | `media.updateTarget()` | 5 |
| MED-010 | post now | `jobs.enqueueNow(mediaId)` | 6/10 |
| MED-011 | bulk edit | `media.bulkUpdate(ids,patch,mode)` | 5 |
| MED-012 | import Excel | `media.importSpreadsheet()` | 5 |
| MED-013 | export Excel | `media.exportSpreadsheet()` | 5 |
| MED-014 | delete selected | `media.ignore/removeFromCampaign(ids)` | 5 |
| MED-015 | right-click clone row | `media.cloneMetadata(id)` | 5 |
| MED-016 | right-click change target | `media.updateTarget()` | 5 |
| MED-017 | right-click clear schedule | `schedule.clearMedia()` | 6 |
| MED-018 | right-click remove | `media.ignore/removeFromCampaign()` | 5 |

No media mutation may exist only in React state.

---

## I. Schedule

| ID | UI | Contract | Phase |
|---|---|---|---|
| SCH-001 | start date | campaign schedule config | 6 |
| SCH-002 | videos/day | schedule generator | 6 |
| SCH-003 | dynamic time slots | schedule slots CRUD | 6 |
| SCH-004 | auto append new media | campaign schedule setting | 6 |
| SCH-005 | Apply schedule | `scheduler.generateJobs(campaignId)` | 6 |
| SCH-006 | Clear unsent schedule | `scheduler.clearPending()` | 6 |
| SCH-007 | Timeline view mode | UI query | 6 |
| SCH-008 | Timeline date range | UI query | 6 |
| SCH-009 | phone multi-select | UI query | 6 |
| SCH-010 | Refresh timeline | `scheduler.query()` | 6 |
| SCH-011 | Drag job time | `scheduler.reschedule(jobId,time)` | 6 |
| SCH-012 | Ctrl+wheel zoom | UI_ONLY | 6 |
| SCH-013 | Anti-conflict | `scheduler.spreadConflicts()` | 6 |

`Apply schedule` creates immutable Job snapshots, not just dates in renderer memory.

---

## J. VPN

| ID | UI/action | Contract | Rule | Phase |
|---|---|---|---|---|
| VPN-001 | Scan VPN | `network.scanVpnApps(deviceId)` | package manager | 13 |
| VPN-002 | VPN icon toggle | `network.setVpn(deviceId,package,on)` | adapter-based UI automation | 13 |
| VPN-003 | Unknown VPN package | open only / unsupported adapter state | no fake generic toggle | 13 |

Turning VPN on clears active Proxy.

---

## K. Proxy

| ID | UI/action | Contract | Phase |
|---|---|---|---|
| PXY-001 | Import proxy text | `proxy.parseAndUpsert(text)` | 13 |
| PXY-002 | Select proxies | UI_ONLY | 13 |
| PXY-003 | Select device(s) per proxy | UI_ONLY mapping draft | 13 |
| PXY-004 | Check selected | `proxy.check(ids)` | 13 |
| PXY-005 | Check all | `proxy.checkAll()` | 13 |
| PXY-006 | Check one row | `proxy.check([id])` | 13 |
| PXY-007 | Apply selected | `proxy.assign(mapping)` | 13 |
| PXY-008 | Verify device received routing | part of assign result | 13 |
| PXY-009 | Remove proxy | `proxy.clear(deviceIds)` | 13 |

Alive must mean a real successful connectivity test through that proxy, with timeout and structured latency/error result.

---

## L. APK

| ID | UI/action | Contract | Phase |
|---|---|---|---|
| APK-001 | choose APK | Electron file picker | 13 |
| APK-002 | package name | validate package identifier | 13 |
| APK-003 | select all devices | UI_ONLY | 13 |
| APK-004 | deselect all | UI_ONLY | 13 |
| APK-005 | install | `apk.install(deviceIds,path)` | 13 |
| APK-006 | uninstall | `apk.uninstall(deviceIds,package)` | 13 |

Return per-device results. One device failure does not fail the entire batch.

---

## M. Clone configuration

The feature means **clone configuration only**, not credentials/session/passwords.

Cloned fields:
- campaign defaults;
- audience/remix/story;
- schedule profile if requested;
- posting metadata/template settings.

Never clone:
- login credentials;
- Facebook private session/token;
- device identifier.

| ID | UI | Contract | Phase |
|---|---|---|---|
| CLONE-001 | source | `config.getCloneSource()` | 5 |
| CLONE-002 | destination device | devices query | 5 |
| CLONE-003 | destination account | accounts query | 7 |
| CLONE-004 | copy name | validation | 5 |
| CLONE-005 | confirm clone | `config.clone()` | 7 |

---

## N. Add device modal

USB devices are discovered, not manually fabricated.

Manual add is for explicit ADB network targets.

Production fields:
- display name optional;
- address `host:port`;
- optional IP metadata.

If the UI keeps USB/LAN select:
- selecting USB directs user to connect/authorize and scan;
- it does not create a fake USB serial.

---

## O. “No placeholder” audit

Before release, repository scan must fail CI if production source contains known placeholder patterns outside tests/dev fixtures, including:

```text
TODO_IMPLEMENT
MOCK_ONLY
SIMULATE_ONLY
alert("...mô phỏng...")
throw new Error("Not implemented")
console.warn("not implemented")
return true // placeholder adapter
setTimeout used as fake backend success
```

Exceptions require an allowlist file with justification and must not be reachable in production UI.

---

## P. Coverage accounting

The acceptance report must produce:

```text
Total production interactive features: N
Backend-required features: N
Implemented: N
Tested: N
Accepted: N
Missing backend: 0
Mock-only production features: 0
Unowned UI controls: 0
```

Release gate requires every last zero condition.
