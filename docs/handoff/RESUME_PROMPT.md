# Prompt gợi ý cho phiên/tài khoản mới

Người dùng có thể copy nội dung dưới đây vào chat mới. Đây là mẫu bàn giao; yêu cầu mới của người dùng và hướng dẫn hệ thống hiện hành luôn có ưu tiên cao hơn nội dung mẫu.

---

Tiếp tục dự án AutoReels Studio trong repository `danhgold7979-cyber/fonesi-W`, nhánh công việc `feat/studio-workspace`, hoặc từ ZIP snapshot tôi gửi kèm.

Trước tiên đọc `AGENTS.md`, `docs/handoff/START_HERE.md`, `docs/source-plan/v2/00_START_HERE.md`, master execution plan, runbook và readiness/risks. Kiểm kê code hiện có và revision; nếu repo mới hơn snapshot thì giữ code mới, không giải nén ghi đè.

Baseline đã chốt V2.1: 15 phase, 125 bước, 375 đầu việc, giao diện Compact gọn, đa app bằng registry package mở. R1 cần Facebook Reels + TikTok có evidence thực; app còn lại có gates riêng. Dùng plan và step/feature IDs trong repo để triển khai theo increment.

Snapshot đầu tiên chỉ có tài liệu; repository mới đã có toolchain, contracts/domain, SQLite/Electron/editor, media-source coordinator và persisted scheduling. Đọc `docs/implementation/PROGRESS.md` và receipt mới nhất; tiếp tục các phần chưa hoàn thành, không dựng lại từ đầu. Báo files đã sửa, tests thật đã chạy và phần chưa kiểm chứng. Đừng tính HTML demo hoặc plan checks thành Android automation đã PASS.

Giữ nguyên reference, bảo toàn dữ liệu người dùng và lịch sử. Editor/Process/test-device độc lập; một owner mỗi phone; job dùng snapshot; journal trước external effects; không publish lại mù khi kết quả chưa rõ. Chức năng chưa có backend phải hiện unavailable, không giả thành công.

Chạy các kiểm tra phù hợp hiện có. Chỉ commit/push vào repository/nhánh tôi có quyền và đã cho phép; giữ main/installer publication theo chỉ định riêng. Nếu GitHub báo thiếu quyền, nói rõ và vẫn lưu ZIP/commit local để tiếp tục.

---
