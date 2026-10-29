# 23 — MEDIA STAGING AND ANDROID TEXT INPUT

## Media source

Campaign media remains on the Windows filesystem.

A job snapshot references the source file/fingerprint.

## Device staging root

Recommended logical root:

```text
/sdcard/Movies/AutoReels/
```

Per job:

```text
/sdcard/Movies/AutoReels/<job-id>/
```

or one single-current-job staging folder per device.

Final exact layout is validated against Facebook picker behavior during the Risk Gate.

## Staging state

```text
NOT_STAGED
STAGING
STAGED
INDEXING
MEDIASTORE_READY
SELECTABLE_VERIFIED
CLEANUP_PENDING
CLEANED
STAGE_FAILED
```

## Preflight

Before transfer:

- source exists;
- size/fingerprint still matches Job snapshot;
- device online;
- enough free device storage;
- staging root writable;
- no unresolved prior POST_PENDING staging cleanup conflict.

## Transfer

Use ADB sync/push with:
- timeout derived from file size;
- progress where possible;
- cancellation only before publish transaction begins.

Verify:
- destination exists;
- expected file size;
- hash when a compatible on-device hashing method is available;
- otherwise transfer success + size + strong source fingerprint record.

## Unique staged name

Use a job-unique name so picker verification is easier, e.g.:

```text
AR_<job-id>_<sanitized-original-name>.mp4
```

Do not alter the PC source file.

## MediaStore

After push:
- trigger media indexing using a tested method for supported Android versions;
- wait for observable readiness, not a fixed blind sleep.

The Risk Gate must prove Facebook picker can see the staged file.

## Exact selection

Selection confidence can use:
- dedicated staging album/folder;
- unique staged name if UI exposes it;
- thumbnail fingerprint;
- known MediaStore timestamp/dimensions/duration;
- single staged candidate.

Never select merely “the first tile” without proving the state.

## Cleanup

Safe cleanup after:
- POSTED and no later recovery needs the media;
- terminal pre-publish failure/cancel;
- explicit stale-staging reconciliation.

Keep file while:
- POST_PENDING;
- publish verification unresolved.

Cleanup failures are logged and retried separately; they do not repost.

## Media validation

Before scheduling/posting, capture where feasible:
- container/extension;
- duration;
- dimensions;
- orientation;
- file size.

A later media-probe implementation may use a maintained library/tool after license and packaging review.

Corrupt/unsupported media becomes:

```text
MEDIA_INVALID
```

## Text input

Primary strategy:

```text
scrcpy clipboard/control mechanism
-> set device clipboard
-> focus Facebook field
-> paste
-> verify text/state
```

Do not use plain `adb shell input text` as the general Unicode strategy.

Requirements:
- Vietnamese diacritics;
- emoji;
- URLs;
- newline behavior;
- hashtag;
- punctuation.

Clipboard privacy:
- record only hashes/redacted diagnostics where possible;
- optionally restore/clear temporary clipboard content after posting.

If text cannot be verified and corruption is possible, stop before Publish.


## Final ownership rule

**Never wipe the phone media library.**

AutoReels may delete only files it created inside its dedicated staging namespace.

It must never delete:
- DCIM/Camera media;
- Downloads outside AutoReels staging;
- user-created albums;
- messaging-app media;
- any path not positively owned by AutoReels.

Initial cleanup policy:

```text
SUCCESS
-> delete current job's staged file
-> reconcile/delete stale MediaStore entry
-> verify no stale AutoReels candidate remains
-> allow next job staging
```

If POST_PENDING / post verification is unresolved, retain the staged file.
