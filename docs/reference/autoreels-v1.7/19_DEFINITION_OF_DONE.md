# 19 — DEFINITION OF DONE / PHASE EXIT GATES

## Why this exists

A phase is not complete when the UI looks finished.

A phase is complete only when its user-visible functionality is backed by:
- real implementation;
- persistence/state where required;
- failure behavior;
- tests;
- evidence.

## Feature-level Definition of Done

For every BACKEND feature in `18_UI_BACKEND_TRACEABILITY.md`:

- [ ] UI control exists or is intentionally removed.
- [ ] typed renderer API exists.
- [ ] preload exposes only the required method/event.
- [ ] Main validates input.
- [ ] domain/service implementation is real.
- [ ] device/filesystem/network operation is real where applicable.
- [ ] state is persisted when required.
- [ ] success is reported from real result, not a timer/mock.
- [ ] failure is visible and structured.
- [ ] cancellation/timeout behavior is defined.
- [ ] unit test exists where logic is testable.
- [ ] integration test exists for IPC/service boundary.
- [ ] real-device acceptance test exists for Android behavior.
- [ ] traceability row is marked ACCEPTED.

## Phase-level exit

A phase may close only if:

```text
planned backend features for phase == accepted backend features for phase
```

AND:

```text
unimplemented controls == 0
mock-only production handlers == 0
failing tests == 0
type errors == 0
lint errors == 0
```

## UI change rule

Adding a new button requires adding its traceability row **in the same PR**.

A PR that adds an interactive production control without:
- feature ID;
- owning phase;
- backend contract;
- acceptance test

must fail review.

## DEV_ONLY controls

DEV_ONLY controls:
- must be gated by `import.meta.env.DEV` or explicit diagnostics mode;
- must not appear in normal production package;
- may use simulation only inside tests/dev harness.

## Evidence required per phase

Store under:

```text
docs/evidence/phase-XX/
```

Examples:
- screenshots;
- test output;
- device logs;
- build result;
- DB migration result;
- acceptance checklist.

## Release Definition of Done

Release cannot be called complete unless:

1. traceability matrix is 100% ACCEPTED for shipped controls;
2. no prototype fake data is used as runtime source;
3. every modal submits to real services;
4. every toggle persists/applies real state where expected;
5. all multi-device actions return per-device outcomes;
6. no button silently succeeds;
7. restart-recovery tests pass;
8. POST_PENDING duplicate-prevention test passes;
9. installer clean-machine smoke test passes.
