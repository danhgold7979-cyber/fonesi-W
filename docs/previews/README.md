# AutoReels Studio Compact — bản xem giao diện

Mở [HTML độc lập](AutoReels-Studio-Compact.html) bằng Chrome/Edge. Không cần CDN hoặc cài npm để xem. Phiên chat này không có công cụ Canvas nhúng; HTML là artifact có thể tải về và tương tác trực tiếp trong trình duyệt.

Gồm đủ 6 màn hình, 40 node trong library, canvas và các tiện ích Compact. Điện thoại/cây UI/run vẫn là minh họa, có nhãn xem trước. Nút hardware thực trong Device Tools bị tắt tới khi có backend; không dùng bản này để điều khiển máy hay đăng bài thật.

Phím chính: Ctrl+K tìm lệnh, F1 hướng dẫn, Alt+1…6 chuyển trang, Shift+F vừa vùng chọn, Ctrl+0 vừa toàn bộ, Ctrl+B library, Ctrl+Alt+P phone, mũi tên/Shift+mũi tên dịch node. Ctrl+lăn zoom, Shift+lăn pan ngang; chuột phải để xem menu đúng ngữ cảnh.

Build/test từ repository root:

```sh
python tools/preview/build_compact.py
python tools/preview/build_explorer.py
node --check tools/preview/compact.js
python tools/preview/test_compact.py
```

Reference gốc được giữ nguyên trong `docs/reference/studio-workspace/`. Helpers riêng và HTML sinh ra dành cho review; production phải là ứng dụng nhiều module theo Source Plan V2.1.
