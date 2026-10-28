# Tiến độ implementation

### Increment027 / P08-S072 — conflict readiness chỉ đọc

Đã code công cụ nội bộ kiểm tra trạng thái xung đột ADB, báo mã chặn cho physical verification, transport thiếu chứng cứ mới, lease đang dùng và job chưa an toàn. Tuyệt đối **không cấp quyền tự gỡ CONFLICT**, không chạm Android hoặc ghi lại fingerprint/raw serial. Đã có tests dữ liệu SQLite qua restart và tính read-only.

[CI 40642089739](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40642089739): Ubuntu **243 tests/26 files + 23 UI passed**, Windows **242 passed + 1 skip/26 files**, checks pass. Xem [kế hoạch](INCREMENT-027_PLAN.md), [kết quả](INCREMENT-027_RESULTS.md) và [receipt](../evidence/implementation/checkpoint-020.json). P08 **chưa ACCEPTED**; xác minh trực tiếp máy và thao tác giải quyết xung đột được đánh dấu NOT_RUN/OPEN.

# Increment026 / P08-S072 — khóa transport ADB có nhận diện phần cứng mâu thuẫn

Ngày 28/10/2026. Baseline `feat/studio-workspace@d3e2d2fa`, kế hoạch [INCREMENT-026_PLAN.md](INCREMENT-026_PLAN.md), source đã commit và kiểm tra tại `2efa916e`. Trước đây khi ADB trả hardware fingerprint khác cho cùng host/serial đã xác minh, database có thể tạo thiết bị mới và remap transport khỏi device ID lịch sử. Bản sửa latches `CONFLICT`, giữ original fingerprint/metadata/name/enabled/Process/job và không chuyển transport tự động. Khi fingerprint mới đụng identity đã đăng ký khác, cả hai profile đều cần review. Metadata offline/unauthorized/không đủ serial không được tạo identity mới hay overwrite evidence lịch sử. Generation của transport được fence; queue không claim lease với identity CONFLICT; UI hiển thị block reason và không gửi input.

**CI tại code commit `2efa916e`:** [run 40641180092](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40641180092) **SUCCESS Ubuntu+Windows**: Ubuntu **242 unit/integration/26 files + 23 browser**, Windows **241 đạt + 1 skip Unix-only SDK /26 files**. Generated/type/lint/build/plan/Windows setup/launcher PASS. [Kết quả và giới hạn](INCREMENT-026_RESULTS.md); [receipt checkpoint-019](../evidence/implementation/checkpoint-019.json). Đây là increment đã được TESTED trong CI, **chưa phải S072/P08 ACCEPTED**: chưa có thiết bị thật/Win10 physical, chưa có UI/audit để resolve CONFLICT, chưa chứng nhận automation/scale.

## Increment025 / P07-S068 + P13-S117 — sleep/resume recovery an toàn

Đã triển khai khôi phục job bị lỡ **chỉ sau cặp sự kiện Electron suspend→resume thực sự**, không suy khoảng trống từ app restart/queue bận. `NEXT_FUTURE_SLOT`, `CATCH_UP`, `SKIP` dùng lịch đã frozen trong snapshot, không thay occurrenceKey/hash, chỉ đụng SCHEDULED/QUEUED chưa claim, reject/cần review nếu có effect hoặc DST/slot không chắc chắn; transaction idempotent với giới hạn tối đa 5.000 job/lần, không cắt mất kết quả ngầm. Đây là logic queue; **chưa chạy đăng bài Android**. Kế hoạch tại [INCREMENT-025_PLAN.md](INCREMENT-025_PLAN.md), kết quả [INCREMENT-025_RESULTS.md](INCREMENT-025_RESULTS.md), receipt [checkpoint-018.json](../evidence/implementation/checkpoint-018.json).

**Chứng cứ tích hợp sau merge P04+P07:** [GitHub Actions 40640056106](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40640056106) **SUCCESS Ubuntu và Windows**, Ubuntu **236 unit/integration passed /26 files** cùng **23 Playwright UI passed**; hosted Windows **235 passed, 1 pre-existing Unix-only SDK skip /26 files**. P04 đã merge PR#2 `2400bee`, P07 đã merge PR#3 `efd40af` vào `feat/studio-workspace`; `main` chưa đổi. Đây không phải test Win10 sleep thật, 300 máy, chứng nhận ADB/OS, app Facebook/TikTok hay installer; các gates đó giữ OPEN/NOT_RUN.

## Increment024 / P04-S031/S037 — portable workflow clipboard

Ngày 28/10/2026, branch `phase/p04-portable-clipboard-2026-10-28`, baseline `feat/studio-workspace` commit `8793584`. Plan trước code tại [INCREMENT-024_PLAN.md](INCREMENT-024_PLAN.md); kết quả chi tiết tại [INCREMENT-024_RESULTS.md](INCREMENT-024_RESULTS.md).

