# Tiến độ implementation

Checkpoint ngày 26/10/2026. Baseline sản phẩm V2.1, 15 phase/125 bước; status PLANNED trong source-plan là định nghĩa ban đầu. File này ghi implementation thực và phần còn thiếu; không suy từ số dòng code ra phần trăm hoàn thành. 125 tests hiện chạy là test cases thực, độc lập với 125 đơn vị nghiệm thu trong master plan.

| Phase | Đã có code/bằng chứng local | Chưa nghiệm thu toàn phase |
|---|---|---|
| P00 | Workspace Node/pnpm pinned, lockfile, strict TS/lint/unit/build, CI definition; install đã chạy | CI remote/Windows chưa chạy; reusable setup đã kiểm tra và lưu draft; environment chưa Publish |
| P01 | Open app registry, workflow wire schema/40 nodes, JSON-safe typed values, immutable/hash/readiness/state policies, narrow API DTOs | Event replay/full capability contracts sẽ hoàn thiện cùng services phụ thuộc |
| P02 | SQLite migrations v1–v5, workflows/full bundle/versions/clone/import, Process/preferences/content, snapshots/leases/effect journal, WAL backup/staged restore | Full workspace import preview và toàn bộ schema vận hành còn mở; Windows native acceptance UNRUN |
| P03 | React 6 routes, named sandboxed Electron preload, host validation, serialized DB worker, protected loopback host, theme/states/focus/save ACK | Windows DPI/multi-monitor/lifecycle chưa nghiệm thu; diagnostics/navigation states tiếp tục mở rộng |
| P04 | React Flow adapter, 40-node library, drag/resize/connect, insert/delete, undo/redo, duplicate, layout, properties/schema/subgraphs/version/export/import, partial shortcuts/context menus | Group/convert/edge reroute/full clipboard/layout preferences và một số shortcuts còn thiếu; chưa gọi full editor complete |
| P05 | Shape/topology/all-graphs validation, safe AST/template runtime, TRACE pure control flow/inline loops/subflow-local isolation, budgets/cancel/unsupported device actions | Pinned dependency resolver, typed subflow mapping/IR dominance và full debugger chưa xong; separate bodyGraphRef execution có lỗi unsupported rõ |
| P06 | Native folder/multi-file dialog → private DB grants, coordinator 2 scans/cancel/progress, watch debounce + 10s reconcile/restore, hash/probe/ledger/ignore/change/missing, Process source UI + media names/states, typed row/Process forms, CSV/JSON/XLSX round-trip + ZIP/formula budgets, stable-ID selection/DOM virtualization, bulk/import persisted preview→atomic apply/idempotency + before/after values, scope/revision/registered-ref gates | Native dialog/Windows chưa nghiệm thu; thumbnails/cache, explicit adopt changed files/rebind giữ ID qua host, Process clone/archive UI, migration mapping, inline/column menus và server query/cursor pagination còn thiếu; DOM virtualization không thay scale gate |
| P07 | Temporal/DST/jitter, SQLite persisted preview/hash/expiry/revisions, atomic/idempotent apply qua restart, immutable job snapshots/media hashes, list timeline + filters, safe reschedule/cancel, required Process fields pin vào snapshot, private transactional due claim/renew + generation fencing, lost-claim recovery/audit qua hai DB workers thật | Actual worker dispatch/overdue slot recovery, auto-append lịch, calendar day/week/drag/spread và Windows sleep hooks còn thiếu. Claim chỉ vào PREFLIGHT, không gửi input. Actual target/profile/certification/hardware preflight vẫn chưa nghiệm thu |
| P08–P14 | Contracts/schema nền; chưa có hardware runtime | Android/stream/recognition/app adapters/network/APK/packaging acceptance NOT_RUN |

## Bằng chứng đã chạy

- Unit/integration: 125 tests qua trong 13 files, gồm 40 node defaults, malformed inputs, atomic editor changes, graph topology/trace, SQLite persistence/backup/leases/uncertainty, source filesystem/coordinator/ledger, host grant boundaries, timezone/DST, persisted preview/apply/rollback/restart và immutable schedule edits; typed Process fields, CSV/JSON/XLSX/bulk import transaction/rollback/restart và actual dual-DB-worker ownership recovery.
- Browser E2E: 8 scenarios qua trên Chromium, với DB tạm riêng: workflow round-trip/subgraphs/schema/version/export/import; Process context + edits trong khi save pending + schedule preview; forged origin/token/raw-path/private command rejection; typed forms giữ 0/false/missing/ordered multiline lists; saved preview→apply→timeline→reschedule/cancel qua SQLite thật. Schedule E2E dùng device record fixture trong DB tạm, không Android emulation. Thêm Process fields/save-ACK JSON race + import/bulk/export 3 formats; invalid/stale import; 1200 rows/virtual DOM/stable selection. TypeScript của UI tests được check trước browser.
- Electron 45/Linux main-only SQLite: WAL/Unicode/rollback/reopen/online backup/integrity PASS. Bundled Node 24.22.0, SQLite 3.53.4.
- Electron sandboxed renderer: named API, no window.require, 6 routes, actual create/save/reload qua preload/worker, native chooser capability, actual XLSX export→parse→preview/apply, không expose private/queue API PASS. Host media worker smoke với tệp thật + test picker adapter PASS; native dialog tương tác chưa chạy.
- Local host health + functional bootstrap request PASS. Đây là authoring, không Android automation.

Các lệnh/checks còn đang thay đổi được chạy lại khi scope code ảnh hưởng. Receipt theo revision sẽ lưu ở `docs/evidence/implementation/`; screenshots UI cùng thư mục. Chưa có kết quả Windows, điện thoại, proxy routing hoặc so sánh Genfamer.

## Tiếp tục

P06 tiếp tục thumbnails, source adoption/rebind, Process clone/archive, migration mapping/inline/column helpers và server pagination. P07 tiếp tục actual worker/overdue recovery/calendar/spread; P04/P05 còn advanced editor/engine contracts. Các phần này làm tiếp trên cloud. P08 kết nối/control cần nghiệm thu Windows/Android thật; chưa có thiết bị thì không tự nhận discovery, vuốt, proxy hay posting thành công.

GitHub đã xác minh remote `feat/studio-workspace` ở code commit `55517f14d6f72163cee786d42d4791fa8f8a6eff`. Receipt [checkpoint-004](../evidence/implementation/checkpoint-004.json) ghi checks trên revision này; commit tài liệu/ZIP có thể mới hơn. Không merge main hoặc phát hành installer.

Kế hoạch đã đối chiếu trước code: [increment 005](INCREMENT-005_PLAN.md), [increment 006](INCREMENT-006_PLAN.md), [ADR format](ADR-002-CONTENT-FORMATS.md). Chưa đánh dấu toàn phase ACCEPTED.
