# Snapshot bàn giao

Gói `AutoReels-Studio-Handoff-V2.1-2026-10-26.zip` lưu toàn bộ file được Git theo dõi tại commit nguồn, kèm `SNAPSHOT.json` và `SHA256SUMS` bên trong. ZIP cũ được loại khỏi nội dung để tránh archive lồng nhau.

- Tải ZIP, file `.sha256` và `-receipt.json` trong thư mục này. Trên GitHub chọn ZIP rồi **Download raw file**.
- Đọc `docs/handoff/START_HERE.md` sau giải nén để tiếp tục bằng tài khoản khác.
- Đây là snapshot source/plan/HTML review; app production và Android automation chưa triển khai tại checkpoint này.
- Lịch sử Git được lưu bằng các commit trong repository; mỗi ZIP có commit nguồn chính xác trong metadata.
- Quyền repository do GitHub quản lý. Tài khoản mới cần quyền đọc/ghi tương ứng; ZIP không chứa credentials và không chuyển lịch sử chat.

Snapshot local chỉ xuất hiện trên GitHub khi push thành công. Nếu nhận 403, cần cấp quyền Write hoặc kết nối tài khoản có quyền rồi push nhánh `feat/studio-workspace`.
