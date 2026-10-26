# Kiến trúc và ranh giới module

## Topology

```text
React Studio UI (6 routes, editor, typed forms)
             ↓ narrow typed preload API
Electron Main (sender validation, dialogs, lifecycle, orchestration)
             ↓
Domain services ─ Workflow compiler/interpreter ─ Scheduler
       ↓                    ↓                     ↓
SQLite service        Effect journal        DeviceWorkerManager
       ↓                    ↓                     ↓
Backups/refs           App adapters        ADB + scrcpy + snapshots
```

Cloud/browser development có thể dùng host adapter nội bộ trên loopback cho những chức năng authoring cần test, nhưng không là kiến trúc remote device bridge mặc định. Desktop đóng gói không cần mở HTTP server công khai.

## Repository dự kiến

```text
apps/desktop/src/main/          lifecycle, validated IPC, dialogs
apps/desktop/src/preload/       small allowlisted API
apps/desktop/src/renderer/      shell/devices/editor/processes/schedule/history
packages/contracts/            schemas, DTOs, capabilities, node registry
packages/domain/               entity/policy invariants
packages/database/             migrations/repositories/backup
packages/editor/               commands, selection, geometry, undo history
packages/workflow-engine/      validator/compiler/IR/DSL/interpreter
packages/processes/            process lifecycle, scoped config
packages/media/                assets/watchers/hash/probe/thumbnail
packages/scheduler/            recurrence/preview/due queue/timeline
packages/device-runtime/       registry/transports/lease/ADB/streams
packages/ui-inspector/         XML/frame/selector snapshots
packages/app-adapters/         fb/lite/ig/tt/th versioned plugins
packages/execution/            run orchestration/preflight/effect ledger
packages/staging/              owned-media namespace/MediaStore/reconcile
packages/review/               manual resolutions/evidence
packages/network/              proxy/VPN capability-based adapters
packages/apk/                  package manager queues
packages/diagnostics/          structured logs/export/redaction
packages/import-export/        schema migration/preview/atomic import
tests/unit/ integration/ ui/ hardware/ packaging/
docs/reference/                immutable input material
docs/source-plan/v2/           current plan
docs/evidence/                 implementation receipts by revision
vendor/                        only verified redistributed binaries
```

Không tạo mọi package rỗng ở P00. Chỉ scaffold những package có trách nhiệm của increment hiện tại; contracts giữ dependency direction không vòng.

## Main / renderer / workers

- Renderer chỉ có view state, editor state chưa commit và user intent. Không giữ app/device/process trong một global mutable object dùng chung mọi route.
- Domain entities lấy từ store/service theo ID; libraryAppFilter, editorWorkflowId, editorGraphStack, inspectorTestDeviceId, selectedProcessId, selectedDeviceIds là state riêng.
- Main có lifecycle và quyền privileged, nhưng không decode toàn bộ video/hash/import lớn đồng bộ trên event loop.
- DB serialized worker/service, stream transport bounded, hashing/thumbnail/diagnostics có queues riêng. DeviceWorker là logical actor, không yêu cầu một OS thread mỗi điện thoại.
- Mọi lệnh đổi trạng thái thiết bị được worker authorize bằng lease/fencing; không có subsystem gọi ADB tap trực tiếp vòng qua actor.
- Module network/APK phải phối hợp ownership dù không phải node đang chạy.

## Luồng chỉnh sửa và lưu

Editor command → patch local draft/undo stack → validate form → autosave request với expectedRevision → Main validation → DB transaction → ACK revision → UI saved.

Nếu có edits mới trong lúc save cũ đang chạy, không để ACK cũ xóa dirty của edits mới. Conflict không auto overwrite. Save failure giữ local unsaved draft, cho export/resolve. Close có dirty handling; crash resilience không dựa `beforeunload` là cơ chế lưu chính.

Workflow version là immutable bundle snapshot gồm dependency closure và schema. Lập lịch tham chiếu version ID/hash; autosave draft không tác động version/job cũ.

## Stream/inspector boundary

Host giữ ADB/socket/session. Renderer nhận authorized stream channel, bounded frame buffers và control intents. Không truyền mỗi frame thành JSON/base64, không bật thêm full encoder cho mọi cửa sổ.

Snapshot `{snapshotId, deviceId, appProfileId, frameRef, xmlRef, frameDimensions, rotation, insets, capturedAt, leaseGeneration}`. Selector từ snapshot phải kiểm tra age/profile/geometry. Clipboard không ghi raw text vào logs; capability unsupported không đổi sang plain adb input text âm thầm.

## Runtime/plugin boundary

Compiler tiêu thụ node registry + workflow bundle + typed schema, không biết tọa độ Facebook cố định. Interpreter chạy IR và gọi handler theo type. Handler nhận context hữu hạn, không có arbitrary Main/DB/shell object.

App adapter cung cấp detection, target verification, compose/verify flows theo version/locale/capability. Device primitives chỉ làm thao tác cơ học, không tự kết luận đã đăng bài. Journal/recovery là tầng core, không copy vào từng adapter rồi làm sai khác.

## Các spike phải đi trước phụ thuộc

Chọn SQLite driver thực tế dưới Electron; compare embedded scrcpy/Tango/WebCodecs; exact media picker; Unicode; post signals; ADB coexistence; proxy routing. Quyết định có evidence, không cài hết thư viện được liệt kê trong pack trước khi biết cần dùng.
