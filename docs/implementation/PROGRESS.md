# Tiến độ implementation

Checkpoint đang triển khai ngày 26/10/2026. Baseline sản phẩm V2.1, 15 phase/125 bước; status PLANNED trong source-plan là định nghĩa ban đầu. File này ghi implementation thực và phần còn thiếu; không suy từ số dòng code ra phần trăm hoàn thành.

| Phase | Đã có code/bằng chứng local | Chưa nghiệm thu toàn phase |
|---|---|---|
| P00 | Workspace Node/pnpm pinned, lockfile, strict TS/lint/unit/build, CI definition; install đã chạy | CI remote/Windows chưa chạy; reusable setup đã kiểm tra và lưu draft; environment chưa Publish |
| P01 | Open app registry, workflow wire schema/40 nodes, JSON-safe typed values, immutable/hash/readiness/state policies, narrow API DTOs | Event replay/full capability contracts sẽ hoàn thiện cùng services phụ thuộc |
| P02 | SQLite migrations v1, workflows/full bundle/versions/clone/import, Process/preferences/content, snapshots/leases/effect journal, WAL backup/staged restore | Full workspace import preview và toàn bộ schema vận hành còn mở; Windows native acceptance UNRUN |
| P03 | React 6 routes, named sandboxed Electron preload, host validation, serialized DB worker, protected loopback host, theme/states/focus/save ACK | Windows DPI/multi-monitor/lifecycle chưa nghiệm thu; diagnostics/navigation states tiếp tục mở rộng |
| P04 | React Flow adapter, 40-node library, drag/resize/connect, insert/delete, undo/redo, duplicate, layout, properties/schema/subgraphs/version/export/import, partial shortcuts/context menus | Group/convert/edge reroute/full clipboard/layout preferences và một số shortcuts còn thiếu; chưa gọi full editor complete |
| P05 | Shape/topology/all-graphs validation, safe AST/template runtime, TRACE pure control flow/inline loops/subflow-local isolation, budgets/cancel/unsupported device actions | Pinned dependency resolver, typed subflow mapping/IR dominance và full debugger chưa xong; separate bodyGraphRef execution có lỗi unsupported rõ |
| P06 | Process/content persistence/UI, scanner hash/probe/media whitelist, host-scope/traversal/symlink checks, source ledger/ignore/changed và migrations v1→v2 có tests | Native dialog/coordinator/watcher và tích hợp nguồn vào UI, thumbnails/import/bulk/virtualization chưa xong; nút Chọn nguồn vẫn unavailable |
| P07 | Temporal timezone/DST, seeded immutable preview/hash/expiry/stale-scope checks, missed-vs-busy policy; readonly preview API/UI dùng Process/content thật | Apply/idempotency DB/queue/timeline/recovery chưa xong; preview không tạo jobs, nút áp dụng disabled có lý do |
| P08–P14 | Contracts/schema nền; chưa có hardware runtime | Android/stream/recognition/app adapters/network/APK/packaging acceptance NOT_RUN |

## Bằng chứng đã chạy

- Unit/integration: 76 tests qua trong 7 files, gồm 40 node defaults, malformed inputs, atomic editor changes, graph topology/trace, SQLite persistence/backup/leases/uncertainty, source filesystem/ledger và timezone/DST/preview.
- Browser E2E: 3 scenarios qua trên Chromium, với DB tạm riêng: workflow round-trip/subgraphs/schema/version/export/import; Process context + edits trong khi save pending + schedule preview; forged origin/token/unknown command rejection.
- Electron 45/Linux main-only SQLite: WAL/Unicode/rollback/reopen/online backup/integrity PASS. Bundled Node 24.22.0, SQLite 3.53.4.
- Electron sandboxed renderer: named API, no window.require, 6 routes, actual create/save/reload qua preload/worker PASS.
- Local host health + functional bootstrap request PASS. Đây là authoring, không Android automation.

Các lệnh/checks còn đang thay đổi được chạy lại khi scope code ảnh hưởng. Receipt theo revision sẽ lưu ở `docs/evidence/implementation/`; screenshots UI cùng thư mục. Chưa có kết quả Windows, điện thoại, proxy routing hoặc so sánh Genfamer.

## Tiếp tục

Tiếp tục P06 native grants/coordinator/watcher/UI/import và P07 apply/queue/timeline theo plan đã ghi trước code. Các editor/engine contracts còn thiếu vẫn tiếp tục trong phạm vi cloud; không lấy 76 tests/3 scenarios làm bằng chứng toàn bộ 125 bước accepted. GitHub trước đó thiếu quyền ghi (403); bảo toàn commit/source local.
