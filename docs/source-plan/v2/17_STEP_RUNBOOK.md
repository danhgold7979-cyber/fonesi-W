# Runbook triển khai 125 bước

Baseline V2.1 · execution plan 1.0 · 15 phase / 125 bước / 375 đầu việc / 250 tình huống dự kiến.

Đây là công việc và tests cần thực hiện, **không phải kết quả đã chạy**. Xem [kế hoạch tổng thể](16_MASTER_EXECUTION_PLAN.md) và [các điểm chưa được chứng minh](18_READINESS_AND_RISKS.md).

Đường dẫn đầu ra là dự kiến, được cụ thể hóa trong increment. Phụ thuộc dưới đây là điều kiện triển khai từng bước; điều kiện nghiệm thu toàn phase vẫn ở master plan. Mọi bước production hiện PLANNED.

## P00 — Baseline, repository và công cụ

Gate toàn phase: Không có phase trước.

### S001 — Kiểm kê nguồn và checksum

Trạng thái: PLANNED · Test nghiệm thu: `AT-001`.

Tiền đề triển khai: Nguồn đầu vào đã được cung cấp.

Đầu ra dự kiến: `docs/source-plan/v2/source-inventory.json`, `docs/reference/`.

1. **S001.1** — Đối chiếu 41 file V1.7 và HTML mới với checksum nguồn.
2. **S001.2** — Kiểm kê source/DB thực đang có; ghi FULL-TRANSFER chưa đọc và baseline xây mới đã chốt.
3. **S001.3** — Lưu provenance; giữ reference nguyên byte, tách mock khỏi dữ liệu production.

Tình huống phải kiểm tra:

- Checksum toàn bộ reference khớp.
- File thiếu/đổi byte làm kiểm tra thất bại; không tuyên bố đọc gói quá giới hạn.

**Nghiệm thu:** Giữ nguyên reference; nêu rõ gói FULL-TRANSFER chưa đọc được.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S001/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S002 — Chốt kiểm kê UI và phạm vi

Trạng thái: PLANNED · Test nghiệm thu: `AT-002`.

Tiền đề triển khai: S001.

Đầu ra dự kiến: `docs/source-plan/v2/ui-actions.json`, `docs/source-plan/v2/feature-test-map.json`.

1. **S002.1** — Chốt 6 route, 124 command, 110 field signatures, 26 event families, 40 node và 30 tiện ích.
2. **S002.2** — Gán owner và bước cụ thể; field dùng lại có context variants; phân biệt local UI với privileged command.
3. **S002.3** — Đối chiếu chức năng kế thừa V1.7 và loại mock khỏi shipped scope.

Tình huống phải kiểm tra:

- 330 feature IDs và 121 legacy IDs đều truy được owner/test.
- Feature trỏ cả phase, thiếu owner hoặc UI được tính nhầm là hardware đều bị reject.

**Nghiệm thu:** 124 lệnh, fields, gestures, 40 node, các chức năng kế thừa đều có registry.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S002/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S003 — Chốt quyết định và migration V1.7 → Studio

Trạng thái: PLANNED · Test nghiệm thu: `AT-003`.

Tiền đề triển khai: S001, S002.

Đầu ra dự kiến: `docs/source-plan/v2/02_SCOPE_AND_DECISIONS.md`, `docs/source-plan/v2/13_MIGRATION_MAP.md`.

1. **S003.1** — Ghi các quyết định C01–C12, app registry mở và R0/R1/R2/R3.
2. **S003.2** — Chốt Process/lịch/dedupe/uncertainty/partial-result và phạm vi migration.
3. **S003.3** — Ghi giả định hardware, điều kiện kiểm chứng và đường xử lý nếu fail.

Tình huống phải kiểm tra:

- Mỗi xung đột nguồn có quyết định và nguồn ưu tiên.
- Không lấy nhãn READY của tài liệu cũ làm bằng chứng phần mềm đã tồn tại.

**Nghiệm thu:** Mỗi xung đột có quyết định; UI mới và runtime invariants được phân biệt.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S003/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S004 — Chuẩn bị repository và hướng dẫn agent

Trạng thái: PLANNED · Test nghiệm thu: `AT-004`.

Tiền đề triển khai: S003.

Đầu ra dự kiến: `AGENTS.md`, `README.md`, `.gitignore`.

1. **S004.1** — Giữ checkout và remote history hiện có; dùng feature branch.
2. **S004.2** — Ghi commands thực, quy tắc reference, data roots, module boundaries và receipts.
3. **S004.3** — Giữ dữ liệu runtime/secrets/cache ngoài Git; báo rõ push 403 nếu quyền ghi còn thiếu.

Tình huống phải kiểm tra:

- Git diff chỉ chứa phạm vi increment và reference không đổi.
- Không ghi đè README người dùng, không force-push hoặc tự merge main.

**Nghiệm thu:** Giữ README/commit remote và docs hiện có; không tạo worktree mặc định.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S004/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S005 — Ghim toolchain và gates cloud/Windows

Trạng thái: PLANNED · Test nghiệm thu: `AT-005`.

Tiền đề triển khai: S004.

Đầu ra dự kiến: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `docs/evidence/toolchain/`.

1. **S005.1** — Resolve Node/pnpm/TypeScript và dependencies stable từ registry; ghi exact versions/integrity.
2. **S005.2** — Pin package manager, workspace và build-script allowlist; Electron/SQLite final ở S015.
3. **S005.3** — Thử install clean/frozen và ghi riêng Linux/Windows prerequisites thực còn thiếu.

Tình huống phải kiểm tra:

- Frozen install từ cache rỗng và lockfile nhất quán.
- Lockfile lệch hoặc postinstall chưa cho phép phải dừng; không giả pnpm cài sẵn đúng bản.

**Nghiệm thu:** Cài có integrity; exact Electron/SQLite chỉ chốt sau compatibility check.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S005/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S006 — Thiết lập checks và CI nền

Trạng thái: PLANNED · Test nghiệm thu: `AT-006`.

Tiền đề triển khai: S005.

