# Increment024 — P04/S031+S037 portable workflow clipboard

Baseline: `feat/studio-workspace` @ `87935843613c6194d9a0ba1ed1bd9d9cb89f4801` (latest Ubuntu/Windows Checks PASS). Master: `docs/source-plan/v2/16_MASTER_EXECUTION_PLAN.md` / P04/S029–S039 / `docs/implementation/COMPLETION_PLAN.md`; this slice addresses the open external-clipboard and dependent-subgraph closure gap without expanding hardware capability.

## Before code: dependency and risk review
- Existing in-memory `GraphClipboard` copies only local nodes/edges/groups; it is lost on editor unmount and cannot carry referenced subgraphs to another workflow. It must not silently paste orphaned graph refs or mutate app context.
- Add bounded, versioned, JSON-only clipboard serialization for same-app selections. Copy transitive local `subflow.graphRef`/`loop.bodyGraphRef` graph closure (not raw filesystem/device/account data). Reject missing/recursive graph refs, unsupported formats, unsafe keys, oversized payloads and mixed-app pastes.
- Paste must remap graph IDs, node IDs, edge IDs and group IDs (including nested graph references) in one `EditorHistory.mutate` transaction. Preserve source; validate target with existing workflow shape checks. Keep existing in-memory shortcut behavior when OS clipboard access is unavailable and disclose fallback.
- Use `navigator.clipboard` only during explicit copy/paste user gestures: no new privileged IPC/raw clipboard API, no periodic reads, no background clipboard monitoring, no secrets exported from Process/device/workspace. Ordinary system text must never be mistaken for trusted workflow nodes.
- UI Ctrl+C/Ctrl+X/Ctrl+V and context menu use the same commands; respect editor canvas focus and text input safeguards, prevent partial cut on serialization failure; cut works synchronously with in-editor memory if OS clipboard permission is denied and warns about cross-editor transfer. Same-app transfer is allowed; cross-app transfer rejects, requiring explicit review/migration.

## Tasks and artifacts
1. Add `packages/editor/src/portable-clipboard.ts` with portable format, transitive closure, sanitization, safe bounded parsing and atomic remapped import.
2. Wire system clipboard with in-memory fallback in `apps/desktop/src/renderer/Editor.tsx`; avoid copying private user/phone details.
3. Add `packages/editor/src/portable-clipboard.test.ts` for nested closure, repeated pastes, group/wire identity, cross-app and malicious/malformed payload rejection, and undo/source preservation.
4. Update progress and evidence only after checks. Existing P04/other-phase work is untouched.

## Acceptance/check gate
- `pnpm check` (generated contracts, TS, ESLint, unit/integration, Vite build); `pnpm check:plan`; CI Ubuntu and Windows for commit SHA.
- Malformed/oversized/external/plain-text payloads, recursive/missing refs, incompatible app and invalid data must leave the workflow unchanged. Denied OS clipboard writes fall back to in-editor copy/cut with an explicit warning; the user can still undo a cut.
- Hardware/Windows10 desktop manual clipboard interaction and full P04 completion remain explicitly NOT_RUN/OPEN. This increment is not Android automation or release certification.
