# Increment027 — P08/S072 conflict-resolution readiness (read-only safety gate)

Baseline `feat/studio-workspace@91294aa20295d3d009de9585a343d5788c601cc5`. Master V2.1 15 phases, P08/S072, `docs/implementation/P08_PLAN.md`, `INCREMENT-026_PLAN.md`, `COMPLETION_PLAN.md` and current device registry/queue tests reviewed before coding.

Problem: increment026 securely latches identity `CONFLICT`, but does not provide a bounded, auditable diagnostic to explain why an operator must not clear it. A premature clear or wrong-device binding could permit actions on a different Android phone.

Scope:
1. Add a read-only `conflictResolutionReadiness(hostId, deviceId)` database query that checks the immutable stored device fingerprint, current host transports, state, fresh identity_verified, known collisions, live leases and running jobs. Output is a typed set of public-safe blocker codes; never include hardware serial, raw fingerprint, credentials or private metadata.
2. The query must never clear `CONFLICT`, modify an alias, consume a lease or start device input. Return `canResolveAutomatically: false` even when all evidence appears healthy. Require manual physical confirmation in a separate future mutation phase.
3. Add read-only private-worker command only, not preload/HTTP. Keep bounded work, input validation and safe repeated calls.
4. Tests against real SQLite: latched reused alias, restart, no fresh proof, valid other phone, idempotent no-state-change, malformed IDs and unavailable device; preserve queue fences.
5. Update plan/results with exact CI truth, do not call S072/P08 accepted; Windows10+two physical phones remain external gate.

Acceptance: `pnpm check`, plan validators, Ubuntu+Windows CI. Keep `main` untouched. Commit separately, and PR into `feat/studio-workspace` only after green.
