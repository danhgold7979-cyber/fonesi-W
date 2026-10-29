# Bản đồ giao diện và các yêu cầu khi chuyển sang React

Tham chiếu: `Facebook_Auto_Farm_FINAL_V17.html`, SHA khớp manifest. Đây là phân tích UI/UX và đề xuất triển khai, không sửa thiết kế frozen.

## 1. Cấu trúc tổng thể

```text
┌────────────────┬─────────────────────────────────────────┬──────────────────┐
│ Sidebar máy    │ Header: máy đang chọn + công cụ hệ thống │ Tổng quan / máy  │
│ Tìm/lọc/quét   ├─────────────────────────────────────────┤ Preview điện thoại│
│                │ CPU / RAM / GPU / Disk / FPS / Quality   │ Input điều khiển │
│ Danh sách máy  ├─────────────────────────────────────────┤ Quick apps       │
│ + tình trạng   │ Nick + đích đăng                        │ VPN              │
│ + tiến độ      │ Workflow thực tế                        │ Job đang chạy    │
│                │ Campaign/folder + bulk edit + bảng video│                  │
│                │ Cấu hình lịch                           │                  │
└────────────────┴─────────────────────────────────────────┴──────────────────┘
```

Modal riêng: timeline, Proxy, APK, clone cấu hình, thêm kết nối. Floating MASTER là cửa sổ nổi điều khiển thiết bị/nhóm, không phải modal cấu hình.

UI là dashboard vận hành desktop mật độ cao. Màu nền dark xanh đen; accent tím xanh; xanh lá cho tích cực, vàng cho chờ, đỏ cho lỗi/giảm. Light theme cũng có sẵn. Typography body 13px, nhiều label/metric 7–11px; workflow có chữ rất nhỏ. Cần giữ bố cục đã chốt, đồng thời kiểm tra đọc được ở DPI Windows 125%/150% trước khóa visual baseline.

## 2. Sidebar và ngữ cảnh thao tác

- Thiết bị active: máy đang xem; selected set: nhóm nhận lệnh. Hai trạng thái khác nhau, phải phân biệt bằng style và thông báo nhóm.
- Search/filter chỉ thay danh sách hiển thị; không xóa device trong registry hay job.
- Quét USB là phát hiện thật. Manual add LAN phải kiểm tra địa chỉ/pairing, không tạo serial USB giả.
- Click đơn mở ngữ cảnh máy; Ctrl+click/drag selection thay nhóm; double-click mở MASTER.
- Context menu phải hiển thị phạm vi “1 máy”/“N máy” trước thao tác. Reconnect, restart Facebook, force-stop và worker ownership cần kết quả riêng từng máy.
- Không dựa vào màu chấm duy nhất: luôn có nhãn trạng thái và lý do lỗi.
- Tiến độ/còn bao nhiêu cần định nghĩa theo queue/campaign; bản mẫu có tổng device và tổng campaign lẫn nhau. Đề xuất hiển thị số job chưa hoàn thành trên device và nguồn thống kê rõ ràng.

Trạng thái cần có: chưa tìm thấy thiết bị, ADB chưa cài, cần xác nhận RSA, offline, đang reconnect, automation unsupported, kết quả scan từng máy.

## 3. Header và telemetry

- Header gồm tên máy, USB/LAN, trạng thái quyền điều khiển và các công cụ APK/Proxy/clone/timeline, chạy nền, đổi theme.
- Close khi chạy nền: ẩn vào tray; Quit là dừng/checkpoint có chủ đích. Toggle chạy nền không được chỉ đổi màu.
- Telemetry phải là dữ liệu thật từ host. GPU không đọc được phải hiện `—/Không hỗ trợ`; không sinh phần trăm giả.
- Disk là dung lượng ổ runtime/media liên quan, không phải quota storage của browser.
- FPS/quality chỉ điều chỉnh preview; MASTER giữ profile riêng. Cho biết profile thực nếu thiết bị/GPU không đạt FPS yêu cầu.

## 4. Account và đích đăng

- Hai combobox searchable: account/session và identity/profile/Page thuộc session đó.
- Rich label có tên, Page count, likes/follows và 1N/7N/30N; phần trăm tăng/giảm dùng màu và dấu.
- Khi chưa có snapshot quá khứ phải hiện `—`, không `0.0%`.
- Giữ stable ID trong value; label không phải định danh. Đổi account phải xử lý identity hiện chọn không còn hợp lệ.
- Badge “đã xác minh” phải gắn với đúng device/session/identity và thời điểm; không luôn hiển thị từ HTML mặc định.
- Rescan cần progress, cancellation ở safe point và thông báo scan thiếu/không đủ quyền.
- Dropdown render qua portal/overlay thích hợp để không bị card overflow cắt; kiểm tra keyboard và focus restore.

