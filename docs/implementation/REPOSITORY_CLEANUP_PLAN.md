# Repository cleanup plan — historical snapshot ZIPs

Date: 2026-10-29. Repository: `danhgold7979-cyber/fonesi-W`; branch: `feat/studio-workspace`.
Planning baseline HEAD: `9d414ae869e136b201902bdae7a421c66d394f5b`.

## Finding

- GitHub reports repository size as 21,077 KB (~20.6 MiB), well below GitHub's recommended repository-size guidance.
- The current branch tree contains 492 files and 57.06 MiB of file contents.
- Five historical ZIP bundles under `archives/` account for approximately 42.22 MB (40.27 MiB) in the current tree. The live source has advanced well beyond those snapshots; `archives/README.md` and the adjacent receipt/checksum files identify them as downloadable historical snapshots.
- The ZIPs are not required by source-plan validators or application build/test scripts. The source-plan validator does depend on the 4.36 MiB `docs/source-plan/v2/evidence/controls-observed.json`; that evidence, all source, tests, plans, receipts, and checksum sidecars are explicitly out of scope for deletion.

## Scope

1. Remove only these five binary ZIPs from the current branch tree:
   - `archives/AutoReels-Studio-Code-Checkpoint-003-2026-10-26.zip`
   - `archives/AutoReels-Studio-Code-Checkpoint-004-2026-10-26.zip`
   - `archives/AutoReels-Studio-Code-Checkpoint-005-2026-10-26.zip`
   - `archives/AutoReels-Studio-Code-Checkpoint-2026-10-26.zip`
   - `archives/AutoReels-Studio-Handoff-V2.1-2026-10-26.zip`
2. Keep all `.zip.sha256` sidecars and `*-receipt.json` records as provenance.
3. Update `archives/README.md` to explain that the ZIPs remain retrievable at the pre-cleanup commit `9d414ae869e136b201902bdae7a421c66d394f5b`, and link to those historical files.
4. Update `docs/implementation/PROGRESS.md` with the cleanup result and storage caveat.

## Safety and non-goals

- Do not modify `main` or any other branch.
- Do not delete source, tests, source-plan registries, screenshots, implementation evidence, receipts, or checksums.
- Do not rewrite Git history or force-push. Removing these paths from the current tree reduces the current source archive footprint but does not purge historical Git objects; the GitHub repository size field is already far below recommended limits.
- No application behavior or production acceptance status changes.

## Acceptance checks

- All five ZIP paths are absent from the current branch tree; all receipts and checksum sidecars remain.
- Historical ZIP links point to the verified pre-cleanup commit.
- Plan validators and the existing CI workflow pass on the cleanup commit.
- Report the resulting HEAD SHA and actual CI state; do not claim history storage was reclaimed.
