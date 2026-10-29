# Kế hoạch triển khai: 9 phase, 60 bước nghiệm thu

Trạng thái: PLANNED. Đây là cách chia việc thực thi từ backlog đã phân tích, chưa phải bằng chứng hoàn thành. Đánh số phase 0–8, bước 01–60. Mỗi bước gồm implementation và verification phù hợp; một bước không đồng nghĩa một lệnh hoặc một phiên làm việc.

Gói gốc có Phase 0–15 và Phase 2.5, tổng 17 phase. Bảng dưới gom chúng thành 9 phase thực thi và giữ mapping để không bỏ phạm vi. Các đề xuất đổi thứ tự/gate cần được ghi vào quyết định triển khai; baseline Windows/Android không tự được coi là PASS trên cloud.

Nếu có code mới hơn V1.7, bước 01 kiểm kê và điều chỉnh các bước cần kế thừa trước scaffold.

| Phase | Nội dung | Bước | Số bước | Phase trong gói gốc |
|---|---|---|---:|---|
| 0 | Nền repository và công cụ | 01–06 | 6 | 0 |
| 1 | Ứng dụng Electron và giao diện khung | 07–13 | 7 | 0 + phần nền 1 |
| 2 | Dữ liệu, job và lập lịch | 14–20 | 7 | 1 + 6 + nền 11 |
| 3 | Thư mục video và bảng media | 21–27 | 7 | 5, trừ phần clone phụ thuộc account |
| 4 | Kết nối Android và quyền điều khiển | 28–33 | 6 | 2 |
| 5 | Kiểm chứng khả thi trên thiết bị thật | 34–41 | 8 | 2.5 |
| 6 | Màn hình thật, điều khiển nhóm và danh tính | 42–48 | 7 | 3 + 4 + 7 + 8 + 9 + clone của 5/7 |
| 7 | Đăng Reel và phục hồi giao dịch | 49–55 | 7 | 10 + 11 + 12 |
| 8 | Công cụ bổ sung, hardening và phát hành | 56–60 | 5 | 13 + 14 + 15 |

## Chi tiết và điều kiện nghiệm thu

### Phase 0 — Nền repository và công cụ

| Bước | Công việc | Điều kiện nghiệm thu |
|---:|---|---|
| 01 | Kiểm kê baseline, lưu reference và checksum | Phân biệt source thực, prototype và ghi chú chưa có evidence; bảo toàn file gốc. |
| 02 | Chốt cấu trúc workspace và quy trình cloud/Windows | Ghi quyết định môi trường; mỗi gate có mục tiêu và nơi thực hiện. |
| 03 | Viết AGENTS.md, README và .gitignore | Hướng dẫn tái lập, invariant và dữ liệu không đưa vào Git đầy đủ. |
| 04 | Ghim Node, pnpm và dependency nền | Cài bằng lockfile tái lập; chính sách build scripts tường minh. |
| 05 | Thiết lập TypeScript, lint, format và test runner | Có kiểm tra hành vi nền có ý nghĩa; báo số test thực sự chạy. |
| 06 | Thiết lập CI và kiểm tra nền | Linux checks và Windows checks tách biệt; có kết quả clean install/build. |

### Phase 1 — Ứng dụng Electron và giao diện khung

| Bước | Công việc | Điều kiện nghiệm thu |
|---:|---|---|
| 07 | Khởi tạo Electron, React và Vite | App khởi động/đóng đúng; entry Main/preload/renderer tách biệt. |
| 08 | Thiết lập sandbox và bảo mật renderer | Không có Node/shell tùy ý từ renderer; navigation/CSP có chính sách. |
| 09 | Tạo typed IPC, validation và lỗi chuẩn | Sender/payload sai bị từ chối; batch có kết quả từng thiết bị. |
| 10 | Thiết lập data root, logger và single-instance | Dữ liệu tách source; log redaction; instance thứ hai không chạy scheduler riêng. |
| 11 | Tạo SQLite nền và settings | Migrate/restart giữ settings; module native chạy dưới Electron ABI đã pin. |
| 12 | Dựng shell V17, dark/light và empty states | Bố cục trái/giữa/phải đúng; chưa có thiết bị không hiện dữ liệu giả. |
| 13 | Hoàn thiện tray, close, background và Quit | Toggle lưu thật; Quit checkpoint; kiểm tra vòng đời trên Windows. |

