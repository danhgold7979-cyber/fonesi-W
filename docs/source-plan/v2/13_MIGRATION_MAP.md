# V1.7 → Studio V2: giữ, đổi và bổ sung

| Chủ đề V1.7 | Baseline V2 | Cách xử lý |
|---|---|---|
| Facebook-only UI chính | Studio authoring 5 app | UI mới là reference; certification từng app vẫn bắt buộc |
| Single HTML frozen V17 | Multi-file Electron/React/TS | Giữ nguyên HTML reference, không expand thành production |
| Workflow read-only fixed stages | Editable graph + subflows + typed runtime | Dựng node registry/compiler/interpreter; giữ detect/verify/delay invariant |
| Campaign một folder | Process + SourceBinding + typed items | Folder default còn; manual/text/multi-asset được bổ sung |
| Không affiliate field riêng | Optional affiliate field theo workflow schema | Latest UI thắng; không tự nối link vào comment |
| 06:00/12:00/18:00 | 08:00/12:00/19:00 default mới | Import giữ giá trị cũ, snapshot job không đổi |
| Login/scan Facebook | App-specific sessions/targets | Manual login/no private token extraction giữ; adapters riêng |
| Nick/Page metrics | Identity metrics theo app capability | Không fabricate, missing `—`; đặt trong relevant UI, không ép mọi app có Page |
| 1 device/1 job + manual lock | Worker lease/fencing chung mọi app | Giữ mạnh hơn; APK/network/Inspector cùng phối hợp |
| POST/COMMENT transactions | Generic ExternalEffect journal | Durable uncertainty trước side effect; comment independent |
| Safe staging D-033 | Owned ledger, multi-asset lifecycle | Cleanup sau SUCCESS initial; không xóa user library |
| Overview/detail/MASTER/broadcast | Device grid + Inspector + advanced group control | Giữ capability trong device tools, không gán preview mock là stream |
| Proxy/VPN/APK | Device tools/network modules | Không xuất hiện đầy đủ trong HTML mới nhưng không tự bỏ scope cũ |
| CPU/RAM/GPU/disk strip | Diagnostics/system metrics | Giữ backend capability, shell mới không bắt buộc strip V17 |
| SQLite/native ABI/recovery | Versioned data services + driver compatibility gate | Giữ; chưa claim driver hoạt động dưới Electron |
| DEV_ONLY step/error/reset | Trace/debug sessions tách REAL | Interactive debug là feature có engine; forced result/mock data chỉ fixtures |
| No device/video cap | Virtualize/query/bounded active resources | Giữ; operation safety budgets không phải truncate records |
| Windows Gate A toàn bộ trước scaffold | Cloud foundation + Windows/hardware gates | Ghi quyết định mới, không false PASS trên Linux |
| 17 phases trong pack | 15 phase/125 steps V2 | Tái phân nhóm theo dependencies, thêm editor/engine/schema/app adapters |
| Kế hoạch phân tích trước 9/60 | Superseded cho Studio baseline | Giữ file cũ để truy vết, không dùng tracker cũ để báo tiến độ mới |

`legacy-feature-map.json` liệt kê từng ID của 121 traceability rows V1.7 và phase V2 tiếp nhận. Đây là coverage mapping yêu cầu, không phải báo rằng 121 feature đã implement/accepted. Các source-command IDs mới không one-to-one với feature IDs cũ.

Ghi chú P4/Step29 không có source/evidence đính kèm vẫn UNKNOWN. Gói FULL-TRANSFER vượt 32 MiB vẫn NOT_READ. Nếu bổ sung được source/DB/runtime artifacts, S001 phải kiểm tra và lập delta migration; không đoán từ tên ZIP hoặc số bước trong chat.