Các trạng thái riêng: chưa đăng nhập, login required, scan đang chạy, identity không thấy ở lần scan này, cần người dùng xem lại, metrics stale, phiên hết hạn, Facebook version chưa hỗ trợ.

## 5. Workflow

21 node tham chiếu mô tả hành trình từ Chuẩn bị tới Hoàn tất, với nhánh VPN, popup, Remix, Story và comment.

- Production graph là màn hình quan sát event từ state machine thật.
- Step next/simulate error/reset phải ở dev harness; không xuất hiện như nút vận hành production.
- Min/max delay phải validation `0 ≤ min ≤ max`, lưu theo Campaign và snapshot job.
- Hiển thị job ID/tên media/device, bước hiện tại, attempt, thời gian bắt đầu, lỗi có cấu trúc.
- Nếu mơ hồ sau Publish: hiển thị “Đang xác minh/Cần kiểm tra”, không “Đăng thất bại — thử lại” chung chung.
- Cần đường vào diagnostics và thao tác tiếp tục có điều kiện; không cho người dùng bỏ qua transaction chưa rõ.

## 6. Campaign/folder/media

Campaign selector, tạo mới, đường dẫn thư mục, folder picker, reconcile thủ công, tự quét và interval.

- Đổi Campaign phải lưu/khôi phục đủ folder, device, account, identity, schedule và defaults.
- Path dài cần tooltip/copy; tên folder ngắn không đủ phân biệt hai thư mục cùng basename.
- Watcher state tách biệt “đã bật” và “đang chạy/thư mục không truy cập được”.
- Media có 14 cột tham chiếu: chọn, thumbnail, filename, caption, hashtag, comment, audience, remix, story, date, time, target, status, post now.
- Bảng virtualized theo hàng, query phân trang/stream updates; chỉnh một ô không rerender mọi thumbnail.
- Có số dòng được chọn, trạng thái đang lưu/lỗi và toast kết quả bulk thực tế.
- Text có thể nhiều dòng: dùng editor/popover phù hợp; không ép tất cả caption/comment thành ô một dòng khó đọc.
- Bulk edit phân biệt “không đổi” với “xóa”; preview số mục bị ảnh hưởng trước thao tác thay toàn bộ.
- Post now tạo job có preflight/ownership; không cho click lặp sinh duplicate enqueue. File đã đăng không có nghĩa luôn cấm đăng lại, nhưng cần hành động tạo job mới rõ ràng.
- Remove from Campaign là ignore/hide, không xóa file PC. Xóa file vật lý nếu bổ sung phải là chức năng khác.
- Excel có template version, media ID/path, validation, preview rows hợp lệ/lỗi/trùng; export bằng dữ liệu backend, không chỉ trang bảng đang render.
- Target là selector identity có kiểm tra capability; không phải free text tên Page.

Empty/error states cần có: chưa chọn folder; folder trống; permission denied; file đang copy dở; corrupt/unsupported; thumbnail fail; media changed; missing; ignored; watcher reconnect.

## 7. Lịch và timeline

Khối lịch chính: start date, video/day, auto-append, dynamic time slots, Apply/Clear Pending.

- Hiển thị múi giờ và preview số job/ngày trước Apply.
- Apply lặp phải có behavior rõ; cancel/clear chỉ tác động job chưa bắt đầu và không phá lịch sử.
- Auto-append không tái tạo job cũ.
- Timeline lấy toàn bộ jobs từ backend theo range/devices, không lấy mảng video Campaign đang mở.
- Hàng máy chọn nhưng chưa có job: nên có hàng trống/empty message, không để người dùng tưởng bộ lọc bỏ máy.
- Ngày/Tháng/Khoảng ngày dùng chung normalization. Bản mẫu đang mở “Ngày” nhưng range nhiều ngày.
- Kéo time là sửa lịch có transaction + validation conflict và revision; job đang Publish không kéo được.
- Timeline job width thị giác hiện theo độ dài tên, không phải duration. Không dùng độ rộng này suy ra overlap nghiệp vụ.
- Anti-conflict phải preview tác động, đặc biệt khi đẩy job qua ngày; cần chốt phạm vi selected devices/range/toàn campaign.
- Target colors dựa trên ID ổn định; màu hash tên có thể trùng. Thêm legend/label thay vì hứa mỗi target luôn có màu độc nhất.

