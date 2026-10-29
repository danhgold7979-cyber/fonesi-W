# Increment067 — P11/S097.3–S099 journal receipt sequence fences (no provider dispatch)

Date: 2026-10-29. Repo `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`. Plan-first baseline HEAD `db361bf0bee6bdf0b97718aadbf247ecfb9edab7`, Increment066/checkpoint-059. Work is a host-only hardening increment; do not change `main`.

## Gap

`HostClaimedEffectService.attempt` verifies effect ID/job ID and journal state from the trusted SQLite worker, but it does not validate the monotonic `jobRevision` receipts. If the worker returns a malformed or stale receipt at either boundary, a future adapter must not be called on the basis of that return value, even if the fixture port claims ATTEMPT_UNCERTAIN. The service needs a deterministic guard against invalid receipt revision or receipt identity, in addition to SQLite's own transactional checks.

## Scope

1. `apps/desktop/src/host/claimed-effect-service.ts`: verify INTENT receipt `jobRevision` is a positive safe integer and exactly request.expectedJobRevision+1. Verify ATTEMPT_UNCERTAIN receipt `jobRevision` is exactly intent.jobRevision+1. Reject malformed, skipped, repeated, or out-of-range values before adapter dispatch, with finite generic DomainError codes. Do not expose input hashes, IDs or untrusted receipt contents in error messages; do not acknowledge/confirm an effect.
2. `packages/database/src/claimed-effect.test.ts`: fault-inject altered worker return receipts **after the real SQLite transaction has already committed**. INTENT wrong revision must leave durable INTENT with zero adapter sends; ATTEMPT wrong revision must leave durable ATTEMPT_UNCERTAIN with zero adapter sends. Both restart/recover into NEEDS_REVIEW without requeue or replay. Tests must not forge committed effects as provider proof.
3. Re-run generated contracts, typecheck, lint, unit/integration, build, Chromium UI, Windows VerifyOnly and plan validators via GitHub Actions Ubuntu/Windows on exact source SHA. Fix any real failures. Update `INCREMENT-067_RESULTS.md`, `checkpoint-060.json`, `PROGRESS.md` and `COMPLETION_PLAN.md` after CI.
4. No changes to public `StudioApi`, DB schema, effect transition rules, adapter capabilities, Publish, Android input, retries or cleanup. No actual provider adapter gets installed.

## Acceptance boundary

Best status `TESTED_S097_HOST_RECEIPT_SEQUENCE_NOT_ACCEPTED`. This is fixture + SQLite evidence for response guards only, not device/production acceptance. S087/S095/S096, S097/AT-097 physical kill windows, S098–S103, P12–P14, 20–300 hardware fleet and installer remain OPEN. No overall percentage inferred.
