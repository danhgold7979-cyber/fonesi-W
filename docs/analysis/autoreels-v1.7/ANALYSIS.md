# Phân tích AutoReels Project Source Pack V1.7

Ngày phân tích: 26/10/2026, múi giờ Việt Nam. Phạm vi: ZIP người dùng gửi trong cuộc trò chuyện, repository `fonesi-W` và môi trường Linux cloud hiện tại.

## 1. Kết luận để triển khai

Đây là **bộ đặc tả, giao diện mẫu và công cụ chuẩn bị môi trường Windows**, chưa phải source code ứng dụng production. Gói đủ chi tiết để thiết kế nền tảng và chia công việc, nhưng các tuyên bố “READY”, “FROZEN”, “PASS” trong tài liệu không thay thế bằng chứng chạy ứng dụng hoặc điện thoại thật.

Sản phẩm đích là ứng dụng Windows Electron quản lý điện thoại Android và lịch đăng Facebook Reels qua giao diện Facebook Android. Website Codex là nơi thực hiện công việc phát triển; không có nghĩa sản phẩm cần đổi thành website hoặc điện thoại USB tự kết nối được vào cloud.

Ưu tiên triển khai: bảo toàn dữ liệu → nền tảng ứng dụng → registry/khóa thiết bị → thử nghiệm khả thi với Android → media/lịch → tự động hóa có xác minh. Giao diện V17 là tham chiếu bố cục và tương tác; không sao chép các handler mô phỏng thành logic production.

Phân tích đã hoàn thành. Chưa scaffold ứng dụng, chưa chạy installer PowerShell, chưa commit/push, chưa chứng nhận Gate Windows/Android.

## 2. Bằng chứng và tính toàn vẹn

| Kiểm tra | Kết quả |
|---|---|
| File ZIP | `AutoReels-Project-Source-Pack-V1.7.zip`, 113.067 byte |
| Thành phần | 41 file: 35 Markdown, 3 PowerShell, 1 HTML, 1 JSON, 1 TXT |
| Tổng dung lượng giải nén | 304.552 byte |
| HTML chuẩn | `Facebook_Auto_Farm_FINAL_V17.html`, 2.804 dòng |
| SHA-256 HTML | `fe9e23625d1a50f384ea34eb4003c4049820f68524d0e450c2e70d85b5434b49`, khớp manifest |
| Source production | Không có `package.json`, lockfile, TS/React, SQL migrations, IPC implementation hay bộ test production |
| Repository ban đầu | Chưa có commit, nhánh local `work` chưa có HEAD |
| Traceability | 121 ID chức năng riêng biệt; gồm 3 `WF-DEV-*`, không phải 121 tính năng đã nghiệm thu |
| Chạy giao diện | Chromium headless, cả dark/light, các modal và 5 viewport |
| Windows/Android | Chưa chạy; không có bằng chứng thiết bị thực trong phiên phân tích |

Tài liệu gốc được đọc như **dữ liệu bàn giao và yêu cầu thiết kế**, lưu nguyên trạng tại `docs/reference/autoreels-v1.7/`. Prompt trong `09_HANDOFF_PROMPT.md` và lệnh trong TXT/PowerShell không tự trở thành yêu cầu thực thi của người dùng.

CDN nguyên bản gặp lỗi chứng chỉ/tunnel ở môi trường này. Lượt kiểm tra bổ sung phục vụ cục bộ các dependency lấy qua HTTPS từ npm chính thức và kiểm tra integrity SHA-512. Không tắt TLS, không sửa HTML gốc. Hai thư viện vốn không ghim phiên bản trong HTML là Interact.js/Selecto được ghi lại phiên bản dùng khi kiểm tra. Đây là tái hiện tham chiếu, không chứng nhận dependency production.

Xem `evidence/ui-inspection.json`, `evidence/package-audit.json`, `evidence/verified-packages.json`, `evidence/source-inventory.json` và ảnh trong `screenshots/`.