Đầu ra dự kiến: `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, `.github/workflows/check.yml`.

1. **S006.1** — Tạo scripts typecheck/lint/test/build có ý nghĩa cho các package đã tồn tại.
2. **S006.2** — CI frozen install và gates Linux; thêm Windows job khi có desktop/native package.
3. **S006.3** — Thu logs/test count theo revision; app chưa tồn tại được ghi NOT_RUN thay vì PASS.

Tình huống phải kiểm tra:

- Một contract test thực chạy và lỗi type/lint/test làm job fail.
- Zero-test run hoặc job bị skip không được dùng làm nghiệm thu app.

**Nghiệm thu:** Typecheck/lint/unit/build có kết quả thực; kiểm tra Windows tách khỏi Linux.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S006/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

## P01 — Domain và contracts

Gate toàn phase: P00.

### S007 — AppDefinition và CapabilityProfile mở

Trạng thái: PLANNED · Test nghiệm thu: `AT-007`.

Tiền đề triển khai: S005.

Đầu ra dự kiến: `packages/contracts/src/apps.ts`, `packages/domain/src/capabilities.ts`.

1. **S007.1** — Định nghĩa app ID ổn định, package profiles và capability dimensions độc lập.
2. **S007.2** — Seed Facebook/Lite/Instagram/TikTok/Threads bằng metadata; hỗ trợ app tùy chỉnh.
3. **S007.3** — Validate duplicate package/profile, unknown version và trạng thái chưa chứng nhận.

Tình huống phải kiểm tra:

- Đăng ký app tùy chỉnh và author workflow generic được.
- Có logo/package không tự bật auto-post; version lạ có block reason.

**Nghiệm thu:** Registry mở theo package; 5 app là seed/templates. Chưa có certification không được giả hỗ trợ automation.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S007/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S008 — WorkflowDraft, WorkflowVersion và Certification

Trạng thái: PLANNED · Test nghiệm thu: `AT-008`.

Tiền đề triển khai: S007.

Đầu ra dự kiến: `packages/contracts/src/workflows.ts`, `packages/domain/src/workflow-version.ts`.

1. **S008.1** — Tách workflow identity, mutable draft revision, immutable version và test/certification receipt.
2. **S008.2** — Canonicalize/hash toàn bundle và dependency closure.
3. **S008.3** — Ràng buộc readiness theo workflow hash và device/app/locale profile, kể cả user-issued readiness.

Tình huống phải kiểm tra:

- Sửa draft không làm đổi version/job đang tham chiếu.
- Receipt của version/profile khác không mở gate chạy lịch.

**Nghiệm thu:** Draft sửa được, version immutable, certification theo target profile.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S008/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S009 — Graph, Node, Edge và Group schemas

Trạng thái: PLANNED · Test nghiệm thu: `AT-009`.

Tiền đề triển khai: S008.

Đầu ra dự kiến: `packages/contracts/src/graphs.ts`, `packages/contracts/src/node-registry.ts`.

1. **S009.1** — Model graph/node/edge/port/group với ID scope và finite geometry.
2. **S009.2** — Đưa 40 node definitions vào một registry dùng chung cho form/library/compiler.
3. **S009.3** — Phân biệt group trực quan, local subgraph và reusable version reference.

Tình huống phải kiểm tra:

- Round-trip graph giữ IDs, ports và group membership.
- Reject unknown type, NaN, duplicate IDs và port không thuộc node.

**Nghiệm thu:** ID/ports/config schema versioned, phân biệt group trực quan và subflow.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S009/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S010 — Input/Output schema và typed values

Trạng thái: PLANNED · Test nghiệm thu: `AT-010`.

Tiền đề triển khai: S009.

Đầu ra dự kiến: `packages/contracts/src/typed-values.ts`, `packages/domain/src/input-mapping.ts`.

1. **S010.1** — Định nghĩa 9 kiểu input, required/optional và scopes row/process/output.
2. **S010.2** — Validate safe keys, typed mapping, ordered file[]/list và missing khác empty.
3. **S010.3** — Chốt cách schema evolution/migration báo field không tương thích.

Tình huống phải kiểm tra:

- 0/false/empty/list và ordered files giữ nguyên kiểu.
- Reject reserved keys, number không finite và mapping sai kiểu.

**Nghiệm thu:** 9 loại field; scope row/process/output; keys an toàn; mapping có kiểu.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S010/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S011 — Process độc lập với editor/test device

Trạng thái: PLANNED · Test nghiệm thu: `AT-011`.

Tiền đề triển khai: S007, S008, S010.

Đầu ra dự kiến: `packages/contracts/src/processes.ts`, `packages/domain/src/process.ts`.

1. **S011.1** — Định nghĩa Process ID riêng, device/app/workflow/account/target bindings.
2. **S011.2** — Cho phép draft chưa gán máy; validate references khi ready.
3. **S011.3** — Tách editor workflow, library filter, test device và selected Process khỏi nhau.

Tình huống phải kiểm tra:

- Hai Process cùng máy giữ fields/lịch riêng.
- Đổi Inspector device hoặc library filter không mutate Process.

**Nghiệm thu:** Process ID bền; app/workflow/account/target/device refs hợp lệ.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S011/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S012 — MediaAsset, ContentItem, Job và Transaction

Trạng thái: PLANNED · Test nghiệm thu: `AT-012`.

Tiền đề triển khai: S010, S011.

Đầu ra dự kiến: `packages/contracts/src/media.ts`, `packages/contracts/src/jobs.ts`, `packages/domain/src/effects.ts`.

1. **S012.1** — Model assets/content/job snapshot/run/effect/comment/staging/review.
2. **S012.2** — Định nghĩa state transitions và dedupe theo asset order hoặc normalized text/app/target.
3. **S012.3** — Tách pending uncertainty, definitive failure và SUCCESS_WITH_WARNINGS.

Tình huống phải kiểm tra:

- Cùng asset tới hai target khác nhau được, repost chủ đích có ID mới.
- Không retry publish từ uncertainty hoặc cascade-delete history.

**Nghiệm thu:** Một content item có 0/1/n asset; job snapshot và effect journal riêng.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S012/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S013 — IPC, event và error contracts

Trạng thái: PLANNED · Test nghiệm thu: `AT-013`.

Tiền đề triển khai: S007, S008, S009, S010, S011, S012.

Đầu ra dự kiến: `packages/contracts/src/ipc.ts`, `packages/contracts/src/errors.ts`, `packages/contracts/src/events.ts`.

1. **S013.1** — Định nghĩa typed allowlisted API và request/result/error envelopes.
2. **S013.2** — Gắn operation ID, expectedRevision, sequence, cancellation và batch per-device results.
3. **S013.3** — Chốt sender/window scope, host file refs và secret refs; renderer không gọi shell/SQL.

Tình huống phải kiểm tra:

- Runtime validation reject DTO sai dù renderer bypass form.
- Cancelled/partial failure không biến thành global success; stale events được requery.

**Nghiệm thu:** Runtime validation, operation IDs, cancellation và per-device batch results.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S013/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

## P02 — SQLite và persistence

Gate toàn phase: P01.

### S014 — Schema quan hệ và migrations

Trạng thái: PLANNED · Test nghiệm thu: `AT-014`.

Tiền đề triển khai: S012, S013.

Đầu ra dự kiến: `packages/database/src/migrations/`, `packages/database/src/schema.ts`.

1. **S014.1** — Chọn table/typed JSON/immutable blob/derived view cho từng entity.
2. **S014.2** — Tạo FK/index/unique occurrence/effect và history retention constraints.
3. **S014.3** — Version/checksum migrations; bật WAL/FK và bounded busy timeout.

Tình huống phải kiểm tra:

- Fresh DB và migration từ fixture qua integrity_check.
- Duplicate effect/job và dangling FK bị DB reject, history không mất khi archive.

**Nghiệm thu:** FK/index/unique scope rõ; history không bị cascade-delete.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S014/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S015 — SQLite adapter và Electron compatibility

Trạng thái: PLANNED · Test nghiệm thu: `AT-015`.

Tiền đề triển khai: S005, S014.

Đầu ra dự kiến: `packages/database/src/adapter.ts`, `tools/spikes/electron-sqlite/`, `docs/evidence/toolchain/`.

1. **S015.1** — Dựng Electron main-only smoke harness, chưa cần UI P03.
2. **S015.2** — So sánh node:sqlite khả dụng thực với maintained native driver dưới exact Electron.
3. **S015.3** — Chọn một driver, pin ABI/build/rebuild strategy; ghi Windows acceptance riêng.

Tình huống phải kiểm tra:

- Trong Electron thật: create/read/write/transaction/close/reopen thành công.
- Driver chỉ chạy Node hoặc thiếu Windows smoke không được claim Electron/Windows PASS.

**Nghiệm thu:** Chứng minh driver dưới Electron ABI; không chỉ standalone Node.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S015/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S016 — Lưu workflow bundle hoàn chỉnh

Trạng thái: PLANNED · Test nghiệm thu: `AT-016`.

Tiền đề triển khai: S008, S009, S010, S014, S015.

Đầu ra dự kiến: `packages/database/src/repositories/workflows.ts`, `packages/database/src/repositories/versions.ts`.

1. **S016.1** — CRUD draft bằng expectedRevision và lưu tất cả subgraphs/schema/dependencies cùng transaction.
2. **S016.2** — Create version bằng canonical hash; clone remap IDs theo scope.
3. **S016.3** — Trả ACK revision/hash thật, giữ draft dirty nếu save lỗi.

Tình huống phải kiểm tra:

- Save/restart/export/import giữ full closure và custom fields.
- Concurrent save stale bị conflict; crash giữa bundle write rollback toàn bộ.

**Nghiệm thu:** Main/subgraphs/inputs/outputs/dependencies cùng transaction, không chia sẻ graph toàn cục.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S016/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S017 — Lưu Process và settings đúng scope

Trạng thái: PLANNED · Test nghiệm thu: `AT-017`.

Tiền đề triển khai: S011, S014, S015.

Đầu ra dự kiến: `packages/database/src/repositories/processes.ts`, `packages/database/src/repositories/preferences.ts`.

1. **S017.1** — Persist bindings/fields/source/schedule theo Process ID.
2. **S017.2** — Persist theme/layout riêng workspace và enabled riêng Device.
3. **S017.3** — Tách async query/save generation để đổi máy không nhận kết quả cũ.

Tình huống phải kiểm tra:

- Restart giữ weekdays/source/policy và từng Process độc lập.
- Response Process A tới sau khi mở B không ghi vào B.

**Nghiệm thu:** Weekdays, slots, source, fields, policies và device enabled giữ qua restart.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S017/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S018 — Lưu assets/content items và references

Trạng thái: PLANNED · Test nghiệm thu: `AT-018`.

Tiền đề triển khai: S012, S014, S015.

Đầu ra dự kiến: `packages/database/src/repositories/content.ts`, `packages/database/src/repositories/assets.ts`.

1. **S018.1** — Lưu asset refs và ContentItem IDs riêng; ordered assets có ordinal.
2. **S018.2** — Queries paging/filter theo Process, không theo row index.
3. **S018.3** — Missing/ignored source giữ provenance và refs lịch sử.

Tình huống phải kiểm tra:

- Hai ContentItems dùng chung asset không trùng IDs hoặc jobs.
- Remove binding không xóa source file hoặc asset còn được tham chiếu.

**Nghiệm thu:** Asset reuse không tái sử dụng content/job ID; ordered multi-asset rõ.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S018/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S019 — Lưu job, leases, effects và review records

Trạng thái: PLANNED · Test nghiệm thu: `AT-019`.

Tiền đề triển khai: S012, S014, S015.

Đầu ra dự kiến: `packages/database/src/repositories/jobs.ts`, `packages/database/src/repositories/leases.ts`, `packages/database/src/repositories/effects.ts`.

1. **S019.1** — Persist immutable snapshots, occurrence/effect uniqueness và attempt journal.
2. **S019.2** — Implement atomic claim/lease generation với contention và stale fencing rejection.
3. **S019.3** — Lưu review/resolution và partial results bền trước external mutation.

Tình huống phải kiểm tra:

- Hai claimant cùng máy chỉ một owner; process restart giữ uncertainty.
- Không ghi SUCCESS thiếu verification hoặc nhận stale generation sau reconnect.

**Nghiệm thu:** Unique occurrence/effect keys, fencing tokens và transaction boundaries có test contention.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S019/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S020 — Backup/restore, WAL và integrity

Trạng thái: PLANNED · Test nghiệm thu: `AT-020`.

Tiền đề triển khai: S014, S015, S016, S017, S018, S019.

Đầu ra dự kiến: `packages/database/src/backup.ts`, `packages/database/src/restore.ts`.

1. **S020.1** — Dùng SQLite backup API/snapshot nhất quán khi WAL hoạt động.
2. **S020.2** — Restore vào staging DB, validate schema/checksum/integrity và preview.
3. **S020.3** — Quiesce writers, atomic swap có rollback; giữ bản trước khi migration.

Tình huống phải kiểm tra:

- Backup lúc đang ghi restore được dữ liệu và effect states nhất quán.
- Backup hỏng/version mới không thay active DB; full disk không mất DB cũ.

**Nghiệm thu:** Backup nhất quán; restore vào staging DB rồi integrity check trước thay thế.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S020/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S021 — Import atomic, revisions và rollback

Trạng thái: PLANNED · Test nghiệm thu: `AT-021`.

Tiền đề triển khai: S016, S017, S018, S019, S020.

Đầu ra dự kiến: `packages/import-export/src/preview.ts`, `packages/import-export/src/commit.ts`.

1. **S021.1** — Parse/validate toàn import và namespaces trong worker trước mutation.
2. **S021.2** — Preview remap/conflicts/loss/rebind; commit theo token/revisions trong một transaction.
3. **S021.3** — Persist import receipt và rollback nếu lỗi bất kỳ entity.

Tình huống phải kiểm tra:

- Custom bundle/process round-trip giữ types và full refs.
- Malformed/deep/unknown nodes hoặc stale preview không mutate DB một phần.

**Nghiệm thu:** Import sai schema/refs không mutate DB; optimistic concurrency chống ghi đè.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S021/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

## P03 — Shell và UI nền Studio

Gate toàn phase: P01, P02.

### S022 — Rail, header, footer và sáu route

Trạng thái: PLANNED · Test nghiệm thu: `AT-022`.

Tiền đề triển khai: S013, S015, S017.

Đầu ra dự kiến: `apps/desktop/src/main/`, `apps/desktop/src/preload/`, `apps/desktop/src/renderer/shell/`.

1. **S022.1** — Dựng Electron main/preload/React renderer với CSP/isolation/sandbox và typed API.
2. **S022.2** — Tạo rail/header/footer và 6 route từ baseline Compact.
3. **S022.3** — Route tới service/empty state thật; không seed máy/account/jobs mẫu.

Tình huống phải kiểm tra:

- Desktop shell khởi động, navigation và authoring empty states hoạt động.
- Renderer không có require/process/shell; navigation URL lạ bị chặn.

**Nghiệm thu:** Theo layout mới, breadcrumbs/ngữ cảnh/capability status thống nhất.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S022/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S023 — Theme, layout và Windows DPI

Trạng thái: PLANNED · Test nghiệm thu: `AT-023`.

Tiền đề triển khai: S022.

Đầu ra dự kiến: `apps/desktop/src/renderer/theme/`, `apps/desktop/src/renderer/layout/`.

1. **S023.1** — Token hóa light/dark, spacing, typography và icon accessibility.
2. **S023.2** — Giữ 4 workflow controls, progressive panels và minimum desktop window.
3. **S023.3** — Persist splitters/layout; kiểm DPI 100/125/150%, monitor/maximize/restore trên Windows.

Tình huống phải kiểm tra:

- 1366/1600/1920 và min-window không tràn document; canvas pan thay thu chữ.
- Layout cũ ngoài monitor được clamp/reset; Windows DPI chưa thử ghi NOT_RUN.

**Nghiệm thu:** Light/dark; kích thước panel lưu thật; 100/125/150% không che nút chính.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S023/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S024 — Điều hướng và context isolation

Trạng thái: PLANNED · Test nghiệm thu: `AT-024`.

Tiền đề triển khai: S011, S017, S022.

Đầu ra dự kiến: `apps/desktop/src/renderer/state/`, `apps/desktop/src/renderer/navigation/`.

1. **S024.1** — Tạo independent stores/queries cho library/editor/Inspector/Process/selection.
2. **S024.2** — Điều hướng context service bằng ID và cancellation generation.
3. **S024.3** — Dirty form giữ edits hoặc resolve rõ; route unmount hủy subscription cũ.

Tình huống phải kiểm tra:

- REG-01/02/10: d1→d2, library đổi app, restart giữ scope.
- Async completion cũ không đổi context mới hoặc làm mất unsaved edits.

**Nghiệm thu:** Chuyển máy/app/target không mang rows hoặc schema của context khác.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S024/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S025 — Modal, context menu và keyboard focus

Trạng thái: PLANNED · Test nghiệm thu: `AT-025`.

Tiền đề triển khai: S022.

Đầu ra dự kiến: `apps/desktop/src/renderer/components/dialog/`, `apps/desktop/src/renderer/components/context-menu/`.

1. **S025.1** — Tạo dialog/focus trap/return focus và safe Escape policy.
2. **S025.2** — Context menu bám viewport, keyboard arrows/Enter/Esc/Shift+F10.
3. **S025.3** — Form validation inline; destructive actions dùng confirm/undo đúng scope.

Tình huống phải kiểm tra:

- Keyboard-only mở/chọn/đóng menu và trả focus đúng nút.
- Delete/Ctrl+A/Space trong input không gửi graph command.

**Nghiệm thu:** Focus trap/restore/Escape; confirm destructive; menu không ra ngoài viewport.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S025/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S026 — Empty/loading/error/unsupported states

Trạng thái: PLANNED · Test nghiệm thu: `AT-026`.

Tiền đề triển khai: S013, S022.

Đầu ra dự kiến: `apps/desktop/src/renderer/components/operation-state/`.

1. **S026.1** — Chuẩn hóa loading/empty/error/cancel/unsupported/dirty/saved components.
2. **S026.2** — Hiện capability block reasons và đường dẫn kết nối/retry phù hợp.
3. **S026.3** — Disable unavailable actions bằng state thực; chỉ đếm service-backed data.

Tình huống phải kiểm tra:

- Không thiết bị vẫn tạo workflow/Process draft được.
- Không có backend không hiển thị success, số máy/account hoặc post count mẫu.

**Nghiệm thu:** Không tự tạo thiết bị hoặc reported success; thiếu backend có lý do hiển thị.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S026/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S027 — Save status, toasts và notifications

Trạng thái: PLANNED · Test nghiệm thu: `AT-027`.

Tiền đề triển khai: S013, S017, S022.

Đầu ra dự kiến: `apps/desktop/src/renderer/components/save-status/`, `apps/desktop/src/renderer/notifications/`.

1. **S027.1** — Bind saved/saving/conflict/error với ACK revision, không với click.
2. **S027.2** — Toast/error/progress correlation theo operation và context.
3. **S027.3** — Notifications giữ scope/read state; Ctrl+S save domain đang có focus.

Tình huống phải kiểm tra:

- ACK save cũ không xóa dirty của edits mới.
- Save/network failure giữ data và có retry/export, không báo đã lưu.

**Nghiệm thu:** Chỉ báo saved sau ACK bền; lỗi save/revision conflict có retry an toàn.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S027/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S028 — Visual và navigation regressions

Trạng thái: PLANNED · Test nghiệm thu: `AT-028`.

Tiền đề triển khai: S022, S023, S024, S025, S026, S027.

Đầu ra dự kiến: `tests/ui/shell/`, `docs/evidence/ui/`.

1. **S028.1** — Browser/Electron visual cho 6 route và Compact constraints.
2. **S028.2** — Kiểm focus/navigation/context regressions với empty và populated fixtures test-only.
3. **S028.3** — Ghi screenshots/build/OS/DPI; baseline ảnh có review thay vì auto-update.

Tình huống phải kiểm tra:

- REG-01/02/22 và route smoke qua dữ liệu thật của test DB.
- Screenshot prototype không thay bằng chứng Electron hoặc Windows DPI.

**Nghiệm thu:** Ảnh các route/modal và test focus/resize; fixture tách runtime production.

**Môi trường:** `CLOUD_PLUS_ELECTRON_AND_WINDOWS_FOR_HOST_BEHAVIOR`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S028/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

## P04 — Workflow editor

Gate toàn phase: P03.

### S029 — Node library và tìm kiếm

Trạng thái: PLANNED · Test nghiệm thu: `AT-029`.

Tiền đề triển khai: S007, S009, S022.

Đầu ra dự kiến: `packages/editor/src/library/`, `apps/desktop/src/renderer/workflows/`.

1. **S029.1** — Sinh 40 node definitions vào library theo registry, search/group/favorites.
2. **S029.2** — Workflow list CRUD/archive/version menu qua service; library filter độc lập.
3. **S029.3** — App tùy chỉnh dùng template generic, không tự copy selectors Facebook.

Tình huống phải kiểm tra:

- Search/favorite và mở workflow đúng app/bundle.
- Unknown drag payload và filter app không mutate workflow hiện tại.

**Nghiệm thu:** 40 node từ catalog chung; nhóm và subflow library nhất quán.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S029/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S030 — Thêm/kéo/resize node

Trạng thái: PLANNED · Test nghiệm thu: `AT-030`.

Tiền đề triển khai: S009, S023, S029.

Đầu ra dự kiến: `packages/editor/src/geometry/`, `packages/editor/src/commands/nodes.ts`.

1. **S030.1** — Add/drag/resize bằng inverse viewport world transform.
2. **S030.2** — Pointer capture, snap/grid, auto-pan và one-transaction undo.
3. **S030.3** — Node ID stable, finite dimensions và viewport clipping đúng.

Tình huống phải kiểm tra:

- Drag/resize đúng vị trí ở nhiều zoom/pan/DPI.
- Cancel pointer/resize không để NaN hoặc nhiều undo entries cho một gesture.

**Nghiệm thu:** Tọa độ world-space, snap và auto-pan ổn định dưới zoom.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S030/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S031 — Selection, clipboard, undo/redo và phím tắt

Trạng thái: PLANNED · Test nghiệm thu: `AT-031`.

Tiền đề triển khai: S025, S030.

Đầu ra dự kiến: `packages/editor/src/commands/history.ts`, `packages/editor/src/commands/clipboard.ts`.

1. **S031.1** — Selection/marquee/multi-select, nudge 1/10 và scoped shortcuts.
2. **S031.2** — Copy/paste/duplicate remap nodes/edges/groups/subgraph refs an toàn.
3. **S031.3** — Undo/redo theo design transactions; không tác động input điện thoại đã gửi.

Tình huống phải kiểm tra:

- Copy group/custom subflow và undo/redo giữ topology.
- Gõ textarea không xóa/chọn node; clipboard invalid không mutate graph.

**Nghiệm thu:** Canvas focus scope, nudge 1/10, selection/clipboard/history scoped workflow; typing không sửa node.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S031/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S032 — Nối/xóa/chèn node trên edge

Trạng thái: PLANNED · Test nghiệm thu: `AT-032`.

Tiền đề triển khai: S009, S030, S031.

Đầu ra dự kiến: `packages/editor/src/commands/edges.ts`.

1. **S032.1** — Connect/delete/select edge bằng node/port IDs hợp lệ.
2. **S032.2** — Insert node trên edge thay topology atomic và giữ error semantics.
3. **S032.3** — Cancel/Escape xóa pending insertion; reject duplicate output và port mismatch.

Tình huống phải kiểm tra:

- Insert/undo đưa graph về cùng topology/hash ban đầu.
- REG-04: output trùng, self-cycle không được chấp nhận như graph hợp lệ.

**Nghiệm thu:** Ports hợp lệ; một edge/output trừ cơ chế fanout được thiết kế; undo một lần.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S032/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S033 — Bẻ dây và routing

Trạng thái: PLANNED · Test nghiệm thu: `AT-033`.

Tiền đề triển khai: S032.

Đầu ra dự kiến: `packages/editor/src/geometry/edge-routing.ts`.

1. **S033.1** — Reroute waypoints, drag handles và hit testing theo world coordinates.
2. **S033.2** — Tách edge visual points khỏi execution semantics.
3. **S033.3** — Persist route points và undo; normalize khi move/delete nodes.

Tình huống phải kiểm tra:

- Reroute/save/reload giữ hình dây và source/target.
- Node bị xóa hoặc resize không để orphan routing handle.

**Nghiệm thu:** Handles bám node/zoom; reroute không đổi graph semantics.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S033/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S034 — Pan/zoom/fit/minimap và command palette

Trạng thái: PLANNED · Test nghiệm thu: `AT-034`.

Tiền đề triển khai: S030, S031.

Đầu ra dự kiến: `packages/editor/src/viewport/`, `apps/desktop/src/renderer/commands/`.

1. **S034.1** — Wheel dọc, Shift-wheel ngang, Ctrl-wheel zoom quanh cursor, middle/Space pan.
2. **S034.2** — Fit all/selection, minimap/snap/focus và bounded zoom.
3. **S034.3** — Ctrl+K palette tìm lệnh/node với capability/focus-aware enablement.

Tình huống phải kiểm tra:

- Cursor anchor giữ vị trí khi zoom; Shift-wheel chỉ pan một lần.
- Palette không gửi hardware command disabled hoặc lấy phím khi modal nhập liệu.

**Nghiệm thu:** Fit selection, readable default zoom, Ctrl+K/node search, mouse gestures có cùng command registry.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S034/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S035 — Layout, align và group trực quan

Trạng thái: PLANNED · Test nghiệm thu: `AT-035`.

Tiền đề triển khai: S030, S031, S033.

Đầu ra dự kiến: `packages/editor/src/commands/layout.ts`, `packages/editor/src/commands/groups.ts`.

1. **S035.1** — Layout ngang/dọc, align/distribute theo node dimensions thật.
2. **S035.2** — Group/rename/collapse/ungroup visual, membership nhất quán.
3. **S035.3** — Một action là một undo transaction và không đổi thứ tự execution.

Tình huống phải kiểm tra:

- Move/delete/group undo giữ membership và graph semantics.
- Collapsed group không làm bỏ node khi compile/export.

**Nghiệm thu:** Group membership cập nhật sau move/delete; không giả làm subflow.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S035/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S036 — Properties và advanced editor theo node type

Trạng thái: PLANNED · Test nghiệm thu: `AT-036`.

Tiền đề triển khai: S009, S010, S025, S030.

Đầu ra dự kiến: `packages/editor/src/properties/`, `apps/desktop/src/renderer/inspector/properties/`.

1. **S036.1** — Sinh typed form theo node definition, common name/timeout/delay/description.
2. **S036.2** — Chỉ mở advanced phù hợp selector/gesture/loop/OCR/effect config.
3. **S036.3** — Inline errors, units/ranges và fallbacks có thứ tự; edit không tự authorize side effect.

Tình huống phải kiểm tra:

- 40 config forms serialize round-trip giữ 0/false và required fields.
- Invalid timeout/coords/confidence hoặc reserved mapping không lưu version.

**Nghiệm thu:** Field-specific config, validation inline, effect retry policy có kiểm soát.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S036/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S037 — Tạo/mở/convert subflow và mapping

Trạng thái: PLANNED · Test nghiệm thu: `AT-037`.

Tiền đề triển khai: S008, S010, S031, S032, S036.

Đầu ra dự kiến: `packages/editor/src/commands/subflows.ts`, `packages/editor/src/mappings/`.

1. **S037.1** — Tạo/mở local subgraph hoặc pinned reusable version với typed ports.
2. **S037.2** — Convert selection chỉ single-entry/exit mapping rõ, remap IDs/edges atomic.
3. **S037.3** — Clone/export/import full bundle và custom schema qua S016/S021.

Tình huống phải kiểm tra:

- REG-03/05/21: closure/mapping/custom fields không mất.
- Multi-entry hoặc recursive refs bị reject với hướng dẫn, không auto-wire sai.

**Nghiệm thu:** Nested refs/version/type-safe; clone/export đầy đủ dependencies.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S037/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S038 — Breadcrumb/call-stack và Debug UI

Trạng thái: PLANNED · Test nghiệm thu: `AT-038`.

Tiền đề triển khai: S024, S037.

Đầu ra dự kiến: `apps/desktop/src/renderer/inspector/debug/`, `packages/editor/src/navigation/`.

1. **S038.1** — Breadcrumb theo graph-open stack; debug call stack riêng với authoring navigation.
2. **S038.2** — Render frames/locals/breakpoints/logs theo session events.
3. **S038.3** — Step/pause/stop UI bind API S047 khi engine sẵn sàng; trước đó disabled rõ.

Tình huống phải kiểm tra:

- Mở child A→B rồi Back về đúng cha.
- View chuyển workflow không tiếp tục nhận debug state của session trước.

**Nghiệm thu:** Về cha thật theo stack; không luôn nhảy main; no real action trong undo.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S038/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S039 — Autosave, progressive panels và shortcuts

Trạng thái: PLANNED · Test nghiệm thu: `AT-039`.

Tiền đề triển khai: S016, S023, S024, S027, S031, S036, S037.

Đầu ra dự kiến: `packages/editor/src/persistence/`, `apps/desktop/src/renderer/inspector/panels/`.

1. **S039.1** — Autosave debounce với expectedRevision, save ACK và unsaved recovery.
2. **S039.2** — Library/phone thu gọn, properties theo selection, advanced theo type; preferences đúng scope.
3. **S039.3** — Ctrl+S/F1, shortcut help và onboarding ngắn; giữ toolbar 4 controls.

Tình huống phải kiểm tra:

- Edit trong khi save/restart và conflict giữ mọi thay đổi hoặc báo resolve.
- Close/save failure không mất draft; thu panel không đổi graph/runtime state.

**Nghiệm thu:** 4 primary controls, library/phone collapse, properties theo selection, no command conflicts.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S039/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

## P05 — Validator, compiler và execution core

Gate toàn phase: P01, P04.

### S040 — Validate schema import và reserved keys

Trạng thái: PLANNED · Test nghiệm thu: `AT-040`.

Tiền đề triển khai: S008, S009, S010.

Đầu ra dự kiến: `packages/workflow-engine/src/validation/envelope.ts`.

1. **S040.1** — Validate import envelope và node configs bằng runtime schema trước semantic pass.
2. **S040.2** — Safe key allowlist, finite numbers, size/depth/resources và detailed issue locations.
3. **S040.3** — Validate trước DB mutation/renderer graph load.

Tình huống phải kiểm tra:

- Valid custom workflow app và typed values được chấp nhận.
- REG-11: prototype pollution/unknown type/oversize bị reject atomic.

**Nghiệm thu:** Reject unknown types/ports, duplicate IDs, prototype keys và payload quá resource budget.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S040/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S041 — Validate graph topology

Trạng thái: PLANNED · Test nghiệm thu: `AT-041`.

Tiền đề triển khai: S040.

Đầu ra dự kiến: `packages/workflow-engine/src/validation/topology.ts`.

1. **S041.1** — Unique IDs, refs, input/output port existence và one-edge/output.
2. **S041.2** — Start/terminal/reachability/dead-end và cycle detection.
3. **S041.3** — Issue dùng graphId/nodeId/edgeId để click tới vị trí chính xác.

Tình huống phải kiểm tra:

- Mỗi invalid edge/cycle có stable error location.
- Graph main valid không che lỗi disconnected/child graph.

**Nghiệm thu:** Endpoints/ports/output uniqueness/reachability và required terminal đầy đủ.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S041/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S042 — Loops/break/continue và budgets

Trạng thái: PLANNED · Test nghiệm thu: `AT-042`.

Tiền đề triển khai: S041.

Đầu ra dự kiến: `packages/workflow-engine/src/validation/loops.ts`, `packages/workflow-engine/src/runtime/budgets.ts`.

1. **S042.1** — Loop body scope, item/index typing và lexical break/continue.
2. **S042.2** — Max iterations/elapsed/step budgets bắt buộc và cancel-aware.
3. **S042.3** — Không dùng free wire cycles hoặc recursion thay loop semantics.

Tình huống phải kiểm tra:

- Nested loop break/continue trả đúng frame.
- Infinite loop/budget overflow dừng có reason và không dispatch thêm input.

**Nghiệm thu:** Loop body có scope/giới hạn; không cho arbitrary wire cycle hoặc runaway execution.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S042/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S043 — Validate toàn bộ dependency closure

Trạng thái: PLANNED · Test nghiệm thu: `AT-043`.

Tiền đề triển khai: S008, S010, S041, S042.

Đầu ra dự kiến: `packages/workflow-engine/src/validation/dependencies.ts`.

1. **S043.1** — Resolve local graphs và immutable version dependency closure.
2. **S043.2** — Check missing refs/hash/version, recursion và typed input/output mappings.
3. **S043.3** — Validate mọi graph liên quan, canonical hash bao toàn closure.

Tình huống phải kiểm tra:

- Subflow với custom schema compile/export/reimport cùng semantics.
- REG-05: child invalid, recursive hoặc mapping sai kiểu bị reject.

**Nghiệm thu:** Mọi subgraph được check; recursive call/type mismatch và thiếu dependency bị chặn.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S043/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S044 — DSL và template mapping an toàn

Trạng thái: PLANNED · Test nghiệm thu: `AT-044`.

Tiền đề triển khai: S010, S040.

Đầu ra dự kiến: `packages/workflow-engine/src/dsl/`, `packages/workflow-engine/src/templates/`.

1. **S044.1** — Parse expression thành AST whitelist và helpers được đăng ký.
2. **S044.2** — Typed field paths/templates không eval, shell hoặc arbitrary property traversal.
3. **S044.3** — Missing/optional/list index/bounds rõ; redact sensitive bindings trong trace.

Tình huống phải kiểm tra:

- Condition và templates Unicode cho 0/false/list đúng kiểu.
- Unknown helper/reserved path hoặc code injection bị reject, không eval.

**Nghiệm thu:** Không eval/Function/shell; whitelist expression/field paths và typed conversion.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S044/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S045 — Compile IR và kiểm tra side effects

Trạng thái: PLANNED · Test nghiệm thu: `AT-045`.

Tiền đề triển khai: S041, S042, S043, S044, S012.

Đầu ra dự kiến: `packages/workflow-engine/src/compiler/`, `packages/workflow-engine/src/ir/`.

1. **S045.1** — Compile validated graph/typed bindings thành immutable IR có source map.
2. **S045.2** — Check effect intent dominance, verification/review routes và cleanup eligibility.
3. **S045.3** — Tách structural validation, manual DEVICE_TEST và automatic eligibility.

Tình huống phải kiểm tra:

- Intent→effect→verify graph tạo IR có graph/node source refs.
- REG-06: irreversible effect không journal hoặc cleanup trước verify bị chặn.

**Nghiệm thu:** Transaction intent thống trị effect; không dựa node name để chứng nhận hành vi.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S045/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S046 — Interpreter và call stack

Trạng thái: PLANNED · Test nghiệm thu: `AT-046`.

Tiền đề triển khai: S045.

Đầu ra dự kiến: `packages/workflow-engine/src/runtime/interpreter.ts`, `packages/workflow-engine/src/runtime/frames.ts`.

1. **S046.1** — Interpreter call stack/frames/locals/return và loop cursors có deterministic semantics.
2. **S046.2** — Dispatch handler interface hẹp với AbortSignal, attempt/operation IDs.
3. **S046.3** — Lưu checkpoints cần thiết qua injected persistence; fixture adapters chỉ trong tests.

Tình huống phải kiểm tra:

- Main→subflow→loop→return giữ outputs và cursor đúng.
- Missing handler, abort hoặc runtime type error không coi là next/success.

**Nghiệm thu:** RunFrame/local scope/return/output mapping; test adapters chỉ ở fixtures.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S046/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S047 — Pause/breakpoint/step/into/out/stop

Trạng thái: PLANNED · Test nghiệm thu: `AT-047`.

Tiền đề triển khai: S046.

Đầu ra dự kiến: `packages/workflow-engine/src/debug/`, `apps/desktop/src/main/debug-sessions.ts`.

1. **S047.1** — Pause/continue/step-over/into/out và stop theo semantic boundary.
2. **S047.2** — Breakpoint resume token bỏ qua điểm vừa resume đúng một lần.
3. **S047.3** — Debug sessions tách TRACE/DEVICE_TEST; step không vượt pending effect recovery.

Tình huống phải kiểm tra:

- REG-07: continue qua breakpoint, nested step-out về caller.
- Stop giữa pending external effect lưu uncertainty, không đánh failed retryable.

**Nghiệm thu:** Continue vượt breakpoint một lần; cancellation tại safe point, không skip pending recovery.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S047/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S048 — 40 handler contracts và adapter boundaries

Trạng thái: PLANNED · Test nghiệm thu: `AT-048`.

Tiền đề triển khai: S009, S013, S045.

Đầu ra dự kiến: `packages/workflow-engine/src/handlers/`, `packages/device-runtime/src/ports/`, `packages/app-adapters/src/contracts.ts`.

1. **S048.1** — Khai báo và test contracts đủ 40 node types; pure handlers có logic thực.
2. **S048.2** — Map device/recognition/media/transaction nodes tới provider interfaces, capability gates.
3. **S048.3** — Định nghĩa tap/hold/drag/swipe/scroll/pinch, OCR/image/read và timeout/retry semantics riêng.

Tình huống phải kiểm tra:

- Registry/library/compiler/handler declarations khớp chính xác 40 types.
- Provider chưa có capability trả unsupported; không timer/random success.

**Nghiệm thu:** Mỗi node có real handler hoặc explicit unavailable; typed errors/timeouts.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S048/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S049 — Trace-only diagnostics và capability gates

Trạng thái: PLANNED · Test nghiệm thu: `AT-049`.

Tiền đề triển khai: S038, S047, S048.

Đầu ra dự kiến: `packages/workflow-engine/src/trace/`, `apps/desktop/src/renderer/inspector/results/`.

1. **S049.1** — TRACE dùng explicit fixture scenario; log/source map/issues click tới node hoặc row.
2. **S049.2** — DEVICE_TEST lấy device/profile/bindings qua gate, không tự certify production.
3. **S049.3** — Trace logs/vars/debug UI hiển thị mode, missing providers và validation results.

Tình huống phải kiểm tra:

- Trace nested flows/branches không gọi thiết bị hoặc tạo post ID.
- TRACE completion không tăng real post counters hoặc ready status.

**Nghiệm thu:** Dry-run không tạo POSTED/SUCCESS thật; real run phải preflight/certify.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S049/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

## P06 — Process, input và media

Gate toàn phase: P02, P03, P05.

### S050 — Process CRUD và clone

Trạng thái: PLANNED · Test nghiệm thu: `AT-050`.

Tiền đề triển khai: S011, S016, S017, S024.

Đầu ra dự kiến: `packages/processes/src/service.ts`, `apps/desktop/src/renderer/processes/`.

1. **S050.1** — CRUD/archive/clone Process với bindings và expectedRevision.
2. **S050.2** — Clone ContentItems ID mới, preserve asset refs, clear jobs/device/credentials theo preview.
3. **S050.3** — Chọn máy/Process qua context service; library/test-device không mutate bindings.

Tình huống phải kiểm tra:

- REG-01/10: nhiều Process cùng điện thoại giữ dữ liệu/lịch riêng qua restart.
- Clone không copy lịch đã đăng, account credentials hoặc job IDs.

**Nghiệm thu:** ID riêng; clone có preview; giữ hoặc clear bindings có chủ đích.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S050/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S051 — Dynamic fields và input mapping

Trạng thái: PLANNED · Test nghiệm thu: `AT-051`.

Tiền đề triển khai: S010, S037, S050.

Đầu ra dự kiến: `packages/processes/src/mapping.ts`, `apps/desktop/src/renderer/processes/fields/`.

1. **S051.1** — Render 9 typed field editors từ workflow version, outputs read-only.
2. **S051.2** — Map row/process/input/output có validation và migration preview.
3. **S051.3** — Account/target labels theo app capabilities; optional affiliate không tự thêm comment.

Tình huống phải kiểm tra:

- REG-21: list/file[] order, 0/false/empty giữ qua save/reload.
- Đổi app/workflow không âm thầm bỏ fields hoặc bịa account/target.

**Nghiệm thu:** Row/process/output với 9 types; file[] ordered, list thật; không ép mọi thứ thành string.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S051/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S052 — Chọn nguồn thư mục/tệp và multi-asset

Trạng thái: PLANNED · Test nghiệm thu: `AT-052`.

Tiền đề triển khai: S013, S018, S050.

Đầu ra dự kiến: `packages/media/src/source-registration.ts`, `apps/desktop/src/main/file-dialogs.ts`.

1. **S052.1** — Host dialogs đăng ký folder/files; renderer chỉ nhận permission-bound source refs.
2. **S052.2** — Hỗ trợ text-only/single/multi-asset, reorder và manual ContentItems.
3. **S052.3** — Rebind import từ HTML vì metadata/browser path chưa phải quyền đọc file thật.

Tình huống phải kiểm tra:

- File dialog cancel không tạo item rác; multi-asset giữ thứ tự.
- Path từ JSON/import chưa đăng ký không được read/copy/delete.

**Nghiệm thu:** Desktop dùng file dialog scoped; browser metadata không bị coi là filesystem access.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S052/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S053 — Watcher/reconcile và subfolders

Trạng thái: PLANNED · Test nghiệm thu: `AT-053`.

Tiền đề triển khai: S017, S018, S052.

Đầu ra dự kiến: `packages/media/src/watcher.ts`, `packages/media/src/reconcile.ts`.

1. **S053.1** — Watcher/subfolders debounce add/change/unlink, chờ file ổn định.
2. **S053.2** — Reconcile mặc định 10 giây, không overlap, generation-bound với source revision.
3. **S053.3** — Ignore/source policies giữ qua restart; missing source giữ lịch sử.

Tình huống phải kiểm tra:

- Đổi Process lúc scan vẫn ghi về source đúng ID.
- File đang copy/rename và callbacks cũ không tạo duplicate hoặc gán sai máy.

**Nghiệm thu:** Không overlap; events gắn process/generation; ignore và auto-append đúng scope.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S053/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S054 — Fingerprint và validation nguồn

Trạng thái: PLANNED · Test nghiệm thu: `AT-054`.

Tiền đề triển khai: S012, S018, S052.

Đầu ra dự kiến: `packages/media/src/fingerprint.ts`, `packages/media/src/preflight.ts`.

1. **S054.1** — Hash/probe qua bounded workers, record size/mtime/hash và asset kind.
2. **S054.2** — Strong fingerprint lúc freeze/preflight; text normalize và ordered asset hash cho dedupe.
3. **S054.3** — MEDIA_CHANGED/MISSING rõ, không sửa snapshot job cũ.

Tình huống phải kiểm tra:

- Asset reuse hợp lệ và file đổi sau schedule bị phát hiện.
- Filename trùng không chứng minh cùng asset; hash job không tự cập nhật.

**Nghiệm thu:** Source đổi/mất/copy dở/corrupt có trạng thái; job không âm thầm đổi content.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S054/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S055 — Thumbnail/probe queue

Trạng thái: PLANNED · Test nghiệm thu: `AT-055`.

Tiền đề triển khai: S018, S052.

Đầu ra dự kiến: `packages/media/src/probe.ts`, `packages/media/src/thumbnails.ts`.

1. **S055.1** — Probe duration/dimensions/type và thumbnail queue cancel-aware.
2. **S055.2** — Validate executable allowlist/argument arrays, pin ffprobe/ffmpeg distribution nếu dùng.
3. **S055.3** — Cache bounded/rebuildable, không block renderer/main hoặc decode lại cả folder.

Tình huống phải kiểm tra:

- Large media set vẫn responsive, cancel/retry theo item.
- Corrupt/unsupported media báo lỗi; không fake duration=0 hoặc dùng shell path interpolation.

**Nghiệm thu:** Bounded CPU/I/O, actual media metadata; cache evict không xóa source.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S055/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S056 — Virtualized table, search và inline edits

Trạng thái: PLANNED · Test nghiệm thu: `AT-056`.

Tiền đề triển khai: S018, S050, S051, S055.

Đầu ra dự kiến: `apps/desktop/src/renderer/processes/content-table/`.

1. **S056.1** — Virtualized query/search/status/filter và inline typed edits bằng stable ContentItem ID.
2. **S056.2** — Select visible/query scope rõ; right-click row, copy caption/path, duplicate ID mới.
3. **S056.3** — Ẩn/hiện cột theo schema/workflow, show dirty/save/errors và job refs.

Tình huống phải kiểm tra:

- Sort/filter/reorder không làm edit nhầm row; duplicate reset lịch.
- Header select-all không âm thầm chỉ sửa trang đầu hoặc trộn Process khác.

**Nghiệm thu:** Query/store thật; selection theo ID không theo row index.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S056/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S057 — Bulk edit và import preview

Trạng thái: PLANNED · Test nghiệm thu: `AT-057`.

Tiền đề triển khai: S051, S056.

Đầu ra dự kiến: `packages/media/src/bulk-edit.ts`, `packages/import-export/src/content-preview.ts`.

1. **S057.1** — Bulk unchanged/set/append/prepend/clear có typed validation và selected scope.
2. **S057.2** — Preview matching authoritative ID→registered relative path→unique filename khi không có ID.
3. **S057.3** — Báo unmatched/ambiguous/duplicates và immutable job impacts trước apply.

Tình huống phải kiểm tra:

- REG-12: explicit ID sai không fallback filename.
- Stale revision/duplicate input không update hàng loạt một phần.

**Nghiệm thu:** Set/append/prepend/clear; explicit ID mismatch không fallback sửa nhầm.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S057/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S058 — CSV/JSON/XLSX import/export

Trạng thái: PLANNED · Test nghiệm thu: `AT-058`.

Tiền đề triển khai: S021, S051, S057.

Đầu ra dự kiến: `packages/import-export/src/csv.ts`, `packages/import-export/src/json.ts`, `packages/import-export/src/xlsx.ts`.

1. **S058.1** — Chọn maintained parsers qua licensing/spike; hỗ trợ BOM/quotes/newlines/typed fields.
2. **S058.2** — JSON canonical giữ raw typed data; CSV/XLSX có conversion preview và formula policy.
3. **S058.3** — Export giữ custom schema/order; import schema và file refs cần rebind.

Tình huống phải kiểm tra:

- Multiline comments, Vietnamese, 0/false/list/file[] round-trip đúng policy.
- Formula-leading cells/zip bomb/ambiguous conversions không execute hoặc silently coerce.

**Nghiệm thu:** Round-trip typed/custom fields; duplicate/ambiguous report; formula protection.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S058/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S059 — Remove/ignore/archive và retention

Trạng thái: PLANNED · Test nghiệm thu: `AT-059`.

Tiền đề triển khai: S018, S050, S053, S056.

Đầu ra dự kiến: `packages/media/src/ignore.ts`, `packages/processes/src/archive.ts`.

1. **S059.1** — Remove row bỏ binding/ignore, archive Process giữ history.
2. **S059.2** — Source ignore scoped path/fingerprint để watcher không thêm lại ngay.
3. **S059.3** — Retention/reference accounting cho cache/artifacts, không delete user media.

Tình huống phải kiểm tra:

- Remove/reconcile/restart không làm item ignored tự xuất hiện lại.
- Queued/pending effects không mất evidence; source files vẫn còn.

**Nghiệm thu:** Không xóa file PC; pending jobs cần xử lý rõ; posted history giữ nguyên.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S059/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

## P07 — Scheduler, queue và timeline

Gate toàn phase: P02, P05, P06.

### S060 — UTC/timezone, date, slots và weekdays

Trạng thái: PLANNED · Test nghiệm thu: `AT-060`.

Tiền đề triển khai: S011, S017, S050.

Đầu ra dự kiến: `packages/scheduler/src/calendar.ts`, `packages/scheduler/src/timezone.ts`.

1. **S060.1** — UTC storage và IANA timezone per Process; local date/slots/weekdays validated.
2. **S060.2** — Default 08/12/19, 24 slot pagination không phải giới hạn nghiệp vụ.
3. **S060.3** — DST ambiguous/nonexistent time có explicit reject/resolve preview policy.

Tình huống phải kiểm tra:

- Asia/Ho_Chi_Minh và timezone có DST tạo instants đúng ngày.
- Invalid date/time/empty weekdays hoặc local-midnight ISO shift bị reject.

**Nghiệm thu:** DD/MM display; local date round-trip; invalid date/time bị reject.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S060/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S061 — Policy quá hạn và randomization

Trạng thái: PLANNED · Test nghiệm thu: `AT-061`.

Tiền đề triển khai: S060.

Đầu ra dự kiến: `packages/scheduler/src/policies.ts`, `packages/scheduler/src/randomization.ts`.

1. **S061.1** — NEXT_FUTURE_SLOT/CATCH_UP/SKIP khác normal busy queue delay.
2. **S061.2** — Jitter/spread có seed/offsets persist; queue/catch-up bounded resource.
3. **S061.3** — Uncertain in-flight effect luôn recovery trước overdue.

Tình huống phải kiểm tra:

- Overdue ba policies cho cùng snapshot có kết quả xác định.
- Không policy nào tự đăng lại pending/posted transaction hoặc rerandomize lúc apply.

**Nghiệm thu:** Lưu theo process; seed kết quả preview; không random lại khi retry/apply.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S061/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S062 — Preview/apply idempotent

Trạng thái: PLANNED · Test nghiệm thu: `AT-062`.

Tiền đề triển khai: S019, S057, S060, S061.

Đầu ra dự kiến: `packages/scheduler/src/preview.ts`, `packages/scheduler/src/apply.ts`.

1. **S062.1** — Preview pin Process/content/job revisions, selected scope, offsets/instants/expiry/hash.
2. **S062.2** — Apply token với transaction/idempotency và occurrence uniqueness.
3. **S062.3** — Auto-append chỉ content mới; pending clear và stale preview có reason.

Tình huống phải kiểm tra:

- REG-13/14: apply hai lần tạo một occurrence, scope không đổi.
- Revision/selection đổi hoặc preview hết hạn bị reject toàn bộ.

**Nghiệm thu:** Batch revision token; apply lặp không tạo occurrence trùng.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S062/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S063 — Snapshot workflow/content/target/network

Trạng thái: PLANNED · Test nghiệm thu: `AT-063`.

Tiền đề triển khai: S008, S012, S019, S054, S062.

Đầu ra dự kiến: `packages/scheduler/src/snapshot.ts`, `packages/domain/src/dedupe.ts`.

1. **S063.1** — Freeze workflow closure/schema/content/ordered assets/identity/network/options cùng hashes.
2. **S063.2** — Credentials chỉ secret refs; job pin version không đọc draft lúc chạy.
3. **S063.3** — Dedupe app/target/content; deliberate repost tạo explicit occurrence mới.

Tình huống phải kiểm tra:

- REG-15: sửa draft/row/Process sau schedule không đổi job snapshot.
- Payload hash mismatch hoặc same-target verified duplicate bị chặn; uncertainty không tạo retry job.

**Nghiệm thu:** Pin immutable version/dependency hashes; sửa draft không đổi scheduled jobs.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S063/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S064 — Due queue, priority và device leases

Trạng thái: PLANNED · Test nghiệm thu: `AT-064`.

Tiền đề triển khai: S019, S062, S063.

Đầu ra dự kiến: `packages/scheduler/src/queue.ts`, `packages/scheduler/src/claim.ts`.

1. **S064.1** — Due order scheduledUtc/priority/createdAt với fairness xác định.
2. **S064.2** — Transactional per-device claim/lease interface; offline/manual ownership states.
3. **S064.3** — Cloud tests dùng fake clock/test worker riêng; actual device worker bind S074.

Tình huống phải kiểm tra:

- Hai Process cùng máy chạy tuần tự; hai máy độc lập.
- REG-16: duplicate scheduler/expired generation không dispatch hai jobs cùng máy.

**Nghiệm thu:** Một device/một job; fairness/cancel; unassigned process không chạy thật.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S064/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S065 — Timeline toàn workspace

Trạng thái: PLANNED · Test nghiệm thu: `AT-065`.

Tiền đề triển khai: S060, S062.

Đầu ra dự kiến: `apps/desktop/src/renderer/schedule/`, `packages/scheduler/src/timeline-query.ts`.

1. **S065.1** — Timeline workspace-wide filters app/Process/device/date range.
2. **S065.2** — Day/week/month/range views từ persisted jobs, không từ rows đang mở.
3. **S065.3** — Hiện timezone, waiting/uncertain/posted states và jump tới Process/job.

Tình huống phải kiểm tra:

- Đổi Process tab không làm mất jobs máy khác khỏi timeline query.
- Filter/count không trộn TRACE/demo hoặc dùng tên làm key.

**Nghiệm thu:** Range/app/process/device filters; các context được truy vấn từ DB.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S065/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S066 — Drag/reschedule/clear pending

Trạng thái: PLANNED · Test nghiệm thu: `AT-066`.

Tiền đề triển khai: S019, S063, S065.

Đầu ra dự kiến: `packages/scheduler/src/reschedule.ts`, `apps/desktop/src/renderer/schedule/interactions.ts`.

1. **S066.1** — Drag/reschedule/clear pending bằng expectedRevision và scoped preview.
2. **S066.2** — Giữ job ID/snapshot; chỉ đổi not-started safe jobs.
3. **S066.3** — Block posted/running/pending-effect changes; show per-item conflicts.

Tình huống phải kiểm tra:

- Edit schedule giữ content hash và history refs.
- Pending/posted drag không sửa job/device/target; stale revision bị reject.

**Nghiệm thu:** Cùng job ID và revision; không sửa pending external transaction.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S066/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S067 — Conflict và spread

Trạng thái: PLANNED · Test nghiệm thu: `AT-067`.

Tiền đề triển khai: S061, S062, S065, S066.

Đầu ra dự kiến: `packages/scheduler/src/conflicts.ts`, `packages/scheduler/src/spread.ts`.

1. **S067.1** — Detect same-device/same-instant conflicts; duration intervals nếu có dùng measured estimate.
2. **S067.2** — Spread 60–120 phút chỉ explicit operation, seed/scope/cross-day preview.
3. **S067.3** — Apply dùng chính proposal đã xem; queue vẫn enforce exclusion.

Tình huống phải kiểm tra:

- Spread selected jobs không sửa phần ngoài scope.
- Không lấy width/title card làm duration hoặc auto đẩy lịch ngoài ngày mà không báo.

**Nghiệm thu:** Phân biệt timestamp/reserved interval; preview scope và crossing-day policy.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S067/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S068 — Restart/sleep/resume recovery

Trạng thái: PLANNED · Test nghiệm thu: `AT-068`.

Tiền đề triển khai: S019, S061, S064.

Đầu ra dự kiến: `packages/scheduler/src/recovery.ts`, `tests/integration/scheduler-restart/`.

1. **S068.1** — Persist/reload queue và reconcile after clock gap/restart.
2. **S068.2** — Sleep/resume requery overdue, devices và job preflight; không replay pending input.
3. **S068.3** — Bind host power events S117, deterministic recovery tests trước hardware.

Tình huống phải kiểm tra:

- Kill/restart trước claim và sau persisted snapshot không duplicate jobs.
- Clock jump/reconnect không coi effect pending là job chưa bắt đầu.

**Nghiệm thu:** Due jobs theo policy; uncertainty verify trước retry; ledger giữ bền.

**Môi trường:** `CLOUD_LOGIC_UI_THEN_WINDOWS_SMOKE`. Phone cần cho nghiệm thu: Chưa cần; host behavior vẫn phải kiểm theo target.

**Evidence:** `docs/evidence/implementation/S068/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

