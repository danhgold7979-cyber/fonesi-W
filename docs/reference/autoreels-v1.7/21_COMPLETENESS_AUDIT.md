# 21 — COMPLETENESS AUDIT

## Mandatory audit points

This audit runs at the end of every phase and before every release candidate.

### UI audit

- enumerate interactive controls from production renderer;
- compare against traceability matrix;
- report unknown controls;
- report removed controls still referenced by code;
- ensure DEV_ONLY controls are absent from production package.

### IPC audit

- every preload method has a Main handler;
- every Main handler validates arguments;
- no renderer direct Node/filesystem/ADB access;
- unused handlers are removed or documented.

### Persistence audit

Any user expectation that survives restart has a persistence path.

Examples:
- campaigns;
- folder paths;
- media edits;
- schedule;
- queue;
- proxy assignment;
- account/Page cache;
- metrics;
- settings.

### Real-action audit

Search production code for:
- fake `setTimeout` success;
- hard-coded demo devices;
- hard-coded demo videos;
- `alert("...mô phỏng...")`;
- random success/failure values;
- placeholder metrics;
- static fake proxy alive state.

All must be absent from production runtime.

### Failure audit

Every external operation defines:
- timeout;
- cancellation;
- error code;
- retryability;
- recovery state;
- diagnostic capture policy.

### Multi-device audit

All bulk operations:
- iterate through real selected IDs;
- use bounded concurrency;
- return per-device result;
- continue when one device fails unless atomicity is explicitly required.

## Build report

Generate a file like:

```text
docs/evidence/completeness-report.json
```

with:

```json
{
  "unknownInteractiveControls": 0,
  "backendRequired": 0,
  "backendImplemented": 0,
  "accepted": 0,
  "mockOnlyProductionHandlers": 0,
  "missingIpcHandlers": 0,
  "failingTests": 0
}
```

The numeric fields are filled by the implementation tooling.

Release requires all missing/error counts to be zero.
