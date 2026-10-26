# ADR 002 — content format adapters và dữ liệu typed

Ngày 26/10/2026; scope S051/S056/S057/S058, chi tiết trước code trong INCREMENT-005_PLAN.md.

## Chọn dependency

- csv-parse 7.0.3 + csv-stringify 6.9.0; read-excel-file 9.3.12 + write-excel-file 4.1.1. Metadata và LICENSE trong package đã đọc: MIT. Versions pin exact/integrity trong pnpm lockfile. Không dùng xlsx registry cũ hoặc ExcelJS 4.4.0 có metadata cập nhật cuối 2024.
- @tanstack/react-virtual 3.14.22 MIT cho DOM virtualization theo stable row ID và row height đo thực.
- XLSX adapter dùng Node/Buffer; renderer không load parser ZIP/XML hoặc nhận filesystem path từ dữ liệu. Native dialog và content file import có authority khác nhau; JSON/CSV không thể tạo SourceGrant.

## Format có thể round-trip

JSON envelope `format=autoreels-content`, `version=1`, Process ID/schema và rows có contentId/fields/ordered assetIds. Không tự thay schema hoặc remap ID sang Process khác.

Canonical CSV/XLSX có `$format=autoreels-content/1`; selectors/field cells dùng JSON literals, header `field.<key>`. Blank canonical cell = missing, JSON `""` = explicit empty, JSON `false`/`0`/arrays giữ type. Các ô string chứa JSON quotes, không thành formula-leading spreadsheet expressions. XLSX writer dùng String cells, không formula cells.

CSV/XLSX bên ngoài format: selector columns + headers field trong schema; convert number/boolean/structured values theo schema, báo conversions và lỗi từng dòng. Không suy diễn list bằng newline, không ép blank numeric thành 0. Header trùng/unknown, malformed quoting hoặc workbook nhiều sheet reject; không silently bỏ dữ liệu.

## Giới hạn tài nguyên theo operation

File 4 MiB, 1000 rows, 128 columns; vượt thì chia lô, không truncate. Dataset được kiểm thử 1200 records qua hai operation. XML/ZIP gate trước parser kiểm actual inflate output, CRC/size/local-central bounds, duplicate/path names, encryption/method/ZIP64, 256 entries/16 MiB entry/32 MiB expanded/100000 cells và nesting. Formula/DTD/entity bị reject trước đọc cached results. Không extract ZIP vào filesystem.

Preview lưu token/hash/expiry/context; authoritative ID sai không fallback; ambiguous path/basename/duplicate target không apply. Transaction apply kiểm lại context và toàn bộ fields/registered refs; retry/restart không sửa revision lần hai. Preview có actual before/after values, mutations không đụng job snapshots hoặc source files.

## Bằng chứng và giới hạn

Tests round-trip bytes thật cả 3 format; malicious/corrupt archives, formula/entity/nesting/budget, matching/stale/rollback/restart/typed scopes; Chromium bulk/import/export/Process fields/1200-row DOM và Electron sandbox XLSX qua preload/worker.

Đây là content import/export. Workspace remap/backup restore UI, schema migration mapping, full source rebind/adoption, thumbnail cache và server cursor pagination vẫn là các bước chưa nghiệm thu; không suy từ adapter PASS ra full P06 accepted. Windows native dialogs/performance/licensing bundle release có gates riêng.
