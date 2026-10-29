# Workflow, node và execution contracts

## Bundle và version

Workflow bundle có `{formatVersion, workflowId, appId, mainGraphId, graphs, inputs, outputs, dependencies}`. Mọi graph ref được namespaced và có input/output schemas riêng. Reusable subworkflow pin version/hash; local subgraph thuộc bundle. Export/clone/import phải giữ đầy đủ dependency closure, không chỉ main.

Draft revision tăng khi lưu. Create Version đóng một bundle canonical/hash thành immutable version và trả đúng `versionId/versionNumber/hash`. Hardware certification là record khác; UI không đồng nhất “tạo phiên bản” với “đã chạy được trên máy”.

`schemas/workflow.schema.json` là planning envelope. JSON Schema chỉ kiểm shape/types; semantic compiler vẫn kiểm keys/IDs/ports/refs/reachability/types/side effects. Không dùng việc schema PASS làm bằng chứng app selectors đúng.

## 40 node types

Registry chuẩn ở `node-catalog.json`. Nhóm:

- Control: start/end/condition/loop/break/continue/subflow.
- App/system: launch/installed/current/closeapp/back.
- Input: tap/doubletap/hold/drag/swipe/scroll/pinch/type/clear/keyboard.
- Recognition/wait: find/image/ocr/read/wait/waitfor/screenshot.
- Data/media: setvar/row/stage/index/selectmedia/cleanup.
- Transactions/results: transaction/verify/output/review/log.

Mỗi node có typed config riêng, timeout/cancel/retry policy, input/output requirements và handler/capability. Node registry sinh library/properties/validator/handler declaration từ cùng nguồn; không duy trì 4 danh sách lệch nhau.

### Ports

Start chỉ next; end/review không output. Condition/find/image/installed/current/verify có true/false/error. Loop có body/done/error; break/continue chỉ hợp lệ trong lexical loop body. Subflow có next/error/review và return mapping. Node action/service có next/error. Error không nối có thể đi global `STOP_FOR_REVIEW`, nhưng không tự coi là next/success; compiler ghi default handler rõ. Successful required ports phải đủ, output trùng bị chặn trừ explicit fan-out semantics được thiết kế sau.

Legacy graph next-only không tự được certify. Migration preserve source, report missing ports/mapping và default error route, không lặng lẽ viết thêm nhánh thành công.

### Loop và subflow

- Loop có maxIterations + wall-clock/step budget; body graph scope, item/index bindings; break/continue trả signal cho đúng loop frame.
- Không dùng wire cycle tự do để biểu diễn loop; không recursive subflow.
- Interpreter có call stack, graphId/nodeId, input/locals/outputs, loop cursor, attempt/effect refs và cancellation token.
- Step over chạy một semantic unit; step into vào subflow; step out về caller; breadcrumb theo stack thật.
- Breakpoint có resume token để Continue đi qua breakpoint hiện tại một lần, không pause lại ngay.
- Undo chỉ tác động thiết kế; không thu hồi input đã gửi điện thoại.

## Validator/compiler gates

1. Shape/types, finite geometry/numbers, enum allowlist, resource budget, safe key names.
2. Unique IDs theo scope; edges có source/target/port thực; một edge/output; start/terminal rules.
3. Reachability và dead ends; cycle detection toàn bộ relevant graphs; disconnected errors không bị bỏ qua.
4. Dependency closure, graph refs, no recursion, typed input/output mapping, field existence.
5. Loop/break/continue lexical validity và bounded budgets.
6. Transaction dominance/effect policy: intent/journal trước irreversible effect, verification/review route trước cleanup.
7. Workflow app và adapter/profile match; schema/media/target capability match.
8. Run preflight/certification: compiler valid khác hardware eligible.

Node names và một cờ `effect` do renderer nhập không đủ chứng minh tap không gây publish. Adapter certification và reviewed workflow version quyết định real execution eligibility. Raw arbitrary UI input của operator phải ở manual/test mode có quyền điều khiển và diagnostics rõ; không quảng cáo validator loại bỏ mọi rủi ro side effects.

## DSL và mappings

Expression AST whitelist hỗ trợ literal, boolean/comparison, field path và helper an toàn được đăng ký. Không eval/new Function, không arbitrary property traversal, không dynamic shell/network/file code. `{{row.caption}}` render từ typed bindings; missing required field là error, không text literal “undefined”. List length/index phải kiểm type/bounds.

Mỗi run đóng bindings từ Process snapshot + ContentItem snapshot + outputs đã verify. `output.postId` chỉ được gán sau verification có evidence, không dựa `runState.finished`.

## Execution modes

| Mode | Nguồn dữ liệu | Được gửi thao tác thiết bị? | Kết quả |
|---|---|---|---|
| TRACE | Explicit fixture/branch scenario | Không | Trace report, không POSTED |
| DEVICE_TEST | User-selected compatible device, explicit test scope | Có qua lease/gates | Test receipt, không giả production certification |
| REAL_JOB | Immutable scheduled/manual job snapshot | Có qua full preflight/certified profile | Durable run/effect/job states |

Prototype Run tô sáng đường chính và chưa vào subflow/loop thật. V2 không dùng timer đó làm interpreter production. UI debug controls là chức năng thật khi backed bởi session engine; fixture-only scenario/forced branches chỉ ở TRACE/dev.

## Handler interface dự kiến

`execute(nodeConfig, RunContext, AbortSignal) -> NodeResult` với kết quả discriminated `{kind:'next'|'branch'|'return'|'review'|'error', output?, evidenceRefs?, error?}`. Handler không tự mutate renderer state. External actions luôn có operationId/deviceId/jobId/attempt/leaseGeneration.

Retry chỉ cho safe/idempotent scope có maxAttempts/backoff/redetect. Timeout publish/comment tạo uncertainty verification, không retry click. Random wait bắt đầu sau action-complete + verify, được record/replay; không thay thế điều kiện readiness.
