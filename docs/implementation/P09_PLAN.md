# P09 — Inspector, stream và control, kế hoạch trước code

Đối chiếu master, S077–S085, IPC, ownership và operation policies. P08 smart-socket/manual backend có code/tests; hardware acceptance còn NOT_RUN. Không chờ physical acceptance để triển khai tiếp các phần độc lập.

1. Stream cần provider/decoder có protocol/frame evidence; không gắn nhãn video cho vòng chụp ảnh. Profile/visibility/backpressure/ownership và popup sessions triển khai theo provider thực; chưa có provider giữ stream unsupported.
2. Inspector S082/083: snapshot đọc-only có XML nodes + screenshot thật, cùng device/profile/transport generation/rotation/foreground, bounded capture interval. UI phân biệt frozen snapshot và trạng thái hiện tại. Android không atomic XML+PNG: chỉ tuyên bố bounded correlation, không giả atomicity.
3. XML parse strict streaming library, reject DTD/entities, bounded byte/node/depth/text/coordinates. Không eval XPath/JS; selector DSL whitelist JSON exact/contains trên resourceId/text/description/class/package/flags. Ambiguous/zero match rõ, không tự chọn đầu tiên.
4. Pick tọa độ chọn phần tử nhỏ nhất chứa điểm, tree/search/highlight/bounds và selector copy. Read-only mặc định, không gửi touch khi pick; control consent riêng. App custom/multi-platform dùng package từ cây thực.
5. Inspector test device độc lập Process. Tích hợp editor phone panel sau shared Inspector implementation; không đổi Process binding khi chọn máy test. Mọi input vẫn qua actor/lease/fence P08, snapshot cũ không tự chạy.
6. Tests parser hostile/malformed/limits/entities, selector semantics/ambiguity, correlation rotation/foreground/timeout, real TCP fixture XML/PNG và browser pick/search/copy. Windows/device/video/OCR/Unicode/group/popup acceptance ghi riêng, không certify app từ parser PASS.

Tiểu bước đầu: INCREMENT-009_PLAN.md. Không gọi toàn P09 complete khi stream/group/popup chưa có.
