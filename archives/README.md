# Snapshot bàn giao

Bản mới nhất: **AutoReels-Studio-Code-Checkpoint-004-2026-10-26.zip**. Có source React/Electron/SQLite/editor, media coordinator, typed content CSV/JSON/XLSX/bulk preview/apply, virtualized table và private queue claim/recovery. Đây là source checkpoint, chưa phải installer; Android automation và nghiệm thu Windows chưa hoàn thành. Xem `docs/implementation/PROGRESS.md` sau giải nén.

| Gói | Phạm vi tại commit nguồn |
|---|---|
| `AutoReels-Studio-Code-Checkpoint-004-2026-10-26.zip` | Typed Process inputs/import/bulk/virtualization và queue ownership; 125 unit/integration tests, 8 browser scenarios; chưa Android runtime |
| `AutoReels-Studio-Code-Checkpoint-003-2026-10-26.zip` | Increment native media + persisted scheduling; 98 unit/integration tests, 5 browser scenarios tại code revision ghi trong receipt |
| `AutoReels-Studio-Code-Checkpoint-2026-10-26.zip` | Checkpoint code trước đó: editor/ledger/readonly schedule preview |
| `AutoReels-Studio-Handoff-V2.1-2026-10-26.zip` | Snapshot đầu: source-plan/reference/HTML review, chưa có app implementation ở commit đó |

Mỗi ZIP chứa các file được Git theo dõi tại commit nguồn, thêm `SNAPSHOT.json` và `SHA256SUMS`. ZIP cũ bị loại khỏi nội dung để tránh lồng archive. Mỗi gói có `.zip.sha256` và `-receipt.json` cạnh bên; chọn ZIP trên GitHub rồi **Download raw file**.

Đọc `docs/handoff/START_HERE.md` để tiếp tục bằng tài khoản khác. GitHub quản lý quyền đọc/ghi repository; ZIP không chứa credentials hoặc lịch sử chat. So sánh commit trước khi dùng: không giải nén snapshot cũ đè code mới hơn. Metadata và receipt ghi commit nguồn cùng phạm vi kiểm chứng; kiểm tra ZIP không đồng nghĩa kiểm thử điện thoại.
