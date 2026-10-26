# 28 — RELEASE AND OPERATIONAL GATES

## Supported environment declaration

Every release declares:
- Windows architecture/version;
- tested Android API/vendor matrix;
- tested Facebook app versions/locales;
- bundled/pinned ADB;
- scrcpy server/client versions;
- database schema version.

## Upgrade gate

Before updating:
- Electron;
- Node baseline;
- native SQLite module;
- scrcpy server/client;
- Facebook selector profile;
- ADB platform-tools

run targeted compatibility suite.

## Clean-machine test

Install on a Windows machine without dev toolchain.

Verify:
- app starts;
- bundled runtime works;
- DB initializes;
- ADB is available;
- device discovery works;
- no CDN dependency.

## Migration test

For each DB schema migration:
- old fixture DB;
- backup;
- migrate;
- integrity check;
- rollback/recovery scenario.

## Installer/uninstaller

Uninstaller must not silently delete user DB/backups unless user explicitly selects data removal.

## Code signing

If distributing broadly, sign Windows builds.

Unsigned development builds remain clearly identified as development.

## Auto-update

Not required for first development milestone, but updater must:
- verify signatures/checksums;
- not update during critical active transaction;
- preserve DB/data;
- run migration gate.

## Production support bundle

Diagnostic export includes:
- app version;
- build SHA;
- DB schema version;
- relevant logs;
- device metadata;
- redacted screenshots/XML;
- job/transaction timeline.

Never include Facebook password or 2FA secret.