## P08 — ADB registry và worker

Gate toàn phase: P01, P02, P03.

### S069 — Platform-Tools discovery/verification

Trạng thái: PLANNED · Test nghiệm thu: `AT-069`.

Tiền đề triển khai: S005, S013, S022.

Đầu ra dự kiến: `packages/device-runtime/src/adb/discovery.ts`, `packages/device-runtime/src/adb/runner.ts`.

1. **S069.1** — Discover configured/installed verified Platform-Tools; pin artifact checksum/license.
2. **S069.2** — Exec allowlist + argument arrays, owned process/forward accounting.
3. **S069.3** — Hiện ADB missing/version mismatch và guidance trên Windows.

Tình huống phải kiểm tra:

- Verified ADB version được dùng từ resolved executable.
- Không kill shared server hoặc chạy executable/path do renderer tự cung cấp.

**Nghiệm thu:** Version/hash/source có evidence; không overwrite toolchain khác.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S069/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S070 — USB và authorization

Trạng thái: PLANNED · Test nghiệm thu: `AT-070`.

Tiền đề triển khai: S069.

Đầu ra dự kiến: `packages/device-runtime/src/transports/usb.ts`.

1. **S070.1** — Parse devices -l với authorized/unauthorized/offline states.
2. **S070.2** — Cập nhật registry từ events/poll có cancellation/backoff.
3. **S070.3** — Hướng dẫn USB debugging/OEM driver/RSA trust, không giả auto-authorize.

