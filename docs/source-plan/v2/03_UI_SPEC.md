# Layout và interaction specification

Mục đích: đủ chi tiết để implement component và acceptance mà không phải suy đoán từ ảnh. Danh sách command/field/event cụ thể nằm trong `ui-actions.json`, `ui-fields.json`, `ui-delegates.json`; file này định nghĩa ngữ cảnh và hành vi xuyên màn hình.

## 1. Design system và shell

Theo reference: rail 64px, header 55px, footer 25px; primary #5b58e8; panel trắng, nền #f3f5f9; dark theme theo token. Default body 13px Segoe UI/system, nhiều label 10–12px. Giữ visual language, dùng SVG icons ổn định có accessible name.

Rail có 6 route: Điện thoại / Inspector / Tiến trình / Thư viện / Lịch đăng / Lịch sử. Footer theme/settings/help; header breadcrumb, notifications, workspace status. Badge OFFLINE/PREVIEW chỉ ở reference/dev; production hiển thị trạng thái thật: lưu cục bộ, kết nối thiết bị, adapter/certification.

Prototype đo được ở 1920/1366/1024 không tràn document; ở 390 có min-width 1000. V2 chọn desktop min-window 1100×720 làm baseline, có mode hẹp collapse library/phone; không tự quảng cáo mobile web support. Windows DPI 100/125/150%, maximize/restore và nhiều màn hình là visual acceptance bắt buộc.

Mọi modal có focus trap, label, validation inline, Escape theo safe policy và trả focus về nút mở. Dirty form không mất data chỉ vì đổi tab. Toast phản ánh kết quả service, không phản ánh việc vừa click. Context menu bám viewport, có keyboard navigation.

## 2. Điện thoại

- Header: title, quản lý thiết bị, refresh; metrics từ registry/query thật: registered/online/processes/pending content có scope rõ.
- Toolbar: search name/model/serial, tile-size slider, bulk menu. Slider chỉ đổi layout, không tự tăng stream quality.
- Card: connection/capability state, checkbox selected group, preview last frame hoặc unsupported/empty, model/Android/transport, enabled toggle, Setup và Inspector.
- Active card và selected group khác nhau. Enabled chỉ cho phép nhận việc, không biến offline thành online hoặc uncertified thành certified.
- Setup luôn gọi navigation/context service; Inspector chỉ đổi testDevice, không đổi Process bindings.
- Bulk: enable/disable, manual-control group, reconnect hoặc app operations theo capability; kết quả từng device.
- Right-click: info/setup/inspector/refresh/device tools theo reference; các extension legacy ở device tools, không nhồi nút mới tùy ý vào card.

States: chưa có ADB, chưa có thiết bị, unauthorized, offline, reconnecting, manual supported nhưng automation unsupported, partial batch failure. Không nạp 4 điện thoại mẫu vào runtime production.

## 3. Inspector: phần trên và library

- Workflow header: app logo, tên, draft revision hoặc version đang xem, breadcrumb main/subflow; workflow dùng chung nhiều máy.
- Actions: workflow menu, inputs, validate, save, debug/run. Save xong chỉ hiện saved khi ACK. Real run bị gate theo device/certification/inputs; trace-only ghi nhãn rõ.
- Library trái: search, Node/Subflow tabs, grouping 40 loại node; click plus hoặc drag/drop.
- Kéo thả dùng world coordinates qua inverse viewport transform. Unknown payload không tạo node fallback thành Start.
- Subflow library list theo workflow bundle/dependencies, phân biệt local graph và reusable version reference. Tạo subflow không giả định account/page/compose/comment là keys global duy nhất.

## 4. Canvas và gestures

Canvas có toolbar undo/redo/layout/options; world layer gồm groups/edges/nodes; toolbar dưới zoom ±/percent/fit/snap/focus; minimap. Nhóm chỉ đổi visual, subflow đổi control flow.

