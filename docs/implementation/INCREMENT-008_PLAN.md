# Increment 008 — remember endpoint/reconnect policies

Trước code: đối chiếu master/P08, S071/S073, IPC và one-owner policies. Increment 007 đã có Node smart-socket/manual actor; 007 enabled ACK fix đang chạy lại browser. Không lưu pairing port/PIN hoặc tự đổi USB sang legacy TCP.

1. Migration 7 append-only host-bound endpoint policies: canonical endpoint, resolved serial từ ADB ACK, desired reconnect, revision, failures/next attempt/error code. Backup qua host khác không tự connect theo host ID cũ. Không hard-limit tổng số phone; mỗi tick chỉ tối đa 2 reconnects, bounded deadline/backoff.
2. Explicit connect có checkbox remember/reconnect (mặc định được hiển thị rõ). Persist desired trước attempt nếu user chọn; trạng thái kết nối vẫn từ devices-l + metadata. Error code không chứa PIN, không suy identity từ IP/hostname. Giữ resolved alias khi ADB trả IP khác hostname.
3. Heartbeat query desired endpoints chưa connected, đến hạn. Exponential 2s→300s, không overlap scan; SDK/server unavailable thì không chạy input/reconnect loop. Unauthorized không auto-authorize; retry có backoff, hướng dẫn RSA/pairing.
4. Tắt reconnect là policy mutation expectedRevision, không disconnect hiện tại. Explicit disconnect của một device tắt policy các TCP aliases của device trước khi gửi scoped host:disconnect; không host:disconnect rỗng/all và không tác động devices khác.
5. UI list endpoints/desired/backoff trong Connection dialog, callback ACK/rollback như enabled controls; endpoint field có prefill từ policies. Pair code transient và không được tự retry.
6. Tests: host scope/restart/alias, retries bounded/nextAttempt, stale policy revisions, no duplicate sessions, disable prevents auto-connect, actual TCP fixture automatic connect/list reconciliation và UI checkbox state. Windows/physical LAN acceptance để sau implementation theo yêu cầu user.

Shutdown refinement trước sửa: explicit connect/pair giữ promise trong lifecycle set; close abort và await trước khi đóng DB. SDK configuration không được chạy khi network task còn pending. Tắt reconnect ngăn attempt kế tiếp; attempt đã gửi không được coi là đã hủy ACK. Failure status lưu bounded code, không raw ADB payload.

Review refinement trước sửa: checkbox unchecked không tạo policy mới; nếu endpoint có policy trước đó thì tắt desired của policy đó. Kết nối một lần chỉ quan sát transport, không âm thầm ghi nhớ endpoint. Thêm regression test cho cả hai trường hợp.