## 3. Sản phẩm thực sự làm gì

Một người vận hành có nhiều điện thoại, trên mỗi máy đăng nhập Facebook thủ công. Ứng dụng phát hiện thiết bị, hiển thị/điều khiển màn hình, quét các danh tính đang truy cập được, quản lý video từ thư mục Windows, tạo lịch và chạy từng công việc trên đúng thiết bị/đúng Page.

Luồng nghiệp vụ chính:

1. Phát hiện/đăng ký thiết bị và kiểm tra khả năng điều khiển.
2. Người dùng đăng nhập Facebook trên điện thoại.
3. Quét account/profile/Page, lưu cache; xác minh đích đăng.
4. Tạo Campaign: thư mục video + thiết bị + phiên đăng nhập + đích đăng + múi giờ + thiết lập mặc định.
5. Quét file, tạo thumbnail, chỉnh caption/hashtag/comment và các tùy chọn.
6. Tạo Job với snapshot cấu hình; lưu UTC và nguồn múi giờ.
7. Đến lịch, lấy quyền điều khiển độc quyền, kiểm tra lại file/session/đích/mạng.
8. Chuyển video sang staging Android, chờ MediaStore, xác minh đúng video trong picker.
9. Đi qua Facebook bằng nhận diện trạng thái; nhập Unicode và kiểm tra lại.
10. Ghi ý định đăng bền vững, bấm đăng một lần, xác minh kết quả.
11. Nếu có comment: giao dịch riêng, chỉ retry comment khi cần.
12. Hoàn tất; dọn đúng file staging do AutoReels tạo, lưu lịch sử.

Các nhánh rủi ro phải có kết quả xác định: mất kết nối, thiếu file, file thay đổi, Facebook cập nhật, phiên hết hạn, popup lạ, trạng thái bài đăng chưa rõ. Không dùng timer để giả định thao tác đã thành công.

## 4. Các quy tắc phải giữ

| Quy tắc | Hệ quả thiết kế |
|---|---|
| Không chặn số thiết bị/video bằng trần nghiệp vụ | Phân trang, virtualize, hạn chế tài nguyên đang hoạt động; không hứa vô hạn công suất |
| Một thiết bị tối đa một job automation hoạt động | Queue và quyền điều khiển có kiểm soát, kể cả khác Campaign |
| Manual và automation chung khóa | Mọi lệnh có thể đổi UI/mạng/app đều đi qua chủ sở hữu thiết bị |
| Job giữ snapshot | Sửa Campaign/media không âm thầm đổi nội dung của job đã tạo |
| Đăng nhập thủ công | Không lưu mật khẩu/2FA/token Facebook được trích xuất |
| Không bấm Publish lại khi chưa rõ kết quả | Recovery ưu tiên tìm và xác minh bài, nếu chưa đủ chứng cứ thì NEEDS_REVIEW |
| Comment độc lập | Lỗi comment không tạo lại Reel |
| Proxy/VPN loại trừ nhau | Trạng thái mong muốn và trạng thái thực đã xác minh cần tách biệt |
| Metrics thiếu lịch sử là `—` | Không thay bằng 0% hoặc số ngẫu nhiên; lỗi metrics không tự chặn job |
| Cleanup chỉ trong staging thuộc AutoReels | Không xóa DCIM, Downloads hay video của người dùng |

Không có lý do thay đổi các mục tiêu này khi viết nền tảng. Các thay đổi thứ tự công việc hoặc chính sách còn thiếu bên dưới là đề xuất cần ghi vào decision log khi triển khai.

## 5. Kiến trúc đề xuất để hiện thực đặc tả

```text
React renderer: layout, selection, bảng, timeline, trình bày trạng thái
          ↓ API có kiểu qua preload
Electron main: xác thực IPC, dialog, vòng đời, điều phối dịch vụ
          ↓
Domain: Campaign / Media / Scheduler / Transaction / Capability
          ↓
SQLite service + DeviceWorkerManager + media/diagnostic queues
          ↓
DeviceWorker theo thiết bị → ADB / scrcpy / Facebook adapters
```

