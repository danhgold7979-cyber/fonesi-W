# Ma trận 124 lệnh UI

Feature IDs lấy từ reference; phân loại và bước triển khai là thiết kế production. UI_ONLY có thể thay đổi draft local; persistence qua save ACK riêng. Số dòng không phải số tính năng đã nghiệm thu.

| ID | Lệnh | Nhãn | Loại | Owner | Bước | Test |
|---|---|---|---|---|---|---|
| CMD-001 | `slots-prev` | ← | UI_ONLY | P07 | S060 | UI-CMD-001 |
| CMD-002 | `slots-next` | → | UI_ONLY | P07 | S060 | UI-CMD-002 |
| CMD-003 | `reroute-edge` | Thêm / bỏ điểm bẻ dây | UI_ONLY | P04 | S033 | UI-CMD-003 |
| CMD-004 | `modal-close` | Đóng | UI_ONLY | P03 | S025 | UI-CMD-004 |
| CMD-005 | `save` | Lưu | BACKEND_REQUIRED | P04 | S039, S016 | UI-CMD-005 |
| CMD-006 | `undo` | Hoàn tác · Ctrl+Z | UI_ONLY | P04 | S031 | UI-CMD-006 |
| CMD-007 | `redo` | Làm lại · Ctrl+Y | UI_ONLY | P04 | S031 | UI-CMD-007 |
| CMD-008 | `fit` | 76% | UI_ONLY | P04 | S034 | UI-CMD-008 |
| CMD-009 | `zoom-in` | Phóng to | UI_ONLY | P04 | S034 | UI-CMD-009 |
| CMD-010 | `zoom-out` | Thu nhỏ | UI_ONLY | P04 | S034 | UI-CMD-010 |
| CMD-011 | `snap` | Bật / tắt bắt lưới | UI_ONLY | P04 | S034 | UI-CMD-011 |
| CMD-012 | `minimap` | Bật / tắt minimap | UI_ONLY | P04 | S034 | UI-CMD-012 |
| CMD-013 | `focus` | Chế độ tập trung | UI_ONLY | P04 | S034 | UI-CMD-013 |
| CMD-014 | `bottom-toggle` | Thu gọn / mở rộng | UI_ONLY | P04 | S039 | UI-CMD-014 |
| CMD-015 | `parent` | Quy trình chính | UI_ONLY | P04 | S037, S038 | UI-CMD-015 |
| CMD-016 | `open-selected-sub` | Mở khối con | UI_ONLY | P04 | S037, S038 | UI-CMD-016 |
| CMD-017 | `new-sub` | Tạo quy trình con | BACKEND_REQUIRED | P04 | S037 | UI-CMD-017 |
| CMD-018 | `sub-create-confirm` | Tạo khối con | BACKEND_REQUIRED | P04 | S037 | UI-CMD-018 |
| CMD-019 | `add-node` | Thêm node | UI_ONLY | P04 | S030 | UI-CMD-019 |
| CMD-020 | `duplicate` | Nhân bản<br>Ctrl+D | UI_ONLY | P04 | S031 | UI-CMD-020 |
| CMD-021 | `copy` | Sao chép<br>Ctrl+C | UI_ONLY | P04 | S031 | UI-CMD-021 |
| CMD-022 | `paste` | Dán node<br>Ctrl+V | UI_ONLY | P04 | S031 | UI-CMD-022 |
| CMD-023 | `select-all` | Chọn tất cả<br>Ctrl+A | UI_ONLY | P04 | S031 | UI-CMD-023 |
| CMD-024 | `delete-selected` | Xóa node<br>Del | UI_ONLY | P04 | S031 | UI-CMD-024 |
| CMD-025 | `rename-node` | Đổi tên<br>F2 | UI_ONLY | P04 | S036 | UI-CMD-025 |
| CMD-026 | `rename-confirm` | Lưu | UI_ONLY | P04 | S036 | UI-CMD-026 |
| CMD-027 | `layout` | Tự sắp xếp | UI_ONLY | P04 | S035 | UI-CMD-027 |
| CMD-028 | `layout-vertical` | Tự sắp xếp dọc | UI_ONLY | P04 | S035 | UI-CMD-028 |
| CMD-029 | `align` | Căn các node đã chọn | UI_ONLY | P04 | S035 | UI-CMD-029 |
| CMD-030 | `group` | Nhóm trực quan | UI_ONLY | P04 | S035 | UI-CMD-030 |
| CMD-031 | `convert-sub` | Chuyển thành quy trình con | BACKEND_REQUIRED | P04 | S037 | UI-CMD-031 |
| CMD-032 | `convert-confirm` | Chuyển thành khối con | BACKEND_REQUIRED | P04 | S037 | UI-CMD-032 |
| CMD-033 | `insert-edge` | Chèn node vào dây | UI_ONLY | P04 | S032 | UI-CMD-033 |
| CMD-034 | `canvas-menu` | Tùy chọn canvas | UI_ONLY | P04 | S034 | UI-CMD-034 |
| CMD-035 | `node-run` | Chạy thử node | BACKEND_REQUIRED | P05 | S047, S049 | UI-CMD-035 |
| CMD-036 | `node-stop` | Dừng phiên thử | BACKEND_REQUIRED | P05 | S047, S049 | UI-CMD-036 |
| CMD-037 | `stop` | Dừng | BACKEND_REQUIRED | P05 | S047, S049 | UI-CMD-037 |
| CMD-038 | `node-edit` | Cấu hình | UI_ONLY | P04 | S036 | UI-CMD-038 |
| CMD-039 | `node-copy` | Nhân bản | UI_ONLY | P04 | S031 | UI-CMD-039 |
| CMD-040 | `node-delete` | Xóa node | UI_ONLY | P04 | S031 | UI-CMD-040 |
| CMD-041 | `node-open` | Mở quy trình con | UI_ONLY | P04 | S037, S038 | UI-CMD-041 |
| CMD-042 | `node-more` | Thao tác khác | UI_ONLY | P04 | S036 | UI-CMD-042 |
| CMD-043 | `advanced-node` | Nâng cao | UI_ONLY | P04 | S036 | UI-CMD-043 |
| CMD-044 | `advanced-save` | Lưu node | UI_ONLY | P04 | S036 | UI-CMD-044 |
| CMD-045 | `validate` | Kiểm tra | BACKEND_REQUIRED | P05 | S041, S043, S045 | UI-CMD-045 |
| CMD-046 | `run` | Chạy mô phỏng | UI_ONLY | P05 | S049 | UI-CMD-046 |
| CMD-047 | `run-selected` | Chạy thử node | BACKEND_REQUIRED | P05 | S047, S049 | UI-CMD-047 |
| CMD-048 | `run-from` | Chạy từ node này | BACKEND_REQUIRED | P05 | S047, S049 | UI-CMD-048 |
| CMD-049 | `test-data` | Chỉnh dữ liệu thử | UI_ONLY | P05 | S049 | UI-CMD-049 |
| CMD-050 | `apply-test-data` | Áp dụng kịch bản | BACKEND_REQUIRED | P05 | S049 | UI-CMD-050 |
| CMD-051 | `pause` | Tạm dừng | BACKEND_REQUIRED | P05 | S047, S049 | UI-CMD-051 |
| CMD-052 | `breakpoint` | Bật / tắt breakpoint | BACKEND_REQUIRED | P05 | S047, S049 | UI-CMD-052 |
| CMD-053 | `debug-step` | Bước tiếp | BACKEND_REQUIRED | P05 | S047, S049 | UI-CMD-053 |
| CMD-054 | `debug-into` | Vào khối con | BACKEND_REQUIRED | P05 | S047, S049 | UI-CMD-054 |
| CMD-055 | `inputs` | Đầu vào | UI_ONLY | P01 | S010, S036 | UI-CMD-055 |
| CMD-056 | `input-add` | Thêm trường | UI_ONLY | P01 | S010, S036 | UI-CMD-056 |
| CMD-057 | `inputs-save` | Lưu khai báo | BACKEND_REQUIRED | P01 | S010, S036 | UI-CMD-057 |
| CMD-058 | `pick` | Chọn phần tử | BACKEND_REQUIRED | P09 | S083 | UI-CMD-058 |
| CMD-059 | `use-selector` | Gắn vào node đang chọn | BACKEND_REQUIRED | P09 | S083 | UI-CMD-059 |
| CMD-060 | `refresh-tree` | Làm mới | BACKEND_REQUIRED | P09 | S082 | UI-CMD-060 |
| CMD-061 | `phone-control` | Điều khiển mẫu | BACKEND_REQUIRED | P09 | S081, S074 | UI-CMD-061 |
| CMD-062 | `phone-refresh` | Làm mới màn hình | BACKEND_REQUIRED | P09 | S079, S082 | UI-CMD-062 |
| CMD-063 | `phone-fit` | Vừa khung điện thoại | UI_ONLY | P09 | S084 | UI-CMD-063 |
| CMD-064 | `phone-back` | Back | BACKEND_REQUIRED | P09 | S084, S076, S074 | UI-CMD-064 |
| CMD-065 | `phone-home` | Home | BACKEND_REQUIRED | P09 | S084, S076, S074 | UI-CMD-065 |
| CMD-066 | `phone-recent` | Recent | BACKEND_REQUIRED | P09 | S084, S076, S074 | UI-CMD-066 |
| CMD-067 | `phone-dock` | Bố trí điện thoại | UI_ONLY | P09 | S084 | UI-CMD-067 |
| CMD-068 | `phone-popup` | Tách cửa sổ | UI_ONLY | P09 | S084 | UI-CMD-068 |
| CMD-069 | `dock-right` | Dính bên phải | UI_ONLY | P09 | S084 | UI-CMD-069 |
| CMD-070 | `dock-top` | Dính phía trên | UI_ONLY | P09 | S084 | UI-CMD-070 |
| CMD-071 | `dock-floating` | Cửa sổ nổi trong tool | UI_ONLY | P09 | S084 | UI-CMD-071 |
| CMD-072 | `device-info` | Thông tin máy | BACKEND_REQUIRED | P08 | S076 | UI-CMD-072 |
| CMD-073 | `scan-devices` | Làm mới | BACKEND_REQUIRED | P08 | S069, S070, S073 | UI-CMD-073 |
| CMD-074 | `device-manager` | Quản lý thiết bị | UI_ONLY | P08 | S075 | UI-CMD-074 |
| CMD-075 | `device-bulk` | Thao tác nhóm | UI_ONLY | P08 | S075 | UI-CMD-075 |
| CMD-076 | `bulk-enable` | Bật nhận việc | BACKEND_REQUIRED | P08 | S075 | UI-CMD-076 |
| CMD-077 | `bulk-disable` | Tắt nhận việc | BACKEND_REQUIRED | P08 | S075 | UI-CMD-077 |
| CMD-078 | `open-process` | Thiết lập lịch | BACKEND_REQUIRED | P03 | S024, S050 | UI-CMD-078 |
| CMD-079 | `open-inspector` | Mở workflow | BACKEND_REQUIRED | P03 | S024, S081 | UI-CMD-079 |
| CMD-080 | `new-workflow` | Tạo workflow | UI_ONLY | P04 | S029, S016 | UI-CMD-080 |
| CMD-081 | `new-workflow-confirm` | Tạo workflow | BACKEND_REQUIRED | P04 | S029, S016 | UI-CMD-081 |
| CMD-082 | `workflow-menu` | Quản lý workflow | UI_ONLY | P04 | S029, S016 | UI-CMD-082 |
| CMD-083 | `workflow-rename` | Lưu tên | BACKEND_REQUIRED | P04 | S029, S016 | UI-CMD-083 |
| CMD-084 | `workflow-duplicate` | Nhân bản | BACKEND_REQUIRED | P04 | S029, S016 | UI-CMD-084 |
| CMD-085 | `publish-version` | Tạo phiên bản mới | BACKEND_REQUIRED | P04 | S039, S016 | UI-CMD-085 |
| CMD-086 | `workflow-delete` | Xóa / lưu trữ | UI_ONLY | P04 | S029, S016 | UI-CMD-086 |
| CMD-087 | `workflow-archive` | Lưu trữ | BACKEND_REQUIRED | P04 | S029, S016 | UI-CMD-087 |
| CMD-088 | `export-workflow` | Xuất workflow | BACKEND_REQUIRED | P04 | S037, S021 | UI-CMD-088 |
| CMD-089 | `import-workflow` | Nhập JSON | BACKEND_REQUIRED | P04 | S037, S021 | UI-CMD-089 |
| CMD-090 | `folder` | Chọn thư mục | BACKEND_REQUIRED | P06 | S052 | UI-CMD-090 |
| CMD-091 | `media` | Thêm tệp | BACKEND_REQUIRED | P06 | S052 | UI-CMD-091 |
| CMD-092 | `import-data` | Nhập dữ liệu | UI_ONLY | P06 | S057 | UI-CMD-092 |
| CMD-093 | `pick-csv` | Chọn CSV / JSON | BACKEND_REQUIRED | P06 | S058 | UI-CMD-093 |
| CMD-094 | `export-csv` | Xuất CSV | BACKEND_REQUIRED | P06 | S058 | UI-CMD-094 |
| CMD-095 | `apply-import` | Áp dụng dữ liệu | BACKEND_REQUIRED | P06 | S057 | UI-CMD-095 |
| CMD-096 | `demo-data` | Nạp dữ liệu mẫu | DEV_ONLY | P05 | S049 | UI-CMD-096 |
| CMD-097 | `add-row` | Thêm dòng | BACKEND_REQUIRED | P06 | S056, S018 | UI-CMD-097 |
| CMD-098 | `delete-rows` | Xóa dòng chọn | UI_ONLY | P06 | S059 | UI-CMD-098 |
| CMD-099 | `delete-rows-confirm` | Xóa dòng | BACKEND_REQUIRED | P06 | S059 | UI-CMD-099 |
| CMD-100 | `bulk-edit` | Sửa hàng loạt | UI_ONLY | P06 | S057 | UI-CMD-100 |
| CMD-101 | `bulk-apply` | Áp dụng | BACKEND_REQUIRED | P06 | S057 | UI-CMD-101 |
| CMD-102 | `schedule-preview` | Xem trước & áp dụng | BACKEND_REQUIRED | P07 | S062 | UI-CMD-102 |
| CMD-103 | `schedule-apply` | Áp dụng lịch | BACKEND_REQUIRED | P07 | S062 | UI-CMD-103 |
| CMD-104 | `process-save` | Lưu tiến trình | BACKEND_REQUIRED | P06 | S050, S017 | UI-CMD-104 |
| CMD-105 | `data-more` | Tùy chọn nguồn | UI_ONLY | P06 | S056 | UI-CMD-105 |
| CMD-106 | `source-save` | Lưu cấu hình | BACKEND_REQUIRED | P06 | S053, S017 | UI-CMD-106 |
| CMD-107 | `scan-accounts` | Quét account | BACKEND_REQUIRED | P12 | S104, S089 | UI-CMD-107 |
| CMD-108 | `input-mapping` | Ánh xạ trường dữ liệu | UI_ONLY | P01 | S010, S051 | UI-CMD-108 |
| CMD-109 | `clone-process` | Sao chép cấu hình | UI_ONLY | P06 | S050 | UI-CMD-109 |
| CMD-110 | `clone-confirm` | Sao chép | BACKEND_REQUIRED | P06 | S050 | UI-CMD-110 |
| CMD-111 | `process-options` | Tùy chọn | UI_ONLY | P06 | S050 | UI-CMD-111 |
| CMD-112 | `queue` | Hàng đợi | UI_ONLY | P07 | S065 | UI-CMD-112 |
| CMD-113 | `reconcile` | Đối soát mẫu | BACKEND_REQUIRED | P11 | S101, S098 | UI-CMD-113 |
| CMD-114 | `export-logs` | Xuất nhật ký | BACKEND_REQUIRED | P13 | S116 | UI-CMD-114 |
| CMD-115 | `theme` | Đổi sáng / tối | BACKEND_REQUIRED | P03 | S023, S017 | UI-CMD-115 |
| CMD-116 | `settings` | Cài đặt | UI_ONLY | P03 | S025, S017 | UI-CMD-116 |
| CMD-117 | `settings-save` | Lưu cài đặt | BACKEND_REQUIRED | P03 | S025, S017 | UI-CMD-117 |
| CMD-118 | `export-workspace` | Sao lưu workspace | BACKEND_REQUIRED | P13 | S116 | UI-CMD-118 |
| CMD-119 | `restore-workspace` | Khôi phục JSON | BACKEND_REQUIRED | P13 | S116 | UI-CMD-119 |
| CMD-120 | `reset-preview` | Đặt lại dữ liệu mẫu | DEV_ONLY | P05 | S049 | UI-CMD-120 |
| CMD-121 | `reset-confirm` | Đặt lại | DEV_ONLY | P05 | S049 | UI-CMD-121 |
| CMD-122 | `help` | Hướng dẫn & phím tắt | UI_ONLY | P03 | S025 | UI-CMD-122 |
| CMD-123 | `coverage` | Xem phạm vi chức năng bản HTML | UI_ONLY | P03 | S028, S124 | UI-CMD-123 |
| CMD-124 | `notifications` | Thông báo | UI_ONLY | P03 | S027 | UI-CMD-124 |
