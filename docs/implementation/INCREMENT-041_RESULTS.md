# Increment041 — P11/S094 private host media byte recheck

Date 2026-10-28. Plan committed **before source** at `565c462c16a8b058e5d5222ba95795e56b7c6f98` (`INCREMENT-041_PLAN.md`), baseline `feat/studio-workspace@4ba2700e36e1ac99feaabbf442c019c709c4f462`. Code first pushed `1abc1f9180694ac0a4a3c0b1816576258aed6143`; corrected negative test to match stable SOURCE_REBIND_REQUIRED, final verified source `beb6db40d55d3573b83bc3ebf06b81bae911483c`. Only `feat/studio-workspace` updated; `main` unchanged.

## Implemented

- PRIVATE-only `JobMediaPreflightPlan` with immutable job ID/revision/snapshot hash and ordered asset ID/pinned hash/byte size/host grant. Not exposed by `StudioApi`, public dispatcher, renderer, preload or HTTP. The only IPC command is main↔DB-worker `job.mediaPlan`.
- `StudioDatabase.jobMediaPreflightPlan(jobId,hostId)` checks frozen snapshot integrity, allowed unstarted/claimed preflight phases, archived Process, exact device and content bindings, no prior effects, ≤32 unique pinned assets, READY pinned state and hash/bytes, current approved active source with unique correct host identity and matching READY/observed hash. No DB writes or migration.
- `HostMediaService.inspectJobMediaBytes` uses existing realpath-scoped `resolveGrantedFile` and streaming SHA-256 `fingerprint`; checks file size/hash, stable inode/mtime/canonical path, 4-GiB/file and 8-GiB aggregate bounds, 120s per-file deadline, maximum 2 concurrent media reads, abort on shutdown. Re-fetches the DB plan afterward and rejects changed job/media binding/ledger before recording a result. The result is redacted `HOST_BYTES_ONLY` and **`canDispatch: false`**.
- Text-only snapshots yield `NO_MEDIA` with 0 verified assets, not false media/post success. No source PC file is modified/deleted or copied, and no staging/ADB side-effect occurs.
- Real temporary-file integration tests cover streamed byte match without DB/source mutation, changed bytes without scan, cross-host SOURCE_REBIND_REQUIRED, stale source-entry state, missing host file, public command rejection, archived Process and text-only boundary. Existing media package regression covers filesystem root/symlink traversal scope.

## Verification and failures fixed

- Initial source `1abc1f9` CI failed only one new unit test because the assertion expected Vietnamese text while the actual stable rejection message was English. Error **SOURCE_REBIND_REQUIRED** was correctly raised. Updated regression to compare `DomainError.code` at final commit `beb6db40d55d3573b83bc3ebf06b81bae911483c`, reran CI.
- [Actions 40658373289](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40658373289) **SUCCESS** on Ubuntu and hosted Windows.
- [Actions 40658382266](https://github.com/danhgold7979-cyber/fonesi-W/actions/runs/40658382266) **SUCCESS** on Ubuntu and hosted Windows.
- Ubuntu `pnpm check`: **304 passed /35 files**, Chromium `pnpm test:ui`: **30 passed**.
- Windows `pnpm check`: **303 passed + 1 pre-existing Unix-only SDK fixture skip /35 files**. Generated/schema typecheck, ESLint, builds, plan validators and Windows VerifyOnly passed.

## Acceptance boundary

**TESTED_HOST_MEDIA_BYTES_NOT_P11_ACCEPTED.** Not a durable execution receipt; any future runner must revalidate current JOB lease/claim generation, identity, app and target, source fingerprint and effect journal immediately before device input. Android MediaStore upload, staging ledger/cleanup, Facebook/TikTok actual posting/verification, Windows10 physical USB/LAN, performance 20→100→300 phones, installer, deployment and final P11/P10 acceptance remain **NOT_RUN**.