### Phân ranh giới

- Renderer không có Node, DB, shell, đường dẫn hay lệnh ADB tùy ý.
- Main xác thực sender, payload, ID và phạm vi path; hạn chế navigation/window mới, có CSP, `contextIsolation`, sandbox, tắt Node integration.
- SQLite chạy qua dịch vụ tuần tự/worker; thumbnail, hash và parse nặng không khóa event loop của Main.
- Một DeviceWorker là bộ điều khiển logic duy nhất của thiết bị; không bắt buộc tạo một OS thread cho từng điện thoại.
- Mọi thao tác đổi màn hình, app, mạng, cài/gỡ APK phải phối hợp quyền điều khiển; nút quick app không được vòng qua khóa.
- Video frame dùng kênh có backpressure/buffer hữu hạn; tránh JSON/base64 từng frame qua IPC thông thường. Main giữ transport/socket, renderer chỉ nhận kênh stream được cấp quyền cho device đó.
- Worker lỗi trên một máy không làm chết queue của máy khác.

### Tổ chức repository

```text
apps/desktop/                 # Electron entry, preload, renderer
packages/contracts/          # DTO, schemas, errors, IPC/event names
packages/domain/             # state machines và quy tắc thuần
packages/database/           # migrations, repositories, backup
packages/device-runtime/     # registry, ownership, ADB/stream adapters
packages/media/              # watcher, fingerprint, staging metadata
packages/scheduler/          # lịch, recurrence, conflict, due queue
packages/facebook/           # detector, selector profiles, workflows
tests/                       # integration và hardware acceptance tách biệt
docs/reference/              # bản bàn giao được giữ nguyên khi nhập repo
docs/decisions/               # quyết định đã duyệt, khác với đề xuất
docs/evidence/                # bằng chứng theo phase/build/thiết bị
```

Đây là đề xuất cấu trúc, chưa scaffold. Cây trong tài liệu gốc trộn `apps/desktop` và `src/` ở root nhưng chưa xác định ownership; cần chọn một cấu trúc duy nhất trước khi tạo import/build scripts.

## 6. Cơ sở dữ liệu: đặc tả có nền tốt nhưng chưa đủ thành migration

Đặc tả đưa ra 17 bảng logic. Cần thiết kế SQL, foreign keys, indexes và chính sách xóa trước Phase 1.

| Khoảng trống | Cách xử lý đề xuất |
|---|---|
| Một máy USB và LAN có thể xuất hiện như hai serial | Tách device ID bền vững khỏi connection/transport endpoint; không suy luận chỉ từ IP/model |
| Tên Page có thể trùng/đổi tên | Lưu stable fingerprint và nguồn/confidence; không dùng display name làm ID |
| Media và bản sao metadata đang trộn | Phân biệt asset/file với campaign item; chốt clone có tạo đối tượng nào trước đặt UNIQUE |
| Campaign thiếu trường mà UI cần lưu | Thêm/định nghĩa watcherEnabled, reconcile interval, delay range, auto-append, start date, recurrence settings |
| Thiếu staging records | Theo dõi job/device/path thuộc sở hữu/hash/trạng thái MediaStore/cleanup; crash vẫn biết file nào được phép dọn |
| Thiếu compatibility/capability records | Tách registered, manual supported, automation supported và lý do chặn |
| Ownership mới mô tả logic | Lưu generation/owner và phục hồi; enforce một active job/device bằng transaction + constraint phù hợp |
| Snapshot là JSON chưa có schema/version | Validation khi tạo/đọc, version và hash; không tham chiếu ngầm sang defaults mới |
| Job lịch chưa có uniqueness chống sinh trùng | Dùng occurrence ID/generation key độc lập với publish idempotency key |
| Transaction đăng/comment chưa đủ evidence | Lưu attempted/uncertain timestamps, confidence, selector version và fingerprint bài/comment |
| Trạng thái giữa các file khác tên | Hợp nhất `FILE_MISSING`/`MEDIA_MISSING`, `TARGET_MISSING`/`IDENTITY_NOT_FOUND`, `POSTING`/`RUNNING`; tách state, error và UI label |
| Network credential persistence | Lưu reference tới kho bảo mật OS; snapshot không nhét mật khẩu proxy dạng rõ |

