# Catalog 40 loại node

Ports/config ở đây là thiết kế V2, không khẳng định HTML đã thực thi những contract đó. Error port không nối dùng STOP_FOR_REVIEW theo runtime contract.

| ID | Type / tên | Ports V2 | Config theo type | Runtime boundary |
|---|---|---|---|---|
| NODE-001 | `start` — Bắt đầu | next | inputSchemaRef | PURE_ENGINE |
| NODE-002 | `end` — Kết thúc | terminal | outputMapping | PURE_ENGINE |
| NODE-003 | `condition` — If / Else | true, false, error | expression | PURE_ENGINE |
| NODE-004 | `loop` — Vòng lặp giới hạn | body, done, error | maxIterations, bodyGraphRef, itemBinding | PURE_ENGINE |
| NODE-005 | `break` — Thoát vòng lặp | terminal | loopScope | PURE_ENGINE |
| NODE-006 | `continue` — Lượt tiếp theo | terminal | loopScope | PURE_ENGINE |
| NODE-007 | `subflow` — Quy trình con | next, error, review | workflowVersionRef, graphRef, inputMapping, outputMapping | PURE_ENGINE |
| NODE-008 | `launch` — Mở ứng dụng | next, error | packageRole, expectedForeground | ADAPTER_OR_DEVICE_SERVICE |
| NODE-009 | `installed` — Kiểm tra đã cài app | true, false, error | packageRole | ADAPTER_OR_DEVICE_SERVICE |
| NODE-010 | `current` — Kiểm tra app hiện tại | true, false, error | packageRole | ADAPTER_OR_DEVICE_SERVICE |
| NODE-011 | `closeapp` — Đóng / mở lại app | next, error | packageRole, restart, expectedState | ADAPTER_OR_DEVICE_SERVICE |
| NODE-012 | `back` — Back / Home / Recent | next, error | key | ADAPTER_OR_DEVICE_SERVICE |
| NODE-013 | `tap` — Bấm phần tử | next, error | selector, effectClassification | ADAPTER_OR_DEVICE_SERVICE |
| NODE-014 | `doubletap` — Bấm đúp | next, error | selector, intervalMs | ADAPTER_OR_DEVICE_SERVICE |
| NODE-015 | `hold` — Nhấn giữ | next, error | selector, durationMs | ADAPTER_OR_DEVICE_SERVICE |
| NODE-016 | `drag` — Kéo thả | next, error | from, to, durationMs | ADAPTER_OR_DEVICE_SERVICE |
| NODE-017 | `swipe` — Vuốt màn hình | next, error | from, to, durationMs | ADAPTER_OR_DEVICE_SERVICE |
| NODE-018 | `scroll` — Cuộn tới phần tử | next, error | selector, direction, maxScrolls, stableLimit | ADAPTER_OR_DEVICE_SERVICE |
| NODE-019 | `pinch` — Chụm / mở hai ngón | next, error | center, scale, durationMs | ADAPTER_OR_DEVICE_SERVICE |
| NODE-020 | `type` — Nhập văn bản | next, error | selector, textTemplate, unicodeMode, verifyMode | ADAPTER_OR_DEVICE_SERVICE |
| NODE-021 | `clear` — Xóa nội dung ô nhập | next, error | selector, verifyEmpty | ADAPTER_OR_DEVICE_SERVICE |
| NODE-022 | `keyboard` — Ẩn / thao tác bàn phím | next, error | operation | ADAPTER_OR_DEVICE_SERVICE |
| NODE-023 | `find` — Tìm XPath / thuộc tính | true, false, error | selector, matchPolicy | ADAPTER_OR_DEVICE_SERVICE |
| NODE-024 | `image` — Tìm ảnh mẫu | true, false, error | templateAssetRef, confidence, region | ADAPTER_OR_DEVICE_SERVICE |
| NODE-025 | `ocr` — Đọc chữ OCR | next, error | locale, region, confidence, outputBinding | ADAPTER_OR_DEVICE_SERVICE |
| NODE-026 | `read` — Đọc thuộc tính / văn bản | next, error | selector, attribute, outputBinding | ADAPTER_OR_DEVICE_SERVICE |
| NODE-027 | `wait` — Chờ thời gian / ngẫu nhiên | next, error | minMs, maxMs | PURE_ENGINE |
| NODE-028 | `waitfor` — Chờ điều kiện | next, error | condition, pollInterval, deadlineMs | ADAPTER_OR_DEVICE_SERVICE |
| NODE-029 | `screenshot` — Chụp màn hình | next, error | region, outputAssetRef | ADAPTER_OR_DEVICE_SERVICE |
| NODE-030 | `setvar` — Gán / biến đổi biến | next, error | targetPath, expression | PURE_ENGINE |
| NODE-031 | `row` — Đọc dòng công việc | next, error | contentItemRef, fieldMapping | PURE_ENGINE |
| NODE-032 | `stage` — Chuyển nội dung sang máy | next, error | assetRefs, ownedNamespace, progressPolicy | ADAPTER_OR_DEVICE_SERVICE |
| NODE-033 | `index` — Chờ MediaStore | next, error | stagedAssetRef, readinessPolicy | ADAPTER_OR_DEVICE_SERVICE |
| NODE-034 | `selectmedia` — Chọn đúng nội dung | next, error | stagedAssetRefs, selectionProof | ADAPTER_OR_DEVICE_SERVICE |
| NODE-035 | `cleanup` — Xóa tệp staging đã sở hữu | next, error | ownershipLedgerRef, terminalPolicy | ADAPTER_OR_DEVICE_SERVICE |
| NODE-036 | `transaction` — Ghi ý định gửi / đăng | next, error | effectKind, idempotencyScope, payloadHash | TRANSACTION_SERVICE |
| NODE-037 | `verify` — Xác minh kết quả | true, false, error | verificationProfile, evidenceMapping | ADAPTER_OR_DEVICE_SERVICE |
| NODE-038 | `output` — Ghi dữ liệu đầu ra | next, error | schemaRef, valueMapping | PURE_ENGINE |
| NODE-039 | `review` — Dừng để kiểm tra | terminal | reasonCode, evidenceRefs | PURE_ENGINE |
| NODE-040 | `log` — Ghi nhật ký | next, error | level, messageTemplate, redactionPolicy | PURE_ENGINE |
