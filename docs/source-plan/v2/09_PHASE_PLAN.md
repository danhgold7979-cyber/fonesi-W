# Kế hoạch triển khai V2.1

**15 phase (P00–P14), 125 bước (S001–S125).** Đây là baseline được chốt cho Studio đa app; xem 15_COMPACT_UX_ADDITIONS.md. Các tiện ích được phân bổ vào bước hiện có, thay kế hoạch 9 phase/60 bước vốn được lập cho V1.7. Đánh số công việc không phải dự báo số phiên/thời gian. Mọi bước implementation hiện PLANNED.

P00–P07 làm được phần nền/authoring trên cloud. Từ P08 cần Windows/Android cho nghiệm thu phần phụ thuộc. Giai đoạn engine trước hardware dùng test adapters trong test fixtures; không tính đó là automation thật. Các phase vẫn có công việc độc lập có thể tiến hành song song trong cùng tác vụ, nhưng không bỏ gate phụ thuộc.

| Phase | Phạm vi | Bước | Số | Điện thoại khi nghiệm thu |
|---|---|---|---:|---|
| P00 | Baseline, repository và công cụ | S001–S006 | 6 | Chưa cần |
| P01 | Domain và contracts | S007–S013 | 7 | Chưa cần |
| P02 | SQLite và persistence | S014–S021 | 8 | Chưa cần |
| P03 | Shell và UI nền Studio | S022–S028 | 7 | Chưa cần |
| P04 | Workflow editor | S029–S039 | 11 | Chưa cần |
| P05 | Validator, compiler và execution core | S040–S049 | 10 | Chưa cần |
| P06 | Process, input và media | S050–S059 | 10 | Chưa cần |
| P07 | Scheduler, queue và timeline | S060–S068 | 9 | Chưa cần |
| P08 | ADB registry và worker | S069–S076 | 8 | Có |
| P09 | Stream, UI Inspector và manual control | S077–S085 | 9 | Có |
| P10 | Technical Risk Gate | S086–S093 | 8 | Có |
| P11 | Execution và transactions thực | S094–S103 | 10 | Có |
| P12 | Adapters theo ứng dụng | S104–S111 | 8 | Có |
| P13 | Công cụ và vận hành | S112–S118 | 7 | Có |
| P14 | Packaging và release | S119–S125 | 7 | Có |

## P00 — Baseline, repository và công cụ

Modules dự kiến: `docs/`, `AGENTS.md`, `package.json`, `.github/workflows/`

| Bước | Công việc | Nghiệm thu | Test |
|---|---|---|---|
| S001 | Kiểm kê nguồn và checksum | Giữ nguyên reference; nêu rõ gói FULL-TRANSFER chưa đọc được. | AT-001 |
| S002 | Chốt kiểm kê UI và phạm vi | 124 lệnh, fields, gestures, 40 node, các chức năng kế thừa đều có registry. | AT-002 |
| S003 | Chốt quyết định và migration V1.7 → Studio | Mỗi xung đột có quyết định; UI mới và runtime invariants được phân biệt. | AT-003 |
| S004 | Chuẩn bị repository và hướng dẫn agent | Giữ README/commit remote và docs hiện có; không tạo worktree mặc định. | AT-004 |
| S005 | Ghim toolchain và gates cloud/Windows | Cài có integrity; exact Electron/SQLite chỉ chốt sau compatibility check. | AT-005 |
| S006 | Thiết lập checks và CI nền | Typecheck/lint/unit/build có kết quả thực; kiểm tra Windows tách khỏi Linux. | AT-006 |

## P01 — Domain và contracts

Modules dự kiến: `packages/contracts/`, `packages/domain/`

