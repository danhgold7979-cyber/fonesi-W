# 13 — PRE-CODE CHECKLIST

No production coding begins until **Gate A** passes.

## Gate A — machine/toolchain

Required PASS:

- [ ] `E:\AutoReels` exists and is writable.
- [ ] Drive is local and has >= 30 GB free.
- [ ] Git is installed.
- [ ] Node major version is 24 LTS.
- [ ] npm works.
- [ ] pnpm 12.6.x works.
- [ ] Python 3.14.x x64 works.
- [ ] Visual Studio Build Tools C++ workload is detectable.
- [ ] Windows SDK is installed with Build Tools.
- [ ] ADB is installed and callable.
- [ ] ADB version is current enough for the project baseline.
- [ ] At least one Android test phone can reach `adb devices -l` as `device`.
- [ ] No test phone is stuck `unauthorized`.
- [ ] Project path is not synced/network-mounted.
- [ ] Long-path support is enabled or explicitly accepted as a known warning.
- [ ] Git repository is initialized.

## Gate B — Phase 0 dependency sanity

Run after the repository scaffold exists:

- [ ] `pnpm install` completes.
- [ ] approved build-script policy is committed.
- [ ] Electron binary launches.
- [ ] TypeScript typecheck passes.
- [ ] lint passes.
- [ ] unit test runner passes.
- [ ] production build passes.
- [ ] installer dry-run/package step passes.

## Gate C — native dependency sanity

Run when SQLite/native dependencies are added:

- [ ] `better-sqlite3` loads inside Electron, not only plain Node.
- [ ] native rebuild for the pinned Electron version succeeds.
- [ ] clean install on a second folder succeeds.
- [ ] deleting `node_modules` and reinstalling reproduces the same result.

## Gate D — Android baseline

Before scrcpy/account automation work:

- [ ] 2+ phones enumerate independently.
- [ ] USB reconnect is stable.
- [ ] `adb -s SERIAL shell getprop` succeeds.
- [ ] Facebook package presence can be detected.
- [ ] phone IP can be read/resolved.
- [ ] ADB LAN is tested separately from USB.

## Stop conditions

Do not “code around” an environment failure.

If Gate A/B/C fails:
1. fix the environment;
2. rerun the gate;
3. record the fix in project docs if it is reproducible;
4. only then continue to the next phase.
