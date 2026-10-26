# Độ sẵn sàng và những điều chưa được chứng minh

Ngày 26/10/2026. **Đã clear nghiệp vụ và bố cục để bắt đầu code; chưa có bằng chứng production/Windows/Android.** Các mục sau có owner, thời điểm kiểm tra và cách xử lý, không phải danh sách câu hỏi yêu cầu người dùng chốt lại những quyết định đã chấp thuận.

Đây là risk register tại lúc lập plan. Toolchain và SQLite/Electron/Linux đã có implementation/checks ở checkpoint sau; xem [progress](../../implementation/PROGRESS.md) và [ADR lựa chọn driver/CSP](../../implementation/ADR-001-SQLITE-AND-CSP.md). Windows/Android và các capabilities chưa implement vẫn UNRUN; không reset source vì bảng trạng thái lịch sử.

| ID | Trạng thái thực | Chặn phần nào | Kiểm chứng / xử lý | Owner bước |
|---|---|---|---|---|
| RD-01 | FULL-TRANSFER ZIP NOT_READ vì giới hạn 32 MiB | Claim kế thừa nội dung/source/DB trong gói đó | Baseline đã chốt xây mới từ nguồn đã đọc; nếu cần source cũ phải kiểm kê bổ sung trước ghi đè/migrate | S001/S003 |
| RD-02 | Runtime toolchain chưa pin/install trong app checkout; pnpm hiện 11.25.0, plan cũ nêu 12.6.0 | Reproducible install/app foundation acceptance | Resolve stable package versions/integrity, pin lockfile, activate exact manager, clean frozen install | S005/S006 |
| RD-03 | SQLite driver/Electron ABI chưa smoke | Persistence/native packaging support | Main-only Electron harness; chọn driver sau read/write/transaction/reopen; Windows kiểm riêng | S015/S121 |
| RD-04 | Chưa có profile Windows và phones của người dùng trong evidence | Hardware support/latency/scale claims | Thu OS/CPU/RAM/GPU/DPI, models/Android/app/locale/transports khi tới hardware; bắt đầu 2+ phones, không hard cap nghiệp vụ | S070/S086/S118 |
| RD-05 | Embedded decoder/control và coexistence chưa chứng minh | Real stream/manual input | Spike pinned scrcpy/ADB/decoder, ownership, latency/reconnect; fail thì đổi provider hoặc unsupported, không frames giả | S077–S079/S086/S093 |
| RD-06 | Unicode/helper/multitouch còn profile-dependent | Type/pinch/advanced gestures đã công bố hỗ trợ | Verify vi/en/emoji/multiline và touch mapping; helper chỉ khi cần và có chủ đích; unsupported có reason | S083/S087 |
| RD-07 | Exact media/MediaStore/picker chưa thử | Real compose/asset selection | Kiểm hash/order/index/permissions bằng owned staging ledger; mơ hồ thì stop/review | S088/S095/S096 |
| RD-08 | Identity/target và exact publish/comment signals chưa có evidence | Auto-publish và recovery certification | Controlled targets, journal trước effect, verifier profile-specific; thiếu negative proof giữ uncertainty, không blind retry | S089–S091/S097–S101 |
| RD-09 | OCR/image provider chưa chọn/đo | Recognition capabilities tương ứng | Fixtures + phone vi/en, confidence/false matches/latency/license/offline data; tree selectors ưu tiên, provider unsupported rõ | S083/S118/S120 |
| RD-10 | Non-root proxy/VPN/app traffic routing chưa chứng minh | Từng routing type, không chặn authoring/R1 nếu routing chưa ship | Phân biệt parse/PC egress/device/app traffic; helper/rollback; fail type nào không claim type đó | S092/S113–S115 |
| RD-11 | Chưa có benchmark Genfamer cùng version/workload/hardware | Claim “nhanh hơn Genfamer” | Đo baseline nội bộ trước; so sánh chỉ khi có đối chứng cùng điều kiện | S118 |
| RD-12 | Git push trước bị 403: kết nối sanfrankim không có quyền ghi repo | Upload GitHub; không chặn code/test/commit local | Cấp Write hoặc kết nối tài khoản có quyền; không trích credential/token hoặc force-push để né quyền | S004/S125 |

Các mục RD-03…RD-11 là câu hỏi kỹ thuật cần thử nghiệm; không yêu cầu người dùng chọn thay người triển khai thư viện/driver/decoder. Những thông tin phần cứng còn thiếu được thu trước gate phụ thuộc, không dùng cloud configuration thay PC thực.

## Những điểm plan được làm rõ trong lần này

1. Feature map trước trỏ tất cả bước của phase: thay bằng 1–4 bước cụ thể cho đủ 330 IDs.
2. Device filter/tile-size/group checkbox/LAN endpoint bị gán P06: chuyển về owner thiết bị. Review fields chuyển về P11.
3. Field signature dùng lại qua nhiều modal: ghi context variants và meaning riêng; không reuse USB/LAN options vào review/settings chỉ vì HTML mẫu dùng select giống nhau.
4. Undo/clipboard/layout/reroute là editor-local commands; save ACK mới là persistence. File dialogs cần host authorization được phân loại privileged.
5. Overdue trong Settings là default cho Process mới; policy của Process cũ/jobs không bị global setting rewrite.
6. OCR/image/gesture providers, including pinch và bounded scroll, được gắn bước implementation/hardware/licensing; handler declaration riêng không đủ chứng nhận support.
7. Native SQLite/stream/publish risk harness được làm sớm khi đủ contracts, không chờ hoàn thiện mọi panel. Full phase acceptance vẫn giữ dependencies.
8. S074 worker không phụ thuộc S064 UI/scheduler completion; hai bên chia sẻ lease contract S019. Publish spike dùng journal tối thiểu, tránh vòng chờ P11/P12.
9. R1 ưu tiên Facebook Reels + TikTok, app còn lại không bị bỏ scope và không chặn R1 chỉ vì số thứ tự bước.
10. 125 steps/375 tasks/250 scenarios là quy mô kế hoạch; tất cả production acceptance hiện PLANNED/UNRUN, không chuyển thành PASS bởi việc sinh tài liệu.

## Khi gặp một giả định thất bại

Ghi exact build/profile và bằng chứng FAIL → xác định capability bị ảnh hưởng → sửa adapter/thiết kế hoặc DEFERRED/UNSUPPORTED có lý do → cập nhật contracts/UI/test mapping → chạy lại checks bị ảnh hưởng. Giữ nguyên các capability độc lập đã có bằng chứng. Lỗi routing/OCR không biến thành random success và không bắt toàn bộ editor dừng hoạt động.
