# Tiến độ implementation

## Increment019 / P06-S054 — tiếp nhận media đã đổi

Đã có preview/apply từ ID có scoped host grant, hash/probe tệp thật ngoài DB worker, giới hạn hai lượt đọc đồng thời và abort khi đóng host. Preview lưu descriptor/checksum/context hash/expiry, apply kiểm tra lại tệp và context rồi remap typed file/file[]/ordered asset refs atomically sang immutable asset ID mới. Giữ ContentItem IDs, asset records cũ, Process khác và mọi job snapshot. Retry cùng token qua restart trả kết quả cũ kể cả source file đã mất sau commit. UI có preview/hủy/xác nhận và giữ pending Process edits khi nhận ACK.

`pnpm check`: **208 tests /21 files**, generated/type/lint/build PASS. Full browser: **19 passed /0 failed/skipped/flaky**. Test filesystem/SQLite gồm changed-again/stale/source/expiry/foreign/tamper/raw-path rejection, transaction rollback/retry, immutable old job/other Process và read concurrency/shutdown; browser kiểm cancel rồi apply file thật và giữ local edits. Native Windows/Android acceptance vẫn NOT_RUN. P06 còn thumbnail/cache, content query và schema migration UI. Tiếp theo P07-S066/S067 về preview/apply giãn lịch có scope.

## Increment018 / P06-S052 — native source rebind

Đã thêm chọn lại nguồn qua host dialog có canonical approval, không nhận paths/host/kind từ renderer. Giữ source/content/asset IDs khi chuyển thư mục/đổi tên tệp, remap bound basename/ignore ledger atomic, tăng revision/fence scan cũ và bắt buộc đối chiếu tệp thật trước READY. Khác bytes vẫn CHANGED; source inactive có thể chọn lại explicit, foreign-host chỉ đổi binding sau native approval. Không sửa immutable job snapshots. Scan restart sau cancel chờ task bị abort kết thúc trước khi tạo scan mới.

`pnpm check` đạt **204 tests /21 files**, type/lint/generated/build PASS; full browser **18 passed /0 failed/skipped/flaky**. Native picker test adapter + actual temp filesystem xác minh folder relocation, foreign-host file rename, changed bytes, cancel/stale revision/raw-path rejection và callback fencing. Đây chưa là native Windows dialog acceptance. P06 tiếp theo: explicit media adoption, thumbnail/cache, query và field migration UI.

## Increment017 / P06-S050 — Process clone có preview

Đã thêm preview/apply persisted token/hash/expiry/host, stale context rejection và idempotency qua restart. Bản sao có Process/content/source IDs mới, giữ immutable asset refs và ordered typed values, bỏ account/target/identity/credential-shaped fields, không copy jobs/effects/history. Clone registered sources qua DB grants, giữ host binding; không cấp filesystem permission từ raw UI paths. Asset permission/state/import matching tra theo Process/source-entry, nên clone vẫn dùng nguồn riêng khi Process gốc archived; metadata/no-source/foreign-host không vượt schedule gate.

Đã chạy `pnpm check`: **201 tests /21 files**, generated/type/lint/build PASS. Full browser: **18 passed /0 failed/skipped/flaky**. Các cases gồm rollback/restart/apply twice, stale fields/schema/observed bytes, ordered multi-asset refs/ignore ledger/reconcile,0/false/list, no credential values in preview storage, preview cancel và independent UI dataset. P06 tiếp theo: native rebind/adopt/thumbnail/content query/field migration. Chưa có Windows/Android physical acceptance.

## Mốc mới nhất — increment016 / P06-S050 archive lifecycle

Đã bổ sung UI lưu trữ sau đúng save ACK/revision, kho archived records theo device scope và restore có ACK. Giữ nguyên typed content0/false, nguồn/tệp, job snapshots và history; archived Process không được claim mới, không tự cancel/replay pending/running effects. Host refresh media coordinator sau Process mutation để ngừng/tái lập watchers và scans theo grant hiện có.

Đã chạy full quality checks với **193 tests / 20 files**; rerun affected media integration sau củng cố scan synchronization:13 passed; browser full suite **17 passed / 0 failed/skipped/flaky**. Current Linux host restart bằng compiled output mới; health/SQLite/renderer/bootstrap smoke và actual startDebug→initial PAUSED→CONTINUE→COMPLETED API smoke PASS. Không có fake phone/account/posting results trong production DB.

