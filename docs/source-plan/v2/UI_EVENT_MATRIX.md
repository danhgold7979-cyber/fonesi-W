# Gesture, delegation và keyboard

Các interaction không đi qua action dispatcher; phải triển khai và kiểm thử cùng controls.

| ID | Binding | Hành vi | Phase |
|---|---|---|---|
| EVT-001 | `data-view` | Sáu route, giữ context và dirty-state warning | P03 |
| EVT-002 | `data-add/data-modal-add` | 40 node variants, insert edge phải atomic | P04 |
| EVT-003 | `data-sub-add` | Tạo tham chiếu subflow có mapping/type/version | P04 |
| EVT-004 | `data-lib` | Node/subflow tabs, search giữ đúng library | P04 |
| EVT-005 | `data-bottom` | Properties/tree/variables/logs/debug | P03 |
| EVT-006 | `data-tree/phone-screen` | Snapshot match thực, target count và stale state | P09 |
| EVT-007 | `data-device-setup` | Chọn Process qua context service, không mutate device đơn lẻ | P06 |
| EVT-008 | `data-device-inspector` | Đổi test device độc lập Process | P09 |
| EVT-009 | `data-device-card/device-select` | Active device và selected group là hai state | P08 |
| EVT-010 | `data-setup-device/setup-app/setup-workflow/setup-account/setup-target` | Đổi binding có save/load atomic, refs được kiểm tra | P06 |
| EVT-011 | `data-library-app` | Library filter không đổi app của workflow đang chỉnh | P04 |
| EVT-012 | `data-open-wf/data-wf-menu` | Bundle nguyên khối và version đúng | P04 |
| EVT-013 | `data-day` | Weekdays per-process, ít nhất một ngày | P07 |
| EVT-014 | `data-input-key/type/scope/required/delete` | Typed declarations, reserved/duplicate keys rejected | P01 |
| EVT-015 | `data-row-check/data-row-field/data-row-more` | Stable content ID, persist edits, details read-only | P06 |
| EVT-016 | `data-prop` | Property config theo node schema, validation inline | P04 |
| EVT-017 | `data-process-extra/dynamic row columns` | 9 data types theo workflow version, preserve round-trip | P06 |
| EVT-018 | `data-slot/daily/start-date/schedule-scope` | Slots/time/scope valid, page 24 chỉ UI pagination | P07 |
| EVT-019 | `data-device-enable` | Enabled persisted; không giả online/automation capability | P08 |
| EVT-020 | `phone-resize/resize-y/data-size` | Bounds, pointer capture, world coordinates, persist geometry | P04 |
| EVT-021 | `data-port/data-edge/data-reroute` | Valid ports/edge routing with topology checks | P04 |
| EVT-022 | `data-toggle-group` | Group visual only, membership after node delete/move | P04 |
| EVT-023 | `wheel/pointer/drop/contextmenu` | Canvas drag/pan/zoom/marquee, grid drag timeline | P04 |
| EVT-024 | `keydown/keyup` | Ctrl+S/Z/Y/C/V/D/A/F/0,F2,Delete,Space,Esc: scope/focus | P04 |
| EVT-025 | `folder-input/media-input/csv-input/workflow-input` | File dialogs and imports validate before state mutation | P06 |
| EVT-026 | `message/popup beforeunload` | Sender+origin+channel/nonce allowlist; no arbitrary action relay | P09 |
