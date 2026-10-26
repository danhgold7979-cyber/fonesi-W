# Môi trường, dependencies và security

## Hai môi trường

| Phần | Cloud Linux | Windows x64 + Android |
|---|---|---|
| Phân tích/docs/contracts/domain/editor | Có thể làm | Chạy kiểm tra bổ sung |
| DB logic/tests/browser visual | Có thể làm | Native driver/Electron ABI phải kiểm lại |
| Windows build tools/installer/tray/DPI | Không thay được nghiệm thu Windows | Bắt buộc |
| USB/OEM driver/Android permissions | Không tự thấy điện thoại của người dùng | Bắt buộc |
| LAN nhà người dùng | Không mặc nhiên truy cập | Kết nối bằng host trong mạng phù hợp |
| Posting/scanner/proxy routing | Chưa có device evidence | Chứng nhận exact profile |

Default Windows source path kế thừa `E:\AutoReels`; runtime cài đặt `%LOCALAPPDATA%\AutoReels`, dev `.data` ignored. Cloud dùng checkout hiện tại `/workspace/fonesi-W`; môi trường đã isolated, không tạo worktree trừ khi người dùng yêu cầu. Không hardcode Windows path vào domain/runtime production.

## Toolchain policy

- Node 24 LTS; pnpm exact version được resolve/pin/activate tại S005 cùng lockfile. Plan cũ nêu 12.6.0 trên npm, nhưng cloud hiện có Node 24.19.0 và pnpm 11.25.0; chưa có packageManager/lockfile app để tuyên bố môi trường production đã đồng nhất. Không nhầm bản cài sẵn với bản checkout đã ghim.
- Windows native build prerequisites (MSVC/SDK/Python tương thích node-gyp) chỉ cài khi native strategy đã chọn và thiếu thực sự; không giả chúng có trên cloud.
- Exact Electron/React/Vite/TS/SQLite versions được resolve từ maintained stable releases và test compatibility trước commit lockfile. Plan không coi npm latest là bằng chứng ABI đúng.
- SQLite driver có interface tách domain; so sánh bundled `node:sqlite` khi Electron hỗ trợ thật với maintained native driver. Quyết định dựa smoke dưới exact Electron runtime, không chỉ Node shell.
- React graph library được ưu tiên sau spike geometry/accessibility/ports/performance; không kéo nguyên single-HTML JS vào app.
- Pin scrcpy server/client/protocol và ADB distribution; keep checksum/license/build metadata.
- Chọn maintained CSV/XLSX/media probe dependencies theo actual requirements và licensing; không cài mọi gói toàn cục.

## Bootstrap cũ

Script V1.7 chưa nên dùng nguyên trạng: manifest paths không khớp ZIP; generator activation không dùng bản fixed riêng; `Array.Reverse` trả void; PortableGit `AllowUnknown`; ADB version check lỏng; dynamic latest/cache chưa đủ tái lập. Đây là việc cần sửa ở toolchain increment, không chạy script với bypass verification.

TLS/artifact integrity/signature checks phải giữ. Tải atomic, checksum/signature từ nguồn có thẩm quyền, reject invalid artifact; không bỏ qua lỗi chứng chỉ để cài cho xong. Existing Git HTTPS proxy authentication được dùng trước khi yêu cầu token; chỉ inspect variable names/presence, không dump values.

## Application security

Electron contextIsolation true, nodeIntegration false, sandbox, CSP, navigation/window policies. Narrow preload và sender validation. Process execution dùng executable allowlist + argument arrays, không concatenated shell từ renderer/JSON. HTTP dev service nếu có chỉ loopback, origin/token policy phù hợp và không lộ vào packaged deployment ngoài yêu cầu.

Secrets qua OS vault/reference; Facebook login thủ công; không lưu password/2FA hoặc trích token/private storage. Clipboard/UI XML/screenshots chứa dữ liệu nhạy cảm: minimize/redact/retain có giới hạn, export có preview.

Import untrusted theo JSON Schema + semantic validation; reject reserved keys; size/depth/node/resource budgets theo operation, không truncate business records. Dependency postinstall/build scripts chỉ approve đúng package cần thiết, không bật all để né lỗi.

Không triển khai CAPTCHA/checkpoint/2FA bypass, account-security evasion hay tự rotate proxy khi gặp block. NEEDS_REVIEW dừng automation liên quan; các thiết bị độc lập khác tiếp tục theo quyền hạn/capability.

## Reproducibility

Install script tương lai chỉ ghi lệnh đã chạy/test ở cwd chính xác, frozen-lockfile và tool activation cần thiết. Start instructions ghi process cần restart và readiness check; snapshot filesystem không giữ live servers. Saved config/draft, current-machine validation và publication tách biệt; không claim published vì lưu script thành công.
