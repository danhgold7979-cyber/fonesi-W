# Chính sách vận hành thống nhất

## Media và nguồn dữ liệu

Process có một folder nguồn mặc định và có thể có manual ContentItems. ContentItem có typed fields và 0/1/n ordered asset refs theo workflow. Không giới hạn cứng số records; query/paging/virtualization và worker budgets kiểm soát tài nguyên.

Watcher add/change/unlink được debounce, chờ file ổn định trước probe/hash. Reconcile default 10 giây, không overlap, không decode lại toàn bộ thư mục. Async callback phải bind process/source revision/generation, không đọc global “current process” lúc hoàn tất.

Caption mặc định từ filename cho media item nếu workflow có caption; text-only dùng input người dùng. Missing source giữ lịch sử; scheduled item chuyển named state. Strong fingerprint khi freeze/preflight. File thay đổi sau snapshot => MEDIA_CHANGED, không sửa snapshot ngầm. Ignore có scope source/path/fingerprint để file không tự xuất hiện lại.

Register source từ host dialog hoặc source permission, không tin path trong JSON. Browser HTML chỉ giữ metadata và không tự tái truy cập filesystem sau reload; migration yêu cầu rebind.

## Import/export

Matching: nếu có authoritative content ID thì phải match ID đúng scope; ID không tồn tại là lỗi, không fallback filename. Chỉ khi ID không có mới dùng registered relative path; cuối cùng unique filename trong scope. Duplicate import records/ambiguous filename phải preview và có policy, không last-row-wins ngầm.

Chỉ update trường có trong input; missing = unchanged; empty = explicit empty nếu type cho phép. Typed fields/custom fields round-trip. CSV quoting/newlines/BOM và XLSX types/formulas cần validation. Export dành spreadsheet phải neutralize formula-leading cells theo format policy, giữ raw values trong JSON export có schema.

Import workflow/workspace: validate toàn bộ trước mutate, preview namespaced remap, include schema/subgraphs/assets refs/dependency versions, backup và atomic commit. Không import prototype device/account/history thành real telemetry.

## Lịch và queue

Default 3 slots 08:00/12:00/19:00, weekdays cả tuần; giữ lịch cũ khi migration. Start date là local calendar date, không `toISOString().slice(0,10)` trên local midnight. Lưu UTC instant + Process timezone, display DD/MM/YYYY. Time/date invalid bị reject, kể cả import bypass browser input validation.

NEXT_FUTURE_SLOT là default overdue policy. CATCH_UP đưa pending job hợp lệ vào queue với rate/resource bounds; SKIP tạo lịch sử skipped có reason, không xóa. In-flight uncertain effect đi recovery trước, không được ba policy này tạo publish mới.

Preview lưu process revision, selected item set, existing job revisions, random offsets, proposed instants và expires/token/hash. Apply đúng token/idempotency key; stale preview yêu cầu refresh. Reapply không tạo occurrence trùng. Auto-append chỉ xếp items mới vào khoảng tương lai trống; không tái lịch mọi item cũ.

One device/one active job, different devices độc lập. Queue ordering theo scheduledUtc/priority/createdAt, fairness xác định. Offline => WAITING_DEVICE/OVERDUE; device return => preflight lại. Manual lock pause tại safe boundary; release => redetect.

Timeline toàn workspace query, không từ rows đang mở. Edit chỉ scheduled/not-started jobs bằng expectedRevision; snapshot nội dung không đổi. Drag không đổi device/target ngầm. Clear pending không clear posted/pending-effect history.

Conflict tối thiểu cùng device/cùng instant. Nếu dùng reservation intervals thì duration là estimate + uncertainty, không suy từ độ rộng card/name. Queue luôn enforce exclusion kể cả UI không dự đoán overlap. Anti-conflict/spread 60–120 phút kế thừa là explicit operation có preview/scope/seed và cảnh báo crossing-day; không auto đổi lịch ngoài scope.

