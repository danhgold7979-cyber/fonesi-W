# ADR-001 — SQLite và validator CSP

Ngày 26/10/2026, lựa chọn dựa kiểm tra đã chạy trong checkpoint đầu tiên.

## SQLite

Chọn bundled `node:sqlite` qua adapter `StudioDatabase` ở serialized DB worker. Node host 24.19.0 / SQLite 3.53.3 và Electron 45.0.0 (bundled Node 24.22.0 / SQLite 3.53.4) đã thực hiện transaction rollback, Unicode read/write, close/reopen, online backup và integrity check trên Linux. Không cần native addon SQLite bên ngoài cho stack này; giữ service boundary để thay driver nếu target khác không đạt.

Renderer không gọi SQL. Host cấp named API, kiểm DTO/sender/origin trước request vào worker. Windows/packaged-clean-machine vẫn UNRUN; Linux native smoke không suy ra Windows PASS.

## CSP

Browser integration phát hiện Ajv runtime compilation dùng code generation, bị CSP `script-src 'self'` chặn. Chọn Ajv standalone build-time generation từ schema chuẩn; generated validator là module tĩnh, không compile schema/eval/new Function trong renderer. Không thêm unsafe-eval để làm UI chạy.

`tools/generate-contracts.mjs --check` kiểm parity; `tools/copy-runtime.mjs` đưa validator vào host dist. Node/vite runtime interop của các helper Ajv được xác minh bằng unit tests, actual browser authoring và Electron preload save/reload.
