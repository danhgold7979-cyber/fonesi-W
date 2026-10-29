# Kết quả rà soát lại toàn bộ baseline

## Nguồn và phương pháp

HTML mới `AutoReels-Workspace (1).html`: 163.787 byte, SHA-256 `3afb29c567a58b654de2b555b19ed60e8e074c604b2d1d4621e77d21d44cdf54`. Bản gốc có 238 dòng do JS/CSS nén trên các dòng dài. Bản được format để đọc ở `evidence/reference.formatted.js` có 3.987 dòng, CSS 1.760 dòng; đó là artifact audit, không phải app production.

Đã đối chiếu bộ V1.7 và các báo cáo trước; đọc dispatcher cùng event handlers, graph builder, save/import/export, context switching, scheduling và popup. Chromium được dùng để xem giao diện và tạo các tình huống kiểm tra độc lập. Trang được phục vụ nội bộ trên loopback, không xuất link preview.

| Phạm vi kiểm kê | Kết quả |
|---|---:|
| Route chính | 6 |
| Trạng thái UI khảo sát | 101 |
| Action dispatcher cases | 124, không trùng tên |
| Action controls đã thấy qua các trạng thái khảo sát | 124/124 |
| Node types | 40 |
| Workflow mẫu trong HTML | 7 |
| App trong catalog | 5 |
| Event/delegation families ngoài dispatcher | 26 |

Số control instances lặp qua các trạng thái không được tính thành số chức năng. `ui-fields.json` ghi chữ ký của fields/options đã quan sát, không tuyên bố đó là số nghiệp vụ độc lập. Không có uncaught JS error trong 101 trạng thái khảo sát. Điều này **không** có nghĩa các hành vi đều đúng: các regression dưới đây tái hiện ngay trong cùng phiên audit.

Một số trạng thái modal/property được mở bằng gọi handler với fixture đã chọn, thay vì click bằng chuột qua mọi bước. Đây là khảo sát UI/handler và tái hiện lỗi prototype; không phải 101 test end-to-end production PASS. Xem raw observations trong `evidence/browser-audit.json`.

## Những phần thiết kế tốt được giữ

- Workflow dùng chung giữa nhiều máy; máy Inspector để test không phải chủ sở hữu workflow.
- Main graph và subflow tách; có khai báo input/process/row/output.
- 6 route phân tách việc thiết kế, cấu hình tiến trình và vận hành.
- Có snapshot version, preview lịch và preview import thay vì áp ngay.
- HTML tự ghi rõ dữ liệu/điện thoại/run là mẫu; không giấu việc chưa có Android.
- Giữ POST_INTENT, verify, review và cleanup theo ownership trong ý tưởng đồ thị.
- Nguồn media nằm trên PC; file transfer chỉ khi đến lượt.
- Không có runtime CDN trong HTML mới, khác prototype V17.

## Lỗi/thiếu sót đã có bằng chứng

| Phát hiện | Bằng chứng tái hiện | Hệ quả production |
|---|---|---|
| Chuyển máy bằng card Thiết lập đi vòng context service | Chọn d2 nhưng caption còn `ONLY_D1`, chỉ có context d1 trong cache | Có thể hiển thị/lưu nhầm nội dung sang máy khác |
| Library filter đổi app active toàn cục | app active `tt`, workflow vẫn `fb`, launch package vẫn Facebook | Tên app, editor và process có thể không khớp |
| Clone workflow mất custom inputs | Input `customAudit` không có trong bản clone | Mất schema và mapping riêng |
| Import workflow mất custom inputs | File có `customAudit`, import xong `preserved=false` | Export/import không round-trip |
| Validator bỏ qua port lạ, output trùng, ID node thường trùng | Trả `[]` cho các fixture sai | Compiler có thể chạy graph mơ hồ |
| Validator không check topology subgraphs | Child graph có edge tới ID không tồn tại vẫn `[]` ở main | “Main hợp lệ” không chứng nhận dependency closure |
| Publish không có intent vẫn vượt validator | Xóa intent node, nối thẳng compose→publish, validator `[]` | Không đủ bảo vệ crash recovery |
| Breakpoint resume bị lặp | Pause→Continue vẫn `paused=true`, current n8, steps tăng | Debugger không tiến được đúng nghĩa |
| Fit điện thoại hiển thị sai zoom | Slider 100 nhưng label vẫn 130% | State hiển thị không thống nhất |
| Policy quá hạn không tác động schedule preview | Policy next, start 2020 vẫn nhận lịch 2020 | UI policy không có implementation tương ứng |
| Device enabled không persist | Tắt enabled rồi save/reload trở lại true | Restart thay đổi hành vi nhận việc |
| Key nguy hiểm được chấp nhận | `__proto__` qua input declaration | Cần reserved-key policy và schema validation |
| Import ID sai vẫn fallback filename | `NON_EXISTENT` vẫn khớp content-1 | Có thể sửa nhầm hàng khi key authoritative bị sai |

## Phát hiện cần phân loại đúng

- Context cache chỉ lưu rows/slots/daily/startDate. Weekdays và source settings còn global; V2 yêu cầu chúng nằm trong Process. Đây là thiếu scope rõ, không phải bằng chứng mọi trường đều mất qua reload.
- Snapshot version đang lưu v3 nhưng UI thông báo tạo v4. Có thể thiết kế “đóng v3, mở draft v4”, nhưng UI và contract chưa diễn đạt; V2 tách draftRevision khỏi version number.
- Group button có `pointer-events:auto` dù parent none: **không ghi thành lỗi**. Kiểm tra computed style bác bỏ nghi ngờ ban đầu.
- Node loop/break/continue có trong catalog nhưng mô phỏng chưa thực thi ngữ nghĩa tương ứng. Tương tự, subflow được log/tô sáng như một node, chưa interpreter call stack thật.
- File[]/list/identity/datetime có thể hiện như input text trong dynamic columns; declaration không đồng nghĩa typed editor đã hoàn chỉnh.
- Timeline/queue/history mới phản ánh context hiện tại và mô phỏng, không phải dữ liệu toàn workspace.
- Restore/import chỉ kiểm tra envelope tối thiểu và mutate state sớm; cần validation đầy đủ và atomic commit.
- CSV formula safety, duplicate import rows, nguồn file thực, lock/recovery, app-specific selectors và diagnostic privacy chưa thành implementation production.

## Hợp nhất với V1.7

V1.7 cho runtime rules mạnh hơn HTML mới ở locks, job snapshots, storage, recovery, safe staging, compatibility và completeness. HTML mới cho kiến trúc UI/authoring rộng hơn ở đa app, graph editor, dynamic schema và Process. Dùng cả hai bằng bảng quyết định, không copy nguyên handler hoặc áp lại mọi layout cũ.

Gói FULL-TRANSFER vượt giới hạn tải nên chưa được phân tích. Vì vậy kết luận là **đủ để lập baseline và triển khai nền tảng từ những nguồn đã đọc**, không phải “mọi source ở mọi gói đã được kiểm tra”. Windows/ADB/Facebook/thực thi đa app đều chưa được nghiệm thu.
