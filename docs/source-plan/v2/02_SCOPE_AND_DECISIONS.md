# Phạm vi và quyết định baseline V2

## Thứ tự ưu tiên

1. Yêu cầu mới nhất của người dùng trong phiên.
2. Quyết định V2 tại file này và các contracts cùng version.
3. HTML Studio Workspace mới cho layout, navigation và authoring interactions.
4. Runtime/security/recovery invariants V1.7 còn phù hợp.
5. Prototype handlers và ghi chú chat cũ chỉ làm bằng chứng tham chiếu.

Nhãn FROZEN/FINAL/READY trong file cũ không ngăn cập nhật baseline mà người dùng hiện yêu cầu. Các nguồn gốc được giữ nguyên byte; thay đổi nằm ở V2. Đây là baseline kỹ thuật để triển khai, không phải chứng nhận hardware hoặc tuyên bố người dùng đã duyệt từng chi tiết.

## Quyết định

| ID | Quyết định V2 | Lý do/hệ quả |
|---|---|---|
| D2-001 | Sản phẩm là Windows desktop Studio đa app | Cloud là môi trường phát triển, không tự thấy USB/LAN ở máy người dùng |
| D2-002 | UI Studio 6 route thay bố cục 3 cột V17 làm giao diện chính | Giữ V17 ở reference và kế thừa các capability vận hành còn cần |
| D2-003 | App registry mở theo package; 5 app là seed/templates | Primitive nodes dùng chung, semantic adapters/certification riêng; không giới hạn enum 5 app |
| D2-004 | Authoring độc lập thiết bị | Workflow không thuộc một phone; Inspector testDevice là state riêng |
| D2-005 | WorkflowDraft / WorkflowVersion / Certification tách nhau | Structural version được tạo trước hardware certification; run thật kiểm tra gate |
| D2-006 | Process có ID, bindings và policy riêng | Không dùng string context key chứa IDs nối bằng dấu `:` làm primary key |
| D2-007 | Campaign cũ ánh xạ sang Process/source binding | Một folder mặc định/process, đồng thời hỗ trợ manual items và ordered multi-asset |
| D2-008 | Affiliate là field tùy chọn theo schema mới | Không tự thêm affiliate vào comment; mapping là chủ đích của workflow |
| D2-009 | Media = text-only / single / multi-asset theo workflow | Threads text-only không bị bắt video, photo không lấy lại tên video template rồi coi là xong |
| D2-010 | Default lịch mới 08:00, 12:00, 19:00 | Theo HTML mới; import Campaign cũ giữ lịch đã có, không đổi job cũ |
| D2-011 | UTC lưu bền, IANA timezone ở Process | Default Asia/Ho_Chi_Minh; UI ghi timezone đang xem |
| D2-012 | Overdue mặc định NEXT_FUTURE_SLOT | CATCH_UP/SKIP riêng; pending external transaction không dùng overdue để đăng lại |
| D2-013 | 1 device = 1 active automation owner/job | Manual, Inspector, APK/network/app mutation phối hợp cùng ownership |
| D2-014 | Job snapshot pin full dependency closure | Schema/mapping/content/network/options/version không đổi khi sửa draft |
| D2-015 | Durable effect intent/uncertainty trước click | Không có atomic commit giữa Facebook UI và SQLite; không hứa exactly-once tuyệt đối |
| D2-016 | Comment là giao dịch riêng, từng item list có key | Retry comment không repost; chưa rõ đã gửi thì verify trước retry |
| D2-017 | Cleanup sau terminal success an toàn, chỉ file owned | SUCCESS_WITH_WARNINGS được dọn khi post verified, không còn effect pending và không cần media phục hồi |
| D2-018 | Dry-run/debug trace khác real execution | Trace không tạo success/post ID của runtime production |
| D2-019 | Graph DSL whitelist, không eval/shell | Node config và import là dữ liệu không tin cậy |
| D2-020 | Pure/adapter/service nodes có contract và capability gate | Không dùng timer/random success cho nút production |
| D2-021 | Giữ manual login và dừng security challenges | Không lưu password/2FA hoặc trích token/private app DB |
| D2-022 | Proxy/VPN/APK/manual group/metrics vẫn trong scope kế thừa | Đặt trong device tools, diagnostics và relevant identity UI; không ép lại thanh công cụ V17 |
| D2-023 | Không trần nghiệp vụ devices/media/daily count | Resource budgets, paging và per-operation bounds không được truncate records |
| D2-024 | Electron + React + TS + Vite + SQLite | Driver/versions qua compatibility spike; SQLite service interface tránh trói renderer |
| D2-025 | C12 đã chốt commit/push nhánh feature sau checks | Không tự merge main/deploy/phát hành installer; Git push không là publication app |

## Ranh giới phiên bản đầu

R0 là workspace authoring lưu thật: graph/schema/version/process/media/lịch, import/export và diagnostics thiết kế. Không có điện thoại cũng dùng được, nhưng không tự tạo máy/account/bài đăng mẫu trong production.

R1 thêm thiết bị thực, Facebook Reels và TikTok profiles đã kiểm chứng; các app khác vẫn author workflow được và hiển thị trạng thái chưa chứng nhận. R2 mở các adapter còn lại sau gate riêng. User-created workflow có DEVICE_TEST và user-issued readiness theo validation/receipt/exact profile; không buộc mọi primitive workflow chờ maintainer viết template. Tính năng chưa ship có unavailable/hidden capability rõ, không hứa hỗ trợ chỉ vì có logo.

Những thứ cần đo thay vì đoán: selector profile, package/version/locale thật, khả năng paste Unicode, MediaStore/picker, exact-post signals, proxy routing, decoder/USB throughput. Chúng có spike và acceptance trong P10/P12; không phải các quyết định giao diện đang bỏ ngỏ.
