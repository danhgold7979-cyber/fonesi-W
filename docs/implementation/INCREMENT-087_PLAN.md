# Increment087 — Facebook fixed-workflow catalog UI

Date: 2026-10-30. Repository `danhgold7979-cyber/fonesi-W`, branch `feat/studio-workspace`.
Verified baseline HEAD: `f6286ea29c291d5ac0ee50992b8c1bb7a8d316b0`.
Previous verified implementation: Increment086 / checkpoint-079, source `819e0baf27f2b06185ecad2bea3b783e63d5e727`, push CI #40931404496 SUCCESS Ubuntu + Windows. Do not modify `main`.

## Goal

Turn the existing Workflow Library route into the user-facing **Quy trình** catalog without replacing the existing workflow engine or custom workflow management. Add four explicit Facebook fixed-workflow specifications:

1. Fanpage video + caption + hashtags + ordered comments.
2. Fanpage photo + caption + hashtags + ordered comments.
3. Fanpage Reels + caption + hashtags + ordered comments.
4. Facebook Group post + caption + hashtags + ordered comments.

The current route ID `library` is retained to avoid breaking navigation and keyboard shortcuts. The existing custom workflow list/import/create/archive/editor entry points remain available under a clearly separated section.

## Verified source observations

- `apps/desktop/src/renderer/App.tsx` already has a `library` route and a dynamic workflow list with create/import/archive/open actions.
- `WorkflowSummary` and `BootstrapData` are already available; no new backend endpoint is needed for a catalog manifest.
- `ProcessDefinition` already binds one app, device, account identity, target identity, workflow version and schedule. A Process is the correct unit for a device + logged-in account + publish target combination.
- `Sources.tsx` already supports selecting/scanning folders, recursive scanning and watching.
- `ContentFields.tsx` already supports typed ordered `list<text>` fields; `comment-list.ts` already freezes 1–32 ordered comments for a job.
- The SQLite `identities` table exists, but this checkout does not expose a complete account-discovery/list/switch service. The table alone is not evidence that multi-account switching works.
- No production Facebook app adapter exists in the current tree. S089/S090, P11/S103 and P12/S105–S106 hardware/provider gates are not accepted.

## Scope

### UI / catalog

- Add a typed, source-controlled Facebook workflow catalog manifest.
- Render four cards in the existing `library` route, now labelled **Quy trình**.
- Add platform/target/media labels, purpose, ordered execution stages, required inputs, prerequisites and explicit readiness status.
- Add a detail dialog for each fixed workflow.
- Distinguish the logged-in Facebook profile (account) from the Fanpage/Group (publish target). Never present a Fanpage or Group as a login account.
- State the common posting sequence: select phone → verify logged-in profile → verify exact Fanpage/Group target → scan/select media → compose caption + hashtags → publish → independently verify the post → publish comments in their frozen order → verify each comment → record result.
- Require an ordered comment list of 1–32 items for these four templates. If no valid comment list is provided, a future execution preflight must block before posting.
- Preserve the existing generic workflow list and its create/import/open/archive actions as **Workflow tùy chỉnh**.
- Future platform/process templates are added by adding manifest entries; no new tab or new application shell is required.

### Explicit state honesty

All four cards are catalog specifications only and must display `PLANNED / CHƯA SẴN SÀNG CHẠY`. They must not be described as implemented, tested, certified or executable. Do not add a fake "run" action or create a dummy workflow graph merely to make the cards appear functional.

### Non-goals / deferred dependencies

- No real Android/Facebook posting, commenting or account switching in this increment.
- No account/target discovery implementation or new identity DB migration in this increment.
- No change to scheduler, job state machine, media scanner, comment journal or current Process schema.
- No Instagram/TikTok templates yet.
- Do not weaken P10/P11/P12 dependencies, provider verification, duplicate prevention, manual-review fences or hardware acceptance.

## Files expected

- `apps/desktop/src/renderer/workflow-catalog.ts` — typed fixed-template manifest and stable IDs.
- `apps/desktop/src/renderer/WorkflowCatalog.tsx` — cards and accessible detail dialog.
- `apps/desktop/src/renderer/App.tsx` — rename the existing library route to Quy trình, render the fixed catalog, preserve custom workflow management.
- `apps/desktop/src/renderer/style.css` — responsive catalog/detail styling consistent with light/dark theme.
- `tests/ui/workflow-catalog.spec.ts` — Playwright coverage for four templates, destination distinctions, ordered comments and non-executable readiness.
- `docs/implementation/INCREMENT-087_RESULTS.md`, `PROGRESS.md`, `COMPLETION_PLAN.md` and checkpoint evidence — only after source SHA and CI are verified.

## State / error cases

- A Fanpage template always requires a logged-in personal profile identity plus a separate Page target identity.
- A Group template always requires a logged-in profile plus a separate Group target identity.
- Missing device/account/target/media/comment list is a future preflight blocker, not an implicit default.
- A target label/name collision must never be resolved by name alone; future account discovery must pin and verify stable identity evidence (S089).
- If a post result is uncertain, comments must not be dispatched. If a post is verified but one comment fails, only that comment may be reviewed/retried; the post must not be repeated (S100/S101).
- No UI status may imply provider success from a click, a queued job or a DB-only receipt.

## Test plan

- Four manifest entries have unique stable IDs and exact target/media combinations.
- Every entry includes caption, hashtag and ordered comment requirements.
- Page and Group flows distinguish account profile from publish target.
- Detail view exposes the full fixed stage order and explicit non-runnable status.
- Existing custom workflow create/import/open/archive actions remain visible and unchanged.
- Playwright asserts the catalog appears on the existing `library` route and that no execution button is offered.
- Run generated-contract validation, typecheck, lint, unit/integration tests, build, Chromium UI and plan validators through exact-source GitHub Actions push CI. Windows VerifyOnly must remain green. Do not claim local test execution unless a local checkout/runtime becomes available.

## Acceptance boundary

Increment087 can be marked TESTED only when exact-source CI passes. It is not an acceptance of Facebook automation. Real account discovery/switching requires S089/S090 evidence on the supported Facebook package/version/locale profile; actual publish/comment acceptance requires P11/S103 and P12/S105–S106 on Windows 10 + physical Android with provider-confirmed outcomes.
