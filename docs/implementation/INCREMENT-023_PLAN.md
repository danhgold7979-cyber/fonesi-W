# Increment023 — P07/S065 calendar views and app scope

Plan trước code. Baseline022 follow-up Linux220/23 + prior full browser21; Windows CI rerun đang chờ, không gọi all-platform pass.

1. JobQuery thêm appId, DB filter qua immutable job snapshot bundle.workflow.appId, cursor fingerprint bind app filter như các filters hiện có. Process rebind sang app khác không đổi app của job đã freeze. Append-only migration12 thêm expression index cho app/time/order để không phải scan JSON toàn bộ lịch. Named API/preload không nhận SQL. App filter tách context editor/Process/device.
2. Calendar LIST/DAY/WEEK/MONTH, ngày anchor và display IANA timezone rõ. UTC range lấy local calendar boundaries bằng pinned Temporal0.5.1 browser dependency (đã dùng scheduler), exclusive end; xử lý DST23/25h, leap-year/week/month rollover, reject nonexistent calendar day. List giữ explicit UTC range filters hiện tại.
3. Mỗi view query persisted workspace jobs theo range/app/Process/device/state; không dùng content rows đang mở hoặc suy từ Process duy nhất. Display timezone của calendar khác snapshot timezone phải hiển thị rõ trên cards/edit dialog. Edit giữ snapshot timezone/ID và guard scheduled như trước.
4. Grid render tối đa20 cards/day, phần còn lại ghi số đã tải/shortcut xem ngày; không truncate query hoặc claim full total từ prefix. Keyset load-more và chữ còn trang tiếp theo giữ nguyên; cells trống trong page prefix hiển thị chưa có dữ liệu đã tải. Selection stable IDs giữa các cards, đổi range/filter reset đúng context. No drag mutation trong lát này.
5. CSS min-width, day/week/month responsive scroll, keyboard buttons/labels, loading/error/cancel. Helpers bounds/today/grouping tách module browser-safe (không Node crypto). UI dùng pure presentation component, không timer/placeholder jobs.
6. Tests timezone/DST/exclusive end/week/month/leap/day invalid, SQLite app/cursor scope and total coverage, browser calendar job qua local midnight/filter multi-app/from real DB/edit pinned timezone. Full type/lint/unit/build/browser sau code; preserve existing evidence PNGs.

Implementation choice: DAY dùng bảng virtualized theo range local-day, không cap20 cards; WEEK/MONTH cap20/day và nút Xem ngày mở DAY để truy cập đầy đủ records. Cách này giữ DOM bounded và không giấu các jobs sau20.

Visual inspection của tháng có25 jobs/day cho thấy20 cards khiến row quá dài; budget hiển thị được giảm thành3/month và6/week (vẫn trong upper budget20). Tổng đã tải và nút Xem ngày giữ nguyên; DAY virtualized truy cập toàn bộ. Calendar route lazy-load để Temporal không phình initial entry chunk.

Operational readiness cho schema12: nâng smoke-host từ health/bootstrap sang kiểm cả named workspaceStatus/integrity và schema đúng compiled code; bắt host cũ còn giữ schema11 thay vì coi port mở là code mới. Backup DB đang chạy trước restart/migrate, verify lại host/Electron worker sau nâng.

P07 còn drag/auto-append/overdue/actual dispatch/sleep-resume. Calendar authoring không certify Windows20/300 phones hay Facebook posting. Tiếp tục theo completion tracker.
