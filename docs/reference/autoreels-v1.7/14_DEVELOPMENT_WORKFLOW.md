# 14 — DEVELOPMENT WORKFLOW

## Source of truth

```text
Spec / decisions -> Project Source Pack
Code             -> Git repository
Local workspace  -> E:\AutoReels
```

## Branch policy

Recommended:

```text
main
develop
phase/00-foundation
phase/01-database
phase/02-device-registry
...
```

For a solo project, `main` + short-lived phase/feature branches is sufficient.

## Increment rule

For every implementation increment:

1. state the current phase;
2. list files/modules to modify;
3. list acceptance criteria;
4. implement;
5. typecheck;
6. lint;
7. unit/integration tests;
8. build/package as applicable;
9. inspect diff;
10. commit.

Do not continue while tests for the current increment are red.

## Commit convention

Examples:

```text
chore(scaffold): initialize electron react typescript app
feat(db): add sqlite migrations and repositories
feat(devices): add adb registry and heartbeat
test(scheduler): cover device mutex recovery
fix(stream): preserve focused device quality
```

## Native dependency policy

Electron native modules must be tested under Electron ABI.

A package working under standalone `node.exe` is not enough.

## Dependency policy

- exact package manager version pinned;
- lockfile committed;
- no production CDN;
- no unreviewed postinstall/build script;
- prefer official maintained OSS;
- dependencies added only for an identified requirement.

## Continuous progress

“Continuous” means one verified increment after another, not skipping gates.

Never sacrifice:
- database integrity;
- device locking;
- idempotency;
- recovery;
- testability

for implementation speed.
