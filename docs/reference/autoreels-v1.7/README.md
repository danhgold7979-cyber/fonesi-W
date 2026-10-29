# Facebook Auto Farm — Project Source Pack V1.7

**Spec/UI status:** FROZEN  
**Canonical prototype:** `Facebook_Auto_Farm_FINAL_V17.html`  
**SHA-256:** `fe9e23625d1a50f384ea34eb4003c4049820f68524d0e450c2e70d85b5434b49`  
**Freeze date:** 2026-09-24
**Production path:** `E:\\AutoReels`
**Current gate:** PRE-CODE ENVIRONMENT

This package is the canonical source of truth for implementation. If a future chat, Work session, coding agent, or developer is missing context, read:

1. `00_START_HERE.md`
2. `PROJECT_KNOWLEDGE_MASTER.md`
3. `01_MASTER_SPEC.md`
4. `02_IMPLEMENTATION_PLAN.md`
5. `03_ARCHITECTURE.md`
6. `04_DATABASE_SCHEMA.md`
7. `05_STATE_MACHINES.md`
8. `06_ACCEPTANCE_TESTS.md`
9. `07_OPEN_SOURCE_DEPENDENCIES.md`
10. `08_PROJECT_INSTRUCTIONS.md`
11. `09_HANDOFF_PROMPT.md`
12. `10_DECISION_LOG.md`
13. `11_SECURITY_BOUNDARIES.md`
14. `Facebook_Auto_Farm_FINAL_V17.html`

## Source-of-truth order

When two sources conflict:

1. `10_DECISION_LOG.md`
2. `01_MASTER_SPEC.md`
3. `PROJECT_KNOWLEDGE_MASTER.md`
4. `Facebook_Auto_Farm_FINAL_V17.html`
5. older chat messages

Do not silently change frozen decisions. Use a change request.

## Before coding

Read and pass:

- `12_ENVIRONMENT_REQUIREMENTS.md`
- `13_PRE_CODE_CHECKLIST.md`
- `14_DEVELOPMENT_WORKFLOW.md`

Do not start Phase 0 until Gate A is green.

## Environment bootstrap V1.2

Check first; install only missing requirements using `tools/AutoReels_Environment_Bootstrap_V1_2.ps1`.

## V1.3

Fixed project-local toolchain activation precedence for pnpm/ADB.

## V1.4

Fixed Python 3.14 activation and npm/node-gyp Python selection.


## Implementation completeness contract

Before declaring any phase complete, read:
- `18_UI_BACKEND_TRACEABILITY.md`
- `19_DEFINITION_OF_DONE.md`
- `20_BACKEND_IPC_CONTRACT.md`
- `21_COMPLETENESS_AUDIT.md`

A visible production button with no real backend is a release-blocking defect.

## V1.5

Added mandatory UI-to-backend traceability, IPC contract, Definition of Done, and completeness audit to prevent placeholder controls.

## V1.6 — Final deep audit

Added mandatory media staging, embedded-stream compatibility, error/retry policy, runtime-data lifecycle, and Technical Risk Gate before full automation.

## V1.7 — Final staging ownership lock

Locked Android media cleanup to AutoReels-owned staging only. Project is ready for Phase 0.
