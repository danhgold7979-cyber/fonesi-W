# Increment040 — P11/S094 pure live-evidence preflight comparator

Date: 2026-10-28. Initial baseline `feat/studio-workspace@bbc6d9cb8d4a50e330c175bb0010c0d5a3632f34`. Detailed plan committed *before implementation* at `5fa897ba8adfe9c617196155cfea983b9ae9f54b`; source and tests committed/pushed as `2ee75214e38f61422d96b6a920c7fea70dc703ca` directly on `feat/studio-workspace`.

## Provenance and scope

Reviewed S094/P10/P11 master plan, current P11 Increment035 journal and Increment039 persisted-only `jobPreflight`, `JobSnapshot`, `workflowReady` exact receipt, DeviceRecord metadata and old PR #16 (`phase/p11-preflight-evidence-2026-10-28`, from older `eea49514`). PR #16's independent pure comparison was adapted and extended rather than blindly merged. Its `INCREMENT-038_PLAN.md` path conflicts with current merged P06 Increment038; it is not a safe merge source.

## Implemented

- New `packages/domain/src/preflight.ts` pure comparator with dependency-injected existing domain hash/receipt primitives exposed via `assessJobPreflightEvidence` in `packages/domain/src/index.ts`. No circular module import; no DB mutation, filesystem read, ADB input, public named IPC/API, generated account values or automatic execution.
- Type-safe `JobPreflightEvidence` carries pinned JobDefinition/JobSnapshot/workflow hash and observed DeviceRecord, app, exact profile, trusted `DEVICE_TEST` receipt, target/account/network IDs, media evidence with `checkedAt`, observed timestamp and current clock. This is **supplied evidence**, not independently trusted by the pure function.
- Gate checks: job phase and content ID; workflow shape/hash and immutable snapshot hash; exact app/installed package/profile and user-confirmed receipt; verified enabled connected device, connected verified transport timestamp/generation, JOB owner expiry and device app locale/version match; actual observed IDs versus frozen account/target/network references.
- Ordered media evidence compares frozen IDs and pinned hash to observed hash/state, with fresh per-asset observations, 250-item budget, no duplicate IDs, required READY and positive bytes; supports legitimate text-only snapshots when the frozen typed text is present and app mediaKinds includes text.
- Stable named blockers only with cap32; report never echoes caption, filename/path, serial, target/account values or credentials. **`dispatchAuthorized: false` always**, even when synthetic `evidenceConsistent: true`. Provider attestation, private job lease/claim and live verification are still required before any future external input.
- Added 8 domain unit tests covering positive synthetic comparison without dispatch, state/snapshot/version, verified transport and stale timestamps, receipt/profile/device properties, exact identity pins, ordered media/invalid/future proof, text-only, immutability and redaction. Existing P11 persisted preflight dialog and API unchanged.

## Exact source validation

- [GitHub Actions 40657203038](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40657203038): **SUCCESS** Ubuntu and hosted Windows.
- [GitHub Actions 40657209201](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40657209201): **SUCCESS** Ubuntu and hosted Windows.
- Ubuntu `pnpm check`: **299/299 passed, 34 files**; Chromium `pnpm test:ui`: **30/30 passed**.
- Windows `pnpm check`: **298 passed + 1 pre-existing Unix-only SDK fixture skipped, 34 files**; Windows VerifyOnly launcher, generated check, typecheck, lint, build and `pnpm check:plan` passed.

## Status / NOT_RUN

**TESTED_PURE_PREFLIGHT_COMPARATOR_NOT_P11_ACCEPTED**. No live trusted host observation binding, provider control, app certification on a physical device, media byte rehash before dispatch, claimed JOB runner, publish/verify/comment recovery, Windows10 USB/LAN physical tests, throughput benchmarks at 20→100→300 phones or installer/release. This increment cannot certify Facebook/TikTok posting; `main` stays unmodified and nothing was deployed.
