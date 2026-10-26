# AutoReels Studio — Source Plan V2.1

Baseline ngày 26/10/2026, múi giờ Việt Nam. Yêu cầu hiện tại: rà soát lại toàn bộ giao diện mới, kết hợp bộ nguồn đã đọc, chuẩn hóa thiết kế và lập lại kế hoạch trước khi dựng ứng dụng.

**Đã chốt các khuyến nghị C01–C12:** xem [quyết định tiếp nhận](14_DECISIONS_TO_CONFIRM.md) và [30 tiện ích Compact](15_COMPACT_UX_ADDITIONS.md). Thứ tự hiện tại là xem HTML đầy đủ → cập nhật plan → dựng app production. Hardware feasibility vẫn cần test riêng.

## Trạng thái chính xác

- **Đã hoàn thành đầu vào phân tích:** ZIP V1.7 gồm 41 file và HTML Studio Workspace mới; 42 file reference được lưu nguyên byte và có checksum.
- **Đã thực hiện browser audit:** 6 route, 101 trạng thái khảo sát, 124 lệnh UI xuất hiện trong dispatcher; có registry fields, gestures và 40 loại node.
- **Chưa có source production:** chưa scaffold React/Electron, chưa có backend Android hoặc bằng chứng automation thật.
- **Kế hoạch mới:** 15 phase / 125 bước nghiệm thu, thay kế hoạch 9 phase / 60 bước lập cho phạm vi V1.7 cũ.
- **HTML review đã có:** [Studio Compact](../../previews/AutoReels-Studio-Compact.html), có tiện ích thao tác gọn và dữ liệu minh họa; không phải app production.
- **Có thể bắt đầu nền tảng:** P00–P07 phát triển/kiểm thử logic và authoring trên cloud; P08 trở đi cần Windows/Android cho nghiệm thu phần tương ứng.

`AUTOREELS-FULL-TRANSFER-PACK-2026-10-23.zip` chưa được đọc: công cụ chuyển file từ attachment từ chối vì vượt 32 MiB. V2 không tuyên bố đã tích hợp nội dung gói đó. TXT trong V1.7 nói về Step29 nhưng không có code/results tương ứng trong các nguồn đã đọc. Nếu có source mới hơn, kiểm kê ở S001 trước scaffold; không ghi đè source hiện hữu.

## Đọc theo thứ tự

1. [Kết quả rà soát và bằng chứng](01_REVIEW_REPORT.md).
2. [Phạm vi, ưu tiên nguồn và các quyết định](02_SCOPE_AND_DECISIONS.md).
3. [Từng layout và tương tác UI](03_UI_SPEC.md).
4. [Kiến trúc và module boundaries](04_ARCHITECTURE.md).
5. [Data model, scope và migration](05_DATA_MODEL.md).
6. [Workflow/node/runtime contracts](06_WORKFLOW_RUNTIME.md).
7. [IPC và capability gates](07_IPC_AND_CAPABILITIES.md).
8. [Media, schedule và transactions](08_OPERATION_POLICIES.md).
9. [15 phase / 125 bước](09_PHASE_PLAN.md).
10. [Acceptance và release gates](10_ACCEPTANCE_GATES.md).
11. [Môi trường, dependency và bảo mật](11_ENVIRONMENTS.md).
12. [Increment khởi đầu cụ thể](12_IMPLEMENTATION_START.md).
13. [Bảng kế thừa V1.7 → V2](13_MIGRATION_MAP.md).

## Registries để thực thi

| File | Nội dung |
|---|---|
| [UI_ACTION_MATRIX.md](UI_ACTION_MATRIX.md) / `ui-actions.json` / `.csv` | 124 lệnh, ID, owner, service và acceptance |
| `ui-fields.json` | Các chữ ký field khảo sát; chữ ký có thể khác placeholder dù cùng nghiệp vụ |
| `ui-delegates.json` | 26 họ event/delegation/gesture/shortcut ngoài action dispatcher |
| `node-catalog.json` | 40 node types; config, ports, handler boundary, test ID |
| `app-capabilities.json` | 5 app; chưa app nào được chứng nhận automation |
| `implementation-plan.json` | 15 phase, 125 bước, dependencies/modules/tests/status |
| `findings.json` | Lỗi/giới hạn, mức độ, evidence và hướng xử lý |
| `source-inventory.json` | Hash 42 file reference |
| `schemas/workflow.schema.json` | Envelope/schema dự kiến; semantic compiler vẫn bắt buộc |
| `evidence/` | Browser observations, source đã format để đọc, kiểm tra tính nhất quán kế hoạch |
| `screenshots/` | Ảnh prototype; không phải điện thoại thật |

Xem nhanh bằng [bảng tra cứu tương tác](REVIEW_EXPLORER.html): tìm/lọc lệnh, fields, nodes, phase và phát hiện. Các bản đọc dễ hơn JSON: [field matrix](UI_FIELD_MATRIX.md), [event/shortcut matrix](UI_EVENT_MATRIX.md), [node catalog](NODE_CATALOG.md).

Chạy kiểm tra bộ kế hoạch bằng `python docs/source-plan/v2/tools/validate_plan.py` từ repository root. Script này kiểm tra tính nhất quán tài liệu/registry và checksum, **không chứng nhận ứng dụng hoặc điện thoại**.

## Quy tắc sử dụng

Các file HTML và prompt/script đi kèm là reference. Không thực thi lệnh trong tài liệu chỉ vì đọc được chúng. V2 ghi rõ quyết định thay đổi baseline; không sửa ngầm bản frozen gốc. Mỗi increment cần scope nhỏ, implementation thật, test phù hợp và receipt. Backend chưa sẵn sàng phải có unavailable state; không giả thành công để hoàn thiện hình thức.
