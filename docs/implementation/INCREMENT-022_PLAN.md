# Increment022 — P00/S005, P14/S119 reproducible Windows source startup

Plan trước code. Phát hiện read-only GitHub run40457121431 ở commit7b0cfc7: Windows stop tại `check:generated`, generated node-registry.ts bytes khác. `.gitattributes` chỉ giữ reference/ZIP, chưa khóa LF source; runner autocrlf chuyển checkout thành CRLF. Linux đã chạy checks. Không regenerate/normalize frozen reference để che lỗi.

1. Reproduce git checkout-index với core.autocrlf=true vào temp fixture (không worktree/clone/reset). Thêm default text auto/eol LF, override frozen docs/reference và binaries giữ nguyên byte; không renormalize repository. Generated check vẫn strict byte parity, không bỏ check hoặc sửa output baseline.
2. Windows PowerShell5.1 compatible setup script kiểm Node24.19+/24.x, exact pnpm11.25.0 hoặc install cục bộ, local cache paths, frozen install/official Electron installer, propagate exit errors. Separate start script + root CMD cho user double-click (Node cần cài trước), giữ app userData/default và envoverride, không cấp admin/kill resources.
3. CI fail-fast false để có đủ kết quả hai OS. Windows dùng setup script thực rồi full `pnpm check` và Python plan validators; Linux giữ frozen install. Không auto deploy/merge/publish installer.
4. Docs tải branch chính xác/ZIP/setup/desktop/data/Android SDK và limitations, sửa lỗi thường gặp bằng mã lỗi. Source launcher không được gọi là installer/portable/offline bundle.
5. Local strict generation/plan/tests/build + git forced-autocrlf checkout parity/reference hashes. Commit/push authorized branch; đọc Windows CI log thực, sửa lần lượt lỗi platform tiếp theo nếu lộ ra. Chỉ ghi Windows CI PASS sau remotejob hoàn thành; Win10 GUI/phones vẫn NOT_RUN.
