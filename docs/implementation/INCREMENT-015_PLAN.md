# Increment 015 — P07/S065 timeline pagination cho fleet lớn

Plan trước code. Người dùng Windows10 x64,20 phones ban đầu, hướng tới300, đa app/Facebook trước. P05 compiler slice đã kiểm189 unit/integration và15 browser. Không đánh dấu P06 hay P07 accepted vì làm lát scale này; các dependency gate toàn phase giữ nguyên.

1. S065 timeline cần truy cập mọi job thay vì chỉ500 bản đầu. Add keyset cursor theo UTC instant, priority, createdAt và stable job ID; page size là resource budget1–1000, không là trần tổng jobs/phones. Cursor không chứa snapshot/content/secrets.
2. Cursor bound với filters và persisted jobs epoch. Migration8 append-only tạo epoch/triggers INSERT/UPDATE/DELETE và expression index. Mutation bởi worker khác làm cursor stale rõ; không ghép hai revision thành một danh sách thiếu/trùng. Cursor malformed/cross-filter reject bằng schema/parameterized SQL, không shell/SQL interpolation từ user.
3. API trả nextCursor/null cùng jobs/hasMore; giữ compatibility cho callers chỉ dùng jobs. Timeline có Tải thêm, thể hiện số đã tải/còn trang; đổi filter/reload/mutation reset cursor. Generation guards bỏ response cũ; load-more không thay Process/device bindings hoặc immutable snapshots.
4. Tests sau code: paging tied UTC/priority/time IDs, changed/foreign-filter/malformed cursor, restart, concurrent DB mutation invalidation,1000+ jobs no duplicate/omission. Browser bằng DB fixture riêng để chứng minh truy cập trang sau thật; không seed devices/jobs vào production DB.

Đây là logic/paging evidence, chưa là benchmark300 phones. Calendar/spread/dispatch/overdue/sleep và physical throughput vẫn còn trong P07/P08/P13.