### Phase 2 — Dữ liệu, job và lập lịch

| Bước | Công việc | Điều kiện nghiệm thu |
|---:|---|---|
| 14 | Thiết kế domain và schema đầy đủ | ID, relationships, indexes, state/error labels nhất quán. |
| 15 | Thực hiện migrations, transactions, backup/restore | Integrity và migration fixtures pass; backup nhất quán với WAL. |
| 16 | Làm Campaign CRUD và cấu hình riêng | Hai Campaign không rò folder, schedule, defaults; archive giữ lịch sử. |
| 17 | Làm Job snapshot và transaction ledger | Snapshot versioned/immutable; uncertainty được ghi trước side effect. |
| 18 | Làm timezone, slots và policy lịch | UTC+7 round-trip đúng; chốt overdue, overlap, reapply và auto-append. |
| 19 | Làm generator, queue và ownership nền | Generate idempotent; một device một job; recovery từ crash. |
| 20 | Làm Schedule Editor và Timeline backend/UI | Query toàn bộ jobs đúng range/máy; kéo/clear/spread an toàn và lưu thật. |

### Phase 3 — Thư mục video và bảng media

| Bước | Công việc | Điều kiện nghiệm thu |
|---:|---|---|
| 21 | Làm folder picker và binding Campaign | Chọn đúng đường dẫn; missing/permission error hiển thị rõ. |
| 22 | Làm watcher và reconcile không chồng | Sự kiện gắn Campaign/generation; auto-append không đổi job cũ. |
| 23 | Làm fingerprint, validation và phát hiện đổi file | Copy dở/corrupt/missing/changed không bị coi là media sẵn sàng. |
| 24 | Làm thumbnail queue và cache | Giới hạn concurrency; lỗi một file không chặn các file khác. |
| 25 | Làm bảng virtualized và sửa từng dòng | Các trường lưu thật; đúng identity ID; dữ liệu lớn vẫn tương tác. |
| 26 | Làm chọn nhóm, bulk edit, clone metadata và ignore | Phân biệt unchanged/set/clear; không xóa nhầm file gốc hoặc lịch sử. |
| 27 | Làm Excel import/export | Stable ID/path matching; preview lỗi/trùng; round-trip giữ dữ liệu. |

### Phase 4 — Kết nối Android và quyền điều khiển

| Bước | Công việc | Điều kiện nghiệm thu |
|---:|---|---|
| 28 | Phát hiện và kiểm tra Platform-Tools | Executable/version đúng; lỗi cài đặt có chẩn đoán. |
| 29 | Nhận USB và kết nối/pair LAN | Thiết bị thật; authorization, endpoint và kết quả connect được xác minh. |
| 30 | Lưu device identity, connections và capability | Đổi transport không tự tạo sai device; hỗ trợ manual/automation tách biệt. |
| 31 | Làm heartbeat, reconnect và sidebar thật | Kết nối thay đổi cập nhật live; lỗi một máy độc lập. |
| 32 | Làm acquire/release và pause/redetect ownership | Mọi control/app/network mutation đi qua quyền điều khiển. |
| 33 | Nghiệm thu registry nhiều máy | Ít nhất hai máy thực; reconnect/authorization độc lập; ghi evidence Windows/Android. |

### Phase 5 — Kiểm chứng khả thi trên thiết bị thật

| Bước | Công việc | Điều kiện nghiệm thu |
|---:|---|---|
| 34 | R1: Stream/control nhúng Electron | Hai máy thực có video H.264, tap/swipe, clipboard, reconnect và profiles. |
| 35 | R2: Unicode trên Facebook | Tiếng Việt, emoji, URL và newline đúng trên field thật. |
| 36 | R3: PC → Android → đúng video trong picker | Đúng source trên hai Android/vendor profiles, video dọc/ngang. |
| 37 | R4: Quét account/Profile/Page | Đối chiếu với kiểm tra thủ công; scroll/deduplicate đúng. |
| 38 | R5: Nhận diện trạng thái Facebook | Các state chính nhận đúng; unknown có diagnostics, không đoán. |
| 39 | R6: Xác minh bài đăng | Controlled test Page có tín hiệu phân biệt posted/pending/ambiguous. |
| 40 | R7: Proxy routing thực | Mỗi loại claimed-supported có evidence Android egress/Facebook; loại khác DEFERRED rõ. |
| 41 | R8: ADB coexistence | Chốt chính sách chung/riêng/exclusive bằng kiểm tra thực, không giết server khác tùy tiện. |

