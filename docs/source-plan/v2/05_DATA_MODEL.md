# Data model và scope

## Các thực thể

| Entity | Trường/quan hệ chính | Invariant |
|---|---|---|
| AppDefinition | id, package profiles, target/media capabilities | Catalog khác certification |
| CapabilityCertification | app/device profile, version/locale, workflow hash, evidence | Exact profile match mới cho automatic execution |
| Device | ID, stable hardware evidence, metadata, enabled, capability | Enabled không đại diện online |
| DeviceConnection | deviceId, transport, endpoint, session, lastSeen | Nhiều transport có thể thuộc một device |
| DeviceLease | deviceId, ownerKind/ID, generation, acquired/expires | One current owner; stale generation không gửi input |
| LoginSession | deviceId/appId, display/state, verifiedAt | Không password/2FA/private tokens |
| Identity | loginSessionId/appId, kind, stable fingerprint, confidence | Không dùng tên làm key; không xóa sau một scan thiếu |
| IdentityMetric | identityId, capturedAt, likes/followers nullable | Missing history khác zero |
| Workflow | id, appId, name, kind, archived | Không thuộc một test phone |
| WorkflowDraft | workflowId, revision, graphBundle, schema refs | Mutable optimistic revision |
| WorkflowVersion | id, workflowId, version, canonical hash, frozen bundle | Immutable dependency closure |
| Graph | id/ref, nodes, edges, groups, input/output schema | Scope graph/node IDs xác định |
| Process | id, appId, workflowVersionId/draftRef, device/account/target refs | Binding refs hợp lệ; có thể draft unassigned |
| ProcessFields | processId, typed values, mapping/schema version | Không lẫn giữa Process IDs |
| SourceBinding | processId, folder/registered file refs, recursive/watch/reconcile | Path do host đăng ký; source không bị auto delete |
| ScheduleProfile | processId, timezone, date, slots, weekdays, overdue/jitter/scope | Lưu theo Process, không global mutable |
| MediaAsset | id, sourceRef/path, content hash, size, mtime, kind, metadata | Strong fingerprint khi freeze/preflight |
| ContentItem | id, processId, schemaVersion, typed row fields, status | Row index/STT không phải ID |
| ContentAsset | contentItemId, assetId, ordinal, role | Giữ ordering của file[] |
| IgnoredSource | sourceBindingId, path/fingerprint, ignoredAt | Reconcile không tự làm file ignored xuất hiện lại |
| SchedulePreview | token, process/job set revisions, generated instants/hash | Apply không re-randomize hoặc đổi scope |
| Job | id, occurrenceKey, process/device, scheduledUtc, state, priority | Unique generation key; one active job/device |
| JobSnapshot | jobId, workflow/dependency/schema/content/target/network hashes | Immutable posting config |
| Run / RunFrame | jobId/mode, call stack, locals, node/attempt/cursor | DEBUG/TRACE/REAL tách biệt |
| JobAttempt / NodeAttempt | run/node, timestamps, result/errors/evidence | Operation correlation, no fake SUCCESS |
| ExternalEffect | job/node/effectKind/key, payloadHash, intent/attempt/result | Attempt marker bền trước input gây side effect |
| VerificationEvidence | effectId, provider/identity, externalId/fingerprint, confidence | Ambiguous vẫn ambiguous |
| CommentEffect | postEffectId, ordinal/contentHash/idempotencyKey | Retry không repost, từng comment riêng |
| StagedAsset | job/device, owned path, source hash, MediaStore ref, state | Không delete path ngoài ownership ledger |
| ReviewCase / Resolution | effect/run, evidence, actor, reason, decision | Resolution không tự publish lại |
| NetworkProfile / DeviceNetworkState | credentialRef, desired/observed route, verifiedAt | Proxy/VPN mutually exclusive, verify thật |
| Diagnostic / Notification | op/device/run refs, severity, asset refs, retention | Local/redacted; export có scope |
| WorkspaceSetting / EditorPreference | theme/layout/history preferences | Không lẫn Process policy |

Không bắt buộc một entity = một bảng ngay lập tức. Migration phải ghi cụ thể đâu là table, typed JSON payload, immutable blob hoặc derived view. Renderer không query SQL trực tiếp.

## Database constraints

- Foreign keys enabled, WAL, busy timeout, bounded transactions; migration có checksum và applied version.
- Unique workflow version `(workflow_id, version)`, graph/node/edge identifiers theo schema, occurrence keys và effect keys theo semantic scope.
- Constraint/transaction cho active job/device cùng lease generation, không chỉ mutex trong renderer.
- Archive workflow/process/device không cascade-delete posted history/effect journal.
- Identity fingerprint uniqueness trong đúng app/session scope; filename/hash không UNIQUE toàn workspace nếu nghiệp vụ cho phép tái sử dụng asset.
- Index jobs `(state,scheduled_at_utc)` và `(device_id,state,queue_order)`; identities/session; metrics identity/time; content process/id; source/path/fingerprint.
- DB backup bằng API nhất quán khi WAL hoạt động; không chỉ copy file `.db` đang mở.

## Typed values

text = string; number = finite number; boolean = boolean; url = validated optional URL; identity = registered IdentityRef; datetime = instant + timezone metadata theo field policy; file = AssetRef; file[] = ordered AssetRef[]; list = typed values array. `0`, `false`, `''`, `[]` và “missing” khác nhau.

Schema keys dùng `[A-Za-z_][A-Za-z0-9_]*`, không dùng `__proto__`, `prototype`, `constructor` và reserved roots. Config map không dựa prototype chain. Typed import từ JSON/CSV có preview conversion/loss/error; không ép mọi giá trị qua String.

## Context transitions

`selectProcess(processId)` load dữ liệu đúng ID; `setBindings(processId, patch, expectedRevision)` xác thực refs và effects lên mapping. Đổi testDevice chỉ chạm Inspector preferences. Library filter chỉ chạm list query. Không giữ cache keyed bằng tên hoặc colon-concatenated IDs làm chân lý.

Clone: workflow bundle copy đủ dependency/schema, IDs được remap theo scope; Process clone có Process/Content IDs mới, source asset refs reuse nếu cho phép, clear lịch/jobs/history và credential refs theo preview. Không clone phiên Facebook hoặc tạo account/Page thật.

## Migration từ bản HTML

- Chấp nhận import qua một adapter schema-versioned, không `state = data.state` trước validation.
- `workflowBundles` ưu tiên bundle full; `graphs['wf:'+id]` chỉ main legacy, thiếu dependencies/schema thì report unresolved, không tự bịa đã tương thích.
- `state.contexts` được chuyển thành Process entities, normalize bindings sau kiểm tra collisions/refs.
- Prototype rows chỉ có metadata browser: đánh dấu NEEDS_SOURCE_REBIND; không coi path demo/localRef là đường dẫn đọc được thật.
- Prototype history/metrics/mock accounts/devices vào dev fixtures hoặc archive riêng, không vào real runtime counts.
- Versions với draft counter/snapshot mơ hồ giữ raw provenance; tạo canonical version number mới có receipt, không gán nhầm v4 cho nội dung v3.
- Media/content/job lịch V1.7 nếu có DB thật cần migration riêng; pack tài liệu hiện không cung cấp DB đó.
