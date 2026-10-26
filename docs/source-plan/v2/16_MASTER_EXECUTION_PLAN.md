# Kế hoạch thực thi toàn bộ AutoReels Studio

Execution plan 1.0, baseline sản phẩm V2.1, ngày 26/10/2026. Đây là bản chi tiết hóa phạm vi đã chốt, không thêm phase và không đổi reference. **15 phase, 125 đơn vị nghiệm thu, 375 đầu việc cụ thể, 250 tình huống kiểm tra thành công/thất bại dự kiến.** Số tình huống trong plan không phải số tests đã chạy.

Implementation đã bắt đầu sau khi lập bản này. Theo dõi code/evidence hiện tại ở [progress](../../implementation/PROGRESS.md); các mô tả trạng thái ban đầu dưới đây là baseline trước code, không thay thế kiểm kê checkout mới nhất.

Đọc cùng [runbook từng bước](17_STEP_RUNBOOK.md), [các điểm cần kiểm chứng](18_READINESS_AND_RISKS.md), [plan theo phase](09_PHASE_PLAN.md) và [quy tắc nghiệm thu](10_ACCEPTANCE_GATES.md). Dữ liệu thực thi ở `execution-runbook.json`; chức năng → bước → test ở `feature-test-map.json`.

## 1. Đã clear đến đâu

Đã chốt nghiệp vụ, ranh giới dữ liệu, bố cục, thao tác chính và cách chia module. Đủ để code nền tảng, authoring và các harness kiểm chứng. Backend Android, exact-post verification, routing, native SQLite và hiệu năng Windows phải có bằng chứng thực trước khi công bố hỗ trợ. Một giả định đã có cách kiểm chứng không đồng nghĩa giả định đó đã PASS.

Hiện repository có reference, source-plan và HTML preview; chưa có ứng dụng Electron production. 20 kiểm tra HTML và kiểm tra nhất quán tài liệu là bằng chứng review. Không tính các file này thành 125 bước production đã hoàn thành.

Chọn xây mới từ HTML Studio + V1.7 đã đọc. Gói FULL-TRANSFER chưa đọc do giới hạn chuyển file 32 MiB vẫn được ghi NOT_READ; baseline đã chốt cho phép dựng mới, không tuyên bố kế thừa code/DB trong gói đó.

## 2. Phạm vi toàn tool và đầu ra nhìn thấy được

| Phần | Đầu ra sử dụng được | Dữ liệu/quy tắc phải giữ |
|---|---|---|
| Workspace | Sáu route, theme, settings, notifications, backup/restore | Preferences riêng; không nạp máy/account/jobs mẫu |
| Điện thoại | USB/LAN, scan/pair/reconnect, trạng thái, grid, nhóm chọn, enabled | Một phone có nhiều transport nhưng một identity/queue/owner |
| Workflow library | CRUD/archive/clone, app filter, app tùy chỉnh, version/import/export | Filter không đổi app của editor; bundle đủ main/subflows/schema/dependencies |
| Canvas | 40 node, drag/drop, resize, nối/chèn/bẻ dây, group/layout, undo, minimap | World geometry; IDs bền; visual group khác subflow; history thiết kế không hoàn tác device input |
| Properties | Typed config theo node, advanced đúng loại, mapping và validation | Không hiển thị mọi knob cho mọi node; required/type/range kiểm ở cả host |
| Inspector | Stream thật, XML/tree, pick, search/freeze, selector test/count/highlight | Frame/XML/profile/geometry/generation correlation; stale/ambiguous có lý do |
| Nhận diện/cử chỉ | UI selectors, image/OCR/read, tap/hold/drag/swipe/scroll/pinch, text/keys | Provider capability thực, confidence/budgets; unsupported không giả success |
| Debug/engine | TRACE, DEVICE_TEST, call stack, breakpoints, step/continue/stop | TRACE không chạm máy; user test khác built-in certification; không tạo post ID giả |
| Tiến trình | Bind phone/app/workflow/account/target, nguồn, typed fields, content | Nhiều Process một máy; mỗi Process giữ fields/lịch riêng; editor/testDevice độc lập |
| Media | Folder/files, watcher/subfolders, hash/probe/thumbnail, ordered assets | Text-only/1/n assets; strong fingerprint; remove row không xóa source PC |
| Bulk/import | Inline/bulk edit, CSV/JSON/XLSX preview, matching, exports | Stable IDs; explicit missing/empty; typed round-trip; stale import không mutate |
| Lịch/queue | Slots/weekdays/timezone, preview/apply, overdue, timeline, spread | Lịch riêng Process, queue chung phone, snapshot/version immutable, apply idempotent |
| Execution | Preflight, staging/index/picker, compose/publish/verify/comment | Durable uncertainty trước effect, no blind retry, target/content xác minh đúng |
| Review/history | Real results, logs, effects/evidence, resolution, comment-only retry | Pending khác failed; partial-result rõ; review không tự publish lại |
| Đa app | Facebook Reels + TikTok trước; Lite/Instagram/Threads theo gate riêng | Registry mở theo package; catalog không phải chứng nhận; generic custom workflow được test |
| Device Tools | Kết nối / Ứng dụng / Mạng; APK, proxy/VPN, quick actions | Worker ownership chung, results từng máy, verified routing khác PC proxy check |
| Vận hành | Disk/power/tray/single-instance/retention/diagnostics | Crash recovery, owned resources, redaction, giữ lịch sử và dữ liệu người dùng |
| Phát hành | Installer Windows, upgrade/rollback, offline bundle, notices | Clean-machine smoke, supported profiles và checksums; publish là thao tác riêng |

