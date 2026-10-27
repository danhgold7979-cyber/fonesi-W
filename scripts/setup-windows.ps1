[CmdletBinding()]
param([switch]$SkipChecks)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repositoryRoot
try {
    if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
        throw 'NODE_MISSING: Install Node.js 24.19+ (24.x) x64, then reopen this launcher. See docs/implementation/WINDOWS_START.md.'
    }
    & node.exe -e "const [major,minor]=process.versions.node.split('.').map(Number);if(major!==24||minor<19)throw Error('Node 24.19+ (24.x) is required')"
    if ($LASTEXITCODE -ne 0) { throw 'NODE_VERSION: This checkout requires Node 24.19+ (24.x).' }

    $env:PNPM_HOME = Join-Path $repositoryRoot '.tools\pnpm'
    $env:npm_config_cache = Join-Path $repositoryRoot '.cache\npm'
    $env:electron_config_cache = Join-Path $repositoryRoot '.cache\electron'
    $env:XDG_CACHE_HOME = Join-Path $repositoryRoot '.cache'
    $env:XDG_CONFIG_HOME = Join-Path $repositoryRoot '.cache\xdg-config'
    @($env:PNPM_HOME, $env:npm_config_cache, $env:electron_config_cache, $env:XDG_CONFIG_HOME) | ForEach-Object {
        New-Item -ItemType Directory -Path $_ -Force | Out-Null
    }
    $packageManagerRoot = Join-Path $repositoryRoot '.tools\package-manager'
    $env:PATH = (Join-Path $packageManagerRoot 'node_modules\.bin') + [IO.Path]::PathSeparator + $env:PATH
    $pnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
    $pnpmVersion = if ($pnpmCommand) { (& $pnpmCommand.Source --version | Out-String).Trim() } else { '' }
    if ($pnpmVersion -ne '11.25.0') {
        if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'NPM_MISSING: Reinstall the official Node.js x64 distribution with npm.' }
        & npm.cmd install --prefix $packageManagerRoot --no-audit --no-fund pnpm@11.25.0
        if ($LASTEXITCODE -ne 0) { throw 'PNPM_INSTALL: Failed to install the pinned package manager.' }
    }
    $pnpmCommand = Get-Command pnpm.cmd -ErrorAction Stop
    $pnpmVersion = (& $pnpmCommand.Source --version | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $pnpmVersion -ne '11.25.0') { throw 'PNPM_VERSION: Expected pnpm 11.25.0.' }
    if ($env:HTTPS_PROXY -or $env:HTTP_PROXY) { $env:ELECTRON_GET_USE_PROXY = '1' }
    & $pnpmCommand.Source install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw 'DEPENDENCY_INSTALL: Frozen installation failed; keep the lockfile and inspect the error above.' }
    & node.exe node_modules/electron/install.js
    if ($LASTEXITCODE -ne 0) { throw 'ELECTRON_INSTALL: Official pinned Electron download or verification failed.' }
    if (-not $SkipChecks) {
        & $pnpmCommand.Source check
        if ($LASTEXITCODE -ne 0) { throw 'CHECK_FAILED: Fix the reported check before treating this build as verified.' }
    }
    Write-Host 'Windows source environment is ready.'
} finally { Pop-Location }
