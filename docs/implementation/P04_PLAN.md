# P04 — kế hoạch trước khi code

Scope S029–S039; implement theo lát đủ save/reload. React Flow qua integration geometry/edge test; domain bundle không phụ thuộc library view model.

1. Library từ generated registry 40 nodes, search/groups/favorites, workflow CRUD và app filter độc lập. Generic custom app không nhận Facebook subflows/selectors.
2. Pure editor command store cho add/update/remove/connect/insert/duplicate/copy/paste/layout/group và bounded undo/redo. Một gesture = một history transaction, IDs stable/remap đúng scope.
3. Graph adapter world coordinates, named ports, no duplicate output edges, insert-edge atomic và cancel xóa pending state. Routing metadata tách semantics.
4. Pan/zoom/fit/minimap, Ctrl+K/F1, focus-aware shortcuts, nudge 1/10, selected-fit. Context menus node/edge/canvas đúng loại; screen-reader labels.
5. Properties theo config schema/node type, advanced relevant; typed inputs schema editor. Subflow create/open/back/convert single-entry with mapping, full bundle save/export/import/clone.
6. Save ACK/revision + dirty/error/conflict; immutable version tạo từ validated closure. Trace khác real run; hardware actions disabled với reason tới khi có backend.
7. Unit tests command invariants + actual browser/Electron round-trip/reload/undo/edge/subflow; desktop viewports không tràn. Library/test device/Process context regressions bắt buộc.

Không tính mọi control accepted bằng việc render. Những lát chưa làm ghi PARTIAL trong progress, tiếp tục làm; không fake success để lấp chức năng.
