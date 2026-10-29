# Increment070 — exact frozen comment ordinal/hash required by SQLite COMMENT intent

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`. P11/S100.1 durable source binding, NOT live provider certification.

Plan first at `a16e66cd12843382b58089a85745fbd551c0b924`, initial implementation `b3795e4fe1aaf5aeb2ad090f94ee171a5d2b7cb1`, unused-test helper correction `0c7212aa3384b44382cc44954fb6b964274af85b`, Windows migration timeout correction / **exact tested source SHA `9a3a9f6c96f8d39765aff4f46418fcc3bd9f7192`**.

## Implemented source

- `packages/database/src/index.ts`: extends private `prepareClaimedEffect` with `commentSource` (persisted PUBLISH effect ID, frozen list field key/scope and item ordinal). For COMMENT, it must be present and valid, the current job must be POSTED without pending effects, the exact parent PUBLISH must be durably CONFIRMED, and the snapshot's private `frozenCommentListPlan` must return an item at that ordinal whose deterministic effectKey/payloadHash **exactly match** the intended journal write. Any missing, wrong-key/bytes, wrong ordinal/field/scope/post binding or duplicate effect is rejected before INSERT and state transition. PUBLISH rejects unexpected commentSource. The existing transaction, lease, claim, phase and effect-key uniqueness guards remain enforced.
- `apps/desktop/src/host/internal.ts`: private `effect.prepareClaimed` carries optional `commentSource` only internally; no public StudioApi, HTTP, preload or renderer command added.
- `apps/desktop/src/host/claimed-effect-service.ts`: host-only COMMENT requests require a validated source binding and pass it to the durable SQLite worker. PUBLISH requests with a comment source are invalid. No adapter is installed and no private Unicode comment text is made public.
- `packages/database/src/claimed-effect.test.ts`: updates the existing synthetic parent-PUBLISH fixture to consume the exact ordinal-0 frozen keys and adds SQLite regressions for alternate ordinal with wrong key, forged valid-format hashes, wrong payload, wrong parent, field, scope, missing source, ordinal bounds, forged PUBLISH source and host rejection. Confirms state/ledger remain unchanged for each rejection and one matching intent writes once.
- `packages/database/src/database.test.ts`: the **single existing** historical v1 restore/migration test uses a targeted 30-second timeout on busy shared Windows runner, preserving its complete assertions and leaving all other test budgets unchanged.

## CI correction and evidence

The first source commit `b3795e4fe1aaf5aeb2ad090f94ee171a5d2b7cb1` had an unused test-helper binding fixed at `0c7212aa3384b44382cc44954fb6b964274af85b`. The next push run on `0c7212aa3384b44382cc44954fb6b964274af85b` failed only a **Windows migration/restore fixture timeout (10s)**; PR CI on the same source SHA succeeded on both Windows and Ubuntu. Applied a test-scoped 30s migration budget at `9a3a9f6c96f8d39765aff4f46418fcc3bd9f7192` and reran both CI events.

| Exact-source CI | Ubuntu | Windows |
|---|---|---|
| [Push 40887532920](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40887532920) | SUCCESS | SUCCESS |
| [PR 40887542792](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40887542792) | SUCCESS | SUCCESS |

Ubuntu **515/515 unit/integration (44 files), 31/31 Chromium UI**. Windows **514 passed + 1 platform-only skip (44 files)**. Generated/typecheck/lint/build, Windows `scripts/start-windows.ps1 -VerifyOnly` and both plan validators PASS.

## Acceptance / remaining

Status **TESTED_S100_DURABLE_COMMENT_BINDING_NOT_ACCEPTED**. This is a guarded SQLite INTENT transition using synthetic post journal records only. A database fixture marked CONFIRMED is **not independent provider evidence**. The host has no certified Facebook/TikTok adapter and did not send any comment or post. Per-comment provider verification, safe comment-only retry, real Android Unicode input, actual target/account observation, USB/LAN hardware, S100/AT-100, S101–S103, P12–P14 and installer/fleet remain OPEN/NOT_RUN. Neither a green CI nor a successful INTENT INSERT accepts P11; `main` unchanged. Overall tool percentage remains unavailable.
