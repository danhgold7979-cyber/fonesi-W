# Increment019 — P06/S054 explicit adoption của media đã đổi

Plan trước code.018 đạt204 unit/integration +18 browser. Source rebind không được tự sửa hash/media của jobs; increment này cho user tiếp nhận bytes mới có preview và ACK.

1. Public preview nhận Process/asset IDs, không raw path/hash. Main resolve current scoped source grant, stream fingerprint/probe tệp thật, verify path/stat sau read. Preview lưu descriptor mới + context hash + expiry/host; không sao chép credential fields vào preview payload. Chặn unchanged/ignored/foreign/unregistered source.
2. Apply chỉ token. Main đọc private plan, fingerprint/probe lại, reject bytes đổi thêm hoặc context stale. DB transaction tạo immutable asset ID mới, đổi source entry và active ContentItem asset refs/file/file[] fields trong đúng Process, giữ ContentItem IDs, tăng revisions. Process file fields remap atomic. Không sửa/xóa asset records cũ, source bytes hoặc job snapshots/effects.
3. Idempotency qua restart: retry cùng token trả cùng committed asset/content IDs; completed plan không yêu cầu tệp còn tồn tại để tránh biến ACK retry thành hành động mới. File checks có bounded concurrency và AbortSignal khi host đóng; không block serialized DB worker bằng hash/probe.
4. UI chỉ đưa action cho CHANGED assets, preview số rows/hash/bytes/warnings, cancel không mutate, save Process trước preview. Result ACK cập nhật Process revision/file refs; giữ local edits đang pending và không đổi Process khác. Reload source/content sau commit; stale/changed-again phải xem trước lại.
5. Actual temp filesystem/SQLite tests: old/new hashes và IDs, ordered multi-asset refs/typed Process refs, old job snapshot unchanged, unrelated Process unaffected, read-only preview, cancellation, changed-again/stale/rebind/foreign/rollback/restart/apply twice và no raw-path injection. Browser dùng isolated host + actual media fixture, không production fake phones/results.

P06 vẫn còn thumbnail/cache/query/field migration và các native Windows gates. Automation phải strong-fingerprint lúc preflight; metadata READY hoặc adoption không certify Android/publish.
