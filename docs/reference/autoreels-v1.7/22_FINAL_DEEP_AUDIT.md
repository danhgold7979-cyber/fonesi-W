# 22 — FINAL DEEP AUDIT

## Result

Business requirements and UI behavior are sufficiently specified for implementation.

However, four technically risky assumptions must be proven on real Android devices before the project is allowed to build later automation phases on top of them:

1. embedded scrcpy video/control architecture;
2. PC-media staging -> Android MediaStore -> exact Facebook picker selection;
3. Unicode/emoji text injection into Facebook fields;
4. actual device-wide Proxy behavior, especially SOCKS/auth proxy types.

These are not optional experiments. They are **technical feasibility gates**.

## A. Critical newly-identified requirement — media staging

The campaign media exists on the PC.

Facebook Android can only select media available to Android/MediaStore.

Therefore every publish job requires a staging lifecycle:

```text
PC source file
-> validate snapshot fingerprint
-> check device free storage
-> push one job-specific file to Android
-> verify transfer
-> index into MediaStore
-> verify selectable media
-> Facebook picker chooses exact staged media
-> retain staging until publish transaction resolved
-> cleanup after safe terminal state
```

Without this pipeline, “select video” has no reliable backend.

See `23_MEDIA_STAGING_AND_TEXT_INPUT.md`.

## B. Critical — exact media picker identity

One device has one active automation job, so the staging design should exploit this:

- use a dedicated AutoReels staging album/folder;
- keep exactly the current job's selectable staged file there when possible;
- give staged file a unique job-based filename;
- do not rely only on “first/newest thumbnail” when multiple candidates exist;
- preserve staged file while POST_PENDING is unresolved.

If exact selection is not provable, stop with NEEDS_REVIEW rather than upload a potentially wrong video.

## C. Critical — Unicode text

`adb shell input text` is not accepted as the primary caption/comment mechanism.

Primary text strategy:

```text
scrcpy control / clipboard set
-> focus field
-> paste
-> read back/verify where possible
```

This is needed for:
- Vietnamese;
- emoji;
- hashtags;
- URLs;
- punctuation.

Fallback strategies must be explicitly tested and cannot silently mangle text.

## D. Critical — embedded scrcpy

The native scrcpy desktop client is excellent, but FINAL V17 requires streams rendered **inside the Electron UI**.

Production must not assume native scrcpy SDL windows can simply become React canvases.

Technical spike must compare:
- official scrcpy server/protocol;
- Tango / `@yume-chan/*` Node/TypeScript client components;
- Chromium WebCodecs decoding;
- control messages;
- lifecycle/reconnect behavior.

The client/server pair must be pinned and tested together.

## E. Critical — Proxy reality

Checking a proxy from Windows is not proof that Facebook Android is using it.

For each supported proxy type, implementation must prove:

```text
configured
-> Android routing changed
-> traffic actually exits through expected route
-> Facebook remains functional
```

Android system HTTP proxy does not imply generic SOCKS/auth support for all apps.

Do not label a proxy type “supported on device” until a real-device adapter has passed this test.

It is acceptable for the proxy parser/checker to understand more types than the first device-routing adapter supports, but UI must show adapter support accurately.

## F. Android/Facebook compatibility

Automation eligibility is separate from device registration.

A device can be registered and manually controlled even when its Android/Facebook combination is not yet certified for automation.

Record:
- Android API/version;
- model/vendor;
- resolution/DPI;
- orientation;
- Facebook package/versionCode/versionName;
- UI locale.

Unknown/unsupported Facebook UI version:

```text
AUTOMATION_UNSUPPORTED
```

Manual control remains available.

## G. Facebook app scope

MVP target:

```text
com.facebook.katana
```

Facebook Lite or other packages require separate adapters/change request.

## H. Locale

Selectors should prefer resource IDs/accessibility properties.

Text fallback is locale-aware.

Initial automation certification should cover the actual production fleet locale(s), recommended:
- Vietnamese;
- English fallback.