### Phase 6 — Màn hình thật, điều khiển nhóm và danh tính

| Bước | Công việc | Điều kiện nghiệm thu |
|---:|---|---|
| 42 | Làm stream lifecycle và profiles production | Server/client pinned; bounded buffers; reconnect không mất job state. |
| 43 | Làm Overview, Detail và panel resize/zoom | Real frames; aspect ratio/scroll/visibility policy đúng. |
| 44 | Làm floating MASTER | Drag/resize/Ctrl+wheel hoạt động; chất lượng độc lập preview. |
| 45 | Làm chọn nhóm, normalized input và context/quick actions | Khác độ phân giải/rotation vẫn mapping đúng; per-device ownership/results. |
| 46 | Làm manual login, account scanner và identity verification | Không lưu Facebook credentials; unknown app/locale chặn automation. |
| 47 | Làm metrics snapshots và rich combobox | 1/7/30 ngày có nguồn thật; thiếu lịch sử hiện dấu gạch. |
| 48 | Làm semantic detector/adapters và clone cấu hình | Selectors versioned; clone settings không tạo identity/clone session. |

### Phase 7 — Đăng Reel và phục hồi giao dịch

| Bước | Công việc | Điều kiện nghiệm thu |
|---:|---|---|
| 49 | Làm preflight đầy đủ | Đúng device/session/identity/file/network/capability trước hành động. |
| 50 | Làm staging, transfer và MediaStore | Source fingerprint khớp; readiness quan sát được; staging ownership lưu bền. |
| 51 | Làm chọn đúng video và điền nội dung | Picker identity, Unicode, audience/remix/story được verify trước Publish. |
| 52 | Nối Publish vào transaction và verify thật | Ghi intent/uncertainty trước click; pending không tự click lại. |
| 53 | Làm crash recovery và xử lý ambiguous | Kill trước/sau click/verify không dẫn tới retry mù; NEEDS_REVIEW khi thiếu chứng cứ. |
| 54 | Làm comment transaction và retry riêng | Xác minh đúng bài/comment; không repost hoặc duplicate comment từ uncertainty. |
| 55 | Làm cleanup an toàn và nghiệm thu end-to-end | Chỉ xóa staging owned sau điều kiện an toàn; giữ media khi pending; không đụng video khác. |

### Phase 8 — Công cụ bổ sung, hardening và phát hành

| Bước | Công việc | Điều kiện nghiệm thu |
|---:|---|---|
| 56 | Hoàn thiện Proxy/VPN và UI quản lý | Adapter theo capability, mutual exclusion, routing verify, secret protection. |
| 57 | Hoàn thiện APK manager | Install/uninstall file/package thật; bounded queue, cancellation và per-device results. |
| 58 | Hoàn thiện vận hành và diagnostics | Retention, export, notifications, low disk, backup/restore, shutdown/sleep/resume. |
| 59 | Kiểm tra tải và audit toàn bộ tính năng | Traceability accepted cho scope phát hành; không thiếu backend; đo resource/device scale. |
| 60 | Đóng gói và nghiệm thu Windows clean-machine | Bundled binaries/licenses, migration, installer/uninstaller; signing/update theo scope; publish riêng. |

## Theo dõi tiến độ

- Implementation chưa bắt đầu: chưa có bước code nào được ACCEPTED.
- Phân tích, reference và browser evidence đã lưu là đầu vào; bước 01 sẽ xác nhận baseline lúc bắt đầu code.
- Status: PLANNED → IMPLEMENTED → TESTED → ACCEPTED. BLOCKED/DEFERRED ghi riêng, không tính là hoàn thành.
- Kết thúc mỗi bước báo phase, step, file/module, checks pass/fail/unrun, evidence và bước kế tiếp.
- Phase có prerequisite fail thì dừng phần phụ thuộc; vẫn làm được công việc độc lập đã được phép.
- Tất cả 60 bước là scope đầy đủ; scope phát hành nhỏ hơn phải ghi rõ, không gọi phần chưa làm là xong.
- Khi thêm phạm vi, cập nhật phiên bản kế hoạch và tổng bước; không âm thầm đổi mẫu số tiến độ.

