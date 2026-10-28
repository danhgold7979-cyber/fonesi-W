# Increment028 — P05/S045: path-sensitive effect audit

Baseline `feat/studio-workspace@91294aa20295d3d009de9585a343d5788c601cc5`. Implementation source commit `10027ae7ee261565d83954fb79c0597706b591cd`; plan was committed before code (originally numbered 027; renamed to `INCREMENT-028_PLAN.md` when another active P08 PR reserved 027). Latest head for plan renumber `432f3ffa`.

## Implemented

- `packages/workflow-engine/src/effects.ts`: bounded control-flow path audit using per-node effect/intent/verification states and deduped frontier. Transaction.next can grant typed PUBLISH/COMMENT intent; transaction.error does not. Each declared effect requires a matching intent and consumes it. A second effect while the previous effect remains unverified, an unverified success exit, cleanup without verified external result or an unclassified tap are explicitly flagged.
- `packages/workflow-engine/src/compiler.ts`: immutable IR includes `effectPathAudit: { scope:'STATIC_INTRAGRAPH_ONLY', issues }`; `assertStaticEffectPathsSafe(ir)` enforces a fail-closed static admission check. `packages/workflow-engine/src/index.ts` exports the reusable checker. Existing authoring and TRACE are not misrepresented as real execution.
- `packages/workflow-engine/src/effects.test.ts`: path bypass through transaction.error, typed mismatch/missing kind, verify.false cleanup, uncertain effect exit/review, consecutive publish+comment, unknown external tap, and branch convergence/resource safety. Does not invoke an Android device.

## CI evidence

- [GitHub Actions run 40642239427](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40642239427) at source commit `10027ae7`: **SUCCESS** Ubuntu and Windows.
- Ubuntu: `pnpm check`: 250 PASS / 27 files. `pnpm test:ui`: 23 PASS / 0 failed. Windows: 249 PASS, 1 pre-existing Unix-only SDK fixture skipped / 27 files. Both platform generated/type/lint/build/plan validators and Windows setup/VerifyOnly PASS.
- Additional check after plan filename renumber and integration with P08 increment027 required before merging this PR.

## Explicit limitations

This is **TESTED static-analysis increment**, not full P05/S045 accepted. It does **not** prove transaction journals persist, verify external effects at a provider, certify any Android app version/profile, or dispatch/comment/publish; neither hardware nor Windows10 physical tests were performed. Intergraph/subflow/loop effect-token propagation, real provider binding and irreversible cleanup eligibility remain OPEN. A static audit with no issue is **not** permission to claim a real post succeeded.