P06 còn clone preview/asset ownership, adopt/rebind, thumbnails, server content query và migration UI; các mục P04/P05/P07 khác và P08–P14 vẫn giữ theo completion plan. Target Windows10 x64/20→300 phones/Facebook-first đa app chưa được hardware/throughput/installer acceptance. Tổng15 phases chưa hoàn tất100%.

## Mốc mới nhất — increment 015 / P07-S065

Timeline có keyset pagination theo UTC/priority/createdAt/stable ID; page size1–1000 là operation budget, không truncate tổng jobs. Migration8 thêm persisted jobs epoch + insert/update/delete triggers và index; cursor bind filters/epoch, bị invalidate khi worker/connection khác thay đổi lịch. UI có Tải thêm, loaded counts, response generation guards và virtualized rows để không dựng hàng trăm/nghìn DOM rows một lúc.

Đã chạy `pnpm check`: **191 tests / 20 files**, typecheck/lint/generated/build PASS. Browser **16 passed / 0 failed/skipped/flaky**. DB regression duyệt1203 jobs không trùng/thiếu, cursor qua restart và bị chặn sau mutation từ connection khác; browser fixture501 jobs xem được job sau500, DOM rows dưới40. Đây là test dữ liệu/paging, **không là chứng nhận300 điện thoại vật lý**.

P07 còn calendar day/week/drag/spread, actual dispatch/overdue/auto-append/sleep gates. P06 còn clone/archive/media adopt/rebind/thumbnail/query/schema migration UI; P08–P14 còn các runtime/hardware/operations/release mục đã ghi trong tracker. Không gọi phase nào hoàn tất100% chỉ vì lát vừa thêm qua checks.

## Cập nhật tiếp — increment 014 / P05

Pinned external subflows đã resolve theo immutable version/workflow/hash và canonical bytes; reject missing/undeclared/conflicting pins, app mismatch, namespace escapes và resource excess. Compiler tạo deep-frozen IR/source maps/routes; TRACE interpreter dùng routes đã compile. SQLite createVersion đóng full graph closure trong transaction, giữ draft refs nguyên và không bị child draft edit/restart làm đổi. Validate/TRACE/debug host dùng cùng DB resolver; paused debugger vẫn ngoài DB worker.

Sau code: `pnpm check` đạt **189 tests / 20 files**, type/lint/generated/build; browser **15 passed / 0 failed/skipped/flaky**, thêm actual API + SQLite + host debugger với external typed pinned call. Dependency declaration nội bộ engine→domain được cập nhật bằng pnpm; lockfile chỉ thêm workspace link, frozen install đã qua. Còn mở P05: comprehensive effect dominance, provider/DEVICE_TEST execution gates; không coi structural IR là automation certification. P04 còn các mục ghi bên dưới, P06–P14 tiếp tục theo tracker.

Target người dùng: Windows 10 x64, 20 phones ban đầu, dự kiến tăng khoảng300, đa app và Facebook ưu tiên. Đây là mục tiêu thiết kế/đo ở P08–P14, chưa phải scale/hardware evidence.

## Cập nhật 27/10/2026 — increment 012–013

- **P04/S030–S037:** đã bổ sung group collapse/expand với crossing-port proxy giữ semantics, kéo group/members một transaction, dịch waypoint nội bộ, set/drag/cancel/reset reroute, align/distribute/layout theo kích thước thật và chuyển single-entry/single-exit selection thành local subflow atomic. Vùng có loop/local/effect cần mapping riêng bị từ chối rõ. Undo khôi phục graph navigation hợp lệ. Canvas có kích thước node xác định để nhấp đúp không mất target trong lúc đo lại node; properties là drawer không đổi viewport khi chọn.
- **P05/S043–S047/S049 và S038:** đã có typed call input/output mappings, child local/output isolation, safe AST syntax validation và debugger TRACE thật. Initial pause, Continue, Pause, Step Into/Over/Out, breakpoints, Stop, call stack/local/event snapshots; host sessions tách DB worker, bounded concurrency/events/TTL/shutdown, named API/preload và UI. Log/snapshot che sensitive bindings. Đây chưa phải DEVICE_TEST/REAL_JOB executor.
- Sau code đã chạy `pnpm check` thành công: **181 tests / 19 files**, generated-contract checks, typecheck, lint, host/renderer build. Browser suite: **14 passed / 0 failed / 0 skipped / 0 flaky**, gồm 3 scenarios mới P04/P05. Bug nhấp đúp sau reload đã được tái hiện bằng pointer-event trace và sửa bằng explicit view dimensions; không bỏ assertion.
- **Còn mở:** P04 external clipboard dependency closure/layout preferences/command search và một số interaction gates; P05 pinned external resolver/IR/effect dominance và DEVICE_TEST gates. P06–P14 vẫn còn implementation theo bảng checkpoint dưới đây; Windows/Android/installer chưa nghiệm thu. Tổng scope vẫn 15 phases, không suy 181 tests thành 181 acceptance units hay 100% completion.

