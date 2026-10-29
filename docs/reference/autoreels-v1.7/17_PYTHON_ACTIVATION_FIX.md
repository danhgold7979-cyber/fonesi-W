# 17 — PYTHON 3.14 ACTIVATION FIX

Gate A detected Python 3.14 through the Windows `py` launcher, but an older `python.exe`
could still appear first on PATH after toolchain activation.

The V1.4 activation script now:

1. prefers project-local `E:\AutoReels\.tools\Python314\python.exe` when present;
2. otherwise resolves `py -3.14` to its exact executable;
3. prepends that Python 3.14 directory to the current PowerShell PATH;
4. sets `npm_config_python` and `PYTHON` to that exact executable;
5. keeps pnpm 12.6.0 and ADB 37.0.1 project-local precedence.

Before Phase 0, activation output must show:

```text
python  Python 3.14.x
```

and:

```powershell
$env:npm_config_python
```

must point to the same Python 3.14 executable.
