# Increment068 — re-fence claimed effect immediately before adapter callback

Date: 2026-10-29. Repo `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`. Owner P11/S097.2–S099.2 partial safety implementation.
Plan-first commit `e2f59900f19dc2daf3c3815be1d18d8de3976bdc`; feature commit `7e55e39c39e8a3e7e2862ae15b8d32a55c60cd58`; corrected fixture and **exact tested source SHA** `71f8edbdde6dc803a7ff26929797760840cabfae`.

## Source changes

- `packages/database/src/index.ts`: private, read-only `assertClaimedEffectDispatch` requires one existing ATTEMPT_UNCERTAIN journal, current JOB lease/claim owner and generation, nonexpired lease and claim, enabled verified device identity, exact job phase and revision, and immutable SQLite snapshot SHA. Returns literal true only while the facts match; no DB mutation/auto-retry/confirmation.
- `apps/desktop/src/host/internal.ts`: adds private `effect.assertClaim` worker operation. Public HTTP, StudioApi and preload do NOT expose it.
- `apps/desktop/src/host/claimed-effect-service.ts`: after committing INTENT and ATTEMPT_UNCERTAIN and checking receipt revisions, the coordinator queries the fresh private fence using a new trusted clock read before invoking the injected adapter. A false/malformed/rejected check prevents adapter invocation; the journal remains uncertain for review. Abort immediately before adapter also means no callback. Acknowledgement remains ACK_UNVERIFIED, never CONFIRMED.
- `packages/database/src/claimed-effect.test.ts`: five SQLite/host fault scenarios plus read-only checks: valid fence; released/superseded lease; altered job revision and identity; false fence receipt; expired lease. Assert no external adapter calls and durable ATTEMPT_UNCERTAIN or recovery to NEEDS_REVIEW; public forged effect.assertClaim is rejected.

## CI correction

Initial source `7e55e39c39e8a3e7e2862ae15b8d32a55c60cd58` failed one test fixture because two independent fault-injection cases reused a globally unique effect key. Commit `71f8edbdde6dc803a7ff26929797760840cabfae` gives each case a distinct idempotency key without relaxing the durable uniqueness invariant or production logic.

| Exact-source workflow | Ubuntu | Windows |
|---|---|---|
| [Push 40882266885](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40882266885) | **SUCCESS** | **SUCCESS** |
| [PR 40882278177](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40882278177) | **SUCCESS** | **SUCCESS** |

Ubuntu **493/493 unit/integration, 43 files**, **31/31 Chromium UI**. Windows **492 passed + 1 platform-only skip, 43 files**. Generated contracts, typecheck, lint, build, Windows `scripts/start-windows.ps1 -VerifyOnly` and both V2.1 plan validators passed.

## Acceptance limits

Status: **TESTED_S097_PRE_DISPATCH_FENCE_NOT_ACCEPTED**. The private DB fence is a read-only check between awaited operations; it is NOT an atomic device-input guarantee. A real adapter must also fence lease and verified transport at its own Android input boundary. No real Facebook/TikTok provider adapter is configured, and no Android picker, Unicode typing, posting, verification, recovery, cleanup, USB/LAN fleet load or installer test was performed. P11/S097/AT-097 and S099 remain not accepted; P12–P14 and the hardware/release gates stay OPEN/NOT_RUN. `main` untouched. No grounded overall tool percentage.