| Bước | Công việc | Nghiệm thu | Test |
|---|---|---|---|
| S007 | AppDefinition và CapabilityProfile mở | Registry mở theo package; 5 app là seed/templates. Chưa có certification không được giả hỗ trợ automation. | AT-007 |
| S008 | WorkflowDraft, WorkflowVersion và Certification | Draft sửa được, version immutable, certification theo target profile. | AT-008 |
| S009 | Graph, Node, Edge và Group schemas | ID/ports/config schema versioned, phân biệt group trực quan và subflow. | AT-009 |
| S010 | Input/Output schema và typed values | 9 loại field; scope row/process/output; keys an toàn; mapping có kiểu. | AT-010 |
| S011 | Process độc lập với editor/test device | Process ID bền; app/workflow/account/target/device refs hợp lệ. | AT-011 |
| S012 | MediaAsset, ContentItem, Job và Transaction | Một content item có 0/1/n asset; job snapshot và effect journal riêng. | AT-012 |
| S013 | IPC, event và error contracts | Runtime validation, operation IDs, cancellation và per-device batch results. | AT-013 |

## P02 — SQLite và persistence

Modules dự kiến: `packages/database/`, `packages/import-export/`

| Bước | Công việc | Nghiệm thu | Test |
|---|---|---|---|
| S014 | Schema quan hệ và migrations | FK/index/unique scope rõ; history không bị cascade-delete. | AT-014 |
| S015 | SQLite adapter và Electron compatibility | Chứng minh driver dưới Electron ABI; không chỉ standalone Node. | AT-015 |
| S016 | Lưu workflow bundle hoàn chỉnh | Main/subgraphs/inputs/outputs/dependencies cùng transaction, không chia sẻ graph toàn cục. | AT-016 |
| S017 | Lưu Process và settings đúng scope | Weekdays, slots, source, fields, policies và device enabled giữ qua restart. | AT-017 |
| S018 | Lưu assets/content items và references | Asset reuse không tái sử dụng content/job ID; ordered multi-asset rõ. | AT-018 |
| S019 | Lưu job, leases, effects và review records | Unique occurrence/effect keys, fencing tokens và transaction boundaries có test contention. | AT-019 |
| S020 | Backup/restore, WAL và integrity | Backup nhất quán; restore vào staging DB rồi integrity check trước thay thế. | AT-020 |
| S021 | Import atomic, revisions và rollback | Import sai schema/refs không mutate DB; optimistic concurrency chống ghi đè. | AT-021 |

## P03 — Shell và UI nền Studio

Modules dự kiến: `apps/desktop/src/renderer/shell/`, `apps/desktop/src/main/`

| Bước | Công việc | Nghiệm thu | Test |
|---|---|---|---|
| S022 | Rail, header, footer và sáu route | Theo layout mới, breadcrumbs/ngữ cảnh/capability status thống nhất. | AT-022 |
| S023 | Theme, layout và Windows DPI | Light/dark; kích thước panel lưu thật; 100/125/150% không che nút chính. | AT-023 |
| S024 | Điều hướng và context isolation | Chuyển máy/app/target không mang rows hoặc schema của context khác. | AT-024 |
| S025 | Modal, context menu và keyboard focus | Focus trap/restore/Escape; confirm destructive; menu không ra ngoài viewport. | AT-025 |
| S026 | Empty/loading/error/unsupported states | Không tự tạo thiết bị hoặc reported success; thiếu backend có lý do hiển thị. | AT-026 |
| S027 | Save status, toasts và notifications | Chỉ báo saved sau ACK bền; lỗi save/revision conflict có retry an toàn. | AT-027 |
| S028 | Visual và navigation regressions | Ảnh các route/modal và test focus/resize; fixture tách runtime production. | AT-028 |

## P04 — Workflow editor

Modules dự kiến: `apps/desktop/src/renderer/editor/`, `packages/editor/`

