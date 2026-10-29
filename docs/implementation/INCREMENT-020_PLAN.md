# Increment020 — P07/S066–S067 scoped batch schedule changes

Plan trước code. Baseline019:208 unit/integration +19 browser scenarios. Tiếp tục lịch thật từ SQLite, không dispatch/giả posting.

1. API named previewJobChanges/applyJobChanges. Preview nhận explicit unique {id,revision} scope (budget1000/lần), operation SPREAD hoặc CANCEL; gap defaults60–120 phút, validated60≤min≤max≤120. Host tạo seed; không nhận proposed times/snapshot từ renderer. Scope luôn ID, không suy từ current loaded page hay Process đang mở.
2. Pure spread giữ anchor sớm nhất per-device, deterministic seed/gaps và order UTC/priority/ID. Các jobs sau chỉ dịch về sau tới ít nhất previous+gap, không kéo lịch có sẵn về trước. Independent devices có anchors độc lập; không đoán duration. Date crossing theo timezone trong snapshot; preview ghi rõ giờ cũ/mới, gap/offset và warning crossing-day/past.
3. Append-only schema11 lưu token/payload/hash/expiry/result. Preview read-only với per-item blockers cho wrong revision/non-SCHEDULED/existing external intent/archived Process; phát hiện collision cùng phone/cùng instant với jobs ngoài scope. Cancel chỉ safe SCHEDULED; không xóa history/snapshot/source files.
4. Apply token transaction, verify checksum/expiry/jobs epoch + selected safety/revisions/snapshot timezone, cảnh báo conflicts thành blockers. Chỉ ghi đúng proposal đã preview, đổi time/state+revision, giữ job ID/snapshot/device/target/priority. Không thay ngoài scope. Idempotency persisted qua restart/expiry; rollback toàn batch khi một update lỗi. Job mutations ngoài scope cũng làm preview stale conservatively qua epoch.
5. UI checkbox stable IDs, selected counts, select loaded scheduled scope với label rõ, giữ lựa chọn qua load-more, reset khi filter/reload. Dialog preview SPREAD/CANCEL, selectable gap, warnings/blockers và exact apply. Busy/generation/unmount guards; lỗi retry giữ token, stale cần preview lại. Không auto select chưa tải.
6. Tests pure deterministic multi-device/day crossing/range; actual SQLite reopen/apply twice/rollback/stale epoch/revision/external intent/collisions/out-of-scope immutability. Browser isolated schedule host test selected subset, cancel preview, apply fixed timestamps and cancellation.

Không đóng toàn P07: calendar views/drag, overdue/auto-append/actual dispatch/sleep/resume còn các increments/gates sau. Windows/Android vẫn cần nghiệm thu riêng.