Index tối thiểu cần cân nhắc: jobs(device_id,state,scheduled_at_utc), jobs(state,scheduled_at_utc), media(campaign_id,id), identities(login_session_id,stable_fingerprint), metrics(identity_id,captured_at). Constraint và scope uniqueness phải theo nghiệp vụ, không đơn thuần áp UNIQUE toàn cục lên filename/hash.

WAL, foreign_keys và busy_timeout cần cấu hình. Backup bằng SQLite backup API hoặc cơ chế nhất quán tương đương, không copy một file DB đang WAL tùy tiện. Restore cần kiểm tra integrity và reconciliation job/thiết bị.

## 7. Lập lịch: cần chốt chính sách trước khi bật chạy nền

Mặc định 3 video/ngày tại 06:00, 12:00, 18:00; không áp trần nghiệp vụ. Lưu instant UTC và IANA timezone của Campaign. UI phải nói rõ đang xem timezone nào khi timeline có nhiều Campaign.

Các câu hỏi đặc tả chưa quyết định đủ:

- Trùng lịch là cùng timestamp hay hai khoảng dự kiến chạy chồng nhau? Job chưa có duration/reservation end.
- Job quá hạn sau ngủ máy: chạy bù tất cả, bỏ qua hay giãn? Cần giới hạn tốc độ chạy bù theo tài nguyên và quy tắc nghiệp vụ.
- “Chống trùng 60–120 phút” được phép đẩy qua ngày, ngoài slot hoặc ngoài date range không?
- Apply Schedule lần hai thay lịch cũ, tạo bản nháp thay thế hay thêm mới? Không được âm thầm tạo duplicate jobs.
- Auto-append phải nối video mới vào phần lịch chưa dùng, không tái lịch mọi job cũ như prototype.
- Kéo timeline chỉ sửa job chưa chạy; snapshot nội dung vẫn giữ nguyên. Cần revision để chống hai thao tác sửa đè nhau.
- Thay timezone là đổi cách hiển thị hay dịch instant của lịch chưa chạy? Cần phân biệt rõ.
- Khi hỗ trợ vùng có DST: giờ không tồn tại/giờ lặp cần policy. Việt Nam UTC+7 vẫn phải kiểm tra round-trip đúng ngày.

Queue serialize theo device là lớp bảo vệ thực thi; màu conflict trên timeline chỉ là cảnh báo/kế hoạch, không thể thay thế queue.

## 8. Publish: rủi ro lớn nhất là cửa sổ crash

Idempotency key nội bộ không khiến thao tác bấm Facebook UI trở thành API có exactly-once guarantee. Không có transaction nguyên tử giữa SQLite và Facebook.

Ví dụ nguy hiểm: app đã gửi tap Publish nhưng crash trước khi ghi `publish_clicked_at`. Nếu restart nhìn thấy timestamp trống rồi tap lại sẽ trùng bài.

Đề xuất: ghi ý định và mốc “attempt bắt đầu, kết quả có thể chưa rõ” **trước** khi gửi side effect; sau crash phải coi là chưa xác định và verify trước mọi thử lại. Timeout hay không thấy bài ngay chưa chứng minh không có bài, vì Facebook có thể upload/xử lý chậm.

