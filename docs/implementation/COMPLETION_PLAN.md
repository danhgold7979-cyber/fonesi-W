# Kế hoạch hoàn thiện sau checkpoint 005

## Current verified checkpoint — 29/10/2026

Current repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`. Latest tested source SHA `c957fe36d892e6b4e97ad7885549e517e022cf86`; **Increment056 / checkpoint-049**; [push CI 40846775722](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40846775722) and [PR CI 40846782696](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40846782696) both SUCCESS (Ubuntu 365/365 unit/integration, 31/31 Chromium UI; Windows 364 PASS + 1 platform skip; generated/type/lint/build, VerifyOnly and validators). SQLite v20 remains unchanged. Electron-only operator action now triggers a *single fresh remote-byte/MediaStore re-observation* under the trusted host's shared MANUAL lease with a fresh verified transport. Results are redacted and never authorize dispatch/deletion/posting; loopback HTTP cannot invoke it. Prior baseline/checkpoints below are historical, not the current status. Read [PROGRESS.md](PROGRESS.md), [Increment056 results](INCREMENT-056_RESULTS.md), and [checkpoint-049](../evidence/implementation/checkpoint-049.json).

Full scope remains **15 phases/125 steps/375 tasks**. **NOT_ACCEPTED/NOT_RUN**: native Windows10 on real Android USB/LAN, exact MediaStore→picker proof, Facebook/TikTok post verification, owned remote cleanup, fleet 20→100→300 load and installer/release. CI fixtures cannot yield a verified total completion percentage. Branch `main` remains separate and unchanged.

Ngày 27/10/2026. Yêu cầu hiện hành: lập kế hoạch trước từng phase, tiếp tục code, ghi rõ phase hiện tại/số phase còn lại, nghiệm thu tổng thể sau. Đây là tracker implementation, không thay reference V2.1 và không tự chuyển các gate chưa chạy thành PASS.

## Kiểm kê trước khi làm

Baseline: commit `385607d648f1d14a57b5559def3e71e664148ae7`, nhánh `feat/studio-workspace`, working tree sạch. Môi trường đã được cài; 166 unit/integration và 11 browser scenarios qua ở baseline. Những kết quả này không xác nhận code sắp thêm.

Tổng scope giữ nguyên **15 phase / 125 bước / 375 đầu việc**. P00–P09 có implementation từng phần; P10–P14 chưa có đầy đủ runtime. Chưa có evidence để ghi toàn bộ một phase ACCEPTED. Phân biệt số phase đã có code, phase đang bổ sung và phase còn gate nghiệm thu; không báo phần trăm theo số tests hoặc số file.

| Phase | Phạm vi | Công việc tiếp theo / điều kiện đóng |
|---|---|---|
| P00 | Toolchain/repository | Frozen install/forced-autocrlf và Ubuntu/Windows CI PASS ở49dcb77; environment publication và Win10 host acceptance riêng |
| P01 | Contracts | Hoàn thiện contracts theo services, immutable dependency closure/event ordering |
| P02 | Persistence | Đã test verified local online backup/receipt/restart; còn workspace import preview/atomic restore UI, vận hành schema và Windows acceptance |
| P03 | Shell | Diagnostics, lifecycle, navigation/accessibility; Windows DPI/multi-monitor |
| P04 | Workflow editor | Đã test thêm group/collapse/drag, convert local subflow, routing/align/layout; còn external clipboard closure/preferences/command search và interaction gates |
| P05 | Compiler/engine | Đã test typed mapping/pinned closure/immutable IR/debugger/UI và audit đường đi effect nội bộ; còn audit qua subflow/loop, journal runtime/providers/DEVICE_TEST thật |
| P06 | Process/media | P06/S056 backend ContentPage migrated to schema14 with Process-scoped epoch-fenced keyset paging and batch assets; legacy all-row editor still untouched to preserve Select All/scheduling; thumbnails/cache, query-scoped UI selection/search/sort and Windows corpus performance remain OPEN |
| P07 | Scheduler | Đã test app/snapshot filter, local day/week/month, paging/virtual timeline và scoped spread/cancel; còn dispatch/recovery/overdue, auto-append/drag/sleep-resume |
| P08 | Device/worker | Có security fence + native operator review/confirmation, audit SQLite v13 và Increment031 read-only audit history/cursor trên UI; còn nghiệm thu Windows10 với 2 Android thật, worker coordination, cross-host trust, USB/LAN và scale |
| P09 | Stream/Inspector | Đã có XML/PNG Inspector, selector v2 relative/fallback + Increment034 read-only fresh ADB selector probing qua shared lease (0/1/n, no touch); còn real stream decoder, XPath/OCR/image/Unicode/multitouch và hardware Windows10/Android acceptance |
| P10 | Technical risk | Verify exact devices/app versions/locale/USB/LAN; owned staging, identity, publish signals, routing |
| P11 | Execution/effects | Increment035: SQLite atomic effect intent+attempt uncertainty gated by live JOB claim, fingerprint and pinned node, crash/restart review tested; P11 runtime adapter/verification/independent comments/cleanup and real Android publishing remain OPEN |
| P12 | App adapters | Profile-specific Facebook Reels + TikTok trước; Lite/Instagram/Threads/photo theo evidence |
| P13 | Operations | Đã test health/allowlisted diagnostic + verified local backups; còn APK/network, secrets, run logs/retention/power/staging resource bounds |
| P14 | Packaging | Đã có Windows source setup/launcher/guide; còn installer/offline notices, clean-machine/upgrade/rollback/completeness; publication riêng |

## Thứ tự và cách báo tiến độ

Mốc lưu mới nhất: increment023 / checkpoint016. Current source checks:226 unit/integration tests và22 browser scenarios qua. Cloud host đã được backup/migrate schema12/restart và functional readiness + isolated Electron SQLite-worker/backup PASS. GitHub run40459468100 ởe169404 xanh cả Ubuntu và Windows (226 pass Linux;225 pass/1 Unix-only fixture skip Windows), gồm Windows setup/launcher VerifyOnly và hai plan validators. **Không có phase nào được tự đổi thành ACCEPTED**: bảng trên phân biệt lát đã test và phần còn lại. Không có tiến trình coding nền tự tiếp tục sau khi phiên chat kết thúc; resume từ gaps P06/P07/P08–P14, giữ các commits đã kiểm tra. Source Windows launcher/hướng dẫn đã có; chưa publish installer.

1. Hoàn thiện các lát P04 → P05 → P06 → P07 theo dependency; bổ sung P01–P03 khi lát đó cần contracts/persistence/shell.
2. P08/P09 providers → P10 risk evidence → P11 effects → P12 adapters. Không hard-code app selectors hoặc tạo evidence giả khi chưa có profiles thật.
3. P13 operations → P14 package/audit; không publish installer/merge main khi chưa có lệnh.
4. Mỗi increment có plan trước code, liệt kê step IDs, state transitions/failures, files, checks. Sau code: compile/type checks cần thiết; gom regression/browsers thành đợt cuối của increment theo yêu cầu “test sau”. Bug mới phải được xử lý, không đánh dấu phase xong bằng scaffold hay nút disabled.
5. Cập nhật PROGRESS.md cùng receipt: IMPLEMENTED khác TESTED khác ACCEPTED. Báo phase hiện tại, phần vừa xong, các phase còn phát triển và gate ngoại vi.

## Thông tin cần cho nghiệm thu cuối

Người dùng xác nhận ngày 27/10/2026: **Windows 10 64-bit; 20 điện thoại ban đầu, có thể tăng khoảng 300; registry đa app, ưu tiên Facebook**. Đây là workload/target cần thiết kế và đo, không là số máy đã được kiểm nghiệm hay hard cap nghiệp vụ. Queue/device ownership, paging, workers/streams/backpressure phải tách tổng số registered devices khỏi số tác vụ đồng thời. Nghiệm thu scale P13 cần ma trận 20→100→300 trên host/USB/LAN thực; chưa có benchmark không hứa throughput hoặc bật 300 stream cùng lúc. Facebook đi trước không loại TikTok/custom app/các app còn lại khỏi scope.

Máy Windows có GUI và ít nhất hai Android được cấp quyền, exact model/OS/app versions/locale, test account/target có chủ đích và kết nối USB/LAN thực. Cloud hiện chỉ chứng minh authoring/Linux/fixture integration; không thấy USB của PC người dùng. Chưa có thông tin này vẫn tiếp tục code độc lập, nhưng không thể chứng nhận sản phẩm 100% hoặc release Windows bằng cloud tests.