Toàn bộ 124 command, 110 field signatures, 26 event families, 40 node types và 30 tiện ích có mapping đến 1–4 bước cụ thể. Các node device/recognition cần cả handler contract ở S048 và provider thực ở P08–P11. Có một node trong library không có nghĩa node đó đã chạy được.

## 3. Khóa giao diện theo hành vi

HTML Compact là visual baseline. Những thay đổi nhỏ về icon/khoảng cách được làm trong increment; thay đổi hành vi hoặc scope phải cập nhật contract và mapping trước khi làm.

| Màn | Bố cục/nút cố định | Trạng thái và tương tác phải nghiệm thu |
|---|---|---|
| Điện thoại | Search/grid/tile-size, group select, Setup/Inspector, menu Tools | Missing ADB, empty, unauthorized, offline, busy, partial batch; active card khác selected group |
| Inspector | Workflow header 4 controls: ⋯ / Kiểm tra / Lưu / Chạy thử; library / canvas / phone; bottom tabs | Library/phone collapse; properties theo selection; dirty/saving/saved/conflict; trace/test/real mode rõ |
| Tiến trình | Bindings → nguồn/dữ liệu → bảng → lịch; row menu/bulk menu | Draft unassigned, invalid mapping, missing media, immutable scheduled snapshot; chuyển máy không lẫn rows |
| Thư viện | Search/app filter, tạo/clone/archive, thêm app package | App filter độc lập; generic custom app không nhận Facebook selectors/subflows |
| Lịch đăng | Timeline workspace, filters, views, preview/apply/reschedule | Timezone rõ, stale token, busy/overdue/uncertain khác nhau; posted/pending effect không drag đổi |
| Lịch sử | Runs/effects/comments/review/log filters và evidence detail | TRACE không cộng bài đăng; verified/partial/unknown phân biệt; retry scope đúng action |

Giữ rail 64px, header 55px, footer 25px theo baseline; màu/token và min-window theo `03_UI_SPEC.md`. Ưu tiên canvas và chữ đọc được. Windows 100/125/150% DPI, multi-monitor và min-window cần host evidence. Context menus hỗ trợ keyboard, focus trap/return focus, tooltip/accessible names. Mỗi màn có loading/empty/error/cancel/unsupported; mỗi mutation có dirty/ACK/conflict khi liên quan.

Phím/chuột bắt buộc: Ctrl+K, Ctrl+S, undo/redo/copy/paste/duplicate scoped canvas, Alt+1…6, F1, Shift+F, Ctrl+0, nudge 1/10, Ctrl+wheel zoom, wheel dọc, Shift+wheel ngang, Space/middle pan, menu theo node/edge/canvas/row. Lệnh nhập văn bản giữ focus và không thành graph command.

## 4. Stack và công cụ: chọn gì, chốt khi nào

