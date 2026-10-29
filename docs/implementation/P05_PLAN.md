# P05 — kế hoạch trước khi code

Scope S040–S049. Logic compiler/engine có thể triển khai từ contracts khi editor panels chưa hoàn tất; full phase gate vẫn cần editor integration.

1. Shape trước semantic: full dependency closure, unique IDs/valid refs/ports, one edge/output, starts/terminals/reachability/cycles, typed mappings và loop scopes/budgets.
2. Expression AST parser whitelist (literal/path/comparison/boolean), không eval/new Function/arbitrary property traversal. Missing value là named error, không render undefined.
3. Compiler IR/source-map và effect gates: no arbitrary UI automation in TRACE; transaction intent/verify/review/cleanup policies phân biệt structural valid với DEVICE_TEST/REAL_JOB eligibility.
4. Interpreter call frames/locals/subflow/loop/break/continue, budget/cancel, source refs cho issues/logs. Pure handlers logic thật; external providers explicit unsupported nếu không có device service.
5. TRACE chỉ fixture scenarios; no fake post IDs/counters. Debug pause/continue/step vào/ra qua semantic boundaries; breakpoint resume token không pause vô hạn tại cùng node.
6. Tests invalid child/missing dependency/cycles/loop leak/reserved path/DSL injection, nested calls, cancel/budget, no hardware dispatch từ TRACE và resume breakpoint regression.

Không certify app chỉ vì compiler PASS. Core trace engine và hardware runtime receipts tách nhau; khi capability mới chưa đủ tests giữ PARTIAL/UNSUPPORTED.
