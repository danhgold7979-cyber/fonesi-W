# Các mục cần chốt trước khi triển khai

Trạng thái: **ACCEPTED_RECOMMENDATIONS**, ngày 26/10/2026. Người dùng trả lời “Rồi chốt, bổ sung các chức năng phụ cần thiết nữa…” sau khi nhận C01–C12. Ghi nhận chấp thuận các phương án đề xuất, bổ sung yêu cầu giao diện gọn. Thông số PC/điện thoại và so sánh Genfamer vẫn là thông tin/evidence chưa có, không được suy thành hardware PASS. Bảng dưới giữ nguyên lịch sử câu hỏi và gợi ý; các quyết định tiếp nhận ở phần cuối và V2.1.

## A. Quyết định sản phẩm và quy trình

| ID | Điểm cần chốt | Gợi ý cụ thể | Ảnh hưởng |
|---|---|---|---|
| C01 | Xây mới hay kế thừa code đã làm dở? | Xây mới từ HTML Studio + V1.7 đã đọc; giữ reference. Không lấy Step29 làm code hiện có. Nếu cần kế thừa source trong FULL-TRANSFER thì kiểm kê source đó trước scaffold. | Chặn quyết định baseline ở P00 |
| C02 | “Đa app” chỉ 5 app hay app Android bất kỳ? | Registry mở: thêm app bằng package đã cài; primitive nodes dùng chung. 5 app có template/adapters riêng. App có trong registry không tự có scanner/publish verification. | Cần đổi enum app cố định trong planning schema nếu chọn mở; ảnh hưởng P01/P05/P12 |
| C03 | Phạm vi bản đầu dùng thật và ưu tiên app | Nền đa app ngay từ đầu; chứng minh Facebook Reels và một app thứ hai, đề xuất TikTok, trước khi gọi là multi-app runtime. Lite/Instagram/Threads là các đợt có evidence riêng. Nếu cần cả 5 cùng lúc phải ghi rõ release gate tương ứng. | Quyết định shipped scope, không tự bỏ các app còn lại |
| C04 | Workflow tự tạo được chạy thật khi nào, ai đánh dấu sẵn sàng? | Cho phép user bấm DEVICE_TEST trên máy chọn; TRACE riêng. Bản chạy lịch phải lưu version, inputs hợp lệ, qua test receipt trên profile đang dùng và được user đánh dấu sẵn sàng. Generic primitive tests không đợi nhà phát triển viết template; auto-publish vẫn cần effect/verify contract. | Giải quyết UX của certification, P05/P09/P11 |
| C05 | Lịch là theo từng tiến trình hay quota tổng của điện thoại? | Một điện thoại có nhiều Process (app/workflow/account/target); mỗi Process có dữ liệu/lịch riêng. Một queue chung cho điện thoại thực thi tuần tự. Ví dụ 3 Facebook + 3 TikTok = 6 jobs; chưa thêm quota ngày tổng nếu không yêu cầu. | P06/P07, cách hiểu videos/day |
| C06 | Máy bận/offline, quá giờ và chống trùng lịch xử lý thế nào? | Bận bình thường: xếp hàng. Mất kết nối/ngủ máy làm bỏ lỡ giờ: mặc định chuyển slot tương lai; có lựa chọn chạy bù/bỏ lượt theo Process. Spread 60–120 phút chỉ khi người dùng yêu cầu, xem trước cả việc đẩy qua ngày. | P07; không trộn normal queue delay với missed schedule |
| C07 | Một nội dung có được đăng lại không? | Cho cùng asset sang các target khác. Mặc định chặn cùng nội dung/app/target đã xác minh đăng; explicit “tạo lượt đăng lại” khi user chủ đích, không dùng làm retry cho kết quả chưa rõ. Chốt thêm cách hiểu cùng nội dung cho text/multi-asset. | Dedupe keys, job creation và UI, P06/P11 |
| C08 | Gặp kết quả chưa rõ thì dừng job hay cả máy; lỗi comment thì sao? | Chưa rõ publish/comment đã gửi: pause automation trên máy đó để đối soát, máy khác tiếp tục. Đã xác minh post nhưng comment thất bại chắc chắn: ghi kết quả một phần và xử lý comment riêng, có thể tiếp tục queue nếu không còn uncertainty. Cần thêm trạng thái partial-result và cleanup policy rõ nếu chọn cách này. | Thay đổi/bổ sung states và recovery/cleanup ở P11 |
| C09 | Có cho cài app hỗ trợ Android không; root và proxy loại nào phải có? | Không yêu cầu root, không tự root. ADB/scrcpy làm nền; helper APK chỉ cài có chủ đích nếu cần cho routing/clipboard. Proxy HTTP/HTTPS/SOCKS/auth chỉ công bố loại đã chứng minh thực sự đi qua app. Nếu không cho helper thì một số loại routing có thể không hỗ trợ. | Quyết định phạm vi helper/network, có thể cần điều chỉnh kế hoạch; P08/P10/P13 |
| C10 | Đặt Proxy/VPN/APK và nút nhanh ở đâu; nhóm nhận lệnh nào? | Device Tools chia Kết nối / Ứng dụng / Mạng. Quick actions dưới phone pane: Back/Home/Recent, mở app, Gallery/Files/Settings/Browser/VPN, screenshot, reconnect, force-stop app quản lý. Lệnh nhóm có scope và kết quả từng máy, dùng chung khóa với automation. | Bổ sung layout cụ thể thay chỗ “device tools” còn khái quát, P03/P08/P09/P13 |
| C11 | Inspector lấy chuẩn nào và “hơn Genfamer” nghĩa gì? | HTML mới là visual baseline. Ưu tiên pick đúng phần tử, count/highlight match, selector fallbacks, test riêng từng node/subflow, debug/call stack, hướng dẫn theo bước. Chọn app/device/workload chuẩn rồi đo cùng điều kiện; cần xác định bản Genfamer nếu yêu cầu so sánh trực tiếp. | Chốt UX acceptance và benchmark; không hứa “nhanh hơn” trước đo |
| C12 | GitHub tự động tới mức nào? | Sau increment có checks phù hợp: commit/push nhánh feature và tạo PR nếu được ủy quyền. Không tự merge main hoặc phát hành installer. Hiện chưa có lệnh người dùng cho tự push. | Quy trình bàn giao; không chặn viết code local |

