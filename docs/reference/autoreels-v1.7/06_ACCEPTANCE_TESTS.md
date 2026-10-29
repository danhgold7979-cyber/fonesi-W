# 06 — ACCEPTANCE TESTS

## Device

- USB device appears/disappears live.
- LAN device appears/disappears live.
- one broken ADB session does not break other devices.
- reconnect works.
- multiple queued jobs on same phone run one at a time.

## Stream

- Overview shows multiple real devices.
- Ctrl+wheel wraps larger screens instead of overlap.
- single phone tab Ctrl+wheel scales phone.
- floating MASTER drag/resize works.
- offscreen preview throttles.
- global quality/FPS does not degrade focused MASTER.

## Manual group control

- drag-select several phones.
- Ctrl+A selects all when Overview has focus.
- broadcast tap to devices with different resolutions.
- broadcast swipe.
- worker pauses before manual ownership.
- worker re-detects state after manual ownership returns.

## Account/Page scan

- fresh logged-in Facebook session scanned.
- 3 accounts/profile groups discovered when present.
- variable number of Pages supported.
- scrolling scanner stops only after stable/no-new-item condition.
- one missed Page does not delete it.
- manual login required state shown.
- checkpoint becomes NEEDS_REVIEW.

## Metrics

- likes/followers snapshot stored.
- green positive delta.
- red negative delta.
- missing 7/30-day history shows dash.
- metric failure does not block posting.

## Campaign/media

- each Campaign has separate folder.
- thousands of files remain responsive.
- add/delete/reappear behavior correct.
- ignored media does not reappear.
- filename -> caption default correct.
- Excel round trip preserves fields.

## Scheduler

- default 06:00 / 12:00 / 18:00.
- arbitrary videos/day.
- same time on different phones allowed.
- same phone conflict marked.
- anti-conflict spreads by 60–120 minutes.
- timezone survives restart.

## Publish

- wrong account => switch or stop.
- wrong Page => switch or stop.
- Popup recovery finite.
- kill desktop app immediately after Publish click.
- restart verifies post and avoids duplicate.
- ambiguous verification becomes NEEDS_REVIEW.
- no second Publish click without proof.

## Comment

- empty comment skips.
- failed comment retries comment only.
- posted Reel is not duplicated.

## Folder/device failures

- device disconnected at scheduled time.
- file missing at scheduled time.
- network unavailable.
- Proxy check fails.
- VPN app missing.
- Facebook app crashes.

Each has deterministic state and recovery path.

## Persistence

- crash/restart preserves queue.
- stale device lock reconciles.
- pending post transaction recovered.
- database backup/restore succeeds.

## Security

- renderer cannot execute arbitrary command.
- IPC rejects invalid device IDs/paths.
- local service not externally bound.
- logs redact proxy secrets.
- no password/2FA persistence.


## Media staging

- source fingerprint matches Job snapshot.
- device-low-storage prevents staging safely.
- large video transfer timeout/progress behavior.
- MediaStore indexes pushed file.
- Facebook picker selects exact staged media.
- POST_PENDING retains staged file.
- successful post cleans staging later.
- changed source file becomes MEDIA_CHANGED.

## Unicode input

- Vietnamese caption exact.
- emoji exact.
- URL exact.
- comment exact.
- no adb-input-text corruption.

## Compatibility

- unsupported Facebook version blocks automation with diagnostics.
- manual screen/control still available where technically supported.
- rotation changes do not corrupt normalized input mapping.

## Operational

- Windows sleep/resume with due jobs.
- explicit Quit while jobs queued/running.
- disk full.
- DB backup before migration.
- second app instance.
- other ADB-based software coexistence policy test.
