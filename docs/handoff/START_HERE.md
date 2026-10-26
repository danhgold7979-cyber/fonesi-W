# Mở lại AutoReels bằng tài khoản hoặc phiên làm việc khác

Snapshot ngày 26/10/2026: AutoReels Studio, baseline V2.1, execution plan 1.0. Gói này lưu các file dự án để tiếp tục làm việc độc lập với lịch sử cuộc chat. Tại thời điểm bàn giao có tài liệu, reference, HTML review và công cụ kiểm tra; **chưa có ứng dụng Electron production hoặc automation Android đã nghiệm thu**.

## 1. Mở từ GitHub

Repository: `danhgold7979-cyber/fonesi-W`. Nhánh công việc: `feat/studio-workspace`; main chưa được merge các thay đổi này. Việc đẩy snapshot chỉ thành công khi GitHub trả kết quả thành công; ZIP và commit local không tự chứng minh đã upload.

1. Tài khoản GitHub mới cần quyền đọc repository để mở và quyền Write để push. Chủ repo có thể mời tài khoản đó làm collaborator; người được mời cần chấp nhận lời mời. Nếu repo private, link đơn thuần không cấp quyền truy cập.
2. Kết nối tài khoản GitHub có quyền vào phiên Codex/ChatGPT mới, chọn đúng repository và nhánh trên. Lịch sử chat/cấu hình phiên cũ không tự chuyển theo tài khoản.
3. Đọc `AGENTS.md`, file này và `docs/source-plan/v2/00_START_HERE.md`. Dùng prompt trong `RESUME_PROMPT.md` để giao việc tiếp.
4. Trước khi sửa, kiểm tra `git status`, revision và code hiện tại. Nếu repo đã có code mới hơn snapshot thì tiếp tục revision mới, không giải nén snapshot cũ đè lên nó.

Nếu dùng Git trên máy riêng:

```sh
git clone --branch feat/studio-workspace https://github.com/danhgold7979-cyber/fonesi-W.git
cd fonesi-W
```

Xác thực bằng tài khoản có quyền thông qua Git credential manager của máy. Gói bàn giao không chứa password, token hoặc credential của phiên hiện tại.

## 2. Mở từ ZIP

1. Tải ZIP cùng file `.sha256`. Kiểm tra SHA-256 trước khi giải nén. PowerShell dùng `Get-FileHash -Algorithm SHA256 <file.zip>`; Linux dùng `sha256sum -c <file.zip.sha256>` tại thư mục chứa hai file.
2. Giải nén vào thư mục mới. Mở thư mục `AutoReels-Studio`, đọc `SNAPSHOT.json` và `SHA256SUMS` để biết commit nguồn và hashes của từng file.
3. Mở `docs/previews/AutoReels-Studio-Compact.html` bằng Chrome/Edge để xem đủ sáu màn hình. Đây là preview có dữ liệu minh họa; các lệnh hardware chưa hoạt động.
4. Nếu đưa ZIP sang chat mới, gửi kèm yêu cầu tiếp tục và nội dung `docs/handoff/RESUME_PROMPT.md`. Khả năng upload còn phụ thuộc giới hạn của ứng dụng; gói hiện tại khoảng 8 MB.
5. ZIP là snapshot file tại commit ghi trong metadata. Lịch sử Git và các commit tiếp theo được lấy từ repository. Để push về repo cũ vẫn cần quyền GitHub; giải nén ZIP không cấp quyền đó.

## 3. Đọc và kiểm tra trước khi code

Đọc theo thứ tự:

1. `AGENTS.md` và `README.md`.
2. `docs/source-plan/v2/00_START_HERE.md`.
3. `16_MASTER_EXECUTION_PLAN.md`, `17_STEP_RUNBOOK.md`, `18_READINESS_AND_RISKS.md` trong cùng thư mục plan.
4. Contracts liên quan: UI/data/runtime/IPC/operations và các registries JSON.
5. Source code thực tế nếu đã được bổ sung ở revision mới hơn.

Chạy từ repository root bằng Python 3:

```sh
python docs/source-plan/v2/tools/validate_plan.py
python docs/source-plan/v2/tools/validate_execution_plan.py
```

`jsonschema` cho phép chạy thêm kiểm tra workflow schema của plan. Nếu thiếu, checker thứ nhất ghi rõ phần đó NOT_RUN. Playwright/Chromium chỉ cần khi chạy browser checks; không cần chúng để đọc tài liệu hoặc mở HTML. Kiểm tra plan không phải kiểm thử ứng dụng/Windows/điện thoại.

## 4. Điểm tiếp tục và những điều đã chốt

- 15 phase / 125 bước / 375 đầu việc / 250 tình huống dự kiến. 330 feature IDs đã có mapping cụ thể. Các con số này mô tả kế hoạch, không là production tests đã PASS.
- Giao diện gọn theo Compact; bốn controls workflow chính. Các quyết định C01–C12 đã được ghi trong plan.
- Increment đầu: repository/toolchain/lockfile/checks, contracts/domain, rồi native SQLite/Electron smoke và luồng workflow create/edit/save/reload. Không tạo mọi package rỗng hoặc biến HTML demo thành app production.
- Authoring/editor, Process bindings và Inspector test device độc lập. Mỗi phone có một active owner/job, lịch riêng mỗi Process.
- Giữ nguyên 42 reference files; `.gitattributes` giữ bytes reference khi checkout trên Windows/Linux.
- FULL-TRANSFER ZIP quá giới hạn 32 MiB chưa đọc được và không có trong snapshot; không tuyên bố đã tích hợp nó. Baseline đã chọn xây mới từ V1.7 + HTML đã đọc.
- Hardware/native/routing/OCR/publish verification/benchmark vẫn phải kiểm chứng. Từ S069/S070 cần điện thoại cho nghiệm thu kết nối; cloud không tự thấy USB/LAN ở nhà.
- Lần push trước GitHub trả 403 cho tài khoản `sanfrankim`. Quyền ghi cần được giải quyết trước upload; code/test/commit local vẫn làm được.

## 5. Hai tài khoản cùng làm

Cùng repository, mỗi người/phiên dùng nhánh riêng cho công việc đang làm; chia module và step IDs trước khi sửa. Commit/push thường xuyên, cập nhật từ nhánh chung rồi review/merge theo quyền được cấp. Tránh hai phiên ghi cùng file trên cùng nhánh mà không đồng bộ. Ghi tiến độ và evidence vào repo để người sau đọc được; thông tin chỉ nằm trong chat sẽ không đủ để tiếp tục chính xác.

## 6. Tạo snapshot mới

Sau khi source/docs đã commit, chạy từ repository root:

```sh
python tools/handoff/create_snapshot.py --output archives/AutoReels-Studio-Handoff-next.zip
```

Tool lấy file từ commit HEAD, thêm commit/branch metadata và file hashes, loại các ZIP cũ khỏi snapshot để tránh lồng archive. Nó tạo ZIP, sidecar SHA-256 và receipt, xác minh CRC/hashes; không tự upload hoặc chứa `.git`/runtime data bị ignore. Commit/push ZIP mới là thao tác tiếp theo, cần quyền GitHub.