| Công cụ | Hướng triển khai | Gate/đường thay thế |
|---|---|---|
| Node/pnpm | Node 24 LTS, pnpm theo version được resolve/pin; workspace + frozen lockfile | S005. Cloud hiện Node 24.19.0, pnpm 11.25.0; bản plan cũ nêu 12.6.0 chưa là bản đã activate trong checkout |
| Electron/React/TypeScript/Vite | Desktop privileged main, typed preload, React renderer; exact maintained versions khi scaffold | S005/S015. Pin theo compatibility receipts, không viết số phiên bản chưa kiểm |
| Runtime schemas | JSON Schema/Ajv hoặc maintained typed schema adapter phù hợp; một nguồn schema chuẩn | S009/S013/S040. Spike type inference/runtime parity; không duy trì hai schema lệch nhau |
| Graph UI | Ưu tiên React Flow qua spike custom nodes/ports/edge routing/accessibility/undo | S030/S033. Nếu thiếu reroute/geometry thì implement adapter/custom edge; domain graph không phụ thuộc view library |
| State/data | Independent editor/session stores; query cache theo entity ID/revision; shared command registry | S024/S031. Chọn library nhỏ khi scaffold, không global mutable prototype state |
| SQLite | Service/worker interface; so sánh node:sqlite khả dụng thực và maintained native driver | S015 Electron main-only smoke. Windows ABI/packaging phải thử thật; driver Node-only fail |
| Tests/quality | TypeScript strict, ESLint, Vitest, Playwright; Electron integration/Windows/hardware suites riêng | S006. Scripts chỉ khai báo PASS khi đã chạy thật; no zero-test acceptance |
| ADB/scrcpy | Verified Platform-Tools, pinned scrcpy server/client/protocol, owned sessions | S069/S078/S079/S093. Không kill shared ADB; binary channel, bounded buffers |
| Stream decoder | WebCodecs/embedded decoder spike trong exact Electron trước khi chọn | S079/S086. Mismatch/unsupported có explicit state, không fake preview frames |
| OCR/image | Ưu tiên local worker provider; thử maintained OCR vi/en và image matcher với fixtures + máy thật | S083. Đo confidence/false match/latency/bundle/license; tree selector trước, OCR/image fallback có gate |
| Unicode/gestures | scrcpy/control provider verified; Unicode path chứng minh riêng | S083/S087. Helper APK chỉ khi cần và được dùng có chủ đích; không root mặc định, không lossy silent fallback |
| Media/CSV/XLSX | Bounded ffprobe/thumbnail workers và maintained parsers phù hợp licensing | S055/S058/S120. Pin binary integrity và formula/zip/size policies |
| APK/proxy/VPN | Device worker ports, OS secret vault, từng routing adapter có evidence | S112–S115. PC egress khác Android/app egress; fail thì unsupported/rollback |
| Packaging | Windows packager chọn theo exact Electron/driver stack, verified offline bundle | S120–S123. Clean-machine smoke, signing status thật |

Không cần cài thêm plugin bên thứ ba để bắt đầu code. Package phát triển được cài theo increment và lockfile, không cài cả danh sách công nghệ chỉ vì có tên trong tài liệu. Figma/Linear/GitHub connector không thay thế compiler, DB hoặc runtime Android.

## 5. Thứ tự thực thi và các điểm sửa so với plan khái quát

`Pxx.dependsOn` là điều kiện nghiệm thu **toàn phase**. `Sxxx.dependsOn` trong runbook là tiền đề để triển khai một đơn vị. Một harness/spike có thể làm sớm sau contracts tối thiểu; chưa đủ gate không được ghi phase sau ACCEPTED.

