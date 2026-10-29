# P00 — kế hoạch trước khi code

Scope: S001–S006, baseline V2.1. Bắt đầu ngày 26/10/2026 theo yêu cầu code liên tục; không hỏi chốt lại scope đã duyệt. Reference/source-plan đã có, production chưa scaffold khi bắt đầu.

1. Xác minh 42 reference hashes và plan/runbook, giữ checkout/feature branch hiện có.
2. Tạo workspace chỉ gồm packages có logic thực. Pin Node 24, exact pnpm/TS/test/lint dependencies và lockfile qua registry có integrity; không bật mọi postinstall.
3. Dùng cache/store dưới `.cache/` trong checkout: npm mặc định đang cố ghi `/home/agent/.npm` không có quyền. Không đổi HOME hoặc tắt TLS.
4. Tạo strict TS project references, lint, unit runner, build và CI Linux/Windows. Chạy build/typecheck/lint/tests thực, no zero-test acceptance.
5. Install frozen lần hai, kiểm generated contracts khớp registry và reference hashes.
6. Lưu receipt theo revision + commands/OS/tool versions; cập nhật trạng thái implementation riêng, không sửa plan definitions thành giả PASS. GitHub push bị 403 không chặn code local.

Acceptance: reproducible install, meaningful contracts/domain tests, build/typecheck/lint PASS trên Linux. Windows/native/hardware là các gate riêng, chưa chạy không ghi PASS. S005 chỉ pin shared toolchain; Electron/SQLite final lựa chọn sau smoke P02/S015.

Không tạo demo devices/accounts/jobs hoặc package rỗng. Dùng JSON Schema/Ajv cho wire-format workflow hiện có; runtime types và generated registry có kiểm tra parity. Coding authorization cho phép tạo/sửa source/lockfile trong task này; setup skill dùng để tái lập môi trường, không hạn chế yêu cầu code của người dùng.

Increment 006 thêm actual DB-worker concurrency tests: `build:host` được dùng chung bởi `test` và `build`, bảo đảm fresh checkout không phụ thuộc dist cũ. Kế hoạch/tiêu chí trong INCREMENT-006_PLAN.md; giữ lockfile và không thay version toolchain.

Increment 006 kiểm tra cả TypeScript của E2E harness trước browser (tests/tsconfig.ui.json); bắt biến chưa khai báo trong test thay vì đợi browser chạy. Tách khỏi negative unit fixtures có chủ đích truyền input sai kiểu.