Kế hoạch hiện hành: [COMPLETION_PLAN.md](COMPLETION_PLAN.md), [increment012](INCREMENT-012_PLAN.md), [increment013](INCREMENT-013_PLAN.md). Bảng dưới là checkpoint trước các bổ sung này, giữ lại để truy vết.

Checkpoint ngày 26/10/2026. Baseline sản phẩm V2.1, 15 phase/125 bước; status PLANNED trong source-plan là định nghĩa ban đầu. File này ghi implementation thực và phần còn thiếu; không suy từ số dòng code ra phần trăm hoàn thành. 166 tests hiện chạy là test cases thực, độc lập với 125 đơn vị nghiệm thu trong master plan.

| Phase | Đã có code/bằng chứng local | Chưa nghiệm thu toàn phase |
|---|---|---|
| P00 | Workspace Node/pnpm pinned, lockfile, strict TS/lint/unit/build, CI definition; install đã chạy | CI remote/Windows chưa chạy; reusable setup đã kiểm tra và lưu draft; environment chưa Publish |
| P01 | Open app registry, workflow wire schema/40 nodes, JSON-safe typed values, immutable/hash/readiness/state policies, narrow API DTOs | Event replay/full capability contracts sẽ hoàn thiện cùng services phụ thuộc |
| P02 | SQLite migrations v1–v7, workflows/full bundle/versions/clone/import, Process/preferences/content, snapshots/leases/effect journal, WAL backup/staged restore | Full workspace import preview và toàn bộ schema vận hành còn mở; Windows native acceptance UNRUN |
| P03 | React 6 routes, named sandboxed Electron preload, host validation, serialized DB worker, protected loopback host, theme/states/focus/save ACK | Windows DPI/multi-monitor/lifecycle chưa nghiệm thu; diagnostics/navigation states tiếp tục mở rộng |
| P04 | React Flow adapter, 40-node library, drag/resize/connect, insert/delete, undo/redo, duplicate/copy/cut/paste giữ internal wires/group IDs, visual group outlines/create/rename/remove, layout, properties/schema/subgraphs/version/export/import, shortcuts/context menus | Collapse/drag group, convert-to-subflow/edge reroute/external clipboard closure/layout preferences và một số shortcuts còn thiếu; chưa gọi full editor complete |
| P05 | Shape/topology/all-graphs validation, safe AST/template runtime, TRACE pure control flow/inline và referenced lexical loop bodies/nested cursor restoration/subflow-local isolation, step/time/depth budgets và in-flight cancel/unsupported device actions | Pinned dependency resolver, typed subflow mapping/IR dominance và full debugger chưa xong; loop body có schemas chưa có mapping được reject rõ |
| P06 | Native folder/multi-file dialog → private DB grants, coordinator 2 scans/cancel/progress, watch debounce + 10s reconcile/restore, hash/probe/ledger/ignore/change/missing, Process source UI + media names/states, typed row/Process forms, CSV/JSON/XLSX round-trip + ZIP/formula budgets, stable-ID selection/DOM virtualization, bulk/import persisted preview→atomic apply/idempotency + before/after values, scope/revision/registered-ref gates | Native dialog/Windows chưa nghiệm thu; thumbnails/cache, explicit adopt changed files/rebind giữ ID qua host, Process clone/archive UI, migration mapping, inline/column menus và server query/cursor pagination còn thiếu; DOM virtualization không thay scale gate |
| P07 | Temporal/DST/jitter, SQLite persisted preview/hash/expiry/revisions, atomic/idempotent apply qua restart, immutable job snapshots/media hashes, list timeline + filters, safe reschedule/cancel, required Process fields pin vào snapshot, private transactional due claim/renew + generation fencing, lost-claim recovery/audit qua hai DB workers thật | Actual worker dispatch/overdue slot recovery, auto-append lịch, calendar day/week/drag/spread và Windows sleep hooks còn thiếu. Claim chỉ vào PREFLIGHT, không gửi input. Actual target/profile/certification/hardware preflight vẫn chưa nghiệm thu |
| P08 | Direct Node ADB smart socket, shared-server coexistence, SDK path/hash/native chooser + owned server provider, USB/LAN/pairing, stable property identity/host transports, fresh metadata/generation fences, persisted labels/enabled/reconnect/backoff, manual actor + shared leases, actual PNG/tap/swipe/keys/managed app/system intents, compact device UI | Windows/physical phone/owned native server acceptance NOT_RUN; CLI native version probe trên cloud bị read-only host home, không đổi HOME. Identity conflict resolution, APK/proxy và fleet coordination tiếp tục |
| P09 | XML Inspector với strict SAX budgets/password redaction, read-only PNG/tree correlation/rotation/foreground/lease, pick/search/frozen snapshot/highlight/JSON exact+contains selector counts/copy; mở từ Devices và editor với testDeviceId riêng Process | Video stream/decoder, XPath/relative/fallbacks/OCR/image/Unicode/multitouch/group/popup và physical geometry/correlation acceptance chưa xong |
| P10–P14 | Contracts/schema nền; chưa triển khai đủ risk/effect/app/network/packaging runtime | Các gate triển khai và nghiệm thu còn mở, không được gọi sản phẩm hoàn thành 100% |

