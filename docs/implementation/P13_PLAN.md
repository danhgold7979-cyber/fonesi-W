# P13 — Operations implementation plan

Scope S112–S118 theo V2.1. Phases thiết bị/execution đang partial; các lát độc lập của vận hành vẫn có thể thực hiện. Không biến diagnostics thành chứng nhận app/hardware hoặc số máy đã test.

1. Named host services cho resource/health/backup, không arbitrary shell/SQL/path từ renderer. Runtime status dựa process/statfs/SQLite/ADB thật; unavailable/errors có mã rõ. Diagnostic export dùng allowlist, không raw fields/credentials/source paths/device serials/clipboard.
2. SQLite online backup qua serialized worker, integrity/schema/checksum validate, metadata/sha256 receipt persisted và retry có ID. Lưu app-owned directory, chặn symlink/path traversal/overwrite và disk budget; không xóa lịch sử hoặc source media. Restore cần explicit validated preview và quiesce gate riêng, không thay active DB trong lát backup này.
3. APK/network tools giữ shared per-device owner/transport generation; credentials chỉ refs và redacted, không auto rotate/bypass challenge. Implement providers sau profile/evidence tương ứng, giữ unsupported reason khi chưa có.
4. Logs/correlation/notifications/retention, safe export và recovery gắn journal thực. Disk critical chặn staging trước input; tray/sleep/resume/shutdown checkpoint theo safe point, không replay uncertain publish.
5. Scale target Windows10 x64,20→300 registered phones. Tách registry/worker/stream concurrency và memory budgets; phải đo workload20/100/300 trên host/USB/LAN trước công bố throughput. Cloud logic/browser/performance fixtures là evidence riêng.

Increment021: chỉ health/allowlisted diagnostic và verified local backup; kế hoạch chi tiết bên cạnh. Native Windows, power/physical fleet acceptance và full P13 giữ NOT_RUN/PARTIAL.
