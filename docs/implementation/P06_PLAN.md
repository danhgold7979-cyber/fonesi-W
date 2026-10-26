# P06 — kế hoạch media/data trước khi triển khai service

S050–S059. Shell Process/content đang dùng persistence P02 và có E2E scope/save-race; phase này bổ sung nghiệp vụ media thật, không tính shell thành toàn phase đã xong.

1. Thêm migrations append-only cho host-approved source bindings/ignore/probe metadata. Khả năng đọc file đến từ native dialog ở main hoặc app-owned import, không từ raw path trong renderer/JSON. Public API không có register arbitrary filesystem path; private main↔worker grant riêng.
2. Native chọn folder/files, persist source ID/Process/options; web authoring không có native filesystem thì báo unsupported rõ. Process draft chưa gán phone vẫn quản lý data được. Import source từ máy khác cần rebind, không tự cấp quyền theo path cũ.
3. Scanner enumerate media whitelist, optional subfolders, bỏ symlink escapes và junk folders; recheck realpath/stat/hash, không đọc file chưa ổn định. Stream SHA-256 trong bounded concurrency, cancel/generation theo source revision; không block UI bằng hash decode đồng bộ.
4. Reconcile/new/change/missing/ignore theo source + relative path + fingerprint; không overlap. Watcher debounce + interval mặc định 10 giây; only auto-append new content, không ghi đè item/job snapshot cũ khi file đổi. Removed row không delete file PC.
5. ffprobe metadata và thumbnail worker/child process bằng argument arrays/allowlisted executables, deadline; thiếu binary/unsupported/corrupt có trạng thái, duration không tự thành 0. Thumbnail ở app-owned cache, renderer lấy qua scoped URL/protocol, không arbitrary file://.
6. UI typed fields 9 loại, inline/bulk selected scope, ẩn cột, context menu rows, asset order, source options/status/progress. Thiếu required inputs là content chưa ready; không bịa values/identity/media.
7. CSV/JSON import/export: authoritative ID→registered relative path→unique filename chỉ khi không có ID; preview ambiguities/duplicates/conversions/missing-vs-empty; apply token + revision + transaction. XLSX adapter chọn sau parser/license spike, chưa có thì explicit unsupported, không đổi tên CSV thành XLSX.
8. Tests temp real filesystem: recursive/ignore/symlink/outside root/file mutation/hash/order, remove/reconcile/restart, actual probe nếu binary có; DB stale source callback không ghi Process khác; malformed import rollback. Native chooser/permissions cần Electron evidence; browser tests chỉ gọi routes được hỗ trợ.

Đầu ra: packages/media, DB source/migration APIs, main grants + Process UI, import-export helpers và receipts. Hoàn thiện theo slice, ghi phần còn thiếu; không gọi full P06 accepted bằng một source button hoặc JSON editor.
