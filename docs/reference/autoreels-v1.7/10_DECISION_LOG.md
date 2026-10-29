# 10 — DECISION LOG

## FINAL decisions

### D-001 — Scale
No hard business cap on number of devices or videos.

### D-002 — UI freeze
Canonical UI/behavior reference is FINAL V17.

### D-003 — Production architecture
Do not build production as one HTML file. Use Electron + TypeScript + React + Vite.

### D-004 — Facebook login
Manual on Android. No stored Facebook password/2FA secret.

### D-005 — Account/Page discovery
Automatic UI scan after login; UIAutomator/accessibility first, OCR fallback.

### D-006 — Campaign
One Campaign owns one media folder.

### D-007 — Jobs
One active automation job per device. Extra work queues.

### D-008 — Job immutability
Created jobs store immutable snapshots of their posting configuration.

### D-009 — Random delay
Delay starts only after action completion and verification.

### D-010 — Publish idempotency
Never blindly re-click Publish from a pending/ambiguous transaction.

### D-011 — Comment
Comment is a separate transaction; comment failure never reposts Reel.

### D-012 — VPN/Proxy
Mutually exclusive on one device.

### D-013 — Manual group control
MASTER input is normalized and broadcast to selected devices; it shares device ownership lock with automation.

### D-014 — Preview resource policy
Focused phone high quality; visible previews configurable; offscreen last-frame/about 1 FPS.

### D-015 — Timeline
No max videos/day; defaults are 06:00, 12:00, 18:00 for three daily slots.

### D-016 — Metrics
Like/Follow and 1D/7D/30D values are shown inside the Nick/Page combobox. Missing history shows `—`.

### D-017 — Security challenge
CAPTCHA/checkpoint/2FA/identity review => `NEEDS_REVIEW`; no bypass.

### D-018 — Persistence
SQLite mandatory. Restart recovery is part of the architecture, not an afterthought.

### D-019 — Open source
Prefer maintained official/open-source dependencies listed in the dependency document over new custom implementations.

### D-020 — Database time
Persist job timestamps in UTC and convert for display using campaign/local timezone.

## Change control

Any future change to D-001 through D-020 must:
1. identify the decision ID;
2. explain the reason;
3. list impacted schema/modules/tests;
4. update this file before code is merged.

### D-021 — UI/backend completeness
Every shipped interactive control must be traced to a real backend contract or be explicitly UI_ONLY. Mock/placeholder production controls are forbidden.

### D-022 — Phase completion
A phase cannot be completed until all traceability features owned by that phase are ACCEPTED.

### D-023 — Prototype workflow buttons
Step/simulate-error/reset workflow controls are DEV_ONLY diagnostics and are hidden in normal production builds.

### D-024 — Clear background semantics
“Xóa nền” means force-stop managed application(s), primarily Facebook, and verify state. OEM-wide “clear all recents” is a separate adapter feature if ever required.


### D-025 — Device media staging
PC video is pushed/staged to Android and MediaStore before Facebook media selection. Exact selection must be verified.

### D-026 — Unicode text input
General caption/comment input uses a tested Unicode-capable control/clipboard mechanism; plain `adb input text` is not the primary strategy.

### D-027 — Automation compatibility
Registration/manual control may work on devices not yet certified for Facebook automation. Unknown Facebook version/locale can block automation without blocking manual control.

### D-028 — scrcpy compatibility set
scrcpy server and embedded client/protocol versions are pinned and upgraded together only after compatibility tests.

### D-029 — Technical Risk Gate
High-risk assumptions in `27_TECHNICAL_RISK_GATE.md` must be proven before dependent full automation phases.

### D-030 — Production proxy support is adapter-based
A parsed/checkable proxy type is not automatically a supported Android routing type. Device support requires proven routing + verification adapter.

### D-031 — Runtime data separation
Source lives at `E:\AutoReels`; mutable data/cache/logs are excluded from Git and use a dedicated runtime data root.

### D-032 — Production fake-data ban
Prototype simulation/random success data is forbidden in normal production runtime.


### D-033 — Android staging ownership and cleanup
AutoReels must never wipe or manage arbitrary user videos on the Android device.

AutoReels owns only its dedicated staging area, for example:

```text
/sdcard/Movies/AutoReels/
```

Per device:
- only the active job's media is staged when possible;
- staged filenames are job-unique;
- staging is retained while POST_PENDING / publish verification is unresolved;
- initial cleanup policy is after SUCCESS;
- cleanup removes the staged file and reconciles MediaStore;
- DCIM, Camera, Downloads, messaging media, and non-AutoReels folders are never deleted.