Xác minh cần kết hợp đúng identity, time window, caption, đặc trưng media và đường dẫn/ID bài khi UI cho phép. Nếu nhiều bài giống nhau, confidence không đủ thì NEEDS_REVIEW. Không tuyên bố bảo đảm tuyệt đối không duplicate chỉ bằng key trong DB.

Comment cũng có cửa sổ đã gửi nhưng chưa xác minh: retry cần tìm comment hiện có, đối chiếu nội dung và người đăng, không spam thêm comment giống nhau.

**Điều chỉnh thứ tự quan trọng:** tài liệu để Phase 10 đăng thật, Phase 11 mới hoàn thiện idempotency. Nền transaction/recovery phải có trước cú Publish tự động đầu tiên; Phase 11 có thể còn là nghiệm thu crash chuyên sâu.

## 9. Android/stream/media: cần chứng minh trên máy thật

| Hạng mục | Điều cần chứng minh |
|---|---|
| Embedded scrcpy | Video trong Electron, H.264 decode, input, reconnect, đồng bộ server/client version |
| MASTER và previews | Quality riêng; GPU decoder budget; offscreen dừng thật/last frame chứ không chỉ đổi badge |
| Input mapping | Video content rect, rotation, letterbox, nav inset; không chỉ chia tọa độ element |
| Unicode | Caption/comment có dấu, emoji, URL, newline đúng trên Facebook; paste/read-back theo khả năng UI |
| Media staging | PC → ADB transfer → MediaStore → picker đúng video; scoped storage và permission theo Android |
| Account scanner | Scroll/deduplicate đúng, không nhận nhầm Page trùng tên; account != Page switcher |
| Post verification | Phân biệt posted/pending/ambiguous bằng bằng chứng thực |
| ADB coexistence | Không giết server/phần mềm khác tùy tiện; shared/dedicated server phải kiểm chứng USB thực |
| Proxy | Kiểm tra ở PC, adapter routing Android và Facebook traffic là ba mức khác nhau |

Không chọn phần tử đầu tiên trong Gallery chỉ vì vừa push một file. Không mở hai stream encoder đầy đủ cho preview và MASTER mà không tính tài nguyên. Không lấy việc đổi nhãn “1 FPS” trong DOM làm bằng chứng throttling.

Tài liệu v1.7 ưu tiên cleanup sau SUCCESS. File 23 còn mô tả một số terminal state được phép dọn sớm hơn; triển khai theo D-033 và ghi rõ chính sách reconciliation/cancel, không tự trộn hai cách.

## 10. Các phát hiện có thể hành động ngay

### A. Lỗi đã tái hiện trên prototype

| ID | Kết quả quan sát | Nguyên nhân/ảnh hưởng |
|---|---|---|
| UI-01 | Chọn 26/10/2026, lịch trả về 25/10/2026 ở timezone Việt Nam | `new Date(local midnight)` rồi `toISOString().slice(0,10)` trộn local/UTC; cả apply lịch và kéo timeline |
| UI-02 | MASTER Ctrl+wheel: rộng 350 → 350 px | CSS `width:350px!important` thắng inline style. Hai listener wheel lồng nhau còn có nguy cơ nhân zoom hai lần sau sửa CSS |
| UI-03 | Header Proxy 7 ô, dòng dữ liệu 8 ô | Thiếu tiêu đề loại proxy, mọi cột tiếp theo lệch nghĩa |
| UI-04 | Đổi Campaign 1 sang 2 vẫn giữ số slot vừa nhập là 5 | Schedule controls dùng chung DOM, chưa lưu/khôi phục cấu hình theo Campaign |
| UI-05 | Bulk replace comment bằng rỗng vẫn giữ `keep` | Rỗng bị hiểu là “không đổi”; thiếu thao tác xóa rõ ràng |
| UI-06 | Reload mất caption đã sửa | Dữ liệu media/queue/Campaign trong RAM; localStorage chỉ giữ ít tùy chọn UI |
| UI-07 | Timeline ghi kiểu “Ngày” nhưng mở khoảng 24–28/09/2026 | Handler mở modal và handler đổi mode không dùng chung chuẩn hóa range |