## 8. Overview/detail/MASTER

- Overview grid wrap, multi-select, Ctrl+A khi có ngữ cảnh đúng, fullscreen, Ctrl+wheel size.
- Detail panel kéo rộng sang trái; preview giữ aspect ratio, lớn hơn viewport thì scroll.
- MASTER nổi drag/resize và chất lượng độc lập. CSS prototype hiện khóa 350px nên Ctrl+wheel chưa đổi rộng được.
- Không dùng overlay modal chặn toàn ứng dụng nếu mục tiêu là vừa điều khiển MASTER vừa quản lý bảng; cần quyết định focus/keyboard của floating surface.
- Bind input chỉ khi có control ownership, loại trừ click trên nút UI. Hiển thị nhóm đang nhận lệnh và máy nào không acquire được.
- “Bỏ chọn tất cả” nên thực sự không broadcast tới nhóm; nếu fallback điều khiển MASTER, UI phải nói rõ. Prototype tự fallback về master/active device khi selected set rỗng.
- Chuẩn hóa tọa độ trong video content rect, kể cả rotate/letterbox; nhóm khác aspect ratio chỉ nhận tọa độ tương ứng, không bảo đảm cùng vị trí semantic trong Facebook.
- Visible/offscreen phân tầng encoder/decoder thật. Badge profile không phải bằng chứng stream policy.

## 9. Các modal quản lý

| Modal | Hành vi cần có |
|---|---|
| APK | Chọn file thật/package identifier, thiết bị đích, xác nhận uninstall, queue progress và lỗi từng device |
| Proxy | Parser → check PC → adapter support → apply → verify Android; mask secret; báo unsupported thay vì false success |
| Clone | Chỉ clone cấu hình; chọn campaign/template nguồn và đích. Không tạo identity hoặc sao chép phiên Facebook |
| Add device | USB hướng dẫn scan/authorize; LAN kiểm tra host:port, hỗ trợ pair/connect theo capability |
| Timeline | Có thể resize/fullscreen, range/device filtering, trạng thái load/rỗng/lỗi |

Proxy table hiện lệch header 7/row 8 cột; cần thêm nhãn “Loại” ở vị trí phù hợp khi triển khai component. Multi-device result không gộp 9 thành công/1 lỗi thành “thành công tất cả”.

Modal production cần role/label, focus trap, Escape theo policy, trả focus về nút mở, keyboard navigation, validation inline. Các icon hiện đa số chỉ có `title`; bổ sung accessible name, không chỉ phụ thuộc hover.

## 10. Kích thước đã đo

| Viewport | Sidebar | Main | Phone | Document scroll width |
|---|---:|---:|---:|---:|
| 1920×1080 | 220 | 1410 | 290 | 1920 |
| 1366×768 | 220 | 856 | 290 | 1366 |
| 1280×800 | 220 | 770 | 290 | 1280 |
| 1024×768 | 200 | 720 | 255 | 1219 |
| 390×844 | 200 | 720 | 255 | 1219 |

Desktop 1366 có bảng min-width 1280 trong vùng main 856: cuộn ngang là hành vi thực tế. 1024/mobile tràn toàn trang, chưa có responsive mobile. Với sản phẩm Windows desktop đây là giới hạn cần công bố/chọn min window size; không tự thêm dự án responsive mobile ngoài scope.

Cần nghiệm thu bổ sung ở Windows scale 100/125/150%, maximized/restored, kéo panel min/max, nhiều cột text dài, combobox hàng nghìn identity, màn hình dọc/ngang và bàn phím.

## 11. Component boundary đề xuất

`AppShell`, `DeviceSidebar`, `SystemStrip`, `IdentityPanel`, `WorkflowViewer`, `CampaignToolbar`, `BulkMediaEditor`, `VirtualMediaTable`, `ScheduleEditor`, `DevicePanel`, `OverviewGrid`, `StreamSurface`, `MasterWindow`, `TimelineDialog`, `ProxyDialog`, `ApkDialog`, `CloneConfigDialog`, `ConnectionDialog`, `OperationResults`, `ReviewQueue`.

Selection state trong renderer; thực thể và operation state lấy từ service. Mỗi component tương tác phải gắn feature ID với contracts và acceptance; dùng fixture trong dev/test, trạng thái unavailable trong production khi backend chưa có. Không gắn nút vào timer để làm giao diện trông như đã chạy thật.
