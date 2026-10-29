# Increment 005 — typed Process inputs và content data transactions

Đọc trước code: master V2.1/execution runbook, P06/P07 plans, operation policies và gates G1–G3/REG-12/13/15/21. Baseline code 3a3e9cd, repository receipt/archive head 968e6a7. Không đổi định nghĩa 15 phase/125 bước, không tuyên bố toàn P06/P07 accepted.

## Đối chiếu tổng thể và thứ tự

1. P06/S051: missing Process input values đang block schedule. Bổ sung typed persistence/UI/snapshot trước import.
2. P06/S056–S059: content query/selection, bulk/import preview/apply, format adapters và retention. Phụ thuộc S018/S050/S051 đã có phần nền; workspace import S021 vẫn riêng, không gọi content import là full workspace restore.
3. P07/S064/S068: queue claim/fencing/recovery nối P02 leases, chưa dispatch khi chưa có P08 worker. Timeline/spread là increment kế tiếp.
4. P04/P05 advanced editor/compiler/debugger, P02 workspace backup UI và P03 lifecycle vẫn còn; dùng progress để tiếp tục, không bỏ qua vì chưa có phone.
5. P08–P14: lập phase plan trước mỗi module; code/harness cloud riêng với Windows/Android receipts G4–G8. Không auto claim USB tại nhà, posting, routing hay installer.

## 005A — Process inputs (S051/S063)

- Thêm optional `fields` typed JSON map vào Process; record cũ giữ nguyên shape khi thiếu, read mặc định {}. Không sửa migration cũ hay âm thầm rơi field khi đổi schema/app.
- Draft cho phép missing required values để soạn; values đã có phải đúng key/type/scope và registered media/identity thuộc Process/app/device. Schema mismatch trả lỗi có đường dẫn; đổi workflow/app với values cần người dùng xử lý rõ trước khi save.
- UI form theo pinned version, tách khỏi row fields và Inspector test inputs; có dirty/save ACK/revision và giữ 0/false/missing/list order. File refs chỉ chọn asset trong Process; outputs không thành input editable.
- Schedule readiness kiểm đủ required Process fields; snapshot pin `processFields`, hash không đổi sau edit Process. Process asset refs phải nằm trong immutable asset snapshot, không dùng arbitrary IDs/path.
- Tests: legacy reopen, wrong types/unknown/reserved/scope rejected, draft missing required allowed nhưng apply blocked, filled values enable preview, edit sau apply không thay snapshot, E2E edit/save/reload.

## 005B — parser/matching/bulk core (S057/S058)

- Một package import-export có parser/encoder JSON + CSV, XLSX adapter sau licensing/resource spike. JSON giữ raw typed values; CSV typed fields dùng encoding rõ ràng có version/header và cell JSON để không mất number/false/list/datetime/file refs/missing-vs-empty. Spreadsheet formula-leading text neutralized; format metadata cho phép typed round-trip không tự suy diễn apostrophe/raw text.
- Imported selector: authoritative contentId (có mà sai là lỗi, tuyệt đối không fallback) → sourceId/registered relativePath → unique filename trong Process. Duplicate rows/multiple matches/errors báo từng dòng. Không nhận source grants hoặc root paths từ import.
- Sparse fields patch chỉ đổi key có mặt; empty khác missing; clear bulk là explicit REMOVE property, set/append/prepend kiểm type. List append/prepend giữ item nhiều dòng; không split bằng newline.
- Scope selected IDs/revisions, operation size budget rõ (không truncate); không hard-limit dataset tổng. File refs/identity validated cùng boundary với saveContent. Preview hiển thị số changed/unchanged/errors và impacted jobs giữ snapshot cũ.
- Tests fixtures actual BOM/quotes/newlines/Vietnamese/zero/false/empty/list/file arrays, malformed JSON/unsafe keys, formula escaping, wrong authoritative ID, ambiguous filenames, duplicate matches và wrong Process.

## 005C — persisted preview/apply (S057/S058/S059)

