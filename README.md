# fonesi-W

AutoReels Studio — workspace thiết kế workflow và quản lý tiến trình Android đa ứng dụng.

Baseline hiện tại: [Source Plan V2.1](docs/source-plan/v2/00_START_HERE.md), được làm lại từ HTML Studio Workspace mới và runtime requirements của bộ V1.7.

**Kế hoạch code toàn tool:** [master execution plan](docs/source-plan/v2/16_MASTER_EXECUTION_PLAN.md), [125 bước / 375 đầu việc](docs/source-plan/v2/17_STEP_RUNBOOK.md), [readiness và risks](docs/source-plan/v2/18_READINESS_AND_RISKS.md). Có 250 tình huống kiểm tra dự kiến; chưa phải số tests production đã chạy.

**Xem giao diện trước:** [HTML Studio Compact đầy đủ](docs/previews/AutoReels-Studio-Compact.html), [30 tiện ích thao tác gọn](docs/source-plan/v2/15_COMPACT_UX_ADDITIONS.md). Mở HTML bằng Chrome/Edge; hardware/run trong bản này là minh họa.

- [Rà soát UI và lỗi đã tái hiện](docs/source-plan/v2/01_REVIEW_REPORT.md).
- [Đặc tả từng layout và tương tác](docs/source-plan/v2/03_UI_SPEC.md).
- [15 phase / 125 bước triển khai](docs/source-plan/v2/09_PHASE_PLAN.md).
- [124 lệnh giao diện](docs/source-plan/v2/UI_ACTION_MATRIX.md).

Trạng thái: tài liệu, reference, HTML review và evidence browser đã có; ứng dụng production chưa được scaffold. Thiết bị trong HTML là dữ liệu mẫu, chưa có chứng nhận Android/automation thực.

Kiểm tra tính nhất quán bộ kế hoạch:

```sh
python docs/source-plan/v2/tools/validate_plan.py
python docs/source-plan/v2/tools/validate_execution_plan.py
```

Lệnh trên kiểm tra source-plan, không chạy kiểm thử ứng dụng hoặc điện thoại. Tài liệu và kế hoạch V1.7 cũ được giữ để truy vết; V2 là baseline triển khai hiện hành.