## Bằng chứng đã chạy

- Unit/integration: 166 tests qua trong 17 files, gồm 40 node defaults, malformed inputs, atomic editor changes, graph topology/trace, SQLite persistence/backup/leases/uncertainty, source filesystem/coordinator/ledger, host grant boundaries, timezone/DST, persisted preview/apply/rollback/restart và immutable schedule edits; typed Process fields, CSV/JSON/XLSX/bulk import transaction/rollback/restart và actual dual-DB-worker ownership recovery. Thêm TCP smart-socket, DB registry/endpoint policies, XML/selector budgets, clipboard/group remaps, lexical loop refs/bypass scope/nested cursors và actual mid-run TRACE cancellation/time/depth budgets.
- Browser E2E: 11 scenarios qua trên Chromium, với DB tạm riêng: workflow round-trip/subgraphs/schema/version/export/import; Process context + edits trong khi save pending + schedule preview; forged origin/token/raw-path/private command rejection; typed forms giữ 0/false/missing/ordered multiline lists; saved preview→apply→timeline→reschedule/cancel qua SQLite thật. Schedule E2E dùng device record fixture trong DB tạm, không Android emulation. Thêm Process fields/save-ACK JSON race + import/bulk/export 3 formats; invalid/stale import; 1200 rows/virtual DOM/stable selection. TypeScript của UI tests được check trước browser. Thêm real TCP ADB fixture + SQLite: USB/LAN merge, screenshot/tap/key/managed-app, enabled ACK/reload, remembered endpoint policies và read-only XML Inspector pick/query; fixture không phải điện thoại thật. Editor device selection/consent và clipboard wires/groups→cut/undo→save/reload cũng có browser evidence.
- Electron 45/Linux main-only SQLite: WAL/Unicode/rollback/reopen/online backup/integrity PASS. Bundled Node 24.22.0, SQLite 3.53.4.
- Electron sandboxed renderer: named API, no window.require, 6 routes, actual create/save/reload qua preload/worker, native chooser capability, actual XLSX export→parse→preview/apply, không expose private/queue API PASS. Host media worker smoke với tệp thật + test picker adapter PASS; native dialog tương tác chưa chạy.
- Local host health + functional bootstrap request PASS. Đây là authoring, không Android automation.

Các lệnh/checks còn đang thay đổi được chạy lại khi scope code ảnh hưởng. Receipt theo revision sẽ lưu ở `docs/evidence/implementation/`; screenshots UI cùng thư mục. Chưa có kết quả Windows, điện thoại, proxy routing hoặc so sánh Genfamer.

## Tiếp tục

Increment 007–011 có code và checks như trên. Kế hoạch trước từng increment tại cùng thư mục. Checkpoint này chưa có actual workflow device executor/post verification, video, OCR, account/target adapters, proxy/APK hay installer; những phần này cần implementation tiếp trước nghiệm thu tổng thể. Không chỉ thiếu bước cắm điện thoại.

Tiếp tục hoàn thiện P04 group collapse/convert/subflow, P05 compiler/debugger, P06 media/Process và P07 scheduler dispatch theo dependencies; P08/P09 providers thực đã mở đường cho P10 risk và P11 effects. User đã yêu cầu code liên tục và nghiệm thu sau; không chờ reconfirm scope, không lấy fixture success thay actual acceptance. Không merge main/publish installers ngoài scope đã được chốt.
