# Trình tự triển khai sau phân tích

Trạng thái: đề xuất, chưa bắt đầu implementation. Không dùng file này để khai rằng Gate Windows/Android hoặc các phase đã PASS.

Kế hoạch đã được đánh số thành **9 phase / 60 bước nghiệm thu** tại [PHASES_AND_STEPS.md](PHASES_AND_STEPS.md). File này giải thích nền tảng và lý do chia việc; file đánh số là mốc theo dõi thực thi.

## 1. Xác định baseline có thể kế thừa

Gói V1.7 không có source production. TXT nhắc P4/Step29 nhưng không kèm artifact. Nếu có bộ code mới hơn, cần inventory/diff, chạy check và dựng bằng chứng trước khi quyết định scaffold mới. Nếu xây mới, dùng tài liệu V1.7 làm baseline và giữ nguyên bản reference.

## 2. Những quyết định cần ghi trước khi tạo code phụ thuộc

| ID đề xuất | Quyết định | Mặc định kỹ thuật đề xuất |
|---|---|---|
| ADR-CLOUD | Cloud Linux và baseline Windows | Cloud phát triển/test nền; Windows build/native và hardware gates riêng |
| ADR-REPO | Một cây workspace duy nhất | apps/desktop + packages theo domain |
| ADR-TOOLCHAIN | Phiên bản framework/native | Node24, pnpm12.6.0 theo pack; exact Electron/SQLite được chứng minh ABI trước chốt |
| ADR-TRANSACTION | Thứ tự publish/recovery | Nền ghi intent/uncertainty trước mọi auto Publish |
| ADR-SCHEDULE | Overdue, overlap, reapply, auto-append | Không đổi job cũ ngầm; generate idempotent; preview thay đổi lịch |
| ADR-DATA | Media asset/item và clone | ID bền vững; clone settings không tạo identity |
| ADR-STREAM | Embedded transport/video boundary | Spike pinned scrcpy/Tango/WebCodecs với buffer hữu hạn |
| ADR-CLEANUP | Staging | Theo D-033: giữ file khi pending, cleanup initial sau SUCCESS |

Đây là danh sách đề xuất cần chốt khi làm phần liên quan, không phải lý do dừng công việc phân tích hoặc bắt người dùng trả lời mọi chi tiết kỹ thuật.

## 3. Các increment có thể review và kiểm tra

### Increment 0 — Nhập tri thức và nền công cụ

- Import reference gốc riêng, lưu checksum/inventory và phân biệt ghi chú chưa có evidence.
- Tạo AGENTS/README/ignore, Node/packageManager pin, workspace/lockfile, TS strict, ESLint, Prettier, Vitest.
- Chọn exact dependency versions và policy approve native builds; không cài mọi thư viện của 15 phase ngay.
- CI nền Linux; job Windows cho những kiểm tra Windows thực sự có thể chạy.
- Acceptance: clean install frozen-lockfile, typecheck/lint, test runner có test domain có ý nghĩa, build scaffold. Ghi riêng checks unrun/blocked.

### Increment 1 — Shell và persistence đầu tiên

- Main/preload/renderer sandbox, typed result/errors, IPC validation và sender checks.
- App single-instance, data root, logger redaction; close/tray/Quit behavior.
- SQLite migration đầu và settings; theme/run-in-background lưu thật.
- Header/sidebar/layout V17; empty states khi chưa có devices/media. Backend chưa có thì capability unavailable, không giả dữ liệu hoạt động.
- Acceptance: Electron lifecycle smoke; restart giữ settings; IPC từ chối payload sai; native SQLite chạy đúng Electron ABI; Windows smoke riêng.

### Increment 2 — Domain, DB và scheduler thuần

- Campaign/media/job/transactions/ownership model; migration backup/integrity.
- UTC/timezone round-trip; immutable snapshot có schema version.
- Sinh job idempotent, per-device due queue, overdue policy và recovery.
- Acceptance: hai Campaign không lẫn settings, hai job cùng máy không chạy đồng thời, khác máy chạy độc lập, restart từ pending không click lại, UTC+7 không lùi ngày.

### Increment 3 — Media engine và UI ghi dữ liệu thật

- Folder dialog, watcher/reconcile không chồng; event gắn campaign/generation.
- File completion detection, fingerprint cache, bounded hash/thumbnail workers.
- Virtual table, bulk patch có “unchanged/set/clear”, Excel preview và stable match.
- Acceptance: file add/change/unlink/reappear/ignore; giữ history; changed source chặn job; dữ liệu lớn UI vẫn tương tác; reload giữ edits.

