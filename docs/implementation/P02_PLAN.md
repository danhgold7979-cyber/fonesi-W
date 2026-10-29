# P02 — kế hoạch trước khi code

Scope S014–S021. Tiền đề: contracts/domain đã có build và 26 meaningful tests; hoàn thiện persistence DTOs trong cùng slice. Full phase chỉ accepted khi đủ host/native evidence; Windows chưa có nên giữ UNRUN.

1. SQLite relational core: apps, workflow/draft/version, Process, assets/content, jobs/snapshot, leases/effects/review/preferences/migrations. FK/unique/check constraints, archive thay cascade-delete history. JSON payload chỉ cho bundle/typed fields/snapshot; IDs/revisions/query keys có cột riêng.
2. Thử `node:sqlite` dưới Node 24 và exact Electron runtime bằng main-only harness; atomic transaction/reopen/rollback/foreign-key/busy/backup checks. Nếu Electron không hỗ trợ thì thử maintained native driver, không tuyên bố tương thích bằng Node-only result.
3. Workflow create/save(expectedRevision)/clone/full bundle/version hash immutable. Semantic editor/compiler đến P05; shape-invalid bundle bị reject trước DB.
4. Process CRUD/schedule/fields và workspace preferences theo ID/revision. Content IDs khác assets, ordered refs bảo toàn, job snapshots pin version và typed content.
5. Lease generation monotonic và atomic claim; current owner đúng device; effect intent/attempt uncertainty bền trước dispatch. Review/cleanup dựa states, không thử side effects trên thiết bị.
6. Backup bằng SQLite API khi WAL hoạt động, integrity/schema check; restore staging và import preview/token/revisions/atomic transaction. Không thay active DB bằng corrupt/newer backup.
7. Integration tests temp DB: restart/full bundle/custom fields; stale save conflict; contention hai connections; duplicate occurrence/effect; invalid refs; archive giữ history; backup/restore và import failure rollback.

DB synchronous primitives chạy trong serialized host service/worker boundary; renderer không có SQL. Core service không nhận file path từ import/renderer làm filesystem permission. Source fixtures chỉ thuộc tests. Native smoke và SQLite metadata có receipt thật; không chạy Windows/device thì ghi riêng.
