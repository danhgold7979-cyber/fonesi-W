# Gesture, delegation và keyboard

Interactions ngoài action dispatcher, có bước triển khai cụ thể và test IDs; chưa phải tests đã chạy.

| ID | Binding | Hành vi | Owner | Bước | Test |
|---|---|---|---|---|---|
| EVT-001 | data-view | Sáu route, giữ context và dirty-state warning | P03 | S024 | UI-EVT-001 |
| EVT-002 | data-add/data-modal-add | 40 node variants, insert edge phải atomic | P04 | S030, S032 | UI-EVT-002 |
| EVT-003 | data-sub-add | Tạo tham chiếu subflow có mapping/type/version | P04 | S037 | UI-EVT-003 |
| EVT-004 | data-lib | Node/subflow tabs, search giữ đúng library | P04 | S029 | UI-EVT-004 |
| EVT-005 | data-bottom | Properties/tree/variables/logs/debug | P03 | S025, S038, S082 | UI-EVT-005 |
| EVT-006 | data-tree/phone-screen | Snapshot match thực, target count và stale state | P09 | S082, S083 | UI-EVT-006 |
| EVT-007 | data-device-setup | Chọn Process qua context service, không mutate device đơn lẻ | P06 | S050, S024 | UI-EVT-007 |
| EVT-008 | data-device-inspector | Đổi test device độc lập Process | P09 | S081 | UI-EVT-008 |
| EVT-009 | data-device-card/device-select | Active device và selected group là hai state | P08 | S075 | UI-EVT-009 |
| EVT-010 | data-setup-device/setup-app/setup-workflow/setup-account/setup-target | Đổi binding có save/load atomic, refs được kiểm tra | P06 | S050, S051 | UI-EVT-010 |
| EVT-011 | data-library-app | Library filter không đổi app của workflow đang chỉnh | P04 | S029, S024 | UI-EVT-011 |
| EVT-012 | data-open-wf/data-wf-menu | Bundle nguyên khối và version đúng | P04 | S029, S016 | UI-EVT-012 |
| EVT-013 | data-day | Weekdays per-process, ít nhất một ngày | P07 | S060 | UI-EVT-013 |
| EVT-014 | data-input-key/type/scope/required/delete | Typed declarations, reserved/duplicate keys rejected | P01 | S010, S036 | UI-EVT-014 |
| EVT-015 | data-row-check/data-row-field/data-row-more | Stable content ID, persist edits, details read-only | P06 | S056, S059 | UI-EVT-015 |
| EVT-016 | data-prop | Property config theo node schema, validation inline | P04 | S036 | UI-EVT-016 |
| EVT-017 | data-process-extra/dynamic row columns | 9 data types theo workflow version, preserve round-trip | P06 | S051 | UI-EVT-017 |
| EVT-018 | data-slot/daily/start-date/schedule-scope | Slots/time/scope valid, page 24 chỉ UI pagination | P07 | S060, S062 | UI-EVT-018 |
| EVT-019 | data-device-enable | Enabled persisted; không giả online/automation capability | P08 | S075 | UI-EVT-019 |
| EVT-020 | phone-resize/resize-y/data-size | Bounds, pointer capture, world coordinates, persist geometry | P04 | S030, S084 | UI-EVT-020 |
| EVT-021 | data-port/data-edge/data-reroute | Valid ports/edge routing with topology checks | P04 | S032, S033 | UI-EVT-021 |
| EVT-022 | data-toggle-group | Group visual only, membership after node delete/move | P04 | S035 | UI-EVT-022 |
| EVT-023 | wheel/pointer/drop/contextmenu | Canvas drag/pan/zoom/marquee, grid drag timeline | P04 | S030, S034, S066 | UI-EVT-023 |
| EVT-024 | keydown/keyup | Ctrl+S/Z/Y/C/V/D/A/F/0,F2,Delete,Space,Esc: scope/focus | P04 | S031, S034, S039 | UI-EVT-024 |
| EVT-025 | folder-input/media-input/csv-input/workflow-input | File dialogs and imports validate before state mutation | P06 | S052, S058, S021 | UI-EVT-025 |
| EVT-026 | message/popup beforeunload | Sender+origin+channel/nonce allowlist; no arbitrary action relay | P09 | S084 | UI-EVT-026 |