Unknown locale may require a selector pack before automated posting is enabled.

## I. Facebook update handling

At preflight:

```text
read installed package version
-> resolve supported selector profile
```

If Facebook auto-updates outside tested profiles:

```text
APP_VERSION_UNSUPPORTED
-> NEEDS_REVIEW / disable posting automation
```

Do not guess selectors on an unknown production version.

## J. Input coordinate correctness

Group-control coordinate mapping must account for:
- frame dimensions;
- Android rotation;
- scrcpy content dimensions;
- letterbox/crop;
- navigation insets where applicable.

Mapping uses the video content rectangle, not merely the HTML element rectangle.

## K. App lifecycle

Application must be single-instance for one data root.

Explicit Quit:
1. stop accepting new jobs;
2. checkpoint scheduler;
3. stop or checkpoint workers at safe boundary;
4. persist current states;
5. close streams/processes/tunnels;
6. checkpoint SQLite WAL;
7. exit.

Window Close with background enabled only hides to tray.

## L. Windows sleep/hibernate

On resume:
- calculate scheduler gap;
- mark due jobs OVERDUE/QUEUED according to policy;
- reconnect devices;
- preflight jobs;
- do not blindly replay an in-flight publish.

## M. Cancellation

Before POST_INTENT:
- job may safely cancel at a state-machine safe point.

After POST_PENDING:
- cancellation cannot skip publish recovery.
- transaction is resolved first.

## N. External process cleanup

Track:
- adb processes/server relationship;
- scrcpy server sessions;
- ADB forwards/reverses;
- temporary files;
- media staging;
- diagnostic processes.

Crash/restart reconciles stale resources.

## O. Other ADB-based tools

This PC already contains another tool shipping its own ADB.

Phase 2 must test coexistence.

Do not silently kill another product's ADB server unless project policy explicitly permits it.

Evaluate:
- shared standard ADB server;
- dedicated server port;
- operational rule forbidding simultaneous device control by competing tools.

Record the proven approach.

## P. Data growth

No hard business limit does not mean no resource policy.

Use bounded:
- thumbnail workers;
- ADB transfers;
- APK installs;
- account scans;
- diagnostics capture;
- DB batches.

Use virtualization/pagination and indexed queries.

## Q. SQLite

Recommended:
- WAL;
- foreign keys;
- busy timeout;
- transactions;
- DB worker thread or serialized DB service for large operations;
- backup before migrations.

Avoid long synchronous bulk work on Electron UI/Main event loop.

## R. Logging and diagnostics

Every external operation has:
- operation ID;
- device ID;
- job ID where applicable;
- start/end timestamp;
- structured error code;
- duration;
- redacted parameters.

Logs rotate and have retention.

Screenshots/XML diagnostics have separate retention and user-visible export.

## S. Disk full

Before:
- staging media;
- diagnostics;
- thumbnail generation;
- DB backup

check/handle disk-full failures.

`DISK_FULL` is not retried endlessly.

## T. Media mutation

Jobs snapshot:
- media path;
- size;
- fingerprint.

If source media changes after job creation:

```text
MEDIA_CHANGED
```

Do not post silently changed content.

## U. Campaign deletion

Campaign with pending/nonterminal jobs cannot be hard-deleted silently.

Options:
- archive campaign;
- cancel safe jobs;
- retain job/history rows.

## V. Device deletion

Removing a device registration cannot cascade-delete posting history.

Pending jobs become target/device unavailable according to user action.

## W. Notifications

At minimum local tray/in-app notifications for:
- NEEDS_REVIEW;
- job failure;
- device offline when overdue jobs exist;
- disk critical;
- unsupported Facebook version.

## X. Production fake-data ban

All prototype random/simulated:
- devices;
- proxy status;
- CPU/GPU values;
- Facebook metrics;
- job success;
- screenshots

must be absent from normal production runtime.

See completeness audit.