| Tương tác | Hành vi bắt buộc |
|---|---|
| Click node / Shift+click | Single/multi-select; bottom properties theo selection; không mất group khi drag |
| Shift+drag nền | Marquee đúng world bounds, kể cả node đã resize |
| Kéo node/resize | Snap/grid; pointer capture; auto-pan không làm lệch delta; undo một transaction |
| Kéo nền/Space+drag | Pan, không kéo node dưới Space; scope canvas |
| Ctrl+wheel | Zoom quanh con trỏ; limits theo editor, không đổi graph data |
| Drag cổng output→input | Validate node/port/source/target; duplicate-output policy rõ |
| Click/right-click edge | Select, xóa, insert-node, reroute; insert-node cancel không giữ stale pending edge |
| Double-click node | Mở subflow hoặc advanced config; không vừa tạo drag edit vừa mở |
| Double-click nền | Node picker có filter và focus |
| Layout/align/group | Dùng kích thước node thật; membership/lifecycle consistent |
| Minimap | Fit/navigate có viewport indicator; không ảnh hưởng semantics |

Node chrome có type/icon/name/id/detail, input/output handles, actions run/stop/edit/copy/delete/open-or-more, resize handle, breakpoint badge. Actions luôn resolve theo node ID tại thời điểm gửi, không theo index của DOM.

Node menu: run selected/from, advanced, rename, duplicate, copy, breakpoint, group, convert subflow, delete. Edge menu: delete/insert/reroute. Canvas menu: add/paste/select-all/layout horizontal/vertical/align/fit/minimap/help. Group extension V2: rename/ungroup có undo; collapse chỉ ẩn nội dung, không làm thay đổi graph execution.

## 5. Properties và advanced config

Common fields: name, timeout, post-action delay range, description. Config form theo `node-catalog.json`, không hiển thị coordinate/OCR/loop knobs vô nghĩa cho mọi node.

Selector mode: resource-id/accessibility/text/XPath/image/OCR/relative geometry; chọn mode cần config tương ứng. Confidence ∈[0,1], finite coords theo content rect, timeout có đơn vị, retries chỉ trong safe scope. Side-effect setting không cho renderer tự bỏ gate certification của adapter.

Advanced có effect classification, gesture duration, bounded scroll/loop config, fallbacks có thứ tự, Unicode mode, error scope. Simulation branch chỉ thuộc fixture/debug session, không lưu thành lựa chọn true/false ép runtime.

Subflow có version/ref selector và typed input/output mapping. Convert selection chỉ hỗ trợ single entry với exit mapping rõ; selection không đạt yêu cầu thì explain, không auto-rewire sai. Breadcrumb/back đi theo stack thực, không luôn nhảy main.

## 6. Bottom tabs và keyboard

- Properties: editor như trên; multi-selection có trạng thái riêng.
- UI Tree: snapshot thật có serial/app/version/timestamp/XML/frame correlation; empty khi chưa kết nối. Click tree chọn element tương ứng, không luôn trả create_post.
- Variables: input/row/local/output theo frame và test case; redact sensitive values. Finished trace không tự sinh post ID.
- Logs: events có severity/time/op/run/node; filter/export theo scope.
- Debug: pause/continue/step-over/step-into/step-out/stop/breakpoint; call stack và mode hiện rõ.

Shortcuts: Ctrl+S save; Ctrl+Z/Shift+Z/Y undo/redo; C/V/D/A chỉ trong canvas; F tìm library; Ctrl+0 fit; F2 rename; Delete/Backspace khi canvas focus; Space pan; Escape cancel wire/menu/dialog. Khi gõ không lấy phím xóa/chọn văn bản làm graph edit. Không chặn Space ở route khác.

## 7. Điện thoại test, docking và popup

