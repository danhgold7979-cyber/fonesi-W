# Increment033 — P06/S056 conflict-free content query migration v14

## Provenance and prerequisite
- Active baseline: `feat/studio-workspace@d25110f00e60e866258e593b79ab666fd8ac83be` (P08 v13 device audit). P09 PR#10 independently merged to the base during work; PR#11 CI verified combined feature branch.
- Independent original P06 PR#7 (base `c55ca582`) was tested alone but its migration v13 and Increment029/receipt022 conflicts with merged P08. This integration **ports its code and tests** without copying overlapping files/numbering. Source original plan retained as `INCREMENT-033_ORIGIN.md`; integration plan committed first as `INCREMENT-033_PLAN.md`.
- Original P06 SQL preserved, appended as **v14** to `packages/database/src/schema.ts`, keeping v13 device-resolution audit SQL/checksum unchanged, no schema table drops/replaces and no deleting data.

## Implemented
- Database `listContentPage`: Process-scoped, bounded max250 rowid keyset pages; exact count, ordered asset IDs read in one batch rather than N+1 query per row; search and includeIgnored filters.
- Cursor: bounded opaque versioned base64url with scope fingerprint and persisted global content query epoch. Invalid/cross-Process/cross-filter/stale after content/assets updates rejected. Only named `contentPage` public command, host validates strict DTO; no SQL, file/device or ADB arbitrary control.
- Tests migrated from P06 branch (1003+13 records, stable pages, ordered asset bytes, stale on edit, restart and browser API); additional upgrade test synthesizes actual **v13** schema/audit, opens with v14 app and verifies preserved audit ID, device identity, SQL migration checksums and content epoch after restart.
- Existing `Processes.tsx` legacy data fetching and full-scope selection/scheduling remain unchanged. Do not treat this backend step as fully migrated content UI.

## CI: integration rather than legacy standalone
- [GitHub Actions 40647352151](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40647352151) on `ee3190fcb40c66561a8f7c43bfad0e74a31dacf5`: **SUCCESS** hosted Ubuntu and Windows.
- Ubuntu: `pnpm check` **269 passed /29 files**, `pnpm test:ui` **27 passed**; `pnpm check:plan` PASS.
- Windows hosted: `pnpm check` **268 passed +1 pre-existing Unix-only executable SDK fixture skipped /29 files**, setup and launcher VerifyOnly PASS. TypeScript/lint/build and plan validation passed.
- Earlier independent P06 PR#7 passed 255 unit+24 browser but **is not the acceptance evidence for schema v14**.

## Open / NOT_RUN
Full P06 query-scoped client selection and infinite paging, server sort/Unicode search, high-volume real media benchmark; Windows10 x64 interactive acceptance; 20–300 real phone throughput; external app adapters and publishing; Windows installer/release. No physical device tested; no `main` merge or deployment. Status: **TESTED_BACKEND_SLICE_NOT_FULL_PHASE_ACCEPTED**.

## Conflict settlement
Once this PR#11 is green and merged to `feat/studio-workspace`, close original PR#7 as superseded with pointer to #11; do not merge old schema v13 or original Increment029 files.