UI-05 cần quyết định UX: trường rỗng có chủ đích “không đổi” thì thêm hành động “xóa nội dung” thay vì đổi nghĩa rỗng âm thầm. UI-06 là giới hạn prototype đã biết, vẫn là yêu cầu persistence khi chuyển production.

### B. Rủi ro xác định bằng đọc source

- Quét máy tạo device giả; account scan/metrics không phải đọc Facebook thật; CPU/RAM/GPU load và proxy status có random.
- Canvas điện thoại là hình tự vẽ, không stream. Group input không gửi ADB/scrcpy.
- Workflow step chỉ chờ timer rồi báo verify; APK/clone có alert mô phỏng.
- Media table tạo toàn bộ DOM và rerender lại khi đổi dòng; chưa virtualize. Reconcile/thumbnail có thể đụng nhau vì không await đầy đủ và dùng state Campaign toàn cục.
- Timeline chỉ nhìn `S.videos` của Campaign hiện tại; không phải toàn bộ job của mọi máy/Campaign.
- `target` trong dòng là text input/tên hiển thị; production cần identity ID đã xác minh, không cho tên tùy ý trở thành đích tự động.
- “Bản sao cấu hình” đang thêm tên vào danh sách identity giả, không thực sự clone settings; tuyệt đối không coi là tạo Page Facebook.
- Metric thiếu dữ liệu bị fallback 0/0%; khác yêu cầu dấu `—`.
- Excel match theo filename; gặp tên trùng có thể sửa sai dòng. Cần stable ID/path và preview kết quả import.
- Render fingerprint `name|size|mtime` không phải hash nội dung mạnh; không đủ phát hiện mọi thay đổi sau snapshot.

### C. Mâu thuẫn gói bàn giao/công cụ

1. Manifest trỏ 5 file dưới `tools/`, nhưng ZIP đặt các file tương ứng ở root. Chạy theo đường dẫn trong README sẽ không tìm thấy.
2. TXT “Tiếp tục kiểm tra migration” nhắc P4/Step29 và hàng trăm test PASS; không có code/report tương ứng. Không dùng làm tiến độ đã nghiệm thu của gói này.
3. README còn “PRE-CODE ENVIRONMENT”, intro/manifest nói “PHASE 0 READY”. Chỉ nên ghi trạng thái theo bằng chứng hiện tại.
4. Bootstrap phát sinh activation script cũ; không dùng nội dung bản fixed V1.4 đang đi kèm. Vòng `foreach` dùng kết quả `[array]::Reverse(...)`, trong .NET method này mutate và trả void, nên không thể dựa vào đó để prepend PATH.
5. `Get-AdbCandidate`/Gate A thấy executable là chấp nhận, chưa enforce baseline Platform-Tools 37.0.1. Một số kiểm tra SDK/phone chỉ cảnh báo hoặc không tác động kết quả tổng.
6. Checklist yêu cầu có điện thoại ở Gate A; bootstrap lại nói chưa có phone không chặn Phase 0. `-Strict` trong GateA khai báo nhưng không dùng để nâng warning.
7. PortableGit dùng `-AllowUnknown`, vẫn có thể chạy sau chữ ký không hợp lệ; Platform-Tools thiếu checksum archive rõ ràng; cache có file là dùng lại. Chưa chạy các installer này. Cần fail-closed verification và tải atomic trước sử dụng thực tế.
8. Bootstrap Node/Git/ADB chọn “latest” trong lúc spec muốn reproducible; cần ghi exact resolved version/hash, không xem nhãn baseline là pin đầy đủ.

`pnpm@12.6.0` được kiểm tra tồn tại trên npm (HTTP 200); không cần tự ý bỏ pin chỉ vì cloud đang cài pnpm 11.25.0. Electron exact version/native ABI chưa được gói chốt, không chọn bản latest chỉ vì đang có sẵn.