Tình huống phải kiểm tra:

- USB connect/authorize/disconnect trên máy thật có serial/state đúng.
- Unauthorized/offline không được gọi là online hoặc gửi control input.

**Nghiệm thu:** Authorized/unauthorized/offline phân biệt; không tạo serial mẫu.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S070/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S071 — LAN pairing/connect

Trạng thái: PLANNED · Test nghiệm thu: `AT-071`.

Tiền đề triển khai: S069, S070.

Đầu ra dự kiến: `packages/device-runtime/src/transports/lan.ts`.

1. **S071.1** — Hỗ trợ Android wireless pairing/connect và legacy TCP capability riêng.
2. **S071.2** — Validate host/port, timeout/cancel và remember endpoint qua preference.
3. **S071.3** — Pair code nhạy cảm không vào logs; mạng LAN người dùng chạy tại host Windows.

Tình huống phải kiểm tra:

- Pair/connect/reconnect trong LAN thực, wrong code có actionable error.
- Cloud không tự được coi thấy LAN/USB nhà người dùng; mất mạng không tạo device giả.

**Nghiệm thu:** Android pairing/code route phù hợp; endpoint validated, không mở dịch vụ công khai.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S071/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S072 — Device identity và transport reconciliation

Trạng thái: PLANNED · Test nghiệm thu: `AT-072`.

