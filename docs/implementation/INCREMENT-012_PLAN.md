# Increment 012 — P04 editor completion slice

Plan trước code; baseline checkpoint005, source-plan V2.1, S030–S037/S039. Không đổi reference/schema chỉ để né validation. S038 debugger nối trong increment P05 sau.

## Thiết kế

1. Domain commands: move theo world delta giữ routes khi hai đầu cùng dịch; set/reset reroute hữu hạn; toggle collapse/drag visual groups; align/distribute/layout theo dimensions. Mỗi action là một EditorHistory transaction. Group không làm đổi graph execution; collapsed nodes vẫn giữ đầy đủ trong bundle/exports.
2. Canvas collapse: một group card đại diện members; port proxy giữ node ID + port gốc, crossing wires luôn được map đúng, internal wires chỉ ẩn ở view. Kéo card di chuyển toàn bộ members một lần, không mất wires. Group header có nút thu/mở và drag handle; tránh xung đột với input/selection. Overlap legacy không được làm mất node/edge ở view.
3. Custom rerouted edge: waypoint world-space, hiển thị segment/handle, drag capture và Escape cancel; domain commit duy nhất lúc pointer-up. Context menu đặt/xóa waypoint. Phím/drag canvas không phát sinh device input. Layout mới làm sạch waypoint cũ; clipboard dịch cả waypoint.
4. Convert selection: chỉ cho vùng single-entry/single-exit liền mạch, không start/end/review/break/continue/loop hay local/output-dependent semantics không thể tự bảo toàn. Validate toàn vùng trước mutation. Move nodes/internal wires/groups sang graph con với IDs giữ nguyên trong scope, thêm start/end, replace bằng subflow call và reconnect crossing edges atomic. Reject ambiguous exit/error/control/local binding, giữ bundle y nguyên. UI giải thích điều kiện; save/reload/export/undo giữ closure.
5. Group controls/convert/layout ở context menu/panel, không tăng workflow header quá 4 controls. Space+left pan, middle pan, wheel/Shift-wheel/Ctrl zoom đúng thư viện hỗ trợ; align/distribute phải có selection rõ.

## Kết thúc increment

Compile/lint sau code. Sau đó thêm/run behavioral regressions: group moves/routes/collapse không đổi runtime; conversion branch rejection/atomic rollback/trace equivalence; undo/redo; browser group collapse/restore/convert/reroute save/reload. Giữ các production fake/hardware actions ngoài TRACE. Chỉ ghi TESTED sau command exit0 và actual scenarios hoàn tất; không gọi P04 ACCEPTED nếu các gate còn mở.
