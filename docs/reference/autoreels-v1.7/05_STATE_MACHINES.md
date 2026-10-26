# 05 — STATE MACHINES

## Job

```text
DRAFT
  -> SCHEDULED
  -> QUEUED
  -> PREFLIGHT
  -> RUNNING
  -> POST_INTENT
  -> POST_PENDING
  -> POSTED
  -> COMMENT_INTENT? 
  -> COMMENT_PENDING?
  -> SUCCESS
```

Side states:

```text
OVERDUE
WAITING_DEVICE
WAITING_NETWORK
FILE_MISSING
TARGET_MISSING
NEEDS_REVIEW
FAILED
CANCELLED
```

## Login session

```text
UNKNOWN
LOGIN_REQUIRED
LOGIN_OK
SESSION_EXPIRED
CHECKPOINT
```

CHECKPOINT => NEEDS_REVIEW.

## Identity access

```text
AVAILABLE
ACCESS_UNKNOWN
NOT_SEEN
NOT_FOUND
NEEDS_REVIEW
```

A single missed scan yields `NOT_SEEN`, not deletion.

## Publish

```text
NONE
POST_INTENT
POST_PENDING
POSTED
VERIFY_AMBIGUOUS
NEEDS_REVIEW
```

`POST_PENDING` cannot transition back to “click Publish” without first proving no post exists.

## Comment

```text
NONE
COMMENT_INTENT
COMMENT_PENDING
COMMENTED
COMMENT_FAILED
```

Retry from `COMMENT_FAILED` affects comment only.

## Device ownership

```text
IDLE
AUTOMATION_OWNED
MANUAL_PENDING
MANUAL_OWNED
RECOVERING
```

Automation and manual ownership are mutually exclusive.

## Facebook UI states

Minimum classifier vocabulary:

```text
APP_CLOSED
HOME
LOGIN
CHECKPOINT
PROFILE_MENU
PROFILE_SWITCHER
IDENTITY_HOME
CREATE_MENU
REEL_PICKER
REEL_EDITOR
REEL_DETAILS
PUBLISHING
POST_VIEW
COMMENTS
POPUP_KNOWN
POPUP_UNKNOWN
UNKNOWN
```

## Workflow rule

Every transition:

```text
detect current state
-> resolve semantic action
-> execute
-> wait until action completes or timeout
-> verify expected new state
-> record diagnostics
-> random wait
-> next
```

Random wait never substitutes for state verification.