Đã triển khai clipboard liên-workflow cùng app: copy transitive local subgraphs/loop bodies, remap graph/node/edge/group IDs, giữ nội bộ dây nối, nhóm, undo một transaction; clipboard payload versioned JSON có giới hạn kích thước/node/graph và reject malformed/cycle/missing refs/cross-app. Ctrl+C/X/V và menu canvas dùng cùng các lệnh; Ctrl+X cắt ngay trong editor, OS clipboard bị chặn thì giữ clipboard nội bộ và báo giới hạn, không xóa tệp hay chạm Android. Unit và browser regressions đã phát hiện và sửa lỗi Cut bất đồng bộ cùng locator test bị nhập nhằng.

**Evidence tại source commit b6a4026:** GitHub Actions [run 40638326588](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40638326588) PASS Ubuntu/Windows. Ubuntu `pnpm check`: **230 passed / 25 files**; `pnpm test:ui`: **23 passed, 0 failed**; Windows `pnpm check`: **229 passed, 1 skipped** (Unix-only native SDK fixture) / 25 files. `pnpm check:plan`, Windows setup và VerifyOnly cũng PASS. Đây là hosted CI, không phải chứng nhận Chrome/Electron clipboard trên Win10 GUI hay Android thật. P04 còn các parity/interaction gates khác, P05–P14 chưa nghiệm thu. Receipt: [checkpoint-017.json](../evidence/implementation/checkpoint-017.json).

## Increment023 / P07-S065 — calendar và app filter theo snapshot

Đã có LIST/DAY/WEEK/MONTH, local date/IANA timezone ranges dùng Temporal với exclusive UTC end, DST23/25h/leap/week-year rollover và invalid/skipped local-day rejection. App filter/cursor scope dùng immutable snapshot app, không đổi khi Process được rebind. Migration12 thêm indexed app/time/order query. DAY dùng bảng virtualized, WEEK/MONTH giới hạn6/3 cards mỗi ngày và nút Xem ngày, count ghi rõ đã tải và giữ keyset load-more; không truncate tổng records hoặc suy jobs từ Process đang mở. Calendar hiển thị timezone riêng, edit giữ snapshot timezone. Lazy-load Schedule/Temporal giữ initial entry411.93kB thay607.45kB trong bản eager thử đầu.

`pnpm check` core đạt **226 tests /24 files**, generated/type/lint/unit/build PASS; sau compact layout lại chạy type/lint/build và **full browser22 passed /0 failed/skipped/flaky**. Frozen install PASS, hai Python plan validators PASS,42 reference files nguyên byte. Browser kiểm local midnight,3-card month→full25-job day, pinned edit timezone, multi-app filtering và UTC/week switch. Core test còn kiểm Process rebind không đổi app của scheduled snapshots. Screenshot tháng ở `.cache/increment-023-calendar-month.png`; baseline PNG test outputs giữ riêng trong cache.

Đã backup schema11 trước khi nâng cloud DB12, restart host và functional health/renderer/bootstrap/current-schema smoke PASS. Readiness mới bắt được host cũ11 thay vì coi port mở là code mới. Isolated Electron45.0.0/bundled Node24.22.0 thực thi real DB-worker/status/verified backup trên schema12 PASS. Remote CI đã xanh ở022/49dcb77; CI cho023 cần xác nhận theo source commit sau push. Windows10 GUI/physical phones vẫn NOT_RUN.

**Remote CI023 đã xác nhận:** run40459468100 ở `e16940442ece6a2f6f0ae29bc179138ab0690d19` SUCCESS cả Ubuntu/Windows. Ubuntu226 pass/24 files; Windows225 pass/24 files +1 pre-existing Unix SDK fixture skip. Full generated/type/lint/build, Windows PowerShell setup/launcher VerifyOnly và hai Python validators đều PASS. Đây là hosted Windows CI, không Win10 GUI/Android certification.

P07 còn drag/auto-append/overdue/actual dispatch/sleep-resume. P06 còn thumbnail/cache/server content query/schema migration UI; P04/P05 và P08–P14 giữ gaps theo tracker. **Tổng15 phases chưa100%**; không dùng226 tests hoặc hosted Windows CI thay cho runtime/app/hardware acceptance.

## Increment022 / P00-S005 + P14-S119 — Windows source checkout/launcher

Đã tái hiện core.autocrlf=true làm generated node-registry.ts chuyển CRLF; thêm default LF cho source, giữ override frozen reference/binaries và CMD CRLF. Forced-autocrlf checkout sau sửa khớp44/44 files, gồm42 reference files nguyên byte và generated/schema. Không regenerate contracts hoặc renormalize frozen data. Strict generated check + hai plan validators PASS. App source vẫn ở mốc220 unit/integration +21 browser đã qua021.