Tiền đề triển khai: S011, S017, S070, S071.

Đầu ra dự kiến: `packages/device-runtime/src/registry/identity.ts`.

1. **S072.1** — Stable device identity từ evidence phù hợp, không chỉ transport serial/hostname.
2. **S072.2** — Reconcile USB/LAN của cùng máy; conflicts có resolution rõ.
3. **S072.3** — Persist names/enabled/profile, giữ historical refs khi reconnect/archive.

Tình huống phải kiểm tra:

- Một phone qua USB rồi LAN không tạo hai queues độc lập.
- Hai máy cùng model/name không bị merge; identity mơ hồ báo chưa xác nhận.

**Nghiệm thu:** USB/LAN không duplicate sai; không gộp thiết bị chỉ vì cùng model/IP.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S072/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S073 — Heartbeat/reconnect và registry events

Trạng thái: PLANNED · Test nghiệm thu: `AT-073`.

Tiền đề triển khai: S013, S072.

Đầu ra dự kiến: `packages/device-runtime/src/registry/heartbeat.ts`, `packages/device-runtime/src/registry/events.ts`.

1. **S073.1** — Heartbeat/reconnect exponential bounds và cancellation theo session generation.
2. **S073.2** — Events sequence, stale session rejection và snapshot requery.
3. **S073.3** — Disconnect báo worker/stream/job gates, không âm thầm đổi state thành success.

Tình huống phải kiểm tra:

- Reconnect đưa capability về observed profile và preflight lại.
- Out-of-order heartbeat không resurrect connection cũ hoặc stale lease.

**Nghiệm thu:** Lỗi riêng máy; bounded backoff/cancellation.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S073/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S074 — DeviceWorker ownership

Trạng thái: PLANNED · Test nghiệm thu: `AT-074`.

Tiền đề triển khai: S019, S073.

Đầu ra dự kiến: `packages/device-runtime/src/workers/`, `packages/device-runtime/src/leases/`.

1. **S074.1** — Actor một owner/device; automation/manual/Inspector/APK/network dùng chung lease.
2. **S074.2** — Fencing generation kiểm ngay trước dispatch input; pause safe point/redetect khi release.
3. **S074.3** — Cancellation/timeout/uncertainty giữ durable ownership/recovery semantics.

Tình huống phải kiểm tra:

- REG-16: manual và job contention chỉ một được gửi input.
- Stale token/second window/reconnect không bypass ownership; chưa rõ effect pause máy đó.

**Nghiệm thu:** Automation/manual/inspector/app/network mutation chung lease/fencing.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S074/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S075 — Enabled/bulk actions và sidebar/grid

Trạng thái: PLANNED · Test nghiệm thu: `AT-075`.

Tiền đề triển khai: S025, S026, S072, S074.

Đầu ra dự kiến: `apps/desktop/src/renderer/devices/`, `packages/device-runtime/src/batch.ts`.

1. **S075.1** — Grid/search/tile-size/active card/selected group và persisted enabled.
2. **S075.2** — Bulk scoped enable/disable/reconnect/manual/app operation progress.
3. **S075.3** — Per-device results/cancel/partial failure; no hard business device limit.

Tình huống phải kiểm tra:

- Search/selection và enable không đổi connection state.
- Một máy fail không báo cả nhóm success; cancel giữ kết quả đã hoàn tất.

**Nghiệm thu:** Persist thật; per-device ACK, selected set khác active device.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S075/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S076 — Thông tin/app discovery và quick actions

Trạng thái: PLANNED · Test nghiệm thu: `AT-076`.

Tiền đề triển khai: S007, S069, S074, S075.

Đầu ra dự kiến: `packages/device-runtime/src/apps/`, `packages/device-runtime/src/quick-actions/`.

1. **S076.1** — Read metadata/packages/version/locale/foreground app qua allowlisted commands.
2. **S076.2** — Quick actions Back/Home/Recent/open managed app/Gallery/Files/Settings/Browser/VPN/screenshot/reconnect.
3. **S076.3** — Force-stop đúng managed package/scope; capability block reason rõ.

Tình huống phải kiểm tra:

- App discovery thật thêm được custom package profile.
- Wrong/busy/offline device hoặc package lạ không bị thao tác qua global current-device state.

**Nghiệm thu:** Metadata/packages thật; capability unsupported hiển thị rõ.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S076/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

## P09 — Stream, UI Inspector và manual control

Gate toàn phase: P08, P04.

### S077 — ADB coexistence design spike

Trạng thái: PLANNED · Test nghiệm thu: `AT-077`.

Tiền đề triển khai: S069, S073.

Đầu ra dự kiến: `tools/spikes/adb-coexistence/`, `docs/evidence/risk-gate/`.

1. **S077.1** — Kiểm fleet software/ADB version và ownership server/forwards/sockets.
2. **S077.2** — Prototype isolated client/session không kill shared server.
3. **S077.3** — Ghi model coexistence và failure/cleanup contract trước stream implementation.

Tình huống phải kiểm tra:

- Dùng cùng ADB với phần mềm khác không phá phiên hiện hữu.
- Restart/disconnect chỉ thu tài nguyên AutoReels sở hữu.

**Nghiệm thu:** Shared/dedicated/exclusive strategy được kiểm tra, không kill server khác mù.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S077/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S078 — Pin scrcpy server/client/protocol

Trạng thái: PLANNED · Test nghiệm thu: `AT-078`.

Tiền đề triển khai: S077.

Đầu ra dự kiến: `packages/device-runtime/src/streams/protocol.ts`, `vendor/manifest.json`.

1. **S078.1** — Pin scrcpy server/client/protocol cùng metadata/hash/license.
2. **S078.2** — Handshake device/server capabilities và version mismatch handling.
3. **S078.3** — Định nghĩa session lifecycle, owned launch/cleanup và reconnect policy.

Tình huống phải kiểm tra:

- Version/protocol đúng tạo stream session thật.
- Mismatch/corrupt artifact từ chối khởi chạy, không tự lấy latest không kiểm.

**Nghiệm thu:** Compatibility set và checksum binaries được ghi build metadata.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S078/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S079 — Video decoder và IPC transport

Trạng thái: PLANNED · Test nghiệm thu: `AT-079`.

Tiền đề triển khai: S078, S022.

