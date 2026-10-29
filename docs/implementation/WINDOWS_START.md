# Tải và chạy trên Windows 10 64-bit

Đây là bản nguồn đang phát triển trên nhánh `feat/studio-workspace`. Chạy giao diện/authoring và các khả năng đã có code; xem PROGRESS.md để biết phần automation còn thiếu. Chưa phải bộ cài Windows đã nghiệm thu.

1. Cài **Node.js24.19+ thuộc dòng24.x, x64** từ <https://nodejs.org/download/release/>. Mở lại cửa sổ terminal sau khi cài để PATH cập nhật. Node kèm npm; không cần tự cài pnpm toàn máy.
2. Tải [ZIP đúng nhánh phần mềm](https://github.com/danhgold7979-cyber/fonesi-W/archive/refs/heads/feat/studio-workspace.zip), giải nén vào một thư mục bạn có quyền ghi, ví dụ `D:\AutoReels Studio`. Repo riêng tư yêu cầu đăng nhập tài khoản GitHub có quyền. Nhánh `main` hiện chỉ là README; tải main sẽ thiếu mã chạy.
3. Nhấp đúp **Start-FonesiW.bat** (hoặc `Start-AutoReels.cmd`) trong thư mục đã giải nén. File BAT chỉ gọi launcher hiện có để tránh hai luồng setup khác nhau. Lần đầu script tải dependencies và Electron đã pin, build rồi mở desktop; cần Internet trong lần setup. Terminal giữ lỗi nếu setup/build thất bại. Script chạy theo quyền người dùng hiện tại.
4. Trong ứng dụng, mở **Chẩn đoán / Sao lưu** để xem SQLite/đĩa/RAM và tạo backup đã kiểm tra. Bản sao chỉ chứa DB; giữ media nguồn riêng. Desktop mặc định dùng thư mục userData của ứng dụng trong AppData; `AUTOREELS_DATA_DIR` chỉ thay root khi bạn chủ động đặt biến đó.
5. Kết nối điện thoại theo [DEVICE_HOST_GUIDE.md](DEVICE_HOST_GUIDE.md): chọn Platform-Tools/adb.exe thật, bật USB debugging và tự xác nhận RSA trên điện thoại. Cloud không thấy các điện thoại USB cắm vào PC của bạn. Catalog đa app không phải chứng nhận đăng Facebook/TikTok tự động.

Nếu dùng Git thay ZIP:

```powershell
git clone --branch feat/studio-workspace --single-branch https://github.com/danhgold7979-cyber/fonesi-W.git
cd fonesi-W
.\Start-AutoReels.cmd
```

Chạy kiểm tra nguồn bằng Windows PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
```

`-ExecutionPolicy Bypass` chỉ áp dụng cho tiến trình launcher này; không thay policy toàn máy. Máy do tổ chức quản lý có policy bắt buộc cần chạy theo chính sách của quản trị viên. `setup-windows.ps1` mặc định chạy `pnpm check`; launcher dùng setup không lặp checks rồi build. `start-windows.ps1 -VerifyOnly` chỉ kiểm build/executable và không mở cửa sổ desktop; nó không thay nghiệm thu GUI.

| Lỗi | Cách xử lý |
|---|---|
| NODE_MISSING / NODE_VERSION | Cài Node24.x x64 đúng phiên bản, mở lại terminal/launcher; kiểm `node --version`. |
| DEPENDENCY_INSTALL | Đọc lỗi mạng/quyền ghi phía trên; giải nén ngoài Program Files, kiểm kết nối rồi chạy lại. Giữ nguyên pnpm-lock.yaml. |
| ELECTRON_INSTALL | Kiểm proxy/kết nối tải artifact; chạy lại để official installer xác minh checksum. |
| Generated contract is stale | Dùng checkout mới với .gitattributes; `git -c core.autocrlf=false clone --branch feat/studio-workspace ...` hoặc tải ZIP. Giữ byte LF, không sửa reference. |
| SDK_MISSING / SERVER_MISSING / Chờ cấp quyền | Chọn đúng adb.exe, khởi động server riêng nếu cần và xác nhận quyền trên Android theo hướng dẫn thiết bị. |
| DISK_LOW | Giải phóng đủ chỗ chứa DB/WAL và64MiB dự phòng; thử lại cùng ID backup. |

Mục tiêu của bạn là20 điện thoại, tăng dần khoảng300. Hãy nghiệm thu lần lượt1→2→20 máy rồi mới đo100/300; số đăng ký khác số tác vụ/stream đồng thời. Win10 GUI/DPI/USB/LAN và app-specific posting/verification vẫn cần biên bản riêng. Không thay/xóa DB cũ khi cập nhật nguồn; tạo backup trước, giữ media và đọc schema/upgrade gates trong completion tracker.
