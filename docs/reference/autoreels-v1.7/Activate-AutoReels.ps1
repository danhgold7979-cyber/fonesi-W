# AutoReels project-local toolchain activation — FIXED V1.4
# Run:
#   . E:\AutoReels\.tools\Activate-AutoReels.ps1
#
# Changes only the CURRENT PowerShell session.

$ProjectRoot = "E:\AutoReels"
$ToolsRoot = Join-Path $ProjectRoot ".tools"

function Add-FrontPath {
    param([string]$PathToAdd)
    if (-not $PathToAdd -or -not (Test-Path $PathToAdd)) { return }

    $parts = @($env:Path -split ';' | Where-Object {
        $_ -and ($_.TrimEnd('\') -ine $PathToAdd.TrimEnd('\'))
    })
    $env:Path = (@($PathToAdd) + $parts) -join ';'
}

# Project-local Node 24 if present; otherwise system Node 24 may remain.
$NodeRoot = Get-ChildItem $ToolsRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "node-v24.*" } |
    Sort-Object {
        try { [version]($_.Name -replace '^node-v','') } catch { [version]'0.0.0' }
    } -Descending |
    Select-Object -First 1

$PnpmRoot = Join-Path $ToolsRoot "pnpm-12.6.0"
$AdbRoot = Join-Path $ToolsRoot "android\platform-tools"
$PythonLocalRoot = Join-Path $ToolsRoot "Python314"

$PortableGitRoot = Get-ChildItem $ToolsRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "PortableGit-*" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

# Resolve Python 3.14 exactly.
$PythonExe = $null

if (Test-Path (Join-Path $PythonLocalRoot "python.exe")) {
    $PythonExe = Join-Path $PythonLocalRoot "python.exe"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    try {
        $candidate = (& py -3.14 -c "import sys; print(sys.executable)" 2>$null).Trim()
        if ($candidate -and (Test-Path $candidate)) {
            $ver = (& $candidate --version 2>&1).ToString()
            if ($ver -match "^Python 3\.14") {
                $PythonExe = $candidate
            }
        }
    } catch {}
}

# Desired final PATH priority:
# Node -> pnpm -> ADB -> Python 3.14 -> Git -> existing PATH
if ($PortableGitRoot) {
    Add-FrontPath (Join-Path $PortableGitRoot.FullName "bin")
    Add-FrontPath (Join-Path $PortableGitRoot.FullName "cmd")
}

if ($PythonExe) {
    $PythonDir = Split-Path $PythonExe
    Add-FrontPath (Join-Path $PythonDir "Scripts")
    Add-FrontPath $PythonDir

    # Ensure native Node builds use Python 3.14, even if another Python is installed globally.
    $env:npm_config_python = $PythonExe
    $env:PYTHON = $PythonExe
}

Add-FrontPath $AdbRoot
Add-FrontPath $PnpmRoot
if ($NodeRoot) { Add-FrontPath $NodeRoot.FullName }

foreach ($name in @("node","npm","npx","pnpm","adb","git","python")) {
    Remove-Item "Alias:\$name" -ErrorAction SilentlyContinue
    Remove-Item "Function:\$name" -ErrorAction SilentlyContinue
}

Set-Location $ProjectRoot

Write-Host ""
Write-Host "AutoReels project toolchain activated." -ForegroundColor Green
Write-Host "Workspace: $ProjectRoot" -ForegroundColor DarkGray

function Show-ResolvedTool {
    param([string]$Name,[string[]]$VersionArgs)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $cmd) {
        Write-Host ("{0,-8} MISSING" -f $Name) -ForegroundColor Red
        return
    }

    $source = $cmd.Source
    if (-not $source) { $source = $cmd.Definition }

    try {
        $v = (& $Name @VersionArgs 2>&1 | Select-Object -First 2) -join " "
    } catch {
        $v = "version check failed"
    }

    Write-Host ("{0,-8} {1}" -f $Name,$v) -ForegroundColor Cyan
    Write-Host ("         {0}" -f $source) -ForegroundColor DarkGray
}

Show-ResolvedTool "node" @("-v")
Show-ResolvedTool "npm" @("-v")
Show-ResolvedTool "pnpm" @("-v")
Show-ResolvedTool "python" @("--version")
Show-ResolvedTool "git" @("--version")
Show-ResolvedTool "adb" @("version")

Write-Host ""
Write-Host "Native build Python:" -ForegroundColor DarkGray
Write-Host "  npm_config_python = $env:npm_config_python"
Write-Host ""
Write-Host "Expected critical project paths:" -ForegroundColor DarkGray
Write-Host "  pnpm: E:\AutoReels\.tools\pnpm-12.6.0\pnpm.cmd"
Write-Host "  adb : E:\AutoReels\.tools\android\platform-tools\adb.exe"
Write-Host "  python: Python 3.14.x (system via py launcher or project-local)"
Write-Host ""