- Append migration 4 cho content proposals + payload hash/expiry/applied result; public apply chỉ token. Freeze Process schema/revision + matched rows/revisions + media mapping. Không giữ raw source bytes/path authority.
- Preview không mutate content; lỗi tồn tại thì canApply=false. Apply kiểm expiry/hash/stale data/schema/scope trước transaction; apply toàn bộ hoặc rollback. Apply lần hai/restart trả cùng result, không revision++ lần nữa.
- Refactor private content insert helper để reuse transaction không nested BEGIN. Ignore/delete không xóa files hoặc snapshots/history; không clear pending effects. Bulk applies không sửa job snapshots.
- Tests injected failure ở item thứ hai, stale row/schema/media, expired/tampered token, duplicate apply/reopen, one Process không tác động Process khác, file refs cross scope reject.

## 005D — compact UI + end-to-end (S056/S057/S058)

- Selection theo stable IDs, select filtered scope ghi số lượng rõ; đổi Process reset selection, filter không đổi IDs. Giữ toolbar gọn, bulk/import/export trong menu data.
- Import đọc file có size budget, chọn preview; errors/conversions/matches/jobs impacts hiển thị trước apply. Export chọn scope rõ, file download chứa schema/version. Không silently export trang đầu.
- Bulk form chọn field/operation/value typed; xem preview trước mutate. Cancel không ghi DB. Background response cũ không chèn vào Process mới; đang apply khóa double click nhưng backend vẫn idempotent.
- E2E: Process fields round-trip, CSV/JSON import export, error authoritative ID, preview stale, apply twice qua API, filtered selection/bulk, immutable scheduled jobs. Full check/build/lint/unit + Chromium/Electron smoke; receipt ghi revision và UNRUN native/Windows/hardware.

Mỗi tiểu bước chỉ bắt đầu sau khi đọc phần tương ứng; nếu phát hiện cần đổi contract hoặc dependency, cập nhật kế hoạch ngay trước code. Parser mới chỉ pin sau đọc metadata/license và chạy fixture spike. XLSX unsupported tạm không được báo hoàn thành S058.

### Quyết định parser/resource trước 005B

Registry metadata đã đọc: csv-parse 7.0.3 (MIT, modified 25/09/2026), csv-stringify 6.9.0 (MIT, cùng ngày); read-excel-file 9.3.12 (MIT, modified 07/10/2026), write-excel-file 4.1.1 (MIT, modified 08/06/2026). Chọn bốn adapter này, không dùng ExcelJS 4.4.0 (metadata modified 2024) hoặc xlsx registry cũ. Đọc types/README sau install trước khi nối adapter.

Canonical CSV/XLSX: `$format=autoreels-content/1`, selectors và `field.<key>` chứa JSON cell literals; blank canonical cell = missing/unchanged, JSON `""` = explicit empty. Cách mã hóa này giữ raw typed values và không sinh formula-leading text. Raw CSV/XLSX ngoài format dùng headers khớp field/selector; conversions theo schema xuất hiện trong preview, không tự đoán list bằng newline. JSON có version/schema/rows rõ.

XLSX import phải kiểm ZIP central/local directory, method/encryption/ZIP64, CRC và actual decompressed size bằng Node zlib `maxOutputLength` trước parser. Budget từng operation: file 4MiB, ZIP expanded 32MiB, entry 16MiB/256 entries, 1000 content rows, 128 columns, XML không DTD/entity/formula và <=100000 cells. Không extract file, không formula evaluation hoặc silently cached formula results. Dữ liệu lớn chia lô, dataset không bị hard-limit. Thêm fixtures tampered sizes/CRC/formula/oversized archives trước khi claim XLSX hỗ trợ.

### Chi tiết 005D — table DOM budget

Registry kiểm tra @tanstack/react-virtual 3.14.22 (MIT, modified 22/10/2026) trước khi pin. Table dùng stable ContentItem ID làm virtual key, đo row height thật, overscan 8; header checkbox chọn toàn bộ filtered IDs có nhãn scope. Filter reset scroll nhưng giữ selected IDs cùng Process; đổi Process clear selection. Tests 1200 rows: DOM bounded, cuộn/filter/edit không đổi nhầm ID. Đây là DOM virtualization; server cursor/query paging/scale acceptance vẫn ghi riêng nếu chưa triển khai.
