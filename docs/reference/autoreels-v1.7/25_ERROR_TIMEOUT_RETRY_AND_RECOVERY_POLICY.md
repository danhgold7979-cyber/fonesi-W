# 25 — ERROR / TIMEOUT / RETRY / RECOVERY POLICY

## Principles

1. Retry only idempotent/safe actions.
2. Publish is not generally retryable after click.
3. Comment retry cannot repost.
4. Every retry is bounded.
5. Every timeout transitions to a named state/error.
6. Unknown security/account state -> NEEDS_REVIEW.

## Error families

### Device

```text
DEVICE_OFFLINE
DEVICE_UNAUTHORIZED
DEVICE_BUSY
ADB_TIMEOUT
ADB_COMMAND_FAILED
DEVICE_STORAGE_LOW
DEVICE_STORAGE_FULL
```

### Stream

```text
STREAM_START_FAILED
STREAM_DISCONNECTED
DECODER_FAILED
CONTROL_CHANNEL_FAILED
```

### Media

```text
MEDIA_MISSING
MEDIA_CHANGED
MEDIA_INVALID
MEDIA_STAGE_FAILED
MEDIA_INDEX_FAILED
MEDIA_SELECTION_AMBIGUOUS
```

### Facebook

```text
FACEBOOK_NOT_INSTALLED
FACEBOOK_LOGIN_REQUIRED
FACEBOOK_SESSION_EXPIRED
FACEBOOK_CHECKPOINT
FACEBOOK_VERSION_UNSUPPORTED
FACEBOOK_STATE_UNKNOWN
ACCOUNT_NOT_FOUND
IDENTITY_NOT_FOUND
IDENTITY_MISMATCH
POPUP_UNKNOWN
```

### Network

```text
NETWORK_OFFLINE
PROXY_DEAD
PROXY_ADAPTER_UNSUPPORTED
PROXY_APPLY_FAILED
PROXY_VERIFY_FAILED
VPN_APP_NOT_FOUND
VPN_ADAPTER_UNSUPPORTED
VPN_ENABLE_FAILED
VPN_VERIFY_FAILED
```

### Publish/comment

```text
POST_CLICK_FAILED
POST_VERIFY_TIMEOUT
POST_VERIFY_AMBIGUOUS
COMMENT_SUBMIT_FAILED
COMMENT_VERIFY_FAILED
```

### Storage/database

```text
DISK_FULL
DATABASE_BUSY
DATABASE_CORRUPT
MIGRATION_FAILED
BACKUP_FAILED
```

## Retry metadata

Every error defines:

```text
code
message
retryable
retry_scope
max_attempts
backoff
requires_redetect
requires_review
```

## Default timeout categories

Exact values are tuned from real-device tests, but code uses named settings, not magic numbers:

```text
ADB_SHORT
ADB_TRANSFER
UI_TRANSITION
FACEBOOK_LOAD
MEDIASTORE_INDEX
UPLOAD_POST
POST_VERIFY
COMMENT_VERIFY
NETWORK_VERIFY
```

## Publish rule

Once `publish_clicked_at` exists:

```text
NO AUTOMATIC CLICK_PUBLISH RETRY
```

Timeout leads to verification/recovery.

## Cancellation

Safe cancel:
- before POST_INTENT at safe boundary.

After POST_INTENT:
- transition depends on whether Publish was actually clicked.

After POST_PENDING:
- resolve publish transaction first.

## Crash recovery

On startup:

1. load nonterminal jobs;
2. reconcile device connectivity;
3. inspect post/comment transactions;
4. clear/rebuild stale in-memory ownership locks;
5. recover pending staging;
6. resume only after semantic state detection.

## Windows sleep/resume

Resume handler:
- detect elapsed wall-clock gap;
- reconnect;
- re-query due jobs;
- mark overdue;
- preflight before execution.

## Graceful shutdown

Explicit Quit:
- scheduler stop intake;
- workers checkpoint;
- DB flush/WAL checkpoint;
- stream/process cleanup;
- bounded wait;
- exit.

Power loss is covered by transaction recovery, not graceful assumptions.
