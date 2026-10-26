# P07 — kế hoạch scheduler trước khi code

S060–S068. Hiện chỉ có schedule profile persistence; chưa có job preview/apply/runtime tự chạy. Bổ sung scheduler core và UI bằng pure clock + transactional DB, không timer giả posting.

1. Dùng Temporal polyfill maintained/pinned cho UTC instants + IANA timezone/local calendar date. Default 08/12/19, weekdays per Process. DST nonexistent/ambiguous giờ phải reject/giải thích trong preview, không đổi ngày bằng toISOString local-midnight.
2. Preview từ frozen Process/content/version revisions và selected scope; giữ proposed times, seeded jitter offsets, existing job revisions, expiry/token/hash. Apply chính proposal, không rerandomize. Duplicate apply dùng idempotency/occurrence keys và transaction.
3. Unassigned Process vẫn lưu cấu hình/xem preview; tạo runnable jobs cần device/version bindings và required content hợp lệ. Target/certification/hardware eligibility kiểm theo capability; không tạo phone/target giả để apply được.
4. Snapshot pin full version bundle/typed content/ordered assets/target/network/options. Source changes sau schedule giữ snapshot và preflight MEDIA_CHANGED. Deliberate repost khác retry pending effect; clear/reschedule chỉ not-started safe jobs.
5. NEXT_FUTURE_SLOT/CATCH_UP/SKIP khác busy queue; missed instants/clock gaps và randomization có tests. Chưa rõ external effect luôn recovery trước, không policy nào replay publish.
6. Queue order scheduledUtc/priority/createdAt, one device owner qua DB lease, independent phones. Claim không đồng nghĩa execute/posted. Actual runner chờ P08/P11; runtime thiếu capability thì blocked/waiting thật.
7. Timeline query toàn workspace, filters/date/views, preview/apply/reschedule/clear pending và explicit spread 60–120 phút có crossing-day preview. Duration reservation nếu chưa đo thì không đoán theo card width.
8. Unit/integration: timezone/DST/day bounds/weekdays/jitter/restart, stale/expired preview, apply twice, invalid item rollback, snapshot immutable, same-phone contention/different-phone independence, pending effect cannot reschedule/retry. E2E cấu hình/preview từ Process thật; apply gate unavailable device hiển thị lý do.

Đầu ra: packages/scheduler, DB preview/job query APIs, service/main boundary, timeline/Process UI và receipts. Windows sleep/resume hooks và Android execution acceptance riêng, chưa chạy không claim.