Các đề xuất trên được tiếp nhận vào baseline V2.1. Chưa có app production; thứ tự người dùng yêu cầu là xem giao diện HTML đầy đủ → cập nhật plan → code.

## B. Thông tin thực tế cần xác định, không phải chọn bằng ý kiến

- Host Windows dự kiến: Windows version, CPU, RAM, GPU, màn hình/DPI và thời gian máy thường bật để scheduler chạy.
- Số điện thoại hoạt động thường xuyên và workload: số preview/control sessions, media library size, workflow size. Gợi ý bắt đầu nghiệm thu 2–5 điện thoại thật; không biến đó thành trần nghiệp vụ.
- Test profiles: hãng/model, Android, Facebook/app versions, locale, USB/LAN và phần mềm ADB khác đang dùng.
- Các nguồn source/DB/artifact cũ nếu cần kế thừa. FULL-TRANSFER chưa đọc được, không được tự bỏ qua rồi tuyên bố migration hoàn chỉnh.
- Bản/luồng Genfamer dùng làm đối chứng nếu yêu cầu so sánh, thay vì tiêu chí cảm tính “hơn”.

Thông tin hardware không cần để viết mọi contracts, nhưng cần trước khi khóa benchmark hoặc chứng nhận app/device. Không lấy cấu hình cloud thay cấu hình PC người dùng.

## C. Phần kỹ thuật do người triển khai chịu trách nhiệm chọn và đo

Không cần người dùng chọn phiên bản SQLite driver, React graph library hoặc parser cụ thể. Người triển khai phải resolve maintained versions, kiểm compatibility, ghi lockfile/decision và evidence. Nếu thử thất bại, sửa thiết kế hoặc giới hạn capability rõ.

Những khả năng chỉ chứng minh được bằng spike: embedded stream, UI XML/selector coverage của app thực, Unicode/paste, MediaStore/picker đúng file, exact post/comment signals, non-root proxy routing và scale/latency. Đồng ý phương án không biến những thứ này thành PASS.

