# Increment047 — exact Android MediaStore row probe

Date: 2026-10-28. Repository: `danhgold7979-cyber/fonesi-W`; branch `feat/studio-workspace`. Plan-first baseline `2e5eeab3c10d13acf541fbabc01c969060049e8c`. Scope: P11/S095.2–S095.3; no publishing and no claim of physical acceptance.

## Why this increment follows 046

Increment046 persists matching remote SHA-256 and byte count, but deliberately leaves the stage state `SYNC_ACK_UNVERIFIED`. Equal bytes do not prove Android MediaStore indexed the file, and do not prove a gallery/picker will select the intended item. The next safe slice is a **read-only, exact-row MediaStore probe** tied to the persisted job-specific remote path.

## Implementation steps

1. Add a private scoped ADB probe that derives the expected filename and `Download/AutoReelsStudio/job-<jobId>/` relative path from the durable stage record. It must not accept a renderer-provided path, execute arbitrary shell, or return raw ADB output. Query the external file collection for exact display name, relative path, byte size and expected MIME family; parse a bounded result and require exactly one row. Zero rows, duplicate rows, missing columns, permission errors or unrecognized output become explicit unsupported/not-ready outcomes, never success.
2. Use a separate typed result for `INDEXED_EXACT`, `NOT_INDEXED`, `AMBIGUOUS` and `UNSUPPORTED`. `INDEXED_EXACT` requires exactly one matching row, a valid numeric MediaStore ID, exact relative path/name/size and compatible MIME. Do not call a row indexed solely because the ADB shell command exited 0.
3. Add append-only SQLite migration v17 with nullable MediaStore evidence fields (row ID/URI, display name, relative path, MIME, observed bytes, observed time). Preserve v1–v16 migration SQL/checksums and all existing readback evidence. Do not promote the stage state or enable dispatch in this increment.
4. Add a private internal DB command to persist an exact MediaStore observation only when a live JOB lease/claim, device/host/generation, job revision/snapshot, existing matching remote-byte evidence and unique stage ownership all match. Enforce idempotency: no overwriting different prior evidence; no public API/HTTP/preload route. Record a redacted audit event.
5. Integrate a private host coordinator method that validates the durable row and readback evidence, fences the current transport before/after the query, runs the bounded probe, persists only a unique exact match and returns a redacted result with `canDispatch: false`. The coordinator must not run automatically after upload, on startup, scheduling or scanning.
6. Add fixture tests for exact single row, zero rows, duplicate rows, wrong filename/path/size/MIME, malformed/truncated/oversized output, unsupported permission/capability, stale claim/transport, duplicate evidence, restart persistence and public command isolation. Tests must explicitly distinguish fake ADB protocol coverage from physical Android acceptance.
7. Run `pnpm check` Ubuntu + Windows, Chromium `pnpm test:ui` and `pnpm check:plan`; fix all regressions and capture exact source SHA/CI receipts.

## Expected files

- `packages/devices/src/index.ts` and relevant ADB protocol tests
- `packages/contracts/src/media.ts`
- `packages/database/src/schema.ts`, `packages/database/src/index.ts`, DB migration/ownership tests
- `apps/desktop/src/host/internal.ts`, `apps/desktop/src/host/stage-transfer-service.ts`
- `tests/stage-transfer-host.test.ts`
- results/progress/checkpoint evidence

## Safety and acceptance boundary

- This increment probes index visibility only; it does not guarantee that a specific social app's picker displays or selects the row.
- Never run `rm`, overwrite or clean up remote paths in this increment. Never create another nonce/path to recover an uncertain transfer.
- Do not trigger a media scanner automatically yet; scanner behavior varies by Android version/vendor and must be tested before adding a bounded scan-and-reconcile workflow.
- No physical phone is attached to hosted CI. A successful fixture test is not `AT-095` acceptance.
- Stage remains non-dispatchable. The strongest result allowed here is `MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED`; physical Android, picker correlation, cleanup/reconciliation, app identity/posting, Windows 10 USB/LAN, fleet 20→300 and release remain separate gates.