Thêm setup Windows PowerShell5.1 (pinned Node/pnpm, local caches, frozen install, official Electron verifier, exit propagation), launcher CMD/start script và hướng dẫn tải đúng feature branch/ZIP. CI Windows chạy scripts thực, full checks; tắt matrix fail-fast để lấy đủ lỗi cả hai OS. Remote Windows result đang chờ commit/push mới; chưa ghi PASS. Đây là source launcher, không installer/offline bundle hay Win10/Android certification.

Follow-up: remote run40458019916 đã qua generated/type/lint và chạy tests; lộ8 failures (211 pass/1 Unix-only skip). Đã sửa flush owned backup bằng write-capable handle r+ cho Windows, canonicalize media fixture temp roots và batch seed paging1203 records trong một fixture transaction; giữ nguyên assertions/timeout. `pnpm check` lại đạt220/23 files; targeted backup browser PASS. Chờ remote rerun xác nhận các sửa này.

Linux runtime đã backup schema8 trước nâng, restart host bằng compiled source mới/schema11; functional health/renderer/bootstrap và live health/backup/idempotent retry PASS. Electron45.0.0 / bundled Node24.22.0 thực thi isolated SQLite-worker/status/backup smoke PASS qua RUN_AS_NODE; đây không là GUI/DPI/native-phone acceptance.

Run40458413309 đã qua Windows full application checks và source launcher VerifyOnly; phần còn fail là Python plan validator đọc UTF-8 bằng default Windows code page. Đã bổ sung PYTHONUTF8=1, không sửa frozen source-plan/scripts để làm xanh CI. Remote full-workflow result chờ rerun.

Đã xác nhận run40458714335 ở49dcb77 **SUCCESS cả Ubuntu và Windows**, gồm frozen install, Windows PowerShell setup/launcher VerifyOnly, generated/type/lint/unit/build và hai Python validators. Ubuntu220 passed; Windows219 passed/1 pre-existing Unix executable SDK fixture skipped. Không gọi skip này là Windows native SDK acceptance. Win10 GUI/DPI/physical phones và installer vẫn NOT_RUN. Chi tiết ở checkpoint015.

## Increment021 / P02-S020 + P13-S116/S117 — health và verified local backup

Đã có status allowlist từ SQLite quick_check/schema/counts, host memory/runtime và filesystem capacity/available thật. Panel header tải diagnostic JSON chỉ chứa DTO đã xem, không private names/fields/paths/serials/env. Backup lưu app-owned canonical directory, one-at-a-time + disk reserve, SQLite online copy chờ serialized worker hoàn tất, đóng WAL thành tệp độc lập và kiểm integrity/FK/schema/migration checksums rồi hash ngoài worker. No-replace publish + durable receipt, restart retry/copy bị đổi/mất được kiểm; final file thiếu receipt có thể recover. Không ghi đè prior backups/source files. UI save ACK trước backup, giữ ID khi retry; đóng host đợi/abort công việc đang chạy.

`pnpm check`: **220 tests /23 files**, generated/type/lint/build PASS. Full browser sau sửa fixture schema: **21 passed /0 failed/skipped/flaky**. Actual worker/FS tests xác minh backup contents/hash/restart/receipt recovery/corrupt/missing/path/symlink/low disk/concurrency/shutdown. Cả hai Python validators PASS. Chưa có restore/quiesce UI, structured run logs/retention/tray/power/staging disk enforcement hoặc Windows/Android acceptance.

Read-only GitHub kiểm tra phát hiện CI Windows ở7b0cfc7 fail `check:generated` do checkout line endings; Ubuntu checks đã qua nhưng matrix bị fail-fast. Lỗi này chưa sửa trong021; tiếp tục P00/P14 với kế hoạch022, không báo toàn remote CI PASS.

## Increment020 / P07-S066/S067 — scoped spread/cancel preview

Đã có named API, persisted proposal/checksum/expiry/host/epoch, exact apply và idempotency qua restart cho giãn lịch60–120 phút hoặc hủy nhóm đã chọn. Seed/gaps theo từng điện thoại, giữ anchor và chỉ dịch lịch về sau, cảnh báo crossing-day theo snapshot timezone. Chặn wrong revision, non-SCHEDULED/external intent, archived Process và same-device/same-instant ngoài scope; không đoán duration. Transaction giữ ID/snapshot/priority/bindings/history, không sửa jobs ngoài lựa chọn. UI chọn stable IDs, phân biệt scope đã tải, preview/hủy/apply/retry và reset selection khi filters/reload đổi.

`pnpm check`: **215 tests /22 files**, generated/type/lint/build PASS. Full browser: **20 passed /0 failed/skipped/flaky**. SQLite restart/apply twice/rollback/stale epoch/new intent/collision/expiry/tamper và browser selected subset/cross-day/cancel đã qua. P07 còn calendar/drag, overdue/auto-append/actual dispatch và Windows sleep/resume. Next independent slice P02/P13 workspace health/verified local backup; các runtime P08–P12 vẫn chưa nghiệm thu.

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
