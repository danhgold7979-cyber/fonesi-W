# P03 — kế hoạch trước khi code

Scope S022–S028, prerequisites SQLite/IPC core. Native smoke Linux có kết quả; Windows giữ UNRUN.

1. Dựng React/Vite shell 6 route đúng Compact, không dùng single-HTML demo làm runtime. Devices/history empty states service-backed; app catalog là metadata NOT_RUN.
2. DB serialized worker với protocol private main↔worker. Renderer chỉ có named typed API qua sandboxed preload; sender/window URL, request schemas và capability checks ở host. Không SQL/shell/raw filesystem trong renderer.
3. Loopback host cho cloud UI tests dùng cùng service layer/DB worker, bind 127.0.0.1, same-origin/token check, bounded JSON request, không phục vụ ra LAN. Không tạo remote device bridge.
4. Theme/preferences và selection state tách library/editor/test-device/Process. Save status theo ACK/revision, save đang chạy không xóa dirty của edits mới. Error/cancel/unsupported có UI rõ.
5. Modal focus trap/return focus/Esc; context menu viewport/keyboard. Toolbar workflow 4 controls; panel thu gọn và tooltip/accessible labels.
6. Electron packaged-path/main/preload build riêng, CSP/navigation/window policies. Loopback startup/actual request và Electron renderer smoke không thay Windows DPI checks.
7. E2E actual DB: empty workspace → create workflow → save/reload; navigate six routes; switch library filter không đổi editor app; input shortcuts không xóa nodes; no fake devices/posts.

Giữ desktop min-window 1100×720, token styles/rail/header/footer theo UI spec. Windows DPI/multi-monitor/tray không ghi accepted khi chưa chạy host thật. Desktop security flags production không giảm chỉ để headless test chạy.
