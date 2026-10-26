# 04 — DATABASE SCHEMA

This is a logical schema. Exact SQL types/indexes are decided during Phase 1.

## devices

```text
id
name
adb_serial UNIQUE
transport
ip
android_version
model
state
last_seen_at
created_at
updated_at
```

## device_connections

```text
id
device_id
connected_at
disconnected_at
transport
ip
metadata_json
```

## login_sessions

```text
id
device_id
display_name
session_state
last_verified_at
last_scan_at
created_at
updated_at
```

No passwords or 2FA secrets.

## identities

```text
id
login_session_id
identity_type = PERSONAL | ADDITIONAL_PROFILE | PAGE
stable_fingerprint
display_name
avatar_hash
access_state
last_seen_at
missing_scan_count
created_at
updated_at
```

Do not delete after one missed scan.

## identity_metrics

```text
id
identity_id
captured_at
likes
followers
```

Indexes on `(identity_id, captured_at)`.

## campaigns

```text
id
name
device_id
login_session_id
target_identity_id
folder_path
timezone
default_audience
default_remix
default_share_story
network_mode
created_at
updated_at
```

## media

```text
id
campaign_id
path
filename
fingerprint
size_bytes
mtime
thumbnail_path
caption
hashtags
comment
audience
remix
share_story
status
created_at
updated_at
```

## ignored_files

```text
id
campaign_id
path
fingerprint
ignored_at
```

## schedule_slots

```text
id
campaign_id
local_time
ordinal
enabled
```

Default:
- 06:00
- 12:00
- 18:00

## jobs

```text
id
campaign_id
device_id
media_id
login_session_id
target_identity_id
scheduled_at_utc
timezone
state
idempotency_key UNIQUE
snapshot_json
queue_order
created_at
updated_at
```

`snapshot_json` freezes content/network/options used by the job.

## job_attempts

```text
id
job_id
attempt_number
started_at
ended_at
result
error_code
diagnostic_id
```

## post_transactions

```text
id
job_id
state
intent_at
publish_clicked_at
verified_at
external_post_fingerprint
```

## comment_transactions

```text
id
job_id
state
content_hash
intent_at
verified_at
```

## proxy_profiles

```text
id
type
host
port
username_encrypted_or_reference
password_encrypted_or_reference
last_check_at
last_check_result
```

Do not write credentials into logs.

## device_network_state

```text
device_id
mode = DIRECT | PROXY | VPN
proxy_profile_id
vpn_package
verified_at
verification_result
```

## diagnostics

```text
id
device_id
job_id
created_at
type
message
screenshot_path
uiautomator_xml_path
metadata_json
```

## app_settings

```text
key PRIMARY KEY
value_json
updated_at
```

## Required constraints

- one active automation owner per device;
- unique publish idempotency key;
- no cascaded deletion of posted history because source media disappeared;
- transactions around job state + post transaction state changes.
