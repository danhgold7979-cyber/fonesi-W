# Historical source snapshots

The active source on `feat/studio-workspace` has advanced well beyond these October 26 snapshots. The five ZIP binaries have been removed from the current branch tree to keep the current source-download archive smaller; **the snapshots remain available in Git history** at the verified pre-cleanup commit [9d414ae869e136b201902bdae7a421c66d394f5b](https://github.com/danhgold7979-cyber/fonesi-W/commit/9d414ae869e136b201902bdae7a421c66d394f5b).

| Historical bundle | Original source revision | ZIP size | Historical ZIP |
|---|---|---:|---|
| Checkpoint 005 — device controls, XML Inspector, editor clipboard/groups and TRACE loops | `a8f050c6db90d61d72ffb69f799867057a101d5a` | 8,944,575 bytes | [Open ZIP at the pre-cleanup commit](https://github.com/danhgold7979-cyber/fonesi-W/blob/9d414ae869e136b201902bdae7a421c66d394f5b/archives/AutoReels-Studio-Code-Checkpoint-005-2026-10-26.zip) |
| Checkpoint 004 — typed Process inputs/import/bulk/virtualization and queue ownership | `ebef4b00d021224a171ce30ecd63929a5cf28752` | 8,632,568 bytes | [Open ZIP at the pre-cleanup commit](https://github.com/danhgold7979-cyber/fonesi-W/blob/9d414ae869e136b201902bdae7a421c66d394f5b/archives/AutoReels-Studio-Code-Checkpoint-004-2026-10-26.zip) |
| Checkpoint 003 — native media and persisted scheduling | `85b4e368cfe1b6dafd6f82166711e17ebd1980af` | 8,465,194 bytes | [Open ZIP at the pre-cleanup commit](https://github.com/danhgold7979-cyber/fonesi-W/blob/9d414ae869e136b201902bdae7a421c66d394f5b/archives/AutoReels-Studio-Code-Checkpoint-003-2026-10-26.zip) |
| Earlier code checkpoint — editor, ledger and read-only schedule preview | `a1af6dcb14f5e5f515426cc2785c3b864a3aee97` | 8,242,493 bytes | [Open ZIP at the pre-cleanup commit](https://github.com/danhgold7979-cyber/fonesi-W/blob/9d414ae869e136b201902bdae7a421c66d394f5b/archives/AutoReels-Studio-Code-Checkpoint-2026-10-26.zip) |
| V2.1 handoff snapshot — initial source plan/reference and HTML review | `8762adbdc409669063b265dc59aa234533f04fb7` | 7,938,831 bytes | [Open ZIP at the pre-cleanup commit](https://github.com/danhgold7979-cyber/fonesi-W/blob/9d414ae869e136b201902bdae7a421c66d394f5b/archives/AutoReels-Studio-Handoff-V2.1-2026-10-26.zip) |

Each historical ZIP contains the files tracked at its source revision plus `SNAPSHOT.json` and `SHA256SUMS`. The adjacent `.zip.sha256` sidecars and `*-receipt.json` records are retained in the current tree; use them to verify a ZIP retrieved from the pinned historical commit. The receipts distinguish archive verification from application or device acceptance.

To continue development, start from the current repository source and read [the implementation progress](../docs/implementation/PROGRESS.md) and [handoff guide](../docs/handoff/START_HERE.md). Do not extract an old snapshot over newer source. The ZIPs contain no credentials or chat history.

**Storage note:** GitHub recommends repositories ideally remain below 1 GB and strongly recommends below 5 GB. The repository was reported at about 20.6 MiB before cleanup, so it was not near the recommended limit. This cleanup removes old ZIPs from the current tree but does not rewrite history or claim to reclaim historical Git objects.
