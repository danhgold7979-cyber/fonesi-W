# Increment016 — P06/S050 Process archive/restore

Plan trước code. P07 paging slice đạt191 unit/integration +16 browser; không đóng P07 hay bỏ P06. Hoàn thiện một lifecycle luồng đang thiếu thay vì chỉ có archived flag trong DB.

1. UI Lưu trữ tiến trình chỉ sau save ACK của đúng Process/revision. Dialog mô tả policy: ngừng nhận queue claims mới, giữ media/source/content/jobs/history; không tự cancel/replay job đang chạy/uncertain. Mutation dùng expectedRevision, stale reject.
2. Kho lưu trữ đọc persisted archived records (named listProcesses includeArchived schema), lọc đúng device scope, restore explicit và ACK trước chọn Process. Không tạo dữ liệu mẫu, xóa rows/jobs/files hoặc cấp permission filesystem mới.
3. Host refresh media coordinator sau saveProcess để archive ngừng watchers/scans và restore tái lập các source đã được host cấp quyền. Process/testDevice/editor/library scope giữ tách biệt. Request đang hoàn tất không clear Process khác nếu user đổi context.
4. Test sau code: archive/restore và includeArchived qua DB restart, dữ liệu0/false/list/source grants/job snapshots vẫn giữ; queue claim không lấy archived Process. Browser actual create/save/archive/list/restore/content round-trip, không fake timer ACK.

S050 clone có preview/copy content IDs và permission semantics còn là công việc riêng; chưa gọi P06 hoàn tất. Media adopt/rebind/thumbnail/query/field migration cũng vẫn mở.
