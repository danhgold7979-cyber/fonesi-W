[CmdletBinding()]
param([switch]$VerifyOnly)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repositoryRoot
try {
    & (Join-Path $PSScriptRoot 'setup-windows.ps1') -SkipChecks
    $pnpmCommand = Get-Command pnpm.cmd -ErrorAction Stop
    & $pnpmCommand.Source build
    if ($LASTEXITCODE -ne 0) { throw 'BUILD_FAILED: See the build error above.' }
    if ($VerifyOnly) {
        & node.exe -e "import('electron').then(({default:path})=>{if(!path||!require('node:fs').existsSync(path))throw Error('Electron executable missing');console.log('Desktop build and Electron executable are present')})"
        if ($LASTEXITCODE -ne 0) { throw 'ELECTRON_MISSING: Desktop executable verification failed.' }
        return
    }
    & $pnpmCommand.Source exec electron apps/desktop
    if ($LASTEXITCODE -ne 0) { throw 'DESKTOP_EXIT: The desktop process exited with an error; keep the message above for diagnosis.' }
} finally { Pop-Location }
