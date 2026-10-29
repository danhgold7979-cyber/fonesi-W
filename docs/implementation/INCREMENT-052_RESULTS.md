# Increment052 — persisted stage review history in Schedule operator UI

Date: 2026-10-29.
Repository: `danhgold7979-cyber/fonesi-W`; branch: `feat/studio-workspace`.
Scope: P11 / S095.2–S095.3 (read-only operator evidence; not cleanup).
Plan-first: [INCREMENT-052_PLAN.md](INCREMENT-052_PLAN.md), commit `07bc39c2eff9ae9d343a16b7077990dbf15cd46a`.
**Tested source SHA: `80c3970d21819aceee6bc932fc9275a814f1f663`.**

## Real implemented source

- `packages/contracts/src/schedule.ts`, `packages/contracts/src/api.ts`: typed `JobStageReviewPage`, `jobStageReview(id,cursor?)` API; `PERSISTED_ONLY`, `canDispatch:false` invariant.
- `packages/database/src/index.ts`: `jobStageReview` reads stage ordinals/states plus stored byte/MediaStore receipt flags and reconciliation audit rows via restricted SELECT projections; **does not serialize** remote path, stage ID, hash, nonce, ADB serial, lease owner ID, host ID, snapshot payload, caption or account. Keyset by `(created_at,id)`, 20 audit rows/page, at most 32 stages; cursor has canonical shape and binds job ID plus current job revision. Invalid, stale and cross-job cursors rejected. No claims, device I/O or mutations.
- `apps/desktop/src/host/service.ts`, `apps/desktop/src/preload.cts`: strict validated host read-only command and Electron preload surface; generic public stage-transfer and private lease APIs remain inaccessible.
- `apps/desktop/src/renderer/Schedule.tsx`, new `JobStageReviewDialog.tsx`: a **Hồ sơ đối soát** button only for `NEEDS_REVIEW`; loading, empty state, refresh, error, timestamped classification history, pagination, and explicit persisted-not-live warning. No execution, Android input, requeue or deletion control.
- `packages/database/src/device-stage.test.ts`: no-stage read, strict unknown request rejection, read-only job/stage invariants, redacted JOB/MANUAL observations, 25-entry pagination, cursor malformed/cross-job/stale revision, secrets absent from response.
- `tests/ui/schedule.spec.ts`: real SQLite fixture with `NEEDS_REVIEW` and 24 stored observations; verified navigation, visual evidence flags, pagination 20→24, no secret values and no job/stage mutation. Fixture is not a physical Android test.

## CI failures fixed before validation

1. Initial source `03553c2d7f3c0e2d5b534d415a7b819c59d12ea4` failed typecheck: missing `jobStageReview` in Electron preload. Fixed at `519ed88d27222f98015ce0553a21db6a4919e9a8`.
2. Follow-up commit had one failing cursor regression (malformed object reported cross-job). Corrected canonical cursor shape validation before scope/revision checks at tested SHA `80c3970d21819aceee6bc932fc9275a814f1f663`.
3. Both exact-source workflows then completed SUCCESS.

## Exact-source CI

| Scope | Evidence | Result |
|---|---|---|
| Ubuntu foundation, push run | [40837962434](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40837962434) | **SUCCESS**; 346/346 unit/integration in 39 files, 31/31 Chromium UI, generated contracts/typecheck/lint/build, plan validators PASS |
| Windows foundation, push run | [40837962434](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40837962434) | **SUCCESS**; 345 passed + 1 platform-only skip in 39 files, generated contracts/typecheck/lint/build, Windows `VerifyOnly`, plan validators PASS |
| Duplicate PR CI | [40837971855](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40837971855) | **SUCCESS** on the same source SHA, both OS jobs |

No claim of Windows 10 GUI execution or Android physical hardware test.

## Acceptance boundary and next dependency

Status: **TESTED_REDACTED_OPERATOR_STAGE_REVIEW_NOT_S095_ACCEPTED**.

Stage review is a redacted database evidence browser, **not** proof of current phone readiness. Historical indexed MediaStore rows do not establish picker selection or posting. No user-facing active MANUAL lease re-observation is enabled. No remote cleanup, upload retry, job requeue, publish or public ownership decision is added.

Next S095.3 increment should define and implement strictly fenced owned-cleanup readiness/preconditions before any destructive remote cleanup, followed by physical Android/Windows10 evidence and guarded operator decisions. Facebook/TikTok publish/verification, network USB/LAN, 20→100→300 load, installer/release and main merge remain OPEN/NOT_RUN. P11 and total product not ACCEPTED.
