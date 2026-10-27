# Kế hoạch hoàn thiện sau checkpoint 005

Ngày 27/10/2026. Yêu cầu hiện hành: lập kế hoạch trước từng phase, tiếp tục code, ghi rõ phase hiện tại/số phase còn lại, nghiệm thu tổng thể sau. Đây là tracker implementation, không thay reference V2.1 và không tự chuyển các gate chưa chạy thành PASS.

## Kiểm kê trước khi làm

Baseline: commit `385607d648f1d14a57b5559def3e71e664148ae7`, nhánh `feat/studio-workspace`, working tree sạch. Môi trường đã được cài; 166 unit/integration và 11 browser scenarios qua ở baseline. Những kết quả này không xác nhận code sắp thêm.

Tổng scope giữ nguyên **15 phase / 125 bước / 375 đầu việc**. P00–P09 có implementation từng phần; P10–P14 chưa có đầy đủ runtime. Chưa có evidence để ghi toàn bộ một phase ACCEPTED. Phân biệt số phase đã có code, phase đang bổ sung và phase còn gate nghiệm thu; không báo phần trăm theo số tests hoặc số file.

| Phase | Phạm vi | Công việc tiếp theo / điều kiện đóng |
|---|---|---|
| P00 | Toolchain/repository | Giữ frozen install; CI Windows/remote và environment publication còn riêng |
| P01 | Contracts | Hoàn thiện contracts theo services, immutable dependency closure/event ordering |
| P02 | Persistence | Workspace import preview/atomic restore, vận hành schema và Windows acceptance |
| P03 | Shell | Diagnostics, lifecycle, navigation/accessibility; Windows DPI/multi-monitor |
| P04 | Workflow editor | **Đang thực hiện:** group collapse/drag, conversion subflow, edge routing, layout/shortcuts, persistence/undo |
| P05 | Compiler/engine | Typed call mapping, pinned closure/immutable IR, actual debugger sessions và integration UI |
| P06 | Process/media | Adopt/rebind, thumbnails, Process clone/archive, pagination/import/UI gaps |
| P07 | Scheduler | Dispatch/recovery/overdue, explicit spread/auto-append, calendar views |
| P08 | Device/worker | Identity conflicts, worker coordination và physical Windows/Android receipts |
| P09 | Stream/Inspector | Real stream decoder/control, richer selectors/OCR/Unicode/gestures, correlation |
| P10 | Technical risk | Verify exact devices/app versions/locale/USB/LAN; owned staging, identity, publish signals, routing |
| P11 | Execution/effects | Journal-first executor, independent comments, uncertainty/review/recovery/owned cleanup |
| P12 | App adapters | Profile-specific Facebook Reels + TikTok trước; Lite/Instagram/Threads/photo theo evidence |
| P13 | Operations | APK/network adapters, secrets/redaction, diagnostics/retention/power/resource bounds |
| P14 | Packaging | Windows installer/offline notices, clean-machine/upgrade/rollback/completeness; publication riêng |

## Thứ tự và cách báo tiến độ

1. Hoàn thiện các lát P04 → P05 → P06 → P07 theo dependency; bổ sung P01–P03 khi lát đó cần contracts/persistence/shell.
2. P08/P09 providers → P10 risk evidence → P11 effects → P12 adapters. Không hard-code app selectors hoặc tạo evidence giả khi chưa có profiles thật.
3. P13 operations → P14 package/audit; không publish installer/merge main khi chưa có lệnh.
4. Mỗi increment có plan trước code, liệt kê step IDs, state transitions/failures, files, checks. Sau code: compile/type checks cần thiết; gom regression/browsers thành đợt cuối của increment theo yêu cầu “test sau”. Bug mới phải được xử lý, không đánh dấu phase xong bằng scaffold hay nút disabled.
5. Cập nhật PROGRESS.md cùng receipt: IMPLEMENTED khác TESTED khác ACCEPTED. Báo phase hiện tại, phần vừa xong, các phase còn phát triển và gate ngoại vi.

## Thông tin cần cho nghiệm thu cuối

Máy Windows có GUI và ít nhất hai Android được cấp quyền, exact model/OS/app versions/locale, test account/target có chủ đích và kết nối USB/LAN thực. Cloud hiện chỉ chứng minh authoring/Linux/fixture integration; không thấy USB của PC người dùng. Chưa có thông tin này vẫn tiếp tục code độc lập, nhưng không thể chứng nhận sản phẩm 100% hoặc release Windows bằng cloud tests.
