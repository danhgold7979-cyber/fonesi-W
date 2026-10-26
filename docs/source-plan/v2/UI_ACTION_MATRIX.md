# Ma trận 124 lệnh UI

Các ID là feature identities, không phải số button instances. Đã đối chiếu toàn bộ `case` trong action dispatcher và sự xuất hiện của control trong các trạng thái browser audit. “Observed” không có nghĩa handler/device operation đã nghiệm thu. Field, gesture và 40 node handlers ở registry riêng.

| ID | Lệnh | Nhãn tham chiếu | Loại production | Phase | Service |
|---|---|---|---|---|
| CMD-001 | `slots-prev` | ← | UI_ONLY | P07 | `scheduler/timeline/jobs` |
| CMD-002 | `slots-next` | → | UI_ONLY | P07 | `scheduler/timeline/jobs` |
| CMD-003 | `reroute-edge` | Thêm / bỏ điểm bẻ dây | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-004 | `modal-close` | Đóng | UI_ONLY | P03 | `settings/app/notifications` |
| CMD-005 | `save` | Lưu | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-006 | `undo` | Hoàn tác · Ctrl+Z | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-007 | `redo` | Làm lại · Ctrl+Y | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-008 | `fit` | 76% | UI_ONLY | P04 | `workflowDrafts/editorCommands` |
| CMD-009 | `zoom-in` | Phóng to | UI_ONLY | P04 | `workflowDrafts/editorCommands` |
| CMD-010 | `zoom-out` | Thu nhỏ | UI_ONLY | P04 | `workflowDrafts/editorCommands` |
| CMD-011 | `snap` | Bật / tắt bắt lưới | UI_ONLY | P04 | `workflowDrafts/editorCommands` |
| CMD-012 | `minimap` | Bật / tắt minimap | UI_ONLY | P04 | `workflowDrafts/editorCommands` |
| CMD-013 | `focus` | Chế độ tập trung | UI_ONLY | P04 | `workflowDrafts/editorCommands` |
| CMD-014 | `bottom-toggle` | Thu gọn / mở rộng | UI_ONLY | P04 | `workflowDrafts/editorCommands` |
| CMD-015 | `parent` | Quy trình chính | UI_ONLY | P04 | `workflowDrafts/editorCommands` |
| CMD-016 | `open-selected-sub` | Mở khối con | UI_ONLY | P04 | `workflowDrafts/editorCommands` |
| CMD-017 | `new-sub` | Tạo quy trình con | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-018 | `sub-create-confirm` | Tạo khối con | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-019 | `add-node` | Thêm node | UI_ONLY | P04 | `workflowDrafts/editorCommands` |
| CMD-020 | `duplicate` | Nhân bản
Ctrl+D | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-021 | `copy` | Sao chép
Ctrl+C | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-022 | `paste` | Dán node
Ctrl+V | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-023 | `select-all` | Chọn tất cả
Ctrl+A | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-024 | `delete-selected` | Xóa node
Del | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-025 | `rename-node` | Đổi tên
F2 | UI_ONLY | P04 | `workflowDrafts/editorCommands` |
| CMD-026 | `rename-confirm` | Lưu | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-027 | `layout` | Tự sắp xếp | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-028 | `layout-vertical` | Tự sắp xếp dọc | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-029 | `align` | Căn các node đã chọn | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-030 | `group` | Nhóm trực quan | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-031 | `convert-sub` | Chuyển thành quy trình con | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-032 | `convert-confirm` | Chuyển thành khối con | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-033 | `insert-edge` | Chèn node vào dây | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-034 | `canvas-menu` | Tùy chọn canvas | UI_ONLY | P04 | `workflowDrafts/editorCommands` |
| CMD-035 | `node-run` | Chạy thử node | BACKEND_REQUIRED | P05 | `debugSessions` |
| CMD-036 | `node-stop` | Dừng phiên thử | BACKEND_REQUIRED | P05 | `debugSessions` |
| CMD-037 | `stop` | Dừng | BACKEND_REQUIRED | P05 | `debugSessions` |
| CMD-038 | `node-edit` | Cấu hình | UI_ONLY | P04 | `workflowDrafts/editorCommands` |
| CMD-039 | `node-copy` | Nhân bản | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-040 | `node-delete` | Xóa node | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-041 | `node-open` | Mở quy trình con | UI_ONLY | P04 | `workflowDrafts/editorCommands` |
| CMD-042 | `node-more` | Thao tác khác | UI_ONLY | P04 | `workflowDrafts/editorCommands` |
| CMD-043 | `advanced-node` | Nâng cao | UI_ONLY | P04 | `workflowDrafts/editorCommands` |
| CMD-044 | `advanced-save` | Lưu node | BACKEND_REQUIRED | P04 | `workflowDrafts/editorCommands` |
| CMD-045 | `validate` | Kiểm tra | BACKEND_REQUIRED | P05 | `debugSessions` |
| CMD-046 | `run` | Chạy mô phỏng | UI_ONLY | P05 | `debugSessions` |
| CMD-047 | `run-selected` | Chạy thử node | BACKEND_REQUIRED | P05 | `debugSessions` |
| CMD-048 | `run-from` | Chạy từ node này | BACKEND_REQUIRED | P05 | `debugSessions` |
| CMD-049 | `test-data` | Chỉnh dữ liệu thử | UI_ONLY | P05 | `debugSessions` |
| CMD-050 | `apply-test-data` | Áp dụng kịch bản | BACKEND_REQUIRED | P05 | `debugSessions` |
| CMD-051 | `pause` | Tạm dừng | BACKEND_REQUIRED | P05 | `debugSessions` |
| CMD-052 | `breakpoint` | Bật / tắt breakpoint | BACKEND_REQUIRED | P05 | `debugSessions` |
| CMD-053 | `debug-step` | Bước tiếp | BACKEND_REQUIRED | P05 | `debugSessions` |
| CMD-054 | `debug-into` | Vào khối con | BACKEND_REQUIRED | P05 | `debugSessions` |
| CMD-055 | `inputs` | Đầu vào | UI_ONLY | P01 | `workflowSchemas` |
| CMD-056 | `input-add` | Thêm trường | UI_ONLY | P01 | `workflowSchemas` |
| CMD-057 | `inputs-save` | Lưu khai báo | BACKEND_REQUIRED | P01 | `workflowSchemas` |
| CMD-058 | `pick` | Chọn phần tử | BACKEND_REQUIRED | P09 | `inspector/streams/manualControl` |
| CMD-059 | `use-selector` | Gắn vào node đang chọn | BACKEND_REQUIRED | P09 | `inspector/streams/manualControl` |
| CMD-060 | `refresh-tree` | Làm mới | BACKEND_REQUIRED | P09 | `inspector/streams/manualControl` |
| CMD-061 | `phone-control` | Điều khiển mẫu | BACKEND_REQUIRED | P09 | `inspector/streams/manualControl` |
| CMD-062 | `phone-refresh` | Làm mới màn hình | BACKEND_REQUIRED | P09 | `inspector/streams/manualControl` |
| CMD-063 | `phone-fit` | Vừa khung điện thoại | UI_ONLY | P09 | `inspector/streams/manualControl` |
| CMD-064 | `phone-back` | Back | BACKEND_REQUIRED | P09 | `inspector/streams/manualControl` |
| CMD-065 | `phone-home` | Home | BACKEND_REQUIRED | P09 | `inspector/streams/manualControl` |
| CMD-066 | `phone-recent` | Recent | BACKEND_REQUIRED | P09 | `inspector/streams/manualControl` |
| CMD-067 | `phone-dock` | Bố trí điện thoại | UI_ONLY | P09 | `inspector/streams/manualControl` |
| CMD-068 | `phone-popup` | Tách cửa sổ | UI_ONLY | P09 | `inspector/streams/manualControl` |
| CMD-069 | `dock-right` | Dính bên phải | UI_ONLY | P09 | `inspector/streams/manualControl` |
| CMD-070 | `dock-top` | Dính phía trên | UI_ONLY | P09 | `inspector/streams/manualControl` |
| CMD-071 | `dock-floating` | Cửa sổ nổi trong tool | UI_ONLY | P09 | `inspector/streams/manualControl` |
| CMD-072 | `device-info` | Thông tin máy | BACKEND_REQUIRED | P08 | `devices/deviceWorkers` |
| CMD-073 | `scan-devices` | Làm mới | BACKEND_REQUIRED | P08 | `devices/deviceWorkers` |
| CMD-074 | `device-manager` | Quản lý thiết bị | UI_ONLY | P08 | `devices/deviceWorkers` |
| CMD-075 | `device-bulk` | Thao tác nhóm | UI_ONLY | P08 | `devices/deviceWorkers` |
| CMD-076 | `bulk-enable` | Bật nhận việc | BACKEND_REQUIRED | P08 | `devices/deviceWorkers` |
| CMD-077 | `bulk-disable` | Tắt nhận việc | BACKEND_REQUIRED | P08 | `devices/deviceWorkers` |
| CMD-078 | `open-process` | Thiết lập lịch | BACKEND_REQUIRED | P03 | `settings/app/notifications` |
| CMD-079 | `open-inspector` | Mở workflow | BACKEND_REQUIRED | P03 | `settings/app/notifications` |
| CMD-080 | `new-workflow` | Tạo workflow | UI_ONLY | P04 | `workflows/versions/importExport` |
| CMD-081 | `new-workflow-confirm` | Tạo workflow | BACKEND_REQUIRED | P04 | `workflows/versions/importExport` |
| CMD-082 | `workflow-menu` | Quản lý workflow | UI_ONLY | P04 | `workflows/versions/importExport` |
| CMD-083 | `workflow-rename` | Lưu tên | BACKEND_REQUIRED | P04 | `workflows/versions/importExport` |
| CMD-084 | `workflow-duplicate` | Nhân bản | BACKEND_REQUIRED | P04 | `workflows/versions/importExport` |
| CMD-085 | `publish-version` | Tạo phiên bản mới | BACKEND_REQUIRED | P04 | `workflows/versions/importExport` |
| CMD-086 | `workflow-delete` | Xóa / lưu trữ | UI_ONLY | P04 | `workflows/versions/importExport` |
| CMD-087 | `workflow-archive` | Lưu trữ | BACKEND_REQUIRED | P04 | `workflows/versions/importExport` |
| CMD-088 | `export-workflow` | Xuất workflow | BACKEND_REQUIRED | P04 | `workflows/versions/importExport` |
| CMD-089 | `import-workflow` | Nhập JSON | UI_ONLY | P04 | `workflows/versions/importExport` |
| CMD-090 | `folder` | Chọn thư mục | UI_ONLY | P06 | `processes/media/importExport` |
| CMD-091 | `media` | Thêm tệp | UI_ONLY | P06 | `processes/media/importExport` |
| CMD-092 | `import-data` | Nhập dữ liệu | UI_ONLY | P06 | `processes/media/importExport` |
| CMD-093 | `pick-csv` | Chọn CSV / JSON | UI_ONLY | P06 | `processes/media/importExport` |
| CMD-094 | `export-csv` | Xuất CSV | BACKEND_REQUIRED | P06 | `processes/media/importExport` |
| CMD-095 | `apply-import` | Áp dụng dữ liệu | BACKEND_REQUIRED | P06 | `processes/media/importExport` |
| CMD-096 | `demo-data` | Nạp dữ liệu mẫu | DEV_ONLY | P05 | `devFixtures` |
| CMD-097 | `add-row` | Thêm dòng | BACKEND_REQUIRED | P06 | `processes/media/importExport` |
| CMD-098 | `delete-rows` | Xóa dòng chọn | UI_ONLY | P06 | `processes/media/importExport` |
| CMD-099 | `delete-rows-confirm` | Xóa dòng | BACKEND_REQUIRED | P06 | `processes/media/importExport` |
| CMD-100 | `bulk-edit` | Sửa hàng loạt | UI_ONLY | P06 | `processes/media/importExport` |
| CMD-101 | `bulk-apply` | Áp dụng | BACKEND_REQUIRED | P06 | `processes/media/importExport` |
| CMD-102 | `schedule-preview` | Xem trước & áp dụng | BACKEND_REQUIRED | P07 | `scheduler/timeline/jobs` |
| CMD-103 | `schedule-apply` | Áp dụng lịch | BACKEND_REQUIRED | P07 | `scheduler/timeline/jobs` |
| CMD-104 | `process-save` | Lưu tiến trình | BACKEND_REQUIRED | P06 | `processes/media/importExport` |
| CMD-105 | `data-more` | Tùy chọn nguồn | UI_ONLY | P06 | `processes/media/importExport` |
| CMD-106 | `source-save` | Lưu cấu hình | BACKEND_REQUIRED | P06 | `processes/media/importExport` |
| CMD-107 | `scan-accounts` | Quét account | BACKEND_REQUIRED | P12 | `appAdapters/identities` |
| CMD-108 | `input-mapping` | Ánh xạ trường dữ liệu | UI_ONLY | P01 | `workflowSchemas` |
| CMD-109 | `clone-process` | Sao chép cấu hình | UI_ONLY | P06 | `processes/media/importExport` |
| CMD-110 | `clone-confirm` | Sao chép | BACKEND_REQUIRED | P06 | `processes/media/importExport` |
| CMD-111 | `process-options` | Tùy chọn | UI_ONLY | P06 | `processes/media/importExport` |
| CMD-112 | `queue` | Hàng đợi | UI_ONLY | P07 | `scheduler/timeline/jobs` |
| CMD-113 | `reconcile` | Đối soát mẫu | BACKEND_REQUIRED | P11 | `review/transactions` |
| CMD-114 | `export-logs` | Xuất nhật ký | BACKEND_REQUIRED | P13 | `diagnostics/workspaceBackup` |
| CMD-115 | `theme` | Đổi sáng / tối | BACKEND_REQUIRED | P03 | `settings/app/notifications` |
| CMD-116 | `settings` | Cài đặt | UI_ONLY | P03 | `settings/app/notifications` |
| CMD-117 | `settings-save` | Lưu cài đặt | BACKEND_REQUIRED | P03 | `settings/app/notifications` |
| CMD-118 | `export-workspace` | Sao lưu workspace | BACKEND_REQUIRED | P13 | `diagnostics/workspaceBackup` |
| CMD-119 | `restore-workspace` | Khôi phục JSON | BACKEND_REQUIRED | P13 | `diagnostics/workspaceBackup` |
| CMD-120 | `reset-preview` | Đặt lại dữ liệu mẫu | DEV_ONLY | P05 | `devFixtures` |
| CMD-121 | `reset-confirm` | Đặt lại | DEV_ONLY | P05 | `devFixtures` |
| CMD-122 | `help` | Hướng dẫn & phím tắt | UI_ONLY | P03 | `settings/app/notifications` |
| CMD-123 | `coverage` | Xem phạm vi chức năng bản HTML | UI_ONLY | P03 | `settings/app/notifications` |
| CMD-124 | `notifications` | Thông báo | UI_ONLY | P03 | `settings/app/notifications` |
