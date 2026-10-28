# Increment035 — P11/S097 strict claimed-effect journal, tested slice

Baseline `feat/studio-workspace@58987bc9f39e5864dff4a0c8aca36e0eb4a6711d`. Detailed plan `INCREMENT-035_PLAN.md` committed before code. Verified source SHA `7d223787f57f866106d816ce997addc3c8419e4f`.

## Code completed
- `StudioDatabase.prepareClaimedEffect`: durable, transactional validation of active JOB lease and matching `job_claims` owner/generation/expiry, enabled verified device, immutable snapshot hash, current expected job revision, pinned effect-tap classification, no existing/duplicate effect key or prior unreviewed external state. Atomically persist effect `INTENT` and job `POST_INTENT`; job event excludes payload/text.
- `StudioDatabase.beginClaimedEffectAttempt`: revalidate lease/claim, effect intent state/job phase/hash; atomically persist `ATTEMPT_UNCERTAIN` plus job `POST_PENDING` **before provider dispatch boundary**. Duplicate attempts rejected; no action or success classification performed by this primitive.
- Comment intent requires POSTED state and durable confirmed publish record, but actual verification/poster/comment logic is NOT implemented here.
- Internal-only `effect.prepareClaimed` and `effect.beginClaimedAttempt` commands through DB worker dispatcher; public authoring HTTP/preload/StudioApi do not provide them. Earlier legacy APIs retained for older test/migration paths, not real dispatch authorization.
- Real SQLite tests: prepared→uncertain transitions, restart before/after, no blind retry, lease generation/revision/hash/node/key mismatches, private/public boundary. Test fix after initial CI: unused TS type and seeded verified fixture. No synthetic post receipts and no ADB dispatch.

## Verified CI
- [GitHub Actions run 40650548675](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40650548675): **SUCCESS Ubuntu and Windows** on source `7d223787f57f866106d816ce997addc3c8419e4f`.
- Ubuntu `pnpm check`: **279/279 unit/integration tests across 31 files**; `pnpm test:ui`: **28/28 passed**; `pnpm check:plan` PASS.
- Hosted Windows: **278 passed, 1 pre-existing Unix SDK-only fixture skipped /31 files**, Windows setup+launcher VerifyOnly/type/lint/build/plan PASS.
- Earlier intermediate source runs had TypeScript lint/fixture failures; they were fixed and rerun before recording PASS.

## NOT RUN / acceptance
This is **TESTED_JOURNAL_PRIMITIVE_NOT_P11_ACCEPTED**. P11 still requires actual immutable workflow runner, P10/device preflight receipts, Android/app-specific dispatch, independent verifiers for exact post identity+target/time/external ID, multi-comment journal/retry, manual review/recovery, owned media cleanup and physical Windows10/USB/LAN tests plus 20–300 phone throughput. No real Facebook/TikTok posting or production release was attempted; do not merge `main` or publish.
