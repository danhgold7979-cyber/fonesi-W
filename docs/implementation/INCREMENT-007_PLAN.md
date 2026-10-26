# Increment 007 — device discovery + manual backend

Trước code: master execution plan và S069–S077 đã đọc, P08_PLAN.md vừa lập. Prerequisites S019/S064 leases và host/preload validation đã có; P09 video không giả bằng timer screenshots.

## 007A: adapter/process boundary

- Package devices độc lập DB/React. Typed AdbRunner các method version/list/properties/packages/foreground/screenshot/tap/swipe/key/launch/force-stop/system intent/connect/pair; không public generic shell.
- Executable từ host config/PATH/native dialog, canonical path và hash. Public request không có rootPath/executable/shell args. Timeout <=15s, output bounded, AbortSignal, sensitive pair code không đưa vào error/log. Binary PNG giữ Buffer đến host; screenshot tĩnh có capture/profile/transport generation.
- Smart socket probe host:version qua TCP chunk-safe/budget/deadline trước CLI device commands. Mismatch/foreign socket => block, không auto restart shared ADB. Compatible shared server reuse. Missing server có explicit start owned foreground child port 5038 (không claim 5037 shared); cleanup chỉ PID child này.

## 007B: persistence/service

- Migration 6 append-only device_profiles + host-bound device_transports. Existing devices/name/enabled/Process/job IDs giữ nguyên. Private worker register/reconcile/details/setEnabled/lease commands; public queries trả DTO, không raw DB.
- Scan dedupe/cancel/generation, max4 parallel property probes. Persist transport state và observed metadata, derive stable fingerprint khi đủ evidence; provisional chưa merge với historical devices bằng hostname. Không cho connected/deviceTest/automation từ imported records.
- Host DeviceService owns runner + actor queues + optional SDK picker. Startup reset transport connected states của host; reconcile offline/unauthorized transitions; watch bounded interval/backoff. Stop intake/cancel owned processes trước close DB.
- Manual operations resolve current authorized enabled transport, acquire same DB lease system, recheck transport generation, assert lease immediately before exec. Per-phone serialization/limits; operation timeout không auto replay. Screenshot captures and actions bind same device/geometry, stale image reject.

## 007C: API/UI

- Named methods only, host schemas và sender checks như hiện tại. Bootstrap hardware.connected phản ánh actual observation; header không hardcode disconnected.
- Devices route có real cards/status, scan/loading/cancel/empty/error/missing SDK, native picker hoặc configured PATH. LAN connect/pair form; pair PIN transient, không preference/log.
- Search, selected IDs vs active details độc lập; setEnabled persisted. Details metadata/packages/quick actions, screenshot button thật; tap/key/swipe scoped current capture. Chưa có stream thì label ảnh chụp, không gọi là video.
- Source/media router giữ nguyên; device host operations không chạy trong SQLite worker làm block DB. Hardware runtime/certification status vẫn independent.

## 007D: verification

- Native process harness thật + fake ADB test executable (fixtures only) chứng minh version/argv/timeout/output/PIN redaction/PNG/quote. TCP server fixture kiểm segmented protocol/mismatch/no shared kills.
- DB tests USB/LAN evidence merge, provisional/unknown, reconnect reset, enabled/revision/history preserved, no cross-host connected state. Ownership concurrent manual/job và stale capture/generation fence.
- E2E no real devices: missing SDK state thật và boundary reject shell/path; fixture service host riêng để exercise cards/details/actions, không production defaults. Electron sandbox smoke/whole check + source checksums.

Distribution download nếu host cho phép sẽ kiểm official metadata/hash trước dùng; nếu không có binary cloud thì code provider vẫn hoàn thiện, physical acceptance ghi NOT_RUN. Không tự kết luận tác vụ trên phone thành công từ fixture.

### Điều chỉnh 007A sau đọc ADB source, trước triển khai runner

Đã tải official Platform-Tools 37.0.1 Linux (9,054,187 bytes), verify SHA-1 từ Google repository XML `477254aa5f903c15cf51001717bdf347fb6b53e0`, actual ZIP SHA-256 `d230f13842f60f782a8645f9c813f8f845bf36089ea7289f28c48f17979313f1`. `adb version` thật bị host từ chối vì ADB cố tạo `/home/agent/.android` trên filesystem read-only; ANDROID_USER_HOME không đổi behavior. Không đổi HOME hay bypass host permissions.

Đọc AOSP adb_utils.cpp và client/adb_client.cpp cho thấy CLI có thể kill/restart shared server khi version mismatch, kể cả có check ngoài trước đó (TOCTOU). Vì vậy runner device operations dùng **ADB smart-socket trực tiếp** qua node:net: host:version/devices-l/connect/pair + transport + shell_v2/exec. Không có code path gửi host:kill/start-server đến shared server. Pair PIN đi qua local socket transient, không argv/log. SDK executable chỉ dùng local version/owned foreground server startup; cloud permission issue không chặn viết hay test protocol provider.

Shell v2 parse channel/length/exit code qua segmented bytes; command args quote remote shell; screenshot exec raw buffer với PNG/dimension bounds. Feature shell_v2 thiếu thì unsupported rõ, không fallback legacy giả exit=0. Owned server vẫn port riêng 5038 và PID child lifecycle; never kill server khác. Tests TCP byte splits/oversize/EOF/timeouts/cancel/remote quoting/exit errors trước nối UI.

### 007C/D — enabled ACK refinement

Browser test bắt controlled checkbox bị revert trước server ACK. Trước sửa: lưu pending desired enabled theo stable device ID, disable control khi mutation pending, nhận snapshot ACK trước clear pending, rollback nếu lỗi. E2E đợi control hết pending trước reload để chứng minh persistence, không tính optimistic checked là saved. Không thay backend enabled state hoặc giấu revision conflict.