| Bước | Công việc | Nghiệm thu | Test |
|---|---|---|---|
| S029 | Node library và tìm kiếm | 40 node từ catalog chung; nhóm và subflow library nhất quán. | AT-029 |
| S030 | Thêm/kéo/resize node | Tọa độ world-space, snap và auto-pan ổn định dưới zoom. | AT-030 |
| S031 | Selection, clipboard, undo/redo và phím tắt | Canvas focus scope, nudge 1/10, selection/clipboard/history scoped workflow; typing không sửa node. | AT-031 |
| S032 | Nối/xóa/chèn node trên edge | Ports hợp lệ; một edge/output trừ cơ chế fanout được thiết kế; undo một lần. | AT-032 |
| S033 | Bẻ dây và routing | Handles bám node/zoom; reroute không đổi graph semantics. | AT-033 |
| S034 | Pan/zoom/fit/minimap và command palette | Fit selection, readable default zoom, Ctrl+K/node search, mouse gestures có cùng command registry. | AT-034 |
| S035 | Layout, align và group trực quan | Group membership cập nhật sau move/delete; không giả làm subflow. | AT-035 |
| S036 | Properties và advanced editor theo node type | Field-specific config, validation inline, effect retry policy có kiểm soát. | AT-036 |
| S037 | Tạo/mở/convert subflow và mapping | Nested refs/version/type-safe; clone/export đầy đủ dependencies. | AT-037 |
| S038 | Breadcrumb/call-stack và Debug UI | Về cha thật theo stack; không luôn nhảy main; no real action trong undo. | AT-038 |
| S039 | Autosave, progressive panels và shortcuts | 4 primary controls, library/phone collapse, properties theo selection, no command conflicts. | AT-039 |

## P05 — Validator, compiler và execution core

Modules dự kiến: `packages/workflow-engine/`, `packages/contracts/nodes/`

| Bước | Công việc | Nghiệm thu | Test |
|---|---|---|---|
| S040 | Validate schema import và reserved keys | Reject unknown types/ports, duplicate IDs, prototype keys và payload quá resource budget. | AT-040 |
| S041 | Validate graph topology | Endpoints/ports/output uniqueness/reachability và required terminal đầy đủ. | AT-041 |
| S042 | Loops/break/continue và budgets | Loop body có scope/giới hạn; không cho arbitrary wire cycle hoặc runaway execution. | AT-042 |
| S043 | Validate toàn bộ dependency closure | Mọi subgraph được check; recursive call/type mismatch và thiếu dependency bị chặn. | AT-043 |
| S044 | DSL và template mapping an toàn | Không eval/Function/shell; whitelist expression/field paths và typed conversion. | AT-044 |
| S045 | Compile IR và kiểm tra side effects | Transaction intent thống trị effect; không dựa node name để chứng nhận hành vi. | AT-045 |
| S046 | Interpreter và call stack | RunFrame/local scope/return/output mapping; test adapters chỉ ở fixtures. | AT-046 |
| S047 | Pause/breakpoint/step/into/out/stop | Continue vượt breakpoint một lần; cancellation tại safe point, không skip pending recovery. | AT-047 |
| S048 | 40 handler contracts và adapter boundaries | Mỗi node có real handler hoặc explicit unavailable; typed errors/timeouts. | AT-048 |
| S049 | Trace-only diagnostics và capability gates | Dry-run không tạo POSTED/SUCCESS thật; real run phải preflight/certify. | AT-049 |

## P06 — Process, input và media

Modules dự kiến: `packages/processes/`, `packages/media/`, `apps/desktop/src/renderer/processes/`

| Bước | Công việc | Nghiệm thu | Test |
|---|---|---|---|
| S050 | Process CRUD và clone | ID riêng; clone có preview; giữ hoặc clear bindings có chủ đích. | AT-050 |
| S051 | Dynamic fields và input mapping | Row/process/output với 9 types; file[] ordered, list thật; không ép mọi thứ thành string. | AT-051 |
| S052 | Chọn nguồn thư mục/tệp và multi-asset | Desktop dùng file dialog scoped; browser metadata không bị coi là filesystem access. | AT-052 |
| S053 | Watcher/reconcile và subfolders | Không overlap; events gắn process/generation; ignore và auto-append đúng scope. | AT-053 |
| S054 | Fingerprint và validation nguồn | Source đổi/mất/copy dở/corrupt có trạng thái; job không âm thầm đổi content. | AT-054 |
| S055 | Thumbnail/probe queue | Bounded CPU/I/O, actual media metadata; cache evict không xóa source. | AT-055 |
| S056 | Virtualized table, search và inline edits | Query/store thật; selection theo ID không theo row index. | AT-056 |
| S057 | Bulk edit và import preview | Set/append/prepend/clear; explicit ID mismatch không fallback sửa nhầm. | AT-057 |
| S058 | CSV/JSON/XLSX import/export | Round-trip typed/custom fields; duplicate/ambiguous report; formula protection. | AT-058 |
| S059 | Remove/ignore/archive và retention | Không xóa file PC; pending jobs cần xử lý rõ; posted history giữ nguyên. | AT-059 |

