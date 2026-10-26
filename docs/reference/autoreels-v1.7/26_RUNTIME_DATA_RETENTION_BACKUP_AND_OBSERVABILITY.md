# 26 — RUNTIME DATA / RETENTION / BACKUP / OBSERVABILITY

## Development source root

```text
E:\AutoReels
```

Source code and project-local tools live here.

## Runtime data separation

Do not commit mutable user data into Git.

Recommended development runtime root:

```text
E:\AutoReels\.data
```

Production-installed default:

```text
%LOCALAPPDATA%\AutoReels
```

Configurable later if portable deployment is required.

## Runtime directories

```text
data/
db/
logs/
diagnostics/
thumbnails/
temp/
backups/
staging-index/
```

Android staged media itself is on devices.

## Database backups

Automatically:
- before migration;
- daily while app is used;
- before high-risk repair operation.

Retention recommendation:
- latest 7 daily;
- latest 4 weekly;
- configurable.

Backup verification:
- open SQLite backup;
- run integrity check.

## Logs

Structured JSON or structured text.

Fields:
- timestamp;
- level;
- operationId;
- deviceId;
- campaignId;
- jobId;
- module;
- errorCode;
- durationMs.

Redact:
- proxy passwords;
- sensitive clipboard text;
- private diagnostic content where possible.

Rotate by size/date.

## Diagnostics

Capture on significant automation error:
- screenshot;
- UIAutomator XML;
- Facebook version;
- device metadata;
- recent action trail;
- current state;
- job snapshot ID/hash.

Retention configurable.

## Thumbnail/cache

Thumbnail cache is rebuildable.

May be evicted by LRU/age when disk pressure rises.

Do not delete source media.

## Disk pressure

Monitor relevant disks.

Threshold states:
```text
OK
LOW
CRITICAL
FULL
```

At critical:
- stop nonessential diagnostics/thumbnails;
- prevent large media staging if insufficient;
- notify user.

## Single instance

Use Electron single-instance lock for one data root.

Second instance focuses first window or exits cleanly.

## Notifications

Tray/in-app notifications for:
- NEEDS_REVIEW;
- failed job;
- device offline with overdue jobs;
- disk critical;
- unsupported Facebook version;
- DB backup/migration failure.

## Privacy

Diagnostics remain local unless user explicitly exports/shares them.
