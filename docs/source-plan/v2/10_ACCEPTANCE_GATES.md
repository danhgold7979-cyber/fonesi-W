# Acceptance, evidence và release gates

## Các gate

| Gate | Nội dung | Bằng chứng bắt buộc |
|---|---|---|
| G0 Plan consistency | Sources/hashes/commands/fields/node registry/steps/mapping không lệch | Plan validator report; không tính là app test |
| G1 Foundation | Frozen install, typecheck, lint, meaningful unit tests, build | Logs revision/tool versions/target/exit codes |
| G2 Persistence | Migrations/settings/workflow bundle/process/job snapshot | Restart/backup/restore/revision contention/integrity |
| G3 Authoring | UI/editor/fields/validator/trace/import/export | Actual E2E + invalid cases + screenshots/DPI |
| G4 Hardware baseline | Windows/ADB/USB/LAN/authorized devices | Host/device/version receipts, 2+ phones |
| G5 Technical risk | R1–R8, exact core assumptions | PASS/FAIL/DEFERRED per spike, evidence thực |
| G6 Runtime safety | Ownership/journal/uncertainty/cleanup | Fault injection around effect windows, no blind retries |
| G7 App certification | Exact workflow/app/version/locale/device profile | Controlled real flows; unsupported cases remain disabled |
| G8 Release | Installer clean machine, migrations, completeness | Signed/unsigned status, packaged smoke, actual supported scope |

G0–G3 không certify Android. App catalog 5 entries không đồng nghĩa 5 adapter PASS. Prototype screenshots và 101 trạng thái khảo sát không được tính vào app acceptance counts.

## Regressions bắt buộc

| ID | Trường hợp | Kết quả mong muốn |
|---|---|---|
| REG-01 | Device card Setup chuyển d1→d2 | Rows/schema/policy đúng Process hoặc empty, không còn d1 |
| REG-02 | Library tab chọn TikTok khi đang edit Facebook | Library filter đổi, editor workflow app không đổi |
| REG-03 | Workflow clone/export/import có custom subgraph + custom fields | Round-trip toàn bộ bundle/types/mappings |
| REG-04 | Invalid port/duplicate output/duplicate ordinary node ID | Validator reject trước save version/compile |
| REG-05 | Main hợp lệ nhưng child graph invalid/unreachable cycle | Full closure validation reject |
| REG-06 | Effect không có durable intent/dominance | Compile/eligibility reject, runtime journal bảo vệ |
| REG-07 | Continue sau breakpoint | Tiến đúng một lần, không pause lại ngay tại cùng node |
| REG-08 | Phone zoom 130 rồi Fit | Slider/label/transform/profile thống nhất |
| REG-09 | Quá hạn với next policy | Slots được chuyển tương lai theo Process timezone, không dùng ngày quá khứ |
| REG-10 | Device enabled/source/weekdays/reconcile settings qua restart | Giữ đúng scope và giá trị |
| REG-11 | `__proto__`/constructor/unknown nodes trong import | Reject an toàn, state/DB không bị mutate một phần |
| REG-12 | Explicit ID sai nhưng filename trùng | Unmatched/error, không fallback sửa dòng khác |
| REG-13 | Preview schedule xong data/revision đổi | Apply stale token bị reject, không tác động process khác |
| REG-14 | Duplicate occurrence/apply twice | Không tạo job thứ hai |
| REG-15 | Sửa draft/content sau schedule | Job frozen hashes giữ nguyên; source mutation preflight chặn |
| REG-16 | Hai worker/manual request cùng máy | Một owner; stale fencing token không gửi input |
| REG-17 | Crash trước/sau tap/verify/DB commit | Uncertainty recovery, không click Publish mù |
| REG-18 | Comment timeout sau gửi | Verify comment trước retry; không repost |
| REG-19 | Staging ledger/import path trỏ media không owned | Không delete; pending owned media được giữ |
| REG-20 | Popup message nguồn/origin/action sai | Bị reject, không route tới device |
| REG-21 | Typed custom fields 0/false/empty/list/file[] | Không mất type/value/order qua clone/import/save |
| REG-22 | Ctrl+A/Delete/Space trong textarea hoặc route khác | Không sửa graph/giật focus ngoài scope |
| REG-23 | SQLite đang WAL khi backup + upgrade | Backup restore integrity và transaction state nhất quán |
| REG-24 | App update ngoài selector profile | Chặn automation, giữ manual capability đúng thực tế |

## Feature completion

Mỗi command/field/node/event có owner, implementation, tests, failure handling và evidence. UI_ONLY không cần privileged backend nhưng vẫn có interaction test khi phức tạp. Persisted editor changes phải có save ACK. DEV_ONLY không nằm trên normal production path.

Feature status PLANNED → IMPLEMENTED → TESTED → ACCEPTED. Capability unsupported/DEFERRED được hiển thị và loại khỏi shipped scope rõ ràng; không đổi status thành accepted vì có modal giải thích.

## Receipt schema

Receipt theo `revision, buildId, planVersion, phaseId, stepId, testIds, started/endedAt, runner/toolVersions, OS/arch, deviceProfiles, passed/failed/skipped/unrun, exitStatus, evidenceRefs, limitations`. Phân biệt unit/integration/browser/Electron/Windows/hardware. Zero-test run không chứng minh gì; failure chưa giải thích chặn readiness của phần phụ thuộc.

Không commit raw secrets/private diagnostics vào Git. Device evidence giữ cục bộ/redacted; artifact share là thao tác riêng được người dùng chỉ định. CI reports phải thuộc run hiện tại, không dùng file cache của lần cũ.

## Release completeness

Chỉ shipped scope mới được claim: mọi reachable production control có handler đúng, validators real, no random/timer fake success, batch outcomes thật, no unowned control. Các counts error/missing handler/mock-only phải zero trong scope phát hành. Không phát hành chỉ vì build thành công; clean-machine smoke và migration/recovery vẫn là gate riêng.