## 11. Giới hạn cloud và hướng thực hiện

| Công việc | Cloud Linux | Windows + Android thực |
|---|---|---|
| Tài liệu, contracts, React, logic thuần | Có thể phát triển/kiểm tra |
| SQLite/domain/scheduler tests | Có thể, nhưng thêm kiểm tra Windows/native Electron |
| Browser visual tests | Đã làm với prototype |
| Electron Linux smoke | Có thể chuẩn bị khi có scaffold, không chứng nhận Windows |
| Windows C++/SDK/installer | Cần runner hoặc máy Windows |
| USB debugging, OEM drivers, Facebook thực | Cần máy host có thiết bị và quyền hợp lệ |
| LAN Android trên mạng nhà người dùng | Cloud không tự thấy mạng LAN đó |

Đề xuất quy trình hai môi trường: Codex cloud sửa code và chạy check nền; GitHub lưu source và CI; Windows runner build/package/native smoke; máy Windows có điện thoại chạy hardware acceptance. Remote device agent/bridge là một phạm vi kiến trúc mới, không mặc nhiên cần cho v1 desktop.

Gate A trong tài liệu là quy trình máy Windows. Nên ghi quyết định chia Gate Cloud/Foundation và Gate Windows/Hardware, thay vì giả lập Windows trên Linux hoặc đánh dấu tất cả PASS. Đây là đề xuất chưa áp dụng thay đổi vào baseline gốc.

## 12. Quy tắc code và công cụ nên chuẩn bị

Không cần plugin ChatGPT mới để viết ứng dụng này. Thứ cần thiết là cấu hình repository và dependency phát triển.

- `AGENTS.md`: mục tiêu, nguồn tham chiếu, invariant, lệnh check, phân biệt fake/dev fixtures với production, workflow theo phase. Dùng checkout hiện tại; không tạo worktree nếu người dùng không yêu cầu.
- `README.md`: chạy cloud/Windows, đường dẫn dữ liệu, build/test và capability hiện có.
- `docs/decisions/`: quyết định được chấp thuận, đặc biệt split gates, scheduler và transaction.
- `packageManager`, Node version, frozen lockfile; approve build scripts theo package cần thiết, không bật toàn bộ.
- TypeScript strict, ESLint, Prettier, Vitest, kiểm tra browser/Electron; SQL migration fixtures và hardware checklist.
- `.gitignore`: `.data`, `.tools` cache, device staging metadata runtime, logs, screenshots/XML thực, DB, secrets, build/node_modules.
- `.env.example` chỉ khi app thực sự có env cần dùng; không tạo API key giả hoặc file quy tắc trống.
- Import package V1.7 nguyên trạng như reference; bản phân tích là tài liệu riêng, không âm thầm sửa bản frozen.

Playwright/React/Electron/ADB là dependency hoặc công cụ phát triển/runtime, không đồng nghĩa cần cài plugin tích hợp ngoài.

## 13. Phạm vi nghiệm thu hiện tại

Đã xác minh: cấu trúc ZIP, SHA HTML, 121 ID traceability, giao diện dark/light/modal/overview/MASTER, 5 viewport và các tái hiện trong bảng UI-01…07. Không có uncaught JS error ở lượt dùng dependency cục bộ đã kiểm tra integrity.

Chưa thực hiện: unit tests của ứng dụng (chưa có source), native SQLite dưới Electron, Windows installer, ADB thực, stream/control thực, Facebook scan/publish/comment và scale nhiều điện thoại.

Ảnh chụp đẹp và việc mở được prototype không làm các phần chưa thực hiện thành PASS. Kế hoạch ở `IMPLEMENTATION_BACKLOG.md` chỉ rõ acceptance theo từng bước; bản đồ giao diện ở `UI_REVIEW.md` ghi hành vi và trạng thái phải có.