## P07 — Scheduler, queue và timeline

Modules dự kiến: `packages/scheduler/`, `apps/desktop/src/renderer/schedule/`

| Bước | Công việc | Nghiệm thu | Test |
|---|---|---|---|
| S060 | UTC/timezone, date, slots và weekdays | DD/MM display; local date round-trip; invalid date/time bị reject. | AT-060 |
| S061 | Policy quá hạn và randomization | Lưu theo process; seed kết quả preview; không random lại khi retry/apply. | AT-061 |
| S062 | Preview/apply idempotent | Batch revision token; apply lặp không tạo occurrence trùng. | AT-062 |
| S063 | Snapshot workflow/content/target/network | Pin immutable version/dependency hashes; sửa draft không đổi scheduled jobs. | AT-063 |
| S064 | Due queue, priority và device leases | Một device/một job; fairness/cancel; unassigned process không chạy thật. | AT-064 |
| S065 | Timeline toàn workspace | Range/app/process/device filters; các context được truy vấn từ DB. | AT-065 |
| S066 | Drag/reschedule/clear pending | Cùng job ID và revision; không sửa pending external transaction. | AT-066 |
| S067 | Conflict và spread | Phân biệt timestamp/reserved interval; preview scope và crossing-day policy. | AT-067 |
| S068 | Restart/sleep/resume recovery | Due jobs theo policy; uncertainty verify trước retry; ledger giữ bền. | AT-068 |

## P08 — ADB registry và worker

Modules dự kiến: `packages/device-runtime/`, `apps/desktop/src/renderer/devices/`

| Bước | Công việc | Nghiệm thu | Test |
|---|---|---|---|
| S069 | Platform-Tools discovery/verification | Version/hash/source có evidence; không overwrite toolchain khác. | AT-069 |
| S070 | USB và authorization | Authorized/unauthorized/offline phân biệt; không tạo serial mẫu. | AT-070 |
| S071 | LAN pairing/connect | Android pairing/code route phù hợp; endpoint validated, không mở dịch vụ công khai. | AT-071 |
| S072 | Device identity và transport reconciliation | USB/LAN không duplicate sai; không gộp thiết bị chỉ vì cùng model/IP. | AT-072 |
| S073 | Heartbeat/reconnect và registry events | Lỗi riêng máy; bounded backoff/cancellation. | AT-073 |
| S074 | DeviceWorker ownership | Automation/manual/inspector/app/network mutation chung lease/fencing. | AT-074 |
| S075 | Enabled/bulk actions và sidebar/grid | Persist thật; per-device ACK, selected set khác active device. | AT-075 |
| S076 | Thông tin/app discovery và quick actions | Metadata/packages thật; capability unsupported hiển thị rõ. | AT-076 |

## P09 — Stream, UI Inspector và manual control

Modules dự kiến: `packages/device-runtime/stream/`, `packages/ui-inspector/`, `apps/desktop/src/renderer/inspector/`

| Bước | Công việc | Nghiệm thu | Test |
|---|---|---|---|
| S077 | ADB coexistence design spike | Shared/dedicated/exclusive strategy được kiểm tra, không kill server khác mù. | AT-077 |
| S078 | Pin scrcpy server/client/protocol | Compatibility set và checksum binaries được ghi build metadata. | AT-078 |
| S079 | Video decoder và IPC transport | H.264/WebCodecs capability; buffers/backpressure, không JSON/base64 frame flood. | AT-079 |
| S080 | Preview resource profiles | Visible/offscreen/focus streams điều chỉnh tài nguyên thực. | AT-080 |
| S081 | Máy test độc lập process bindings | Đổi test device không đổi target/process/workflow draft. | AT-081 |
| S082 | UI XML/frame snapshot thực | Versioned screenshot/XML/frame dimensions/orientation cùng correlation ID. | AT-082 |
| S083 | Pick selector và matching | Bounds đúng content rect; match count/confidence/version; stale snapshot bị chặn. | AT-083 |
| S084 | Dock/right/top/floating/popup và quick actions | Compact overflow, saved layout, popup origin/channel, real control lease; fit/zoom đồng bộ. | AT-084 |
| S085 | Manual group/MASTER kế thừa V17 | Normalized geometry/rotation; acquire từng máy; real outcomes và release/redetect. | AT-085 |

