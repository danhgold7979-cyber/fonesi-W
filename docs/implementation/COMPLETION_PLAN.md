# Kế hoạch hoàn thiện sau checkpoint 005

Ngày 27/10/2026. Yêu cầu hiện hành: lập kế hoạch trước từng phase, tiếp tục code, ghi rõ phase hiện tại/số phase còn lại, nghiệm thu tổng thể sau. Đây là tracker implementation, không thay reference V2.1 và không tự chuyển các gate chưa chạy thành PASS.

## Kiểm kê trước khi làm

Baseline: commit `385607d648f1d14a57b5559def3e71e664148ae7`, nhánh `feat/studio-workspace`, working tree sạch. Môi trường đã được cài; 166 unit/integration và 11 browser scenarios qua ở baseline. Những kết quả này không xác nhận code sắp thêm.

Tổng scope giữ nguyên **15 phase / 125 bước / 375 đầu việc**. P00–P09 có implementation từng phần; P10–P14 chưa có đầy đủ runtime. Chưa có evidence để ghi toàn bộ một phase ACCEPTED. Phân biệt số phase đã có code, phase đang bổ sung và phase còn gate nghiệm thu; không báo phần trăm theo số tests hoặc số file.

| Phase | Phạm vi | Công việc tiếp theo / điều kiện đóng |
|---|---|---|
| P00 | Toolchain/repository | Giữ frozen install; đã fix forced-autocrlf parity, chờ Windows CI script/check evidence; environment publication riêng |
| P01 | Contracts | Hoàn thiện contracts theo services, immutable dependency closure/event ordering |
| P02 | Persistence | Đã test verified local online backup/receipt/restart; còn workspace import preview/atomic restore UI, vận hành schema và Windows acceptance |
| P03 | Shell | Diagnostics, lifecycle, navigation/accessibility; Windows DPI/multi-monitor |
| P04 | Workflow editor | Đã test thêm group/collapse/drag, convert local subflow, routing/align/layout; còn external clipboard closure/preferences/command search và interaction gates |
| P05 | Compiler/engine | Đã test typed mapping/pinned closure/immutable IR/debugger/UI; còn comprehensive effect dominance/providers/DEVICE_TEST |
| P06 | Process/media | Đã test archive/restore, clone preview/scoped ownership, rebind và explicit adoption; còn thumbnails/cache, query/migration UI gaps |
| P07 | Scheduler | Đã test paging/virtual timeline và scoped spread/cancel preview/apply; còn dispatch/recovery/overdue, auto-append/calendar/drag |
| P08 | Device/worker | Identity conflicts, worker coordination và physical Windows/Android receipts |
| P09 | Stream/Inspector | Real stream decoder/control, richer selectors/OCR/Unicode/gestures, correlation |
| P10 | Technical risk | Verify exact devices/app versions/locale/USB/LAN; owned staging, identity, publish signals, routing |
| P11 | Execution/effects | Journal-first executor, independent comments, uncertainty/review/recovery/owned cleanup |
| P12 | App adapters | Profile-specific Facebook Reels + TikTok trước; Lite/Instagram/Threads/photo theo evidence |
| P13 | Operations | Đã test health/allowlisted diagnostic + verified local backups; còn APK/network, secrets, run logs/retention/power/staging resource bounds |
| P14 | Packaging | Đã có Windows source setup/launcher/guide; còn installer/offline notices, clean-machine/upgrade/rollback/completeness; publication riêng |

## Thứ tự và cách báo tiến độ

Mốc lưu mới nhất: increment021 / checkpoint014. Current source checks:220 unit/integration tests và21 browser scenarios qua. Linux host cần restart compiled output sau đợt increments mới; không tính host cũ là code mới đang phục vụ. GitHub Windows CI ở020 fail generated-file parity/CRLF; next work022 sửa checkout/tooling, không gọi remote CI xanh trước evidence. **Không có phase nào được tự đổi thành ACCEPTED**: bảng trên phân biệt lát đã test và phần còn lại. Không có tiến trình coding nền tự tiếp tục sau khi phiên chat kết thúc; giữ các commits đã kiểm tra.

1. Hoàn thiện các lát P04 → P05 → P06 → P07 theo dependency; bổ sung P01–P03 khi lát đó cần contracts/persistence/shell.
2. P08/P09 providers → P10 risk evidence → P11 effects → P12 adapters. Không hard-code app selectors hoặc tạo evidence giả khi chưa có profiles thật.
3. P13 operations → P14 package/audit; không publish installer/merge main khi chưa có lệnh.
4. Mỗi increment có plan trước code, liệt kê step IDs, state transitions/failures, files, checks. Sau code: compile/type checks cần thiết; gom regression/browsers thành đợt cuối của increment theo yêu cầu “test sau”. Bug mới phải được xử lý, không đánh dấu phase xong bằng scaffold hay nút disabled.
5. Cập nhật PROGRESS.md cùng receipt: IMPLEMENTED khác TESTED khác ACCEPTED. Báo phase hiện tại, phần vừa xong, các phase còn phát triển và gate ngoại vi.

## Thông tin cần cho nghiệm thu cuối

Người dùng xác nhận ngày 27/10/2026: **Windows 10 64-bit; 20 điện thoại ban đầu, có thể tăng khoảng 300; registry đa app, ưu tiên Facebook**. Đây là workload/target cần thiết kế và đo, không là số máy đã được kiểm nghiệm hay hard cap nghiệp vụ. Queue/device ownership, paging, workers/streams/backpressure phải tách tổng số registered devices khỏi số tác vụ đồng thời. Nghiệm thu scale P13 cần ma trận 20→100→300 trên host/USB/LAN thực; chưa có benchmark không hứa throughput hoặc bật 300 stream cùng lúc. Facebook đi trước không loại TikTok/custom app/các app còn lại khỏi scope.

Máy Windows có GUI và ít nhất hai Android được cấp quyền, exact model/OS/app versions/locale, test account/target có chủ đích và kết nối USB/LAN thực. Cloud hiện chỉ chứng minh authoring/Linux/fixture integration; không thấy USB của PC người dùng. Chưa có thông tin này vẫn tiếp tục code độc lập, nhưng không thể chứng nhận sản phẩm 100% hoặc release Windows bằng cloud tests.
