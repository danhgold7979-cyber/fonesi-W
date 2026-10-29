# fonesi-W

AutoReels Studio — workspace thiết kế workflow và quản lý tiến trình Android đa ứng dụng.

Baseline hiện tại: [Source Plan V2.1](docs/source-plan/v2/00_START_HERE.md), được làm lại từ HTML Studio Workspace mới và runtime requirements của bộ V1.7.

**Tiếp tục bằng tài khoản/phiên khác:** [hướng dẫn bàn giao](docs/handoff/START_HERE.md), [prompt tiếp tục](docs/handoff/RESUME_PROMPT.md), [ZIP snapshots](archives/README.md). Snapshot có commit nguồn và SHA-256; tài khoản mới cần quyền GitHub tương ứng.

**Kế hoạch code toàn tool:** [master execution plan](docs/source-plan/v2/16_MASTER_EXECUTION_PLAN.md), [125 bước / 375 đầu việc](docs/source-plan/v2/17_STEP_RUNBOOK.md), [readiness và risks](docs/source-plan/v2/18_READINESS_AND_RISKS.md). Có 250 tình huống kiểm tra dự kiến; chưa phải số tests production đã chạy.

**Xem giao diện trước:** [HTML Studio Compact đầy đủ](docs/previews/AutoReels-Studio-Compact.html), [30 tiện ích thao tác gọn](docs/source-plan/v2/15_COMPACT_UX_ADDITIONS.md). Mở HTML bằng Chrome/Edge; hardware/run trong bản này là minh họa.

- [Rà soát UI và lỗi đã tái hiện](docs/source-plan/v2/01_REVIEW_REPORT.md).
- [Đặc tả từng layout và tương tác](docs/source-plan/v2/03_UI_SPEC.md).
- [15 phase / 125 bước triển khai](docs/source-plan/v2/09_PHASE_PLAN.md).
- [124 lệnh giao diện](docs/source-plan/v2/UI_ACTION_MATRIX.md).

Trạng thái hiện tại: đã bắt đầu ứng dụng React/Electron nhiều module, contracts/domain, SQLite và editor lưu thật. Android automation/stream/routing chưa có chứng nhận. HTML Compact và ZIP ngày 26/10 trước code là reference lịch sử; dùng code checkout mới nhất và `docs/implementation/` để tiếp tục.

## Phát triển và kiểm tra

**Windows 10 64-bit:** tải [ZIP nhánh phần mềm](https://github.com/danhgold7979-cyber/fonesi-W/archive/refs/heads/feat/studio-workspace.zip), giải nén, cài Node.js 24.19+ x64 rồi nhấp đúp `Start-FonesiW.bat` (hoặc `Start-AutoReels.cmd`). [Hướng dẫn tải/chạy và xử lý lỗi](docs/implementation/WINDOWS_START.md). Đây là source launcher của bản đang phát triển; installer/hardware acceptance còn riêng.

Node 24.19+ (24.x), pnpm 11.25.0. Trên cloud:

```sh
bash scripts/setup-cloud.sh
pnpm dev
```

`pnpm dev` build rồi chạy authoring host trên loopback. Dữ liệu mặc định `.data/studio.sqlite`; có thể đặt `AUTOREELS_DATA_DIR` để dùng data root riêng. `node tools/smoke-host.mjs` kiểm tra health + request bootstrap thật. Mở Electron trên máy có giao diện bằng `pnpm desktop`.

```sh
pnpm check
pnpm test:ui
```

Browser tests dùng DB tạm độc lập; cloud có Chromium sẵn thì đặt `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. Trên máy khác cài Chromium của Playwright bằng `pnpm exec playwright install chromium`. Windows DPI/native/hardware checks có gates riêng, chưa chạy không ghi PASS.

Kiểm tra tính nhất quán bộ kế hoạch:

```sh
python docs/source-plan/v2/tools/validate_plan.py
python docs/source-plan/v2/tools/validate_execution_plan.py
```

Lệnh trên kiểm tra source-plan, không chạy kiểm thử ứng dụng hoặc điện thoại. Tài liệu và kế hoạch V1.7 cũ được giữ để truy vết; V2 là baseline triển khai hiện hành.