Đầu ra dự kiến: `packages/device-runtime/src/streams/`, `apps/desktop/src/renderer/phone/decoder/`.

1. **S079.1** — Spike WebCodecs/embedded transport dưới Electron; chọn decoder theo measured support.
2. **S079.2** — Bounded binary frame channel không JSON/base64 từng frame; backpressure và visibility.
3. **S079.3** — Map orientation/resolution/insets; control channel qua worker không bypass lease.

Tình huống phải kiểm tra:

- Video và control thực trên Windows/Android, đo frame latency/drop/CPU/RAM.
- Decoder unsupported hoặc backlog thì degrade/disable rõ, không phát frames mẫu.

**Nghiệm thu:** H.264/WebCodecs capability; buffers/backpressure, không JSON/base64 frame flood.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S079/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S080 — Preview resource profiles

Trạng thái: PLANNED · Test nghiệm thu: `AT-080`.

Tiền đề triển khai: S075, S079.

Đầu ra dự kiến: `packages/device-runtime/src/streams/profiles.ts`, `apps/desktop/src/renderer/devices/previews/`.

1. **S080.1** — Profiles idle/grid/focused với demand-driven subscriptions.
2. **S080.2** — Một encoder/session dùng chung consumers; limit decode/resource budget theo đo.
3. **S080.3** — Pause hidden previews, bounded buffer/drop policy và diagnostics.

Tình huống phải kiểm tra:

- Mở/đóng nhiều cards không tạo encoder trùng cho mỗi view.
- CPU/RAM queue overload không làm main/UI treo hoặc truncate devices.

**Nghiệm thu:** Visible/offscreen/focus streams điều chỉnh tài nguyên thực.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S080/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S081 — Máy test độc lập process bindings

Trạng thái: PLANNED · Test nghiệm thu: `AT-081`.

Tiền đề triển khai: S024, S074, S079.

Đầu ra dự kiến: `apps/desktop/src/renderer/inspector/test-device/`.

1. **S081.1** — Test device selector/subscription riêng Process bindings và editor app.
2. **S081.2** — Pick chỉ đọc snapshot; Control cần manual lease; chuyển mode rõ.
3. **S081.3** — DEVICE_TEST kiểm profile/input trước dispatch; release/redetect khi đổi device.

Tình huống phải kiểm tra:

- REG-01/02: đổi test phone không đổi workflow/Process.
- Pick không gửi tap; stale frame/device generation không gửi input.

**Nghiệm thu:** Đổi test device không đổi target/process/workflow draft.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S081/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S082 — UI XML/frame snapshot thực

Trạng thái: PLANNED · Test nghiệm thu: `AT-082`.

Tiền đề triển khai: S073, S074, S079.

Đầu ra dự kiến: `packages/ui-inspector/src/snapshots.ts`, `packages/ui-inspector/src/xml.ts`.

1. **S082.1** — Capture frame/XML có snapshot ID, dimensions/rotation/insets/time/profile/generation.
2. **S082.2** — XML parser có budgets, sanitize và giữ raw evidence reference locally.
3. **S082.3** — Tree search/filter/freeze/refresh; độ lệch frame/XML đo và hiển thị stale.

Tình huống phải kiểm tra:

- Click tree highlight đúng bounds của cùng snapshot/orientation.
- Malformed XML/secure UI/missing nodes không tự tạo element hoặc match count giả.

**Nghiệm thu:** Versioned screenshot/XML/frame dimensions/orientation cùng correlation ID.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S082/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S083 — Pick selector và matching

Trạng thái: PLANNED · Test nghiệm thu: `AT-083`.

Tiền đề triển khai: S036, S048, S082.

Đầu ra dự kiến: `packages/ui-inspector/src/selectors/`, `packages/ui-inspector/src/recognition/`, `docs/evidence/recognition/`.

1. **S083.1** — Selector resource-id/accessibility/text/XPath/relative và ordered fallbacks, actual 0/1/n matches.
2. **S083.2** — Provider OCR/image/read riêng trong worker; spike maintained local OCR và image matcher về vi/en, false matches/latency/licenses.
3. **S083.3** — Gesture provider tap/doubletap/hold/drag/swipe/bounded scroll/pinch có capability checks; unsupported multi-touch không giả supported.

Tình huống phải kiểm tra:

- Test selector highlight/count, image/OCR confidence và bounded scroll trên fixture rồi phone thật.
- Stale snapshot/ambiguous match/unsupported OCR language hoặc pinch trả named error, không click bừa.

**Nghiệm thu:** Bounds đúng content rect; match count/confidence/version; stale snapshot bị chặn.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S083/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S084 — Dock/right/top/floating/popup và quick actions

Trạng thái: PLANNED · Test nghiệm thu: `AT-084`.

Tiền đề triển khai: S023, S025, S079, S081, S082, S083.

Đầu ra dự kiến: `apps/desktop/src/renderer/phone/layouts/`, `apps/desktop/src/main/phone-window.ts`.

1. **S084.1** — Dock right/top/floating/popup dùng cùng session; saved geometry clamp khi đổi monitor.
2. **S084.2** — Fit/zoom đồng bộ slider/label/transform; quick actions overflow giữ UI gọn.
3. **S084.3** — Popup bind sender/window/device/channel; đóng view release subscription/lease đúng scope.

Tình huống phải kiểm tra:

- REG-08/20: zoom Fit đồng bộ, popup command đúng target được authorize.
- Wrong origin/source/action/nonce bị reject; đóng popup không kill stream của view còn dùng.

**Nghiệm thu:** Compact overflow, saved layout, popup origin/channel, real control lease; fit/zoom đồng bộ.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S084/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S085 — Manual group/MASTER kế thừa V17

Trạng thái: PLANNED · Test nghiệm thu: `AT-085`.

Tiền đề triển khai: S074, S075, S083, S084.

Đầu ra dự kiến: `packages/device-runtime/src/manual-group/`, `apps/desktop/src/renderer/devices/manual-group/`.

1. **S085.1** — MASTER/group manual sync từ nguồn chọn rõ, per-device control leases.
2. **S085.2** — Map normalized gesture theo từng resolution/orientation/insets và supported capabilities.
3. **S085.3** — Progress/cancel/results từng máy; loại máy bận/unsupported có reason.

Tình huống phải kiểm tra:

- Hai phone khác resolution nhận gesture đúng vùng tương ứng.
- Không broadcast vào máy đang automation/pending uncertainty hoặc giả all-success khi partial fail.

**Nghiệm thu:** Normalized geometry/rotation; acquire từng máy; real outcomes và release/redetect.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S085/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

## P10 — Technical Risk Gate

Gate toàn phase: P08, P09, P05, P06.

### S086 — R1 embedded video/control

Trạng thái: PLANNED · Test nghiệm thu: `AT-086`.

Tiền đề triển khai: S079, S080, S081.

Đầu ra dự kiến: `tests/hardware/risk/video-control/`, `docs/evidence/risk-gate/R1/`.

1. **S086.1** — Chạy workload stream/control tối thiểu hai profiles thật với host metadata.
2. **S086.2** — Đo startup/latency/frame drop/CPU/RAM và reconnect bằng protocol cố định.
3. **S086.3** — Khóa budget dựa baseline trước scale; lưu PASS/FAIL/profile limitations.

Tình huống phải kiểm tra:

- Video/control/reconnect có evidence cùng build/host/device.
- Cloud screenshots không dùng làm PASS; profile fail không bị ghi supported.

**Nghiệm thu:** Ít nhất hai điện thoại thật: decode/input/reconnect/profile evidence.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S086/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S087 — R2 Unicode input

Trạng thái: PLANNED · Test nghiệm thu: `AT-087`.

Tiền đề triển khai: S076, S081, S083.

Đầu ra dự kiến: `tests/hardware/risk/unicode/`, `docs/evidence/risk-gate/R2/`.

1. **S087.1** — Thử tiếng Việt dấu, emoji, multiline và clipboard/input modes trong app đích.
2. **S087.2** — Chọn verified method; helper APK chỉ khi cần và có chủ đích, không root.
3. **S087.3** — Kiểm nội dung sau nhập, privacy và failure cleanup; ghi input capability theo profile.

Tình huống phải kiểm tra:

- Caption/comment đúng chuỗi trên hai profiles có evidence.
- Unsupported paste/IME không âm thầm chuyển adb input text làm mất Unicode.

**Nghiệm thu:** Tiếng Việt/emoji/URL/newline trên field thật khớp yêu cầu.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S087/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S088 — R3 media staging/picker

Trạng thái: PLANNED · Test nghiệm thu: `AT-088`.

Tiền đề triển khai: S052, S054, S076, S083.

Đầu ra dự kiến: `tests/hardware/risk/media-picker/`, `docs/evidence/risk-gate/R3/`.

1. **S088.1** — Spike job-owned staging ledger/path và MediaStore/index readiness.
2. **S088.2** — Chứng minh chọn exact single/multi asset giữa media trùng tên và cũ.
3. **S088.3** — Kiểm app picker behavior/Android permissions, cleanup chỉ owned.

Tình huống phải kiểm tra:

- File/hash/order chọn đúng và có selection evidence.
- Chưa index hoặc picker mơ hồ dừng; không chọn thumbnail đầu tiên.

**Nghiệm thu:** Hai Android/vendor profiles; portrait/landscape; exact-media evidence.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S088/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S089 — R4 account/target discovery

Trạng thái: PLANNED · Test nghiệm thu: `AT-089`.

Tiền đề triển khai: S076, S082, S083.

Đầu ra dự kiến: `tests/hardware/risk/identities/`, `docs/evidence/risk-gate/R4/`.

1. **S089.1** — Đọc login/session/account/target qua UI được phép với stable evidence.
2. **S089.2** — Thử target trùng tên, absent, switch và locale/profile variations.
3. **S089.3** — Phân biệt metric missing với zero; không đọc private token/DB.

Tình huống phải kiểm tra:

- Đúng account/target được verify sau switch trên profile thực.
- Tên giống/scan thiếu không chọn nhầm hoặc xóa history identity.

**Nghiệm thu:** So với manual inspection; trùng tên/scroll/cache đều có case.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S089/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S090 — R5 detection/version/locale

Trạng thái: PLANNED · Test nghiệm thu: `AT-090`.

Tiền đề triển khai: S007, S076, S082.

Đầu ra dự kiến: `tests/hardware/risk/profiles/`, `docs/evidence/risk-gate/R5/`.

1. **S090.1** — Collect package/versionCode/versionName/locale/Android/geometry profile.
2. **S090.2** — Resolve selector/adapters match hoặc named unsupported reason.
3. **S090.3** — Test foreground wrong app, update version, locale/rotation thay đổi.

Tình huống phải kiểm tra:

- Known exact profile chọn đúng adapter và stale certification bị invalidated.
- Unknown version không đoán selector hoặc coi seed catalog là certification.

**Nghiệm thu:** Unknown/updated app không đoán selectors; có fixture và device profile.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S090/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S091 — R6 publish verification feasibility

Trạng thái: PLANNED · Test nghiệm thu: `AT-091`.

Tiền đề triển khai: S019, S045, S083, S088, S089, S090.

Đầu ra dự kiến: `tests/hardware/risk/publish-signals/`, `docs/evidence/risk-gate/R6/`.

1. **S091.1** — Dùng controlled test target và minimal durable effect harness, không chờ toàn bộ P11.
2. **S091.2** — Ghi intent/uncertainty trước input; thử posted/pending/rejected/ambiguous signals.
3. **S091.3** — Chứng minh provider/identity/content/external ID hoặc fingerprint strategy; không có negative proof thì review.

Tình huống phải kiểm tra:

- Đăng thử có đối soát đúng bài/đích và log journal theo attempt.
- Không thấy bài tức thời/timeout không kết luận chưa đăng hoặc tự tap lần hai.

**Nghiệm thu:** Controlled test Page; signal posted/pending/ambiguous được chứng minh.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S091/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S092 — R7 device routing

Trạng thái: PLANNED · Test nghiệm thu: `AT-092`.

Tiền đề triển khai: S074, S076, S090.

Đầu ra dự kiến: `tests/hardware/risk/routing/`, `docs/evidence/risk-gate/R7/`.

1. **S092.1** — Spike HTTP/HTTPS/SOCKS/auth từng loại claimed-supported và non-root constraints.
2. **S092.2** — Phân biệt parse/PC check/device egress/app traffic verify.
3. **S092.3** — Chọn adapter/helper/rollback, unsupported rõ; routing có thể deferred nếu chưa ship.

Tình huống phải kiểm tra:

- Mỗi loại công bố có actual Android/app traffic evidence và rollback.
- PC proxy check PASS không biến thành device proxy PASS; không rotate để né block.

**Nghiệm thu:** Mỗi claimed-supported proxy type có Android/Facebook evidence; unsupported ghi riêng.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S092/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S093 — R8 ADB coexistence acceptance

Trạng thái: PLANNED · Test nghiệm thu: `AT-093`.

Tiền đề triển khai: S077, S078, S079, S085.

Đầu ra dự kiến: `tests/hardware/risk/adb-coexistence/`, `docs/evidence/risk-gate/R8/`.

1. **S093.1** — Chạy lại coexistence với stream/manual/group và fleet software thực.
2. **S093.2** — Thử cable loss/server version mismatch/second client và teardown.
3. **S093.3** — Ghi resources owned trước/sau, giới hạn hỗ trợ và cách phục hồi.

Tình huống phải kiểm tra:

- Tắt AutoReels chỉ dọn forwards/processes của mình.
- Không kill shared ADB server hoặc đánh PASS khi chưa thử software fleet thực.

**Nghiệm thu:** Chạy với software fleet thực; PASS/FAIL/DEFERRED ghi riêng.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S093/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

## P11 — Execution và transactions thực

Gate toàn phase: P02, P05, P07, P08, P09, P10.

### S094 — Preflight và eligibility

Trạng thái: PLANNED · Test nghiệm thu: `AT-094`.

Tiền đề triển khai: S063, S074, S086, S087, S088, S089, S090, S091.

Đầu ra dự kiến: `packages/execution/src/preflight.ts`, `packages/execution/src/eligibility.ts`.

1. **S094.1** — Check device lease/session/app/version/locale/identity/target/media/hash/network/workflow receipt.
2. **S094.2** — Resolve immutable job config và current observed profile, không draft/global current state.
3. **S094.3** — Return block reasons/review/ready; recheck sau manual/network/reconnect.

