# V2.1 — tiện ích thao tác nhanh, giao diện gọn

Người dùng đã chốt các đề xuất C01–C12 và yêu cầu thêm shortcuts, chuột/lăn chuột, right-click và quick actions nhưng giữ UI gọn. Các tiện ích được phân bổ vào bước hiện có; master plan vẫn 15 phase/125 bước, version 2.1. Không tính việc làm preview là hoàn thành module production.

## Quy tắc bố cục

- Thanh workflow chỉ giữ 4 controls: menu `⋯`, Kiểm tra, Lưu, Chạy thử. Inputs/version/clone/import/export ở menu hoặc panel liên quan.
- Ưu tiên canvas; library/phone thu gọn được. Properties tự thu khi chưa chọn node, mở khi chọn; có toggle giữ lựa chọn.
- Không thu chữ toàn app để “gọn”. Khi canvas không đủ chỗ, giữ zoom đọc được và pan; Fit All vẫn là thao tác chủ đích.
- Advanced config chỉ hiện nhóm phù hợp node type; không mở sẵn mọi tọa độ/OCR/loop field.
- Nút ít dùng đưa vào context menu/overflow/palette, không thêm một toolbar ngang dài.
- Icon có tooltip/accessibility label. Lệnh nhóm ghi rõ selected scope; destructive action có confirm hoặc undo phù hợp.

## Những gì đã có trong HTML Compact

| ID | Tiện ích | Tương tác | Vị trí |
|---|---|---|---|
| UX-001 | Command palette | Ctrl+K, tìm lệnh/node, ↑↓/Enter/Esc | Header hoặc phím tắt |
| UX-002 | Chuyển 6 route | Alt+1…6 | Keyboard |
| UX-003 | Shortcuts theo focus | Đang gõ không xóa/copy node; Space ngoài canvas giữ hành vi thường | Toàn app |
| UX-004 | Lưu nhanh | Ctrl+S lưu cấu hình đang chỉnh | Keyboard |
| UX-005 | Undo/redo, copy/paste/duplicate | Ctrl+Z/Shift+Z, C/V/D trong canvas | Keyboard + node menu |
| UX-006 | Căn vừa vùng chọn | Shift+F; Ctrl+0 căn toàn bộ | Canvas/context menu |
| UX-007 | Nudge node | Mũi tên 1 đơn vị, Shift+mũi tên 10; undo theo thao tác | Canvas |
| UX-008 | Wheel/pan | Ctrl+lăn zoom quanh con trỏ; lăn dọc; Shift+lăn ngang | Canvas |
| UX-009 | Thu gọn panels | Ctrl+B library; Ctrl+Alt+P phone; Properties theo selection | Canvas tools |
| UX-010 | Ghim node hay dùng | Sao ★ trong library, danh sách favorites lưu cục bộ | Library |
| UX-011 | Context menu đúng loại | Node/dây/nền có lựa chọn phù hợp, thêm detach/fit/palette | Right-click/Shift+F10 |
| UX-012 | Menu dòng nội dung | Bulk edit, duplicate ID mới/reset lịch, copy caption/path, clear pending, remove | Right-click row |
| UX-013 | Device Tools 3 tab | Kết nối / Ứng dụng / Mạng | Menu thiết bị |
| UX-014 | Quick actions gọn | Mở app/Gallery/Files/Settings/Browser/VPN, screenshot/reconnect/force-stop trong overflow | Dưới phone pane |
| UX-015 | Progressive advanced form | Chỉ hiện gesture/loop/OCR/text options đúng loại node | Advanced modal |
| UX-016 | Hướng dẫn nhanh | F1, bảng shortcuts và gestures | Modal |
| UX-017 | Ẩn/hiện cột | Lưu lựa chọn theo workflow | Media table |
| UX-018 | Subflow back stack | Về graph cha theo lịch sử mở | Breadcrumb/back |
| UX-019 | Phone zoom đồng bộ | Fit reset slider/label/transform; Ctrl+lăn đổi zoom | Phone pane |
| UX-020 | Clone giữ custom schema | Copy full bundle và inputs thay main graph đơn lẻ | Workflow menu |
| UX-021 | Context dữ liệu đúng máy | Chuyển máy lưu/khôi phục rows, lịch, weekdays và source policy | Devices/Process |
| UX-022 | Library filter độc lập | Lọc TikTok không đổi app của workflow đang chỉnh | Workflow library |
| UX-023 | Tooltip/accessible names | Các icon có tên thao tác | Buttons |
| UX-024 | Hủy chèn dây không giữ state cũ | Đóng modal/Esc hủy pending insertion | Canvas |

HTML là preview từ reference và vẫn dùng thiết bị/frames/run minh họa. Device tools có layout thật để xem, nhưng các nút cài/gỡ/routing/ADB execution disabled; không giả kết quả hardware.

Theo C02 đã chốt, Thư viện có nút thêm app theo package. App tùy chỉnh có workflow trống/generic và input riêng; không tự kế thừa subflow/selector Facebook. Việc đăng ký cấu hình trong HTML không xác nhận package đã cài hoặc automation hoạt động.

## Bổ sung đã chốt cho source production, chưa thực thi trong preview

| ID | Tiện ích | Contract/acceptance |
|---|---|---|
| UX-025 | UI-tree search, filter thuộc tính, freeze snapshot | Snapshot thực; chỉ refresh theo yêu cầu/thay đổi có kiểm soát, đồng bộ frame/XML |
| UX-026 | Test selector trước khi áp dụng | Highlight và count 0/1/n matches; copy selector, fallback list, cảnh báo stale |
| UX-027 | Click lỗi để tới node/dòng | Validation issue mang stable graph/node/content ID; không lookup bằng tên trùng |
| UX-028 | Panel/splitter và preferences đầy đủ | Lưu bố trí/zoom theo workspace/graph; reset layout; không sửa runtime state |
| UX-029 | Shortcut help theo ngữ cảnh và onboarding | Luồng ngắn: thêm node → chọn element → kiểm tra → thử → lưu version; không nhét tutorial dài vào canvas |
| UX-030 | Batch progress/cancel/partial results | Thao tác nhiều máy có trạng thái từng máy; cancel tôn trọng pending transaction |

Inspector hoàn chỉnh còn cần backend và máy thật. Chưa có benchmark để tuyên bố hơn Genfamer.

## Files và kiểm tra preview

- Source helpers: `tools/preview/compact.js`, `compact.css`.
- Build: `python tools/preview/build_compact.py`.
- HTML độc lập: [AutoReels-Studio-Compact.html](../../previews/AutoReels-Studio-Compact.html).
- Browser check: `python tools/preview/test_compact.py` (cần Python Playwright và Chromium trong môi trường kiểm tra).
- Evidence: `docs/previews/evidence/`.

Các kiểm tra này chỉ nghiệm thu preview. Ứng dụng Electron, SQLite, scheduler và thao tác Android vẫn theo acceptance production của từng phase.