## Job và side effects

Job states chuẩn: DRAFT → SCHEDULED → QUEUED → PREFLIGHT → RUNNING → POST_INTENT → POST_PENDING → POSTED → COMMENT_PENDING nếu có → SUCCESS. Side states: WAITING_DEVICE/WAITING_NETWORK/MEDIA_MISSING/MEDIA_CHANGED/TARGET_MISSING/NEEDS_REVIEW/FAILED/CANCELLED/SKIPPED. V2.1 thêm SUCCESS_WITH_WARNINGS cho post đã verified nhưng comment thất bại chắc chắn; retry comment riêng. Uncertain effect pause automation máy đó để review, không chặn các máy khác. Domain error code và UI label là layers riêng.

Job snapshot pin full workflow/dependency/schema/content/asset/target/network/options. Runtime credentials là secret refs, không raw values. Sửa Process/draft/media metadata không cập nhật snapshot job cũ; muốn áp cấu hình mới phải explicit rebuild job ở trạng thái an toàn.

Không có atomic transaction giữa SQLite và external app UI. Cửa sổ nguy hiểm: tap đã tới điện thoại nhưng desktop crash trước ACK. Vì vậy:

```text
DB commit intent + effect key + payload hash + ATTEMPT_UNCERTAIN
→ gửi input đúng lease
→ record ACK nếu có
→ verify exact provider/identity/content
→ CONFIRMED hoặc NEEDS_REVIEW
```

Thiếu ACK/timestamp hoặc chưa thấy bài ngay không chứng minh chưa đăng. Không có generic retryPublish từ pending. Negative proof cần app-specific strategy/evidence; manual resolution không tự enqueue publish lại.

CommentEffect key theo postEffect + comment ordinal/content hash. Verify đúng bài/người/nội dung trước retry. Lỗi comment không quay lại publish. List comment không dùng newline splitting mơ hồ khi content có multiline.

## Staging ownership

Chỉ AutoReels-owned namespace, ví dụ `/sdcard/Movies/AutoReels/<job-id>/`. Ledger ghi source hash, job/device/path, transfer/index refs và state. Check free space/permission/legacy pending staging trước push. Unique name không tự đủ để chứng minh picker chọn đúng; cần observable readiness và selection evidence.

Initial cleanup sau SUCCESS hoặc SUCCESS_WITH_WARNINGS khi post verified, không còn pending effect và mọi recovery cần media đã giải quyết. POST_PENDING/COMMENT_PENDING hoặc unresolved verification giữ media nếu còn có thể cần. Cleanup failure retry cleanup riêng, không repost. Sau cleanup reconcile MediaStore và verify ownership path. Không xóa DCIM/Downloads/Camera/user albums hoặc arbitrary imported path.

## App và network

Manual login; không password/2FA/token extraction. Security challenge => NEEDS_REVIEW và dừng tự động, không bypass. Unknown app version/locale/selector profile => automation unsupported; manual screen/control có thể vẫn dùng.

Proxy check PC khác Android routing và khác app traffic. Mỗi claimed-supported adapter phải chứng minh cả ba. Proxy/VPN loại trừ nhau per-device, desired state khác verified observed state. Không tự rotate IP/identity khi gặp block. APK install/uninstall phải bounded concurrency và per-device result.

## Lifecycle và retention

Quit: stop intake → checkpoint workers tại safe point → persist journal/queue → close owned sessions/processes/forwards → flush DB/WAL → exit có deadline. Close khi background enabled là hide-to-tray. Power loss vẫn dựa recovery transaction.

Sleep/resume: detect gap/reconnect/requery overdue/preflight; pending publish không replay. Single instance per data root; second instance focus existing. DB backup trước migration và định kỳ; integrity check. Logs/diagnostics rotate, thumbnail cache rebuildable/LRU; disk critical dừng việc không thiết yếu và ngăn staging không đủ dung lượng.
