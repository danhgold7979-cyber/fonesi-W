# P01 — kế hoạch trước khi code

Scope S007–S013; prerequisites implementation là toolchain P00. Full phase acceptance chỉ sau P00 gate. Chỉ làm contracts/domain có tests; chưa có thiết bị.

1. App registry mở theo safe ID/package, 5 seed metadata; capability/certification/profile độc lập. Test custom app, duplicate IDs/packages và profile mismatch.
2. Workflow wire format dùng schema V2 đã kiểm tra; generate runtime schema/40 node registry từ plan, giữ parity và không sửa reference. Validate JSON-safe/plain objects, limits/depth/finite numbers/unsafe keys trước Ajv.
3. Typed input values đủ 9 loại, scopes/mapping và safe field keys; preserve missing/0/false/empty/list/file order. Runtime checks là nguồn quyết định, không tin TS cast.
4. Workflow canonicalization/hash trong host/domain, immutable version đầy đủ closure; draft revision riêng. App/workflow/test receipt exact-profile gating, user readiness không đồng nhất built-in certification.
5. Process IDs/bindings, schedules per Process, content/assets/job/effect states. Define allowed transitions, uncertainty/partial-result và one-owner lease policy trước DB.
6. Typed request/result/error/event envelopes, allowlisted command schemas, expectedRevision cho mutations. No generic invoke/shell/path API. Batch partial/cancel counts có invariant.
7. Unit tests cho malformed/unknown keys/configs, global context separation policy, stale readiness, invalid transitions, ambiguous effects, typed values và canonical hash stable/key-order invariant.

Deliverables: packages/contracts, packages/domain, generator, tests, receipt. Không claim compiler topology/driver/Android đã xong chỉ bằng shape validation. Full bundle semantic validation theo P05; device eligibility vẫn fail khi chưa có profile/receipt.
