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

## Increment 003 — native source → coordinator → Process UI

- Public DTO chỉ nhận Process/source ID, revision và lựa chọn folder/files/options. `rootPath`/`hostId` chỉ đi qua private host→DB-worker channel. Chọn nhiều files được canonicalize toàn bộ trước khi transaction đăng ký; kiểm tra lại Process revision sau dialog, cancel dialog không thay đổi DB.
- Host ID lưu riêng trong data directory; DB từ máy khác chỉ hiển thị nguồn cần rebind. Browser không mở filesystem chooser. Native chooser ở Electron main, sender/frame/DTO vẫn được kiểm tra.
- Coordinator tối đa 2 scans, dedupe theo source, progress có scan ID, abort và source-revision fencing. Chỉ finish/missing khi enumerate hoàn tất không lỗi/không cancel. Watch debounce 600ms + reconcile 10s, tái lập sau restart, đóng watcher/scans trước worker.
- File mới sửa có stability check trước hash; hash/probe recheck như hiện tại. Nguồn lỗi hoặc bị đổi không ghi callback sang Process khác. File đổi chỉ đánh dấu CHANGED, không thay bytes cũ. Ignore không xóa file gốc.
- UI typed form thay JSON mặc định, giữ 0/false/missing và thứ tự item nhiều dòng; file refs chỉ từ media cùng Process, identity chưa có discovery thì không bịa options. UI gọn: nguồn theo Process, chọn folder/files, recursive/watch, quét/hủy, progress và lỗi; tên media/trạng thái thay asset count đơn thuần. Chuyển Process dùng generation để loại response cũ. Phần thumbnails/import/bulk/virtualization để increment sau, không tuyên bố toàn P06 hoàn thành.
- Kiểm chứng bằng real temp FS + SQLite: scan→ignore→reconcile→restart, đổi/mất bytes, cancel/error không mark missing, stale dialog/options, concurrency/dedupe/shutdown; browser unsupported/Process isolation và Electron sandbox smoke. Native dialog tương tác/Windows vẫn cần nghiệm thu desktop thật.

## Increment 005

Kế hoạch chi tiết từng tiểu bước trước code: [INCREMENT-005_PLAN.md](INCREMENT-005_PLAN.md). 005A → 005B → 005C → 005D; Process fields và content preview/apply là phạm vi chính. Giữ phần còn thiếu trong progress và không biến content import thành workspace import.
