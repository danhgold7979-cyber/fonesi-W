# Increment đầu tiên sau khi chuẩn hóa kế hoạch

Current scope: source-plan V2.1 và HTML Compact review có tiện ích tương tác. App implementation chưa bắt đầu. Người dùng đã chốt C01–C12 và yêu cầu xem HTML trước; khi dựng production, lấy V2.1 làm baseline, không ghép HTML review vào Electron rồi coi xong.

## Increment A — repository/contracts baseline

Mục tiêu: skeleton có trách nhiệm rõ, đủ chạy kiểm tra; không claim bất kỳ device automation nào.

Files/modules dự kiến:

- `AGENTS.md`: thứ tự nguồn, invariant, commands, cách ghi evidence, no fake success, existing checkout guidance.
- `README.md`: giữ nội dung người dùng và bổ sung chạy cloud/Windows/data root/capability state.
- `.gitignore`, Node pin, `package.json`, `pnpm-workspace.yaml`, lockfile và build-script policy.
- `tsconfig`, lint/format/test config và CI nền.
- `packages/contracts/`: app/capability, entity IDs, typed values, workflow envelope, errors; tests validation có ý nghĩa.
- `packages/domain/`: source-of-truth state enums, invariants, no global UI state.

Acceptance: install frozen reproducible, typecheck/lint/unit/build thích hợp, actual test count >0, contracts reject malformed bundle/keys, source references không đổi, git diff chỉ scope increment.

## Increment B — host + SQLite + shell

Main/preload/renderer separation; driver smoke Electron; migrations/settings; six routes empty states; theme/save status/single-instance/lifecycle. Show app catalog/templates as design definitions, không tạo điện thoại/account/job success giả. DB native compatibility và Windows lifecycle checks phải ghi riêng PASS/UNRUN/BLOCKED.

## Increment C — editor và data vertical slices

Làm add/edit/save/reload một graph + typed schema, rồi clone/export/import full closure và structural validator. Sau đó Process scoped content + schedule preview/apply. Mỗi slice có UI/service/DB/failure/test cùng increment; không dựng hết 124 nút rồi chờ backend sau.

Các phase trong master plan là phạm vi/dependencies, không buộc một PR chứa toàn phase. Audit phát hiện nguy cơ context và data loss nên ưu tiên tests REG-01…05, REG-10…13, REG-21 ngay lúc viết nền.

## Bắt đầu Android

P08/S069 là mốc đầu cần kết nối điện thoại để nghiệm thu kết nối; P10 cần ít nhất hai thiết bị/Android profiles phù hợp để chứng minh risk assumptions. Trước đó domain/editor/scheduler logic có thể làm trên cloud. Device agent/remote bridge chưa thuộc default desktop scope; không tự cài một tunnel/VPN riêng vào cloud để giả thay host Windows.

## Báo cáo sau mỗi increment

`Plan V2 · Phase Pxx · Step Sxxx · files/modules · implemented · verified · failed/unrun/blocked · evidence · next useful action`.

Theo C12 đã chốt, increment có checks phù hợp có thể commit/push nhánh feature; không tự merge main/deploy/phát hành installer. HTML review có receipt riêng, không tính là hoàn thành bước production tương ứng.
