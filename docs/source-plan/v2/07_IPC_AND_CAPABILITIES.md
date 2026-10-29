# IPC, events và capability gates

## API boundaries

| Namespace | Commands/events tối thiểu |
|---|---|
| workspace | getMetadata, getPreferences, updatePreferences, previewImport, commitImport, exportBackup |
| workflows | list/get/create/archive/rename/clone; getDraft/saveDraft(expectedRevision); validateBundle |
| workflowVersions | createFromDraft, list/get, exportBundle, certificationStatus |
| editor | renderer-local commands/undo/geometry; draft persistence qua workflows, không shell |
| debugSessions | start(mode/profile/bindings), pause/continue/step/stop; state/log/trace events |
| schemas | validateDeclarations, validateMapping; persistence trong draft/version |
| processes | list/get/create/update/clone/archive, bindings, source policies, typed fields |
| media | registerDialogSelection, queryItems/update/bulk/ignore/reconcile, previewImport/commitImport/export |
| scheduler | preview/apply(token), queryTimeline, reschedule(expectedRevision), clearPending, spreadPreview/apply |
| jobs | get/list/enqueueNow/cancel/retryAllowedAction; durable state events |
| devices | list/scan/connectPair/getDetails/setEnabled/reconnect, discoveredAppProfiles |
| workers | acquireManual/releaseManual/pauseAtSafePoint/resumeAfterRedetect, ownerState |
| streams | subscribe/unsubscribe/profile/visibility/requestFrame; frame channel riêng |
| inspector | captureSnapshot/queryElements/pick/validateSelector; read-only tới khi control mode |
| manualControl | tap/swipe/gesture/key/group với lease/fencing token |
| identities | scan/list/verify/switch, metrics snapshots/history theo app adapter |
| transactions/review | getEffects/getEvidence/listReviewCases/recordResolution; không generic retryPublish |
| network/proxy/apk | validated operations theo capability, bounded batch results |
| diagnostics/system/app | metrics, capture/export, notifications, tray/background/Quit lifecycle |

Form-open/selection/fit/viewport không cần privileged IPC nếu dữ liệu cần thiết đã có. UI geometry có thể lưu preferences. Action “Save” commit theo domain đang chỉnh; không expose một `invoke(channel:any,args:any)` trong preload.

## Request/result envelope

Request có operationId, expectedRevision khi mutate, entity refs, DTO đã schema-validate. Result phân biệt ok/error/cancelled; error có code/message/retryable/retryScope/requiresReview và diagnostic ref đã redacted. Exception không làm UI tự hiển thị success.

Batch: items `{deviceId, ok, value?, error?}`, requested/succeeded/failed/cancelled counts nhất quán. Một máy fail không làm giả global success. Atomicity của DB operations khác non-atomic external device actions.

Events có sequence/runRevision và IDs; renderer reconnect/query snapshot trước khi áp event mới để tránh out-of-order. Long operations có progress/cancel; cancel không hủy recovery bắt buộc của pending effect.

## Trust boundary

- Main kiểm tra sender/frame URL và schemas, không chỉ validate ở renderer.
- Path permissions phát sinh từ host dialog/registered source refs, không từ raw path do import/UI gửi.
- File import có size/resource budgets theo operation; parse/preview trong worker; atomic commit và backup/rollback.
- DOM render không nối imported IDs vào HTML attribute chưa escape. Dùng React nodes, safe geometry constraints và validated refs.
- Popup IPC channel bind với window/session/device scope; postMessage cần source+origin+nonce+action allowlist, không `*` arbitrary relay.
- Runtime secrets qua OS vault references; logs/exports không có password, clipboard raw text hoặc private app storage.

## Capability model

`registered`, `connected`, `manualControlSupported`, `streamSupported`, `inspectorSupported`, `automationEligible`, `certificationState`, `blockReasons[]` là các chiều riêng.

App catalog có Facebook/Lite/Instagram/TikTok/Threads; mọi entry ban đầu `automationCertification=NOT_RUN`. Selector profiles theo package/versionCode/versionName/locale/Android đặc thù. Không đổi tên template rồi certify app khác.

Workflow structural validity không xác nhận profile/target/account. Version mới hoặc app update làm certification cần kiểm lại. Metrics không đọc được không tự chặn posting khi identity verify vẫn đạt. Identity không rõ thì dừng, không chọn theo tên giống nhau.

## Chế độ chưa có backend/device

Các route authoring vẫn dùng được với Process draft chưa gán máy. Hardware actions disabled có lý do và đường hướng dẫn kết nối. Không dùng 4 máy/2 account demo làm production defaults. Dev fixtures có namespace/DB riêng, không vào job scheduler/history/counters thật.
