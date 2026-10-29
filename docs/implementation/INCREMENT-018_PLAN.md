# Increment018 — P06/S052 native source rebind giữ ID

Plan trước code;017 đã qua201 unit/integration và18 browser. Scope chọn lại nguồn có permission thực, không đăng ký nguồn mới rồi bỏ các ContentItem cũ.

1. Named `rebindSource(id,expectedRevision)` chỉ mở native dialog. Không nhận rootPath/kind/host từ renderer. Main đọc private binding để chọn đúng FOLDER/FILE, approve canonical path, cancel không mutate DB. Existing chooser busy guard dùng chung.
2. Private DB operation giữ source/content/asset IDs, tăng revision và thay host/root được main cấp quyền. Reject archived Process/stale revision, không nâng foreign-host metadata thành quyền đọc khi chưa chọn lại. Ngừng nguồn có thể được mở lại bằng hành động rebind explicit.
3. Folder giữ relative paths; file rename giữ entry/content ID và đổi bound basename, không sửa immutable asset origin metadata. Mark chưa xác minh là MISSING tới khi scan thật: cùng bytes→READY, khác bytes→CHANGED. Source/ignore ledger remap atomic; không đổi snapshot/hash của job cũ.
4. Cancel/await scan cũ trước commit, revision fences callback cũ; refresh coordinator và quét lại sau rebind. UI cho thấy source inactive, trạng thái cần chọn lại và nút chọn lại chỉ khi native chooser khả dụng; Process callback generation giữ scope.
5. Tests actual temp filesystem/host picker: folder relocation, foreign-host rebind, file rename/same bytes, changed bytes, chooser cancel/stale callback/invalid raw path/archived source. ID và source bytes giữ nguyên; old grant không được áp scan sau revision mới. Browser API boundary không có native picker phải reject rõ.

Tiếp theo018 là explicit adoption của bytes mới, thumbnails/query/migration UI. Windows dialog interaction và physical gates chưa được suy PASS từ fixture picker.