- Test-device selector độc lập Process. Toolbar pick/control/refresh/fit/layout/popup; info dùng metadata thật.
- Chế độ pick không gửi tap xuống máy; mode control yêu cầu manual lease. Click không tự gửi thao tác và gắn selector đồng thời.
- Stream/phone frame có resolution/orientation/insets; hit-test trong content rect; bounds XML scale cùng snapshot.
- Pick modal: class/resource-id/text/content-desc/bounds/selector/match count/confidence/snapshot age. Apply vào node hoặc tạo node mới; stale/ambiguous thì báo, không hứa 1 match giả.
- Right/top/floating/popup layouts dùng cùng session subscription; không mở encoder mới tùy tiện cho từng window.
- Resize/dock/zoom lưu geometry; fit cập nhật slider, label và transform cùng state. Floating luôn có drag handle/close/dock và bounds sau đổi monitor.
- Popup dùng preload/IPC channel được cấp quyền hoặc postMessage allowlist sender+origin+nonce với danh sách actions; không forward arbitrary dispatcher action.

## 8. Tiến trình

Thứ tự: page actions clone/options/save → device/process selection → app/workflow/account/target → data/source actions → content table → schedule editor. Có Process draft chưa gán thiết bị; không bịa account/target để cho đủ dropdown.

Đổi app/workflow cần xử lý mapping không tương thích bằng preview và giữ data cũ ở Process gốc. Library filter không làm đổi app Process. Target labels thay theo app capability; không gọi mọi đích là Fanpage.

Dynamic schema: text/number/boolean/url/identity/datetime/file/file[]/list có editor riêng. File[] có asset list reorder; comments là list có thứ tự, không chỉ textarea tách dòng mặc định. Required/error gắn theo field. Output hiển thị read-only sau run, không trở thành input bắt người dùng điền.

Content table theo stable content ID; thumbnail/content, fields theo schema, duration, path, schedule, status, more. Không tự thêm các cột không được workflow khai báo. Virtualization, pending-save/error và selected count rõ. Header select-all áp dụng visible/query scope đã công bố.

Folder/file import ghi nhận nguồn thật trong desktop; browser selection chỉ metadata thì phải nói rõ. Bulk dùng unchanged/set/append/prepend/clear; không sửa item có immutable job ngầm. Import preview có authoritative matching, unmatched/ambiguous/duplicates; export giữ custom fields/types và chống spreadsheet formula execution.

Row more: ID/assets/path/status/job refs/history. Remove bỏ binding/ignore, không xóa file PC. Clone tạo Process/content IDs mới, giữ asset refs nếu phù hợp; clear schedule/status/credentials/device binding theo preview, không tạo Page/account.

## 9. Schedule và history

Schedule editor mặc định 08/12/19; weekdays per-process; start local date; jitter tùy chọn có preview; scope unscheduled/selected/pending. Slots pagination 24 là UI convenience, không trần nghiệp vụ. Apply token ràng buộc process revision/job set; callback không dùng `window.pendingSchedule` toàn cục.

Timeline query toàn workspace; filter app/process/device/date range; Day/Week/Month/Range theo capability UI thống nhất. Ngày/giờ đổi bằng explicit reschedule service, preserve job ID/snapshot. Cấm drag pending/posted transaction. Conflict/overdue khác nhau. Preview random/spread được lưu và apply chính xác.

History phân biệt AUTHORING/TRACE/REAL_RUN; count posts/comments chỉ từ verified transactions. Review modal có target/run/effect/evidence hiện có, quyền người xử lý, kết luận và save action thật. Kết luận chưa đăng không tự chạy lại. Logs export có nội dung lựa chọn và redaction; không chia sẻ ra ngoài chỉ vì bấm xem diagnostics.

## 10. Settings và states xuyên suốt

Theme/layout ở workspace/user preferences; source/schedule/overdue ở Process; engine budgets ở execution settings; secrets ở OS vault. Backup/restore có schema/revision/hash validation, preview và atomic commit. Reset demo DEV_ONLY; production reset cần backup/explicit scope, không dùng reload để xóa dữ liệu.

Mỗi component có loading/empty/error/cancel/unsupported/dirty/saved; business actions cần disabled reason. Không đưa tên phase, raw implementation hoặc stack trace vào luồng người dùng trừ diagnostic detail có chủ đích.
