# Increment038 — P11/S094 immutable preflight evidence assessment (pure advisory contract)

Plan committed before coding on 2026-10-28, baseline `feat/studio-workspace@eea495140210b3ca836e08af429b3592fdf7208d`. Read V2.1 S094/AT094, P11/S097 journal design, `workflowReady` exact profile/receipt semantics, pinned JobSnapshot/DeviceRecord media schemas, and current queued claim lifecycle. Concurrent P05 cross-graph static admission work is independent.

## Problem
There is no central deterministic check tying a job's immutable workflow hash, content/media selection and device/app profile to current observed preflight evidence. A future dispatcher must never infer "ready" from an app name, old screenshot, a UI checkbox, or the fact that a queue claim exists.

## Ordered implementation
1. Add a **pure advisory** `assessJobPreflightEvidence` in `packages/domain/src/index.ts`, typed input `job/snapshot/snapshotHash/device/app/observedProfile/trustedReceipt/mediaChecks/targetObserved/accountObserved/networkObserved/checkedAt/now`. Validate known IDs, immutable hashes and pinned package/selector profile, exact current device identity and transport, evidence age, target/account/network, ordered media hashes and READY state; list **named blocker codes** deterministically without returning paths/secrets/credentials.
2. Return `evidenceConsistent` but hardcode `dispatchAuthorized:false`. This pure assessment **does not own a DB lease, app attestation, certified provider or device input**. A later P11 host must revalidate private claim, lease, trusted P10 receipt, media and app foreground at dispatch time, and implement explicit execution admission.
3. Never expose a named HTTP/preload API, never write DB state, and never import filesystem/ADB. Tests include a synthetically consistent pinned fixture plus failures for job/snapshot hash changes, wrong Process/device/app/target, stale/cross-device receipt/profile, media order/hash/state, missing/old observation and disabled/conflicted/transport-unverified device. Test source immutability.
4. Ubuntu/Windows `pnpm check`, Ubuntu Chromium regression, `pnpm check:plan` on exact SHA, record receipt and open independent PR to `feat/studio-workspace`. No main/release merge.

## Acceptance boundaries
**TESTED_PURE_PREFLIGHT_ADVISORY** only; not a trusted runtime authorization, not device/app certification or P11 completion. USB/LAN/Windows10 phone acceptance, actual media selection and verified post/COMMENT, account+network providers, 20→300 phone soak and installer are NOT_RUN. Synthetic test fixtures are not evidence that actual posting works.