## P10 — Technical Risk Gate

Modules dự kiến: `docs/evidence/risk-gate/`, `tests/hardware/`

| Bước | Công việc | Nghiệm thu | Test |
|---|---|---|---|
| S086 | R1 embedded video/control | Ít nhất hai điện thoại thật: decode/input/reconnect/profile evidence. | AT-086 |
| S087 | R2 Unicode input | Tiếng Việt/emoji/URL/newline trên field thật khớp yêu cầu. | AT-087 |
| S088 | R3 media staging/picker | Hai Android/vendor profiles; portrait/landscape; exact-media evidence. | AT-088 |
| S089 | R4 account/target discovery | So với manual inspection; trùng tên/scroll/cache đều có case. | AT-089 |
| S090 | R5 detection/version/locale | Unknown/updated app không đoán selectors; có fixture và device profile. | AT-090 |
| S091 | R6 publish verification feasibility | Controlled test Page; signal posted/pending/ambiguous được chứng minh. | AT-091 |
| S092 | R7 device routing | Mỗi claimed-supported proxy type có Android/Facebook evidence; unsupported ghi riêng. | AT-092 |
| S093 | R8 ADB coexistence acceptance | Chạy với software fleet thực; PASS/FAIL/DEFERRED ghi riêng. | AT-093 |

## P11 — Execution và transactions thực

Modules dự kiến: `packages/execution/`, `packages/staging/`, `packages/review/`

| Bước | Công việc | Nghiệm thu | Test |
|---|---|---|---|
| S094 | Preflight và eligibility | Device/session/identity/file/app/version/locale/selector profile đều đúng. | AT-094 |
| S095 | Staging ownership và MediaStore | Ledger bền, job-unique paths, transfer/index readiness có xác minh. | AT-095 |
| S096 | Exact media và Unicode form fill | Không lấy thumbnail đầu tiên; kiểm tra target/content trước Publish. | AT-096 |
| S097 | Intent journal trước side effect | Durable attempt/uncertainty trước click; crash window không tự retry mù. | AT-097 |
| S098 | Xác minh bài đúng provider/identity | External ID/fingerprint/time window; ambiguous thành NEEDS_REVIEW. | AT-098 |
| S099 | Fault injection/restart recovery | Kill trước/sau click/verify/DB commit; uncertainty không bị coi FAILED retryable. | AT-099 |
| S100 | Comment transaction/list | Từng comment có hash/index/key; verify trước retry; không repost Reel. | AT-100 |
| S101 | Cancel, partial-result và manual review | Uncertain effect pause device automation; verified post + definite comment failure có SUCCESS_WITH_WARNINGS và comment retry riêng. | AT-101 |
| S102 | Cleanup/reconciliation | Chỉ owned staging; pending giữ file; cleanup failure không tạo lại post. | AT-102 |
| S103 | Certification-aware runtime | Engine contract tests + hardware reference adapter evidence; release eligibility vẫn theo từng app/profile. | AT-103 |

## P12 — Adapters theo ứng dụng

Modules dự kiến: `packages/app-adapters/`, `tests/hardware/apps/`

