# P08 — device backend, kế hoạch trước code

User tiếp tục yêu cầu hoàn thiện implementation trước, nghiệm thu Windows/Android sau. Đối chiếu master V2.1 và S069–S076/S077, IPC/capability/ownership/operations. Không dùng thiếu điện thoại làm lý do bỏ implementation; giữ trạng thái code/tests/physical acceptance riêng.

1. Device contracts phân biệt registered/connected/authorized/enabled/identity/transport/generation, owner và manual/stream/automation capabilities. Không lấy catalog app hoặc device record cũ làm bằng chứng kết nối.
2. Platform Tools discovery từ cấu hình host/native picker hoặc installed PATH. Canonical binary grant/hash/version, bounded exec argv, cancel/timeout, không shell input arbitrary. Known distribution/checksum/license metadata khi bundle, không bịa checksum.
3. Coexistence trước lệnh ADB: probe smart-socket host:version, không gọi client làm auto-kill shared server mismatch. Reuse compatible shared 5037; nếu user khởi động server riêng thì foreground child port riêng, ghi owner và chỉ dừng child do app tạo. Không adb kill-server/disconnect-all/remove-all forwards.
4. USB parse devices -l; unauthorized/offline/no-permissions khác connected; poll/backoff/cancel + generation. Đọc properties chỉ khi authorized, không auto-authorize RSA/OEM.
5. Wireless endpoint validate IPv4/IPv6/hostname + port, pairing code không logs/DB, explicit cancel/deadline, device-level outcome từ observed re-scan thay vì text toast success.
6. Stable device evidence từ ro.serialno/ro.boot.serialno + manufacturer/product; USB/LAN cùng evidence dùng một device/queue. Chưa có evidence thì giữ provisional transport identity; collision/unknown không tự merge mất history. Persist labels/enabled; connected state thuộc host/session, reset trước discovery mới.
7. Shared DB leases cho Manual/Inspector/job/APK/network; actor serial per phone, bounded concurrency fleet. Assert transport generation + lease ngay trước input. Timeout không giả ACK, không tự retry input; release/redetect và retain effect uncertainty.
8. Metadata/packages/version/foreground, screenshot bytes thật; manual tap/swipe/key và quick app/system actions qua validated commands. Quote Android shell arguments, không nhầm exec argv an toàn với remote shell an toàn. Unicode/text/provider unsupported rõ trước khi có transport chứng minh được.
9. Device UI gọn: scan/connect/pair/native SDK picker/diagnostic, search/selected/active/enabled/grid; Tools 3 tabs nối providers. Screenshot tĩnh khác stream; actual stream/control protocol/decoder ở P09 sau spike S077–S079.
10. Tests actual TCP protocol segmentation/timeouts/cancel; actual subprocess fixture binary cho argv/binary/timeout/remote quoting; DB identity/reconnect/scope/ownership races; UI missing/empty/unauthorized/busy/partial states. Test adapters chỉ trong fixtures.

Kế hoạch tiểu bước hiện tại: INCREMENT-007_PLAN.md. P08 có code chưa đồng nghĩa G4/G5 đã nghiệm thu; Android/Windows receipts để bước nghiệm thu theo yêu cầu người dùng.