Tình huống phải kiểm tra:

- Valid exact-profile job preflight qua và mọi IDs được pin.
- File đổi/target missing/receipt stale hoặc wrong foreground dừng trước effect.

**Nghiệm thu:** Device/session/identity/file/app/version/locale/selector profile đều đúng.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S094/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S095 — Staging ownership và MediaStore

Trạng thái: PLANNED · Test nghiệm thu: `AT-095`.

Tiền đề triển khai: S019, S054, S074, S088.

Đầu ra dự kiến: `packages/staging/src/ledger.ts`, `packages/staging/src/media-store.ts`.

1. **S095.1** — Create owned job-unique staging plan với free-space/hash checks.
2. **S095.2** — Transfer/index/MediaStore refs bền và reconcile sau crash.
3. **S095.3** — Gắn ownership ledger với device/job/generation; permission unsupported rõ.

Tình huống phải kiểm tra:

- Transfer interrupted resume/reconcile không nhân bản staging hoặc chọn sai file.
- Path trỏ ngoài namespace/ledger không bao giờ cleanup.

**Nghiệm thu:** Ledger bền, job-unique paths, transfer/index readiness có xác minh.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S095/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S096 — Exact media và Unicode form fill

Trạng thái: PLANNED · Test nghiệm thu: `AT-096`.

Tiền đề triển khai: S087, S088, S094, S095.

Đầu ra dự kiến: `packages/execution/src/compose.ts`, `packages/execution/src/media-selection.ts`.

1. **S096.1** — Chọn exact ordered assets theo selection readiness evidence.
2. **S096.2** — Fill typed caption/comments/audience/fields bằng verified Unicode method.
3. **S096.3** — Verify target/content trước publish; app-specific compose qua provider interface.

Tình huống phải kiểm tra:

- Nhiều asset trùng tên vẫn chọn đúng hash/order và Unicode.
- Form chưa sẵn sàng/selection ambiguous dừng; không tự bấm publish để thử.

**Nghiệm thu:** Không lấy thumbnail đầu tiên; kiểm tra target/content trước Publish.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S096/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S097 — Intent journal trước side effect

Trạng thái: PLANNED · Test nghiệm thu: `AT-097`.

Tiền đề triển khai: S019, S045, S074, S094, S096.

Đầu ra dự kiến: `packages/execution/src/effects/journal.ts`, `packages/execution/src/effects/dispatch.ts`.

1. **S097.1** — DB commit intent/effect key/payload/attempt-uncertain trước external input.
2. **S097.2** — Dispatch qua exact lease rồi record ACK nếu có, không ACK khác confirmed.
3. **S097.3** — Uncertain state survives kill; duplicate calls dùng durable idempotency guard.

Tình huống phải kiểm tra:

- Kill trước/sau input để journal luôn phản ánh cửa sổ uncertainty.
- Không dispatch nếu intent commit fail hoặc device generation đổi.

**Nghiệm thu:** Durable attempt/uncertainty trước click; crash window không tự retry mù.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S097/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S098 — Xác minh bài đúng provider/identity

Trạng thái: PLANNED · Test nghiệm thu: `AT-098`.

Tiền đề triển khai: S089, S090, S091, S097.

Đầu ra dự kiến: `packages/execution/src/verification/`, `packages/review/src/cases.ts`.

1. **S098.1** — App verifier kiểm exact provider/identity/target/content/time/external reference.
2. **S098.2** — Lưu confidence/evidence và distinguish confirmed/rejected/ambiguous.
3. **S098.3** — Ambiguous mở review và pause device automation, không reuse timeout as failure.

Tình huống phải kiểm tra:

- Đúng bài verified có evidence và post ID/fingerprint hợp lệ.
- Bài cùng caption của identity khác hoặc time window lạ không confirm nhầm.

**Nghiệm thu:** External ID/fingerprint/time window; ambiguous thành NEEDS_REVIEW.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S098/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S099 — Fault injection/restart recovery

Trạng thái: PLANNED · Test nghiệm thu: `AT-099`.

Tiền đề triển khai: S097, S098.

Đầu ra dự kiến: `tests/integration/effect-recovery/`, `tests/hardware/fault-injection/`.

1. **S099.1** — Inject crash trước intent/dispatch/ACK/verify/DB confirmed và restart.
2. **S099.2** — Recovery query journal/reverify thay replay publish; reconcile ownership/snapshot.
3. **S099.3** — Test DB busy/full disk/transport drop trong cùng effect windows.

Tình huống phải kiểm tra:

- REG-17: mọi crash boundary giữ confirmed hoặc review phù hợp.
- Không có recovery branch gửi publish lần hai chỉ vì thiếu ACK.

**Nghiệm thu:** Kill trước/sau click/verify/DB commit; uncertainty không bị coi FAILED retryable.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S099/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S100 — Comment transaction/list

Trạng thái: PLANNED · Test nghiệm thu: `AT-100`.

Tiền đề triển khai: S010, S097, S098.

Đầu ra dự kiến: `packages/execution/src/comments/`, `packages/execution/src/effects/comment-keys.ts`.

1. **S100.1** — Mỗi comment ordinal/content hash/key gắn đúng verified post effect.
2. **S100.2** — Verify existing comment trước retry; multiline là một typed list item.
3. **S100.3** — Separate definite fail/unknown/success; explicit comment-only retry.

Tình huống phải kiểm tra:

- REG-18: timeout sau gửi không duplicate comment hoặc repost.
- Partial comment list restart không gửi lại items verified hoặc tách multiline sai.

**Nghiệm thu:** Từng comment có hash/index/key; verify trước retry; không repost Reel.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S100/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S101 — Cancel, partial-result và manual review

Trạng thái: PLANNED · Test nghiệm thu: `AT-101`.

Tiền đề triển khai: S074, S098, S099, S100.

Đầu ra dự kiến: `packages/review/src/resolution.ts`, `apps/desktop/src/renderer/history/review/`.

1. **S101.1** — Cancel tại safe boundaries; pending effect vẫn verify/review trước terminal.
2. **S101.2** — Verified post + definite comment fail thành SUCCESS_WITH_WARNINGS; unknown pause máy.
3. **S101.3** — Review có evidence/actor/reason/resolution; không tự enqueue publish từ kết luận.

Tình huống phải kiểm tra:

- Máy khác tiếp tục khi một máy NEEDS_REVIEW; comment retry giữ post cũ.
- Operator resolution không âm thầm gửi lại hoặc xóa uncertainty/evidence.

**Nghiệm thu:** Uncertain effect pause device automation; verified post + definite comment failure có SUCCESS_WITH_WARNINGS và comment retry riêng.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S101/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S102 — Cleanup/reconciliation

Trạng thái: PLANNED · Test nghiệm thu: `AT-102`.

Tiền đề triển khai: S095, S098, S100, S101.

Đầu ra dự kiến: `packages/staging/src/cleanup.ts`, `packages/staging/src/reconcile.ts`.

1. **S102.1** — Cleanup eligibility chỉ verified success/warnings không còn pending recovery cần media.
2. **S102.2** — Delete positive-owned paths bằng ledger, reconcile MediaStore sau delete.
3. **S102.3** — Cleanup retry riêng bounded, giữ job outcome và PC source.

Tình huống phải kiểm tra:

- REG-19: cleanup failure retry không repost; owned staging xóa đúng.
- Imported/arbitrary path/DCIM/Downloads hoặc pending media không bị xóa.

**Nghiệm thu:** Chỉ owned staging; pending giữ file; cleanup failure không tạo lại post.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S102/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S103 — Certification-aware runtime

Trạng thái: PLANNED · Test nghiệm thu: `AT-103`.

Tiền đề triển khai: S049, S094, S099, S100, S101, S102.

Đầu ra dự kiến: `packages/execution/src/runtime.ts`, `tests/integration/execution-contract/`.

1. **S103.1** — Ghép scheduler→worker→engine→app port→journal→verify→review thành runtime.
2. **S103.2** — Enforce version/profile readiness và generic workflow DEVICE_TEST policy.
3. **S103.3** — Dùng reference adapter từ risk harness cho core acceptance; built-in app certification ở P12.

Tình huống phải kiểm tra:

- Full job lifecycle thực và recovery có receipts đúng profile.
- Core PASS không tự mở Facebook/Lite/IG/TikTok/Threads mọi version.

**Nghiệm thu:** Engine contract tests + hardware reference adapter evidence; release eligibility vẫn theo từng app/profile.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S103/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

## P12 — Adapters theo ứng dụng

Gate toàn phase: P11.

### S104 — App adapter interface và capability matrix

Trạng thái: PLANNED · Test nghiệm thu: `AT-104`.

Tiền đề triển khai: S007, S048, S089, S090, S091.

Đầu ra dự kiến: `packages/app-adapters/src/registry.ts`, `packages/app-adapters/src/profile.ts`.

1. **S104.1** — Formalize app adapter interface từ S048/risk reference contract.
2. **S104.2** — Capabilities target/media/audience/comment/identity/verification theo version/locale.
3. **S104.3** — Author generic/custom package với user-created workflow, không bắt mọi app chờ template built-in.

Tình huống phải kiểm tra:

- Unknown/custom app vẫn author/test primitive có gate đúng.
- Không lấy Facebook selectors hoặc media semantics gán app khác.

**Nghiệm thu:** Target kinds/media/audience/comments/selectors không giả là giống nhau.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S104/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S105 — Facebook video/Reels adapter

Trạng thái: PLANNED · Test nghiệm thu: `AT-105`.

Tiền đề triển khai: S103, S104.

Đầu ra dự kiến: `packages/app-adapters/src/facebook/reels/`, `tests/hardware/apps/facebook-reels/`.

1. **S105.1** — Implement Facebook Reels/video detect/switch target/compose/publish/verify/comment.
2. **S105.2** — Pin package com.facebook.katana và exact supported profiles; multi-target identity checks.
3. **S105.3** — Thử fail/review/restart/cleanup với controlled targets và version receipts.

Tình huống phải kiểm tra:

- Facebook Reels end-to-end có bài/target/evidence đúng.
- Wrong target/checkpoint/app update dừng, không bypass hoặc duplicate publish.

**Nghiệm thu:** com.facebook.katana: phiên bản/locale/profile được chứng nhận riêng.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S105/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S106 — Facebook photo/multi-asset flow

Trạng thái: PLANNED · Test nghiệm thu: `AT-106`.

Tiền đề triển khai: S105.

Đầu ra dự kiến: `packages/app-adapters/src/facebook/photos/`, `tests/hardware/apps/facebook-photos/`.

1. **S106.1** — Photo/single/multi-asset flow riêng, validate type/order/count capability.
2. **S106.2** — Compose/verification/media picker assumptions chứng minh độc lập với video.
3. **S106.3** — Expose photo support chỉ cho profiles đã test.

Tình huống phải kiểm tra:

- Ảnh/multi-asset đúng order/audience và verified target.
- Đổi tên video template không tính photo PASS; unsupported mix trả reason.

**Nghiệm thu:** Không đổi tên video template rồi coi là photo support; ordering/type kiểm tra thật.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S106/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S107 — Facebook Lite adapter

Trạng thái: PLANNED · Test nghiệm thu: `AT-107`.

Tiền đề triển khai: S103, S104.

Đầu ra dự kiến: `packages/app-adapters/src/facebook-lite/`, `tests/hardware/apps/facebook-lite/`.

1. **S107.1** — Detect Lite package/version và selectors riêng.
2. **S107.2** — Implement scope media/identity/comment verified thực; keep unsupported capability explicit.
3. **S107.3** — Certification/recovery cases không kế thừa Facebook thường.

Tình huống phải kiểm tra:

- Lite end-to-end trên exact profile và failure path có evidence.
- Lite chưa test không auto inherit Facebook certification.

**Nghiệm thu:** Không dùng selectors Facebook thường; chứng nhận độc lập.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S107/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S108 — Instagram adapter

Trạng thái: PLANNED · Test nghiệm thu: `AT-108`.

Tiền đề triển khai: S103, S104.

Đầu ra dự kiến: `packages/app-adapters/src/instagram/`, `tests/hardware/apps/instagram/`.

1. **S108.1** — Instagram profile/Reel/video/target semantics và compose riêng.
2. **S108.2** — Verify post/comment/media behavior theo actual account/profile.
3. **S108.3** — Giới hạn đã chứng minh được khai báo trong registry và UI.

Tình huống phải kiểm tra:

- Instagram flow và exact-post signals qua controlled profile.
- Unsupported media/audience hoặc identity mơ hồ bị chặn có reason.

**Nghiệm thu:** Reel/video/profile semantics/limits/verification được test riêng.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S108/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S109 — TikTok adapter

Trạng thái: PLANNED · Test nghiệm thu: `AT-109`.

Tiền đề triển khai: S103, S104.

Đầu ra dự kiến: `packages/app-adapters/src/tiktok/`, `tests/hardware/apps/tiktok/`.

1. **S109.1** — Detect package thực trên fleet, locale/version và account identity.
2. **S109.2** — Implement TikTok media/caption/publish verification/comment capability riêng.
3. **S109.3** — Ưu tiên cùng S105 để R1 chứng minh hai app thật, không chờ Lite/IG/Threads hoàn thành.

Tình huống phải kiểm tra:

- Cùng phone chạy Facebook rồi TikTok tuần tự; hai phone độc lập.
- TikTok update/profile mismatch không reuse Facebook receipt/selector.

**Nghiệm thu:** Package thực trên fleet, profile locale, media/comment capability có evidence.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S109/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S110 — Threads adapter

Trạng thái: PLANNED · Test nghiệm thu: `AT-110`.

Tiền đề triển khai: S103, S104.

Đầu ra dự kiến: `packages/app-adapters/src/threads/`, `tests/hardware/apps/threads/`.

1. **S110.1** — Threads text-only và attachments theo capability, typed content không ép video.
2. **S110.2** — App-specific identity/compose/publish/verify/comment support.
3. **S110.3** — Chứng nhận profiles và recovery độc lập, dùng label đúng sản phẩm.

Tình huống phải kiểm tra:

- Text-only workflow không cần media file; attachment order đúng.
- Không gọi Threads là Reels hoặc báo attachment support khi chưa thử.