| Bước | Công việc | Nghiệm thu | Test |
|---|---|---|---|
| S104 | App adapter interface và capability matrix | Target kinds/media/audience/comments/selectors không giả là giống nhau. | AT-104 |
| S105 | Facebook video/Reels adapter | com.facebook.katana: phiên bản/locale/profile được chứng nhận riêng. | AT-105 |
| S106 | Facebook photo/multi-asset flow | Không đổi tên video template rồi coi là photo support; ordering/type kiểm tra thật. | AT-106 |
| S107 | Facebook Lite adapter | Không dùng selectors Facebook thường; chứng nhận độc lập. | AT-107 |
| S108 | Instagram adapter | Reel/video/profile semantics/limits/verification được test riêng. | AT-108 |
| S109 | TikTok adapter | Package thực trên fleet, profile locale, media/comment capability có evidence. | AT-109 |
| S110 | Threads adapter | Text và attachments theo capability; không gắn nhãn Reels giả. | AT-110 |
| S111 | Acceptance/certification theo app | App chưa chứng nhận vẫn author workflow được; automation bị disable với lý do. | AT-111 |

## P13 — Công cụ và vận hành

Modules dự kiến: `packages/network/`, `packages/apk/`, `packages/diagnostics/`

| Bước | Công việc | Nghiệm thu | Test |
|---|---|---|---|
| S112 | Device tools 3 tab và APK manager | Kết nối/Ứng dụng/Mạng; thực thi có scoped file picker, bounded queue, per-device result và quick action scope. | AT-112 |
| S113 | Proxy parser/checker/secret storage | Parser/check PC/device support ba mức riêng; log/export redacted. | AT-113 |
| S114 | Device proxy adapters | Apply + egress + app traffic verify; rollback/unsupported có trạng thái. | AT-114 |
| S115 | VPN adapters và mutual exclusion | Discover/open/verify; không auto rotation để né protections. | AT-115 |
| S116 | Logs/diagnostics/notifications | Operation correlation, retention, export preview và consent khi chia sẻ. | AT-116 |
| S117 | Disk/power/lifecycle resilience | Low/full disk, sleep/resume, tray, graceful quit và crash reconciler. | AT-117 |
| S118 | Scale/resource acceptance | Measured devices/streams/jobs/media; bounded workers/backpressure, không trần nghiệp vụ giả. | AT-118 |

## P14 — Packaging và release

Modules dự kiến: `build/`, `.github/workflows/`, `docs/evidence/releases/`

| Bước | Công việc | Nghiệm thu | Test |
|---|---|---|---|
| S119 | Supported matrix/build receipts | Windows/Android/app versions/locales/ABI/protocol/schema khai báo chính xác. | AT-119 |
| S120 | Offline bundling và licenses | Không CDN runtime; binaries verified và third-party notices. | AT-120 |
| S121 | Windows clean-machine install | App/SQLite/ADB/stream chạy không cần dev toolchain; signing theo phạm vi phát hành. | AT-121 |
| S122 | Upgrade/migration/rollback | Fixtures DB cũ; backup/integrity và transaction recovery được kiểm tra. | AT-122 |
| S123 | Uninstall/update policies | Giữ DB/media trừ thao tác rõ; không update giữa critical transaction. | AT-123 |
| S124 | UI ↔ service ↔ test completeness audit | Shipped controls accepted, không mock success/unowned/missing handler. | AT-124 |
| S125 | Release bundle và báo cáo bàn giao | Ghi checks pass/fail/unrun và limitations; publish/push chỉ khi có ủy quyền. | AT-125 |

## Cách theo dõi

PLANNED → IMPLEMENTED → TESTED → ACCEPTED. BLOCKED và DEFERRED ghi riêng. Một bước không được accepted bằng việc dựng nút hoặc trả success từ timer. Mỗi receipt chứa revision/build/target/test output. Khi thêm scope, tăng version kế hoạch và ghi thay đổi số bước. App certification độc lập, không lấy Facebook PASS suy ra app khác PASS.

Các milestone:

- **R0 Authoring**: P00–P07, editor/process/media/schedule lưu thật; chưa chạy Android.
- **R1 Multi-app cơ bản**: phần nền + P08–P11, Facebook Reels và TikTok capability tại P12 đã chứng nhận. P10 reference adapter dùng để chứng minh core, không phải chứng nhận toàn bộ app.
- **R2 Multi-app**: từng adapter Lite/Instagram/TikTok/Threads qua gate riêng; một app fail không biến app khác thành fail.
- **R3 Operations/release**: P13–P14 theo scope công bố. Toàn bộ phạm vi đầy đủ vẫn là 125 bước.