Đặc tả tốc độ trước hết chốt cách dùng, cấu hình và workload; chỉ tiêu p50/p95/FPS/RAM cùng test protocol được cố định sau đo baseline. Không hứa mọi thiết bị đạt cùng latency hoặc “tốt hơn Genfamer” khi chưa đo.

## D. Những quy tắc đã rõ, không cần hỏi lại nếu không đổi phạm vi

- Windows desktop, USB/LAN; cloud dùng phát triển, không tự thấy USB/LAN nhà người dùng.
- UI Studio 6 route, app đa file Electron/React/TypeScript, SQLite, authoring độc lập test device.
- Một máy chỉ một active owner/job; manual/Inspector/automation phối hợp cùng ownership.
- Job dùng cấu hình/version snapshot, không âm thầm đổi khi sửa draft/Process.
- Không bấm publish lại chỉ vì timeout; comment không kéo theo repost.
- Không xóa media ngoài staging owned; không xóa source PC vì remove row.
- Manual login, không lưu password/2FA/private token; security challenges dừng để review.
- Không hard cap devices/media, không fake production success, batch có kết quả riêng.

## Khi nào đủ clear để code?

1. Baseline nguồn và ý nghĩa multi-app được chốt; biết phần nào ship ở mỗi đợt.
2. Workflow quyền chạy, Process/lịch/dedupe/recovery có quy tắc được đồng ý, không mâu thuẫn.
3. UI extensions và Inspector acceptance được ghi vào contracts/registry.
4. Mỗi giả định hardware có spike, test profile dự kiến và điều kiện FAIL/unsupported; không giả PASS.
5. Ghi câu trả lời vào decision log, cập nhật schemas/tracker/tests và version kế hoạch nếu scope thay đổi; rồi bắt đầu increment nền.

Đủ clear để bắt đầu code không có nghĩa tất cả feasibility đã được chứng minh trước khi viết dòng code nào. Nếu yêu cầu chắc chắn phần Android trước khi làm sâu UI, có thể ưu tiên các spike phần cứng sau nền tối thiểu rồi mới đầu tư các module phụ thuộc.

## Quyết định tiếp nhận V2.1

- C01: xây mới từ bộ đã đọc, giữ reference nguyên vẹn; FULL-TRANSFER vẫn NOT_READ.
- C02: app registry mở, 5 app là seed/templates, không là giới hạn enum. Package/identity/certification được resolve ở runtime.
- C03: R1 phải chứng minh Facebook Reels và TikTok trên profiles thực; các app còn lại là các đợt riêng, không bị bỏ khỏi tổng scope.
- C04: user có DEVICE_TEST; đánh dấu version sẵn sàng chạy lịch dựa validation/test receipt và exact profile, không cần đợi maintainer viết mọi template. Built-in semantic adapters vẫn có certification riêng.
- C05–06: lịch riêng Process, queue chung mỗi máy; busy queue khác missed-schedule; NEXT_FUTURE_SLOT mặc định, spread chỉ explicit preview.
- C07: dedupe theo app + stable target + asset hash (ordered list khi multi-asset); text-only theo nội dung post đã render, Unicode NFC/newline chuẩn hóa. Caption/comment thay đổi không tự vượt dedupe media. Repost là job mới có chủ đích, không là retry pending effect.
- C08: effect uncertain pause automation thiết bị; manual review vẫn acquire đúng quyền. Post verified nhưng comment fail chắc chắn có `SUCCESS_WITH_WARNINGS`, retry comment riêng; cleanup chỉ khi không còn pending effect hay nhu cầu phục hồi media.
- C09: non-root mặc định; helper có thể dùng khi có nhu cầu/khả năng chứng minh; không tự cài trong lượt preview. Không hứa mọi loại proxy.
- C10–11: compact layout, Device Tools 3 tab, quick actions theo context; ưu tiên rõ/nhanh/ít click; chưa tuyên bố hơn Genfamer khi chưa benchmark.
- C12: commit/push nhánh tính năng sau checks phù hợp; không tự merge main hoặc phát hành installer.
