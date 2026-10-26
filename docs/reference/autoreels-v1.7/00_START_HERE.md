# 00 — START HERE

## Product

Desktop application for managing Android devices and scheduling/operating Facebook Reels through the Facebook Android app UI.

Core characteristics:

- No hard business limit on number of registered devices.
- No hard business limit on number of videos.
- Android devices can connect by ADB USB or ADB over LAN.
- Each device owns exactly one automation worker and at most one active job.
- Facebook login is manual on each Android session.
- The tool discovers logged-in Facebook profiles/Pages through UI automation.
- Campaigns own their own video folders and schedule configuration.
- Manual multi-device control and automation use the same device-control lock.
- Posting is state-machine-driven, not coordinate-script-driven.

## Mandatory safety boundaries

Do not implement:

- CAPTCHA bypass.
- 2FA bypass.
- checkpoint / identity-verification bypass.
- theft or extraction of Facebook passwords/tokens/private app databases.
- stealth device fingerprint spoofing intended to bypass protections.
- automatic proxy/VPN rotation intended to evade platform protections.

When Facebook requires security review:

`NEEDS_REVIEW`

and automation stops for that device/session.

## Production architecture rule

The frozen HTML is a UI/behavior reference only.

Production must be implemented as a multi-file application, recommended:

- Electron
- TypeScript
- React
- Vite
- SQLite
- typed IPC
- device workers

Do not turn the single HTML prototype into the production codebase.
