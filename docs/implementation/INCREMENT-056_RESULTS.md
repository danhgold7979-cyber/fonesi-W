# Increment056 — native-only live Android stage re-observation

Date: 2026-10-29. Repository `danhgold7979-cyber/fonesi-W`; branch `feat/studio-workspace`.
Plan-first: [INCREMENT-056_PLAN.md](INCREMENT-056_PLAN.md), commit `b3eec82d0f6ddc80e64779455a6393db29d0a656`.
Source implementation SHA `63e4f465bea9c25ced9f040f5b2cdfe01bd4abcc`; test correction `c957fe36d892e6b4e97ad7885549e517e022cf86`.
**Exact tested source SHA `c957fe36d892e6b4e97ad7885549e517e022cf86`**. Phase P11 / S095.2–S095.3; no AT-095 hardware acceptance.

## Implemented source

- `packages/contracts/src/schedule.ts`: narrow `NativeStageReviewApi` and redacted `NativeStageReviewResult`, with only jobId, ordinal, classification, MediaStore status, completedAt, fixed `LIVE_ANDROID_OBSERVATION_NOT_PICKER_VERIFIED`, and unconditional `canDelete:false`, `canDispatch:false`. No stage ID/path/nonce/hash, ADB serial, snapshot hash, lease owner, or cleanup capability.
- New `apps/desktop/src/host/native-stage-review.ts`: derives the unique uncertain stage from existing public persisted job summary and private DB stage list, rejects non-`NEEDS_REVIEW`, wrong ordinal/host/identity/stage; generates a trusted audit request ID, borrows a native device actor MANUAL lease and calls the pre-existing private `reconcileStage` **once**. The response is redacted. No retry, upload or delete.
- `apps/desktop/src/host/device-service.ts`: `withManualStageReviewLease` performs a fresh actual ADB device scan, requires READY diagnostics, one fresh (<=10s) connected identity-verified transport, and uses the existing shared per-device MANUAL actor queue and 60s fenced lease. The existing actor always releases its lease in `finally`. Any stale/offline/busy/ambiguous transport fails closed. Scan reads device metadata and may update registry/transport observations; it does not alter phone content.
- `apps/desktop/src/main/index.ts`, `preload.cts`: separate `studio:stage-reobserve` IPC with strict validated `{jobId, ordinal}`, authorized only for the sandboxed Electron main frame/file URL. No public `ApiCommand`, `StudioApi`, shell/lease/stage-ID entry point or loopback HTTP command is added.
- `apps/desktop/src/renderer/api.ts` and `JobStageReviewDialog.tsx`: native-only, explicitly clicked `Kiểm tra lại Android (chỉ đọc)` for uncertain stages of `NEEDS_REVIEW` jobs; single-flight and error/loading/redacted result feedback, then refresh the persisted journal. No control in browser/loopback, no automatic re-observation, no cleanup/requeue/posting.
- `tests/stage-transfer-host.test.ts`: actual SQLite stage/claim expiry + fenced fake ADB Sync and MediaStore adapter verify persisted MANUAL observation, redaction, lease release, lack of upload or runnable job transition, wrong host/ordinal/clock/lease and ambiguous/unsupported statuses. `tests/device-service.test.ts` checks real fake-ADB metadata scan and shared MANUAL actor lease release, busy/offline rejection and absence of Android mutation. `tests/ui/schedule.spec.ts` verifies loopback UI has no native live control and public HTTP rejects forged native requests.

## CI, defect correction and evidence

The initial feature commit `63e4f465bea9c25ced9f040f5b2cdfe01bd4abcc` passed typecheck but Ubuntu unit suite failed **one test assertion** because a fresh Android identity scan correctly sends a read-only `getprop`. The new regression wrongly expected no additional shell commands at all. Corrected the assertion to require exactly `getprop` and independently forbid touch/rm/reboot; no production source was changed in the correction. The correction commit is the tested SHA `c957fe36d892e6b4e97ad7885549e517e022cf86`.

| Evidence | Result |
|---|---|
| [Push workflow 40846775722](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40846775722) | **SUCCESS** on Ubuntu + Windows, exact SHA `c957fe36d892e6b4e97ad7885549e517e022cf86` |
| [PR workflow 40846782696](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40846782696) | **SUCCESS** on Ubuntu + Windows, exact SHA `c957fe36d892e6b4e97ad7885549e517e022cf86` |

Ubuntu 365/365 unit/integration tests in 39 files; 31/31 Chromium UI; generated/type/lint/build and both plan validators passed. Windows 364 pass plus 1 platform-only skip in 39 files; generated/type/lint/build, Windows `start-windows.ps1 -VerifyOnly` and plan validators passed.

## Acceptance boundary

Status: **TESTED_NATIVE_READONLY_REOBSERVATION_NOT_S095_ACCEPTED**.

The CLI/provider in CI is a fake ADB server, **not physical Android**, so real USB/LAN transport, Android MediaStore permissions and picker correlation are still untested. A remote byte match or even an indexed MediaStore row is NOT proof of picker selection, identity/target/profile readiness or publication. Re-observation appends an audit observation/event but does not change stage/job/effect state or trigger upload, file deletion, publishing or cleanup request. Physical Windows10 with two devices, exact picker proof, owned deletion/recovery protocol, Facebook/TikTok publish verification, 20→100→300 load and signed/offline installer remain OPEN/NOT_RUN. No merge to main. The total product percentage remains unquantifiable from these fixtures.