**Nghiệm thu:** Text và attachments theo capability; không gắn nhãn Reels giả.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S110/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S111 — Acceptance/certification theo app

Trạng thái: PLANNED · Test nghiệm thu: `AT-111`.

Tiền đề triển khai: S103, S104.

Đầu ra dự kiến: `packages/app-adapters/src/certification/`, `docs/evidence/apps/`.

1. **S111.1** — Certification theo từng shipped app/workflow hash/device/version/locale profile.
2. **S111.2** — R1 cần S105+S109 receipts; app khác deferred giữ trong full scope.
3. **S111.3** — User-issued workflow readiness khác built-in adapter certification, UI giải thích rõ.

Tình huống phải kiểm tra:

- Chỉ exact certified profiles auto-run; custom workflow có test/readiness flow.
- App seed hoặc profile PASS khác không mở gate toàn app/all versions.

**Nghiệm thu:** App chưa chứng nhận vẫn author workflow được; automation bị disable với lý do.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S111/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

## P13 — Công cụ và vận hành

Gate toàn phase: P02, P08, P09, P11.

### S112 — Device tools 3 tab và APK manager

Trạng thái: PLANNED · Test nghiệm thu: `AT-112`.

Tiền đề triển khai: S074, S075, S076, S084.

Đầu ra dự kiến: `packages/apk/src/`, `apps/desktop/src/renderer/devices/tools/`.

1. **S112.1** — Device Tools 3 tab Connection/Apps/Network; dialogs file APK qua host refs.
2. **S112.2** — Install/uninstall/list/force-stop có package scope, worker lock, bounded batch và progress.
3. **S112.3** — Cancel/per-device outcomes, permission/busy/offline errors; quick buttons giữ trong overflow.

Tình huống phải kiểm tra:

- APK hợp lệ cài/gỡ đúng selected phone và report từng máy.
- Không uninstall package khác/busy automation hoặc báo all-success khi một máy fail.

**Nghiệm thu:** Kết nối/Ứng dụng/Mạng; thực thi có scoped file picker, bounded queue, per-device result và quick action scope.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S112/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S113 — Proxy parser/checker/secret storage

Trạng thái: PLANNED · Test nghiệm thu: `AT-113`.

Tiền đề triển khai: S013, S017, S074.

Đầu ra dự kiến: `packages/network/src/proxy-parser.ts`, `packages/network/src/secret-store.ts`.

1. **S113.1** — Parse HTTP/HTTPS/SOCKS/auth/IPv6/escaping theo supported formats rõ.
2. **S113.2** — Credential refs qua OS vault; PC probe riêng device/app routing state.
3. **S113.3** — UI edit/import/diagnostics redact passwords và retain desired/observed state riêng.

Tình huống phải kiểm tra:

- Parser round-trip valid profiles và secret refs không chứa raw password exports.
- Malformed proxy/unsupported scheme reject; PC egress PASS không bật device support.

**Nghiệm thu:** Parser/check PC/device support ba mức riêng; log/export redacted.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S113/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S114 — Device proxy adapters

Trạng thái: PLANNED · Test nghiệm thu: `AT-114`.

Tiền đề triển khai: S074, S092, S113.

Đầu ra dự kiến: `packages/network/src/device-proxy/`, `tests/hardware/network/`.

1. **S114.1** — Implement chỉ adapter có routing spike evidence; apply/verify/rollback qua worker.
2. **S114.2** — Verify device egress và traffic app thực, config/helper capability non-root.
3. **S114.3** — Switch network cần pause safe point/repreflight; retain rollback state.

Tình huống phải kiểm tra:

- Claimed proxy type chứng minh app traffic và rollback sau partial failure.
- No actual app route hoặc helper chưa có thì unsupported, không fake check xanh.

**Nghiệm thu:** Apply + egress + app traffic verify; rollback/unsupported có trạng thái.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S114/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S115 — VPN adapters và mutual exclusion

Trạng thái: PLANNED · Test nghiệm thu: `AT-115`.

Tiền đề triển khai: S074, S076, S113.

Đầu ra dự kiến: `packages/network/src/vpn/`, `apps/desktop/src/renderer/devices/tools/network/`.

1. **S115.1** — Discover/open/configure/verify supported VPN adapters theo quyền thực.
2. **S115.2** — Proxy/VPN mutual exclusion và rollback rõ desired/observed states.
3. **S115.3** — Network change redetect profile/preflight; security challenge dừng review.

Tình huống phải kiểm tra:

- Chuyển proxy↔VPN có trạng thái/verify và không dùng hai route ngầm.
- Không tự rotate IP/identity để né block hoặc giả VPN active từ việc mở app.

**Nghiệm thu:** Discover/open/verify; không auto rotation để né protections.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S115/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S116 — Logs/diagnostics/notifications

Trạng thái: PLANNED · Test nghiệm thu: `AT-116`.

Tiền đề triển khai: S013, S027, S019, S074.

Đầu ra dự kiến: `packages/diagnostics/src/`, `apps/desktop/src/renderer/history/`, `apps/desktop/src/renderer/diagnostics/`.

1. **S116.1** — Structured logs/metrics/notifications theo operation/run/job/node/device IDs.
2. **S116.2** — History phân biệt TRACE/REAL và count chỉ verified effects.
3. **S116.3** — Retention/redaction/export preview, user-directed sharing riêng thao tác local export.

Tình huống phải kiểm tra:

- Click lỗi tới node/row/effect đúng ID; export không có secrets/raw clipboard.
- Không đưa demo metrics, pending posts hoặc unrelated device logs vào counters/scope.

**Nghiệm thu:** Operation correlation, retention, export preview và consent khi chia sẻ.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S116/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S117 — Disk/power/lifecycle resilience

Trạng thái: PLANNED · Test nghiệm thu: `AT-117`.

Tiền đề triển khai: S020, S068, S074, S097.

Đầu ra dự kiến: `apps/desktop/src/main/lifecycle/`, `packages/diagnostics/src/resources/`.

1. **S117.1** — Single instance/data root, tray/close/background và graceful quit deadline.
2. **S117.2** — Stop intake→checkpoint→journal→owned resources→DB flush, power gap recovery.
3. **S117.3** — Low/full disk budgets chặn staging không đủ chỗ; giữ DB/evidence và recovery.

Tình huống phải kiểm tra:

- Sleep/resume/quit/crash giữ queue/effects và cleanup đúng ownership.
- Không kill shared resources hoặc update/quit làm mất pending publish state.

**Nghiệm thu:** Low/full disk, sleep/resume, tray, graceful quit và crash reconciler.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S117/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S118 — Scale/resource acceptance

Trạng thái: PLANNED · Test nghiệm thu: `AT-118`.

Tiền đề triển khai: S055, S056, S064, S080, S085, S103.

Đầu ra dự kiến: `tests/performance/`, `docs/evidence/performance/`.

1. **S118.1** — Khóa workload/host/device counts/stream profiles/workflow/media sizes trước đo.
2. **S118.2** — Đo p50/p95 input→frame, XML/selector/OCR, UI save, CPU/RAM/USB và queues.
3. **S118.3** — Optimize caching/backpressure/workers/virtualization; công bố measured envelope, không giới hạn nghiệp vụ giả.

Tình huống phải kiểm tra:

- Lặp cùng workload có reproducible baseline và leak/soak observations.
- Chưa có Genfamer build/workload đối chứng thì không claim nhanh hơn; không truncate records để đẹp benchmark.

**Nghiệm thu:** Measured devices/streams/jobs/media; bounded workers/backpressure, không trần nghiệp vụ giả.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S118/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

## P14 — Packaging và release

Gate toàn phase: P03, P07, P11, P13.

### S119 — Supported matrix/build receipts

Trạng thái: PLANNED · Test nghiệm thu: `AT-119`.

Tiền đề triển khai: S005, S015, S086, S090, S111, S118.

Đầu ra dự kiến: `build/support-matrix.json`, `docs/evidence/releases/`.

1. **S119.1** — Ghi exact OS/arch/Electron/SQLite/ADB/scrcpy/schema và Android/app/locale profiles.
2. **S119.2** — Tách capability support từ catalog, unavailable/deferred states hiển thị đúng.
3. **S119.3** — Receipt release pin revision/lockfile/build hashes và shipped step/feature scope.

Tình huống phải kiểm tra:

- Mỗi supported capability có test receipt cùng build/profile.
- Thiếu Windows/device/version evidence không được đưa vào supported matrix.

**Nghiệm thu:** Windows/Android/app versions/locales/ABI/protocol/schema khai báo chính xác.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S119/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S120 — Offline bundling và licenses

Trạng thái: PLANNED · Test nghiệm thu: `AT-120`.

Tiền đề triển khai: S005, S078, S083, S055.

Đầu ra dự kiến: `build/vendor-manifest.json`, `build/third-party-notices/`.

1. **S120.1** — Bundle verified runtime binaries/fonts/icons/OCR data cần thiết, không CDN runtime.
2. **S120.2** — Kiểm redistribution/license của ADB/scrcpy/ffmpeg/OCR/image libraries và notices.
3. **S120.3** — Offline install/runtime smoke với hashes và missing-artifact detection.

Tình huống phải kiểm tra:

- Disconnect mạng vẫn mở app/authoring và local device capabilities đã bundle.
- Artifact hash/license/missing codec hoặc training data làm gate fail, không auto-fetch unverified latest.

**Nghiệm thu:** Không CDN runtime; binaries verified và third-party notices.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S120/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S121 — Windows clean-machine install

Trạng thái: PLANNED · Test nghiệm thu: `AT-121`.

Tiền đề triển khai: S119, S120, S117.

Đầu ra dự kiến: `build/windows/`, `tests/packaging/clean-machine/`.

1. **S121.1** — Build Windows installer với native ABI/assets/preload/CSP đúng packaged paths.
2. **S121.2** — Clean-machine không Node/dev tools: open/save/DB/ADB/stream/device smoke.
3. **S121.3** — Signing/update publisher status khai báo thật, profiles/test host metadata lưu receipt.

Tình huống phải kiểm tra:

- Fresh user data root và path có Unicode/spaces chạy được.
- Linux build hoặc dev mode PASS không thay clean Windows install; unsigned không ghi signed.

**Nghiệm thu:** App/SQLite/ADB/stream chạy không cần dev toolchain; signing theo phạm vi phát hành.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S121/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S122 — Upgrade/migration/rollback

Trạng thái: PLANNED · Test nghiệm thu: `AT-122`.

Tiền đề triển khai: S020, S021, S099, S121.

Đầu ra dự kiến: `tests/packaging/upgrade/`, `packages/database/src/migration-runner.ts`.

1. **S122.1** — Upgrade schema trên fixtures trước/current và job effect pending.
2. **S122.2** — Backup/integrity trước migrate, transactional apply và rollback supported boundaries.
3. **S122.3** — Newer schema/failed migration không mở writer hoặc xóa user data.

Tình huống phải kiểm tra:

- Upgrade/rollback theo supported path giữ workflow/jobs/history/effects.
- Migration fail/full disk/crash restore được DB cũ, không replay pending effects.

**Nghiệm thu:** Fixtures DB cũ; backup/integrity và transaction recovery được kiểm tra.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S122/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S123 — Uninstall/update policies

Trạng thái: PLANNED · Test nghiệm thu: `AT-123`.

Tiền đề triển khai: S117, S121, S122.

Đầu ra dự kiến: `apps/desktop/src/main/update/`, `build/windows/uninstall-policy.md`.

1. **S123.1** — Uninstall giữ DB/media mặc định; explicit removal scope riêng và có preview.
2. **S123.2** — Update chỉ safe point, verify artifact/version, không giữa critical effect.
3. **S123.3** — Backup/rollback policy và process handoff/single-instance rõ.

Tình huống phải kiểm tra:

- Uninstall/reinstall đọc lại dữ liệu theo policy và schema support.
- Update khi publish pending không tiến hành; không xóa PC source media.

**Nghiệm thu:** Giữ DB/media trừ thao tác rõ; không update giữa critical transaction.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S123/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S124 — UI ↔ service ↔ test completeness audit

Trạng thái: PLANNED · Test nghiệm thu: `AT-124`.

Tiền đề triển khai: S028, S039, S049, S059, S068, S085, S103, S111, S112, S116.

Đầu ra dự kiến: `tools/audit/feature-coverage.ts`, `docs/evidence/releases/completeness.json`.

1. **S124.1** — Đối chiếu 330 IDs và legacy mapping với actual shipped routes/handlers/services/tests.
2. **S124.2** — Reachable controls có state đúng; dev/demo disabled khỏi production path.
3. **S124.3** — Audit errors/missing handlers/mock success/unowned controls zero trong shipped scope.

Tình huống phải kiểm tra:

- Mỗi shipped feature truy tới revision/test/receipt và failure handling.
- Nút bấm chỉ toast, random success hoặc missing service làm release gate fail.

**Nghiệm thu:** Shipped controls accepted, không mock success/unowned/missing handler.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S124/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.

### S125 — Release bundle và báo cáo bàn giao

Trạng thái: PLANNED · Test nghiệm thu: `AT-125`.

Tiền đề triển khai: S119, S120, S121, S122, S123, S124.

Đầu ra dự kiến: `docs/evidence/releases/`, `README.md`.

1. **S125.1** — Tạo installer/checksums/support matrix/migration/limitations và hướng dẫn sử dụng.
2. **S125.2** — Báo implemented/tested/accepted/failed/unrun/deferred theo capability, không chỉ build xanh.
3. **S125.3** — Commit/push feature branch khi có quyền; merge/deploy/publish installer theo chỉ định tương ứng.

Tình huống phải kiểm tra:

- Bundle tải được, hashes khớp và hướng dẫn clean install/recovery đúng phiên bản.
- Git 403 hoặc tests unrun ghi đúng; không claim published/released chỉ vì có file local.

**Nghiệm thu:** Ghi checks pass/fail/unrun và limitations; publish/push chỉ khi có ủy quyền.

**Môi trường:** `WINDOWS_AND_ANDROID`. Phone cần cho nghiệm thu: Có.

**Evidence:** `docs/evidence/implementation/S125/` theo revision/build/OS/profile, phân biệt PASS/FAIL/UNRUN.