### Increment 4 — Registry và ownership thiết bị

- Platform-tools discovery/version validation, USB/LAN connections, heartbeat, per-device result.
- Durable device ID, connection reconciliation, known capability record.
- Manual control acquire/release, pause/re-detect tại safe points; quick app/APK/network không vượt khóa.
- Acceptance Android: 2+ điện thoại thực, authorization/reconnect/transport độc lập; ADB coexistence được ghi lại.

### Increment 5 — Technical Risk Gate

- Thực hiện R1–R8 của source pack: stream/control, Unicode, media picker, scanner, detector, verify post, proxy, coexistence.
- Không kết luận feasible chỉ bằng module import hoặc screenshot prototype.
- Acceptance: report theo thiết bị/Android/Facebook version/locale/build, PASS/FAIL/DEFERRED riêng và evidence thật.
- Proxy không thuộc capability v1 có thể deferred với UI nói rõ; không defer core assumption rồi bật automation phụ thuộc nó.

### Increment 6 — Stream, manual và account end-to-end

- Overview/detail/MASTER real frames, bounded resources, resize/zoom/rotation đúng.
- Normalized group input và quyền điều khiển an toàn.
- Manual login, UI-based account/profile/Page scan; metrics snapshots.
- Acceptance: 3–5 máy khác độ phân giải, reconnect, MASTER độc lập preview, missing metrics `—`, unsupported version không tự post.

### Increment 7 — Một flow đăng thật có recovery

- Trước hết chứng minh preflight → staging → đúng picker → Unicode → identity → details; chưa bấm Publish nếu chưa đủ bằng chứng.
- Kết nối transaction ledger đã có, publish once, verified/ambiguous handling.
- Comment transaction và dedup/recovery riêng.
- Acceptance: Page thử nghiệm do người dùng quản lý; ngắt app trước/sau click/verify; không tự publish lại từ uncertainty; lỗi comment không repost; cleanup không chạm video khác.

### Increment 8 — Hardening và release

- Network/APK adapters theo capability, cancellation và kết quả từng máy.
- Diagnostics export có lựa chọn nội dung, backup/restore, retention, low-disk, sleep/resume, tray notifications.
- Stress theo số registered/active streams/jobs và tài nguyên đo được, không hứa số stream full-quality tùy tiện.
- Windows installer clean-machine; bundle binaries/licenses; migration tests; signing/update theo phạm vi phát hành.

## 4. Quy tắc nghiệm thu

- Mỗi control production có feature ID, service/IPC hoặc phân loại UI_ONLY, trạng thái accepted có evidence.
- Không khai hoàn thành feature khi mới có UI hoặc mock adapter.
- Báo rõ unit/integration/browser/Windows/hardware là các lớp khác nhau.
- Build/test có execution ID, code revision và target; số test nêu trong TXT cũ không được cộng vào báo cáo mới.
- Chưa chạy test thì ghi UNRUN; thiếu phone/Windows thì ghi BLOCKED/NOT AVAILABLE, không PASS.
- Không publish/push/release chỉ vì đã tạo report hoặc scaffold.

## 5. Kiểm tra hồi quy cần mang vào production tests

| Test | Mục tiêu |
|---|---|
| UTC+7 local date round-trip | Chọn ngày 26 vẫn là ngày 26 sau save/reload/drag |
| Campaign isolation | Settings Campaign A không rò sang B |
| Apply schedule twice | Không nhân đôi occurrences |
| Auto-append | Không dịch job đang có |
| Bulk clear | Phân biệt giữ nguyên và xóa có chủ đích |
| Ownership contention | Hai request không sở hữu cùng thiết bị |
| Crash around publish | Side effect uncertain được verify trước retry |
| Comment uncertainty | Không tạo duplicate comment/repost Reel |
| Source mutated | Fingerprint mismatch chặn posting |
| Staging ownership | Chỉ xóa path positively owned, giữ pending |
| IPC validation | Invalid sender/device/path không tới shell/filesystem |
| Stream lifecycle | Reconnect/rotation/offscreen không leak encoder/decoder |
| Windows native ABI | better-sqlite3 hoạt động trong Electron đã pin |
| Backup during WAL | Backup nhất quán, restore/integrity pass |

Không tạo hàng loạt test phản chiếu markup để tăng số đếm; chọn test có thể bắt lỗi workflow thực.