1. **Khoá nguồn và nền:** S001–S006, contracts S007–S013. Sau install/checks có kết quả thực mới báo nền sẵn sàng.
2. **DB/native sớm:** S014/S015 rồi save/reload S016/S017/S018/S019. Electron SQLite harness không đợi UI hoàn chỉnh. S005 chỉ khóa nền chung; final Electron/SQLite selection thuộc S015, tránh vòng phụ thuộc.
3. **Lát UI đầu tiên:** S022–S027 và workflow create/add/edit/save/reload qua S029/S030/S036/S039. Không dựng 124 nút trống cùng lúc. Hoàn thiện backup/import S020/S021 và các regressions tương ứng trước R0 gate.
4. **Hardware thử sớm khi có Windows/phone:** sau host/DB/IPC tối thiểu, làm S069–S074 và harness S077–S079. Bắt đầu thử stream/control/XML/Unicode/exact media/verification khi từng prerequisite đủ; chưa đợi mọi canvas/XLSX/timeline được đánh bóng. Phần UI/logic độc lập tiếp tục khi chưa có phone.
5. **Editor + engine:** S029–S049 theo DAG. Validator/DSL/IR có thể code từ contracts trước khi mọi panel editor hoàn tất. S038 debug UI chưa có engine thì disabled, S047 mới nối session thật.
6. **Data + lịch:** S050–S068. Process/source/typed fields → fingerprint/table/import → schedule preview/apply/snapshot/queue → timeline/reschedule/recovery. Queue interface S064 và worker S074 dùng chung persistence/lease contract, không yêu cầu vòng phụ thuộc lẫn nhau.
7. **Inspector/risk:** S080–S093. Full providers, XML correlation, picker/selector/OCR/image/gestures, Unicode, identity/target, version và coexistence. Fail làm sửa provider/contract hoặc giới hạn capability có lý do.
8. **Effect runtime:** S094–S103. Minimal reference adapter/harness từ P10 chứng minh core; không chờ mọi app adapter production. Publish spike có journal tối thiểu S019/S045 trước external input.
9. **Multi-app:** S104 interface tiếp nối S048; ưu tiên **S105 Facebook Reels và S109 TikTok**, rồi S111 cho R1. S106/107/108/110 nghiệm thu capabilities còn lại theo R2. Không để số thứ tự S109 khiến TikTok phải đợi Lite/Instagram.
10. **Operations + release:** S112–S125 theo dependency/capability scope; tools phối hợp ownership, diagnostics/recovery/scale, clean installer và completeness gate.

Critical path cho automation thật: contracts → durable DB/lease → verified device/control/profile → exact media + Unicode + identity → effect journal → verification/recovery → Facebook và TikTok receipts. Giao diện đẹp không rút ngắn được các gate này.

## 6. Quy trình mỗi increment

| Việc | Bằng chứng đầu ra |
|---|---|
| Chọn slice | Step IDs, feature IDs, prerequisites và acceptance scope |
| Implement đủ lớp cần thiết | UI intent → typed IPC → domain/service → persistence/device port → result state |
| Xử lý failure | Validation/cancel/timeout/conflict/unsupported; không toast success vì vừa click |
| Kiểm tra | Positive/negative cases theo runbook; restart/ownership/effect fault injection khi liên quan |
| Review diff | Scope, source hashes, lockfile, no secrets/fake data, no unowned controls |
| Receipt | Revision/OS/tool versions/test IDs/exit codes/pass/fail/unrun/evidence/limitations |
| Git | Commit increment checked; push feature branch khi quyền ghi hoạt động; không tự merge/publish installer |

Không dùng một PR cho cả 15 phase. Một bước có thể cần nhiều increment; một increment có thể nối vài bước để tạo luồng dùng thật. Receipt của browser logic, Electron Linux, Windows native và Android là những loại bằng chứng khác nhau.

## 7. Milestones và điểm cần điện thoại

| Mốc | Điều kiện | Có thể công bố |
|---|---|---|
| R0 Authoring | S001–S068, G1–G3, host/native checks liên quan | Workflow/data/lịch lưu thật; chưa claim Android automation |
| R1 Multi-app | Nền + S069–S105, S109/S111 theo shipped scope; G4–G7 | Facebook Reels + TikTok trên exact profiles đã có evidence; routing R7 có thể deferred nếu chưa ship |
| R2 Capabilities mở rộng | S106/S107/S108/S110 và các capability mở rộng được chứng nhận | Photo/multi-asset/Lite/Instagram/Threads theo receipts riêng |
| R3 Full operations/release | Đủ full scope 125 bước và G8 | APK/network/scale/resilience/installer theo supported matrix |

S069/S070 là bước đầu cần phone cho nghiệm thu kết nối. Hai phones/profiles tối thiểu là điều kiện hardware baseline/risk gate, không là giới hạn số máy của sản phẩm. Muốn installer cho bất kỳ milestone nào vẫn cần packaging/clean-machine gate tương ứng; R0 code chạy trong dev chưa phải installer đã phát hành.

## 8. Cách gọi là hoàn thành

PLANNED → IMPLEMENTED → TESTED → ACCEPTED; BLOCKED/DEFERRED giữ lý do. Một control được hiển thị không đồng nghĩa chức năng xong. Một bước có tests trong plan chưa có nghĩa tests tồn tại. App/driver/version không có receipt vẫn UNRUN/UNSUPPORTED tương ứng. Theo dõi completion theo capability/receipt thay vì phần trăm cảm tính.
