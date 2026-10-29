param(
  [string]$ProjectRoot = "E:\AutoReels",
  [switch]$Strict
)

$ErrorActionPreference = "Continue"
$script:Failures = 0
$script:Warnings = 0

function Pass($m){ Write-Host "[PASS] $m" -ForegroundColor Green }
function Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow; $script:Warnings++ }
function Fail($m){ Write-Host "[FAIL] $m" -ForegroundColor Red; $script:Failures++ }

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " AutoReels PRE-CODE GATE A" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"
Write-Host ""

# OS / architecture
try {
  $os = Get-CimInstance Win32_OperatingSystem
  $cs = Get-CimInstance Win32_ComputerSystem
  Pass ("Windows: " + $os.Caption + " " + $os.Version)
  if ($env:PROCESSOR_ARCHITECTURE -match "AMD64") { Pass "Architecture: x64" }
  else { Warn ("Architecture is " + $env:PROCESSOR_ARCHITECTURE + "; primary baseline is x64") }
} catch { Warn "Could not read Windows system information." }

# Project drive/folder
try {
  $root = [IO.Path]::GetPathRoot($ProjectRoot)
  if (-not (Test-Path $root)) { Fail "Drive does not exist: $root" }
  else {
    $driveLetter = $root.Substring(0,1)
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$($driveLetter):'"
    if ($disk) {
      $freeGB = [math]::Round($disk.FreeSpace/1GB,1)
      $fs = $disk.FileSystem
      if ($fs -eq "NTFS") { Pass "Filesystem: NTFS" } else { Warn "Filesystem is $fs; NTFS is recommended." }
      if ($freeGB -ge 30) { Pass "Free disk: $freeGB GB" } else { Fail "Only $freeGB GB free; require >= 30 GB." }
      if ($disk.DriveType -eq 3) { Pass "Drive is local fixed disk." } else { Warn "Drive type is not fixed local disk." }
    }
  }
  if (-not (Test-Path $ProjectRoot)) { New-Item -ItemType Directory -Path $ProjectRoot -Force | Out-Null }
  $test = Join-Path $ProjectRoot ".write-test"
  "ok" | Set-Content $test
  Remove-Item $test -Force
  Pass "Project folder writable: $ProjectRoot"
  if ($ProjectRoot -match "OneDrive|Dropbox|Google Drive") { Fail "Project is inside a synced folder." }
  if ($ProjectRoot -match "[^\x00-\x7F]") { Warn "Project path contains non-ASCII characters." }
  if ($ProjectRoot -match "\s") { Warn "Project path contains spaces." }
} catch { Fail ("Project folder check failed: " + $_.Exception.Message) }

# Long paths
try {
  $lp = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name LongPathsEnabled -ErrorAction Stop).LongPathsEnabled
  if ($lp -eq 1) { Pass "Windows long paths enabled." } else { Warn "Windows long paths disabled. Enable LongPathsEnabled=1." }
} catch { Warn "Could not verify Windows long path policy." }

# Git
$git = Get-Command git -ErrorAction SilentlyContinue
if ($git) {
  Pass ("Git: " + (& git --version))
} else { Fail "Git not found." }

# Node: require v24 for reproducible baseline
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  $nv = (& node -v).Trim()
  $major = [int]($nv.TrimStart("v").Split(".")[0])
  if ($major -eq 24) { Pass "Node LTS baseline: $nv" }
  else { Fail "Node is $nv. Project baseline requires Node 24 LTS." }
} else { Fail "Node.js not found." }

# npm
if (Get-Command npm -ErrorAction SilentlyContinue) { Pass ("npm: " + (& npm -v)) }
else { Fail "npm not found." }

# pnpm 12.6.x
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
  $pv = (& pnpm -v).Trim()
  if ($pv -match "^12\.6(\.|$)") { Pass "pnpm baseline: $pv" }
  else { Fail "pnpm is $pv. Pin/install pnpm 12.6.x for this project." }
} else {
  Fail "pnpm not found. Install pnpm 12.6.x after Node."
}

# Python 3.14
$pyPath = $null
if (Get-Command py -ErrorAction SilentlyContinue) {
  try {
    $pyver = (& py -3.14 --version 2>&1).ToString()
    if ($LASTEXITCODE -eq 0) {
      Pass "Python: $pyver"
      $pyPath = (& py -3.14 -c "import sys; print(sys.executable)").Trim()
    } else { Fail "Python 3.14 not found via py launcher." }
  } catch { Fail "Python 3.14 not found." }
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  $pyver = (& python --version 2>&1).ToString()
  if ($pyver -match "Python 3\.14") { Pass "Python: $pyver"; $pyPath=(Get-Command python).Source }
  else { Fail "Python is $pyver; baseline is Python 3.14.x." }
} else { Fail "Python not found." }

if ($env:npm_config_python) { Warn "npm_config_python is set to $env:npm_config_python. Verify it is not stale." }
if ($env:NODE_GYP_FORCE_PYTHON) { Warn "NODE_GYP_FORCE_PYTHON is set. Verify it points to the intended Python." }

# Visual Studio Build Tools
$vswhereList = @(
  "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe",
  "$env:ProgramFiles\Microsoft Visual Studio\Installer\vswhere.exe"
)
$vswhere = $vswhereList | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($vswhere) {
  try {
    $vsPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($vsPath) {
      Pass "MSVC C++ Build Tools: $vsPath"
      $sdk = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.Windows11SDK.26100 -property installationPath 2>$null
      if ($sdk) { Pass "Windows 11 SDK component detected." }
      else { Warn "Could not confirm Windows 11 SDK 26100 component. Ensure a Windows 10/11 SDK is installed in C++ workload." }
    } else { Fail "Visual Studio/Build Tools found, but VC x64/x86 tools are missing." }
  } catch { Fail "Visual Studio Build Tools detection failed." }
} else {
  Fail "Visual Studio Installer/vswhere not found. Install Build Tools with Desktop development with C++."
}

# ADB
$adb = Get-Command adb -ErrorAction SilentlyContinue
if ($adb) {
  $av = (& adb version | Select-Object -First 1)
  Pass "ADB: $av"
  try {
    & adb start-server | Out-Null
    $lines = & adb devices -l
    $deviceLines = @($lines | Select-Object -Skip 1 | Where-Object { $_.Trim() })
    if ($deviceLines.Count -eq 0) {
      Warn "ADB works but no test phone is connected. Connect at least one phone before Device Registry phase."
    } else {
      foreach($l in $deviceLines) {
        if ($l -match "\bunauthorized\b") { Fail "ADB unauthorized device: $l" }
        elseif ($l -match "\boffline\b") { Warn "ADB offline device: $l" }
        elseif ($l -match "\bdevice\b") { Pass "ADB device authorized: $l" }
        else { Warn "ADB device state: $l" }
      }
    }
  } catch { Warn "Could not enumerate ADB devices." }
} else { Fail "adb not found in PATH." }

# Optional VSSetup improves node-gyp VS discovery
if (Get-Module -ListAvailable VSSetup) { Pass "PowerShell VSSetup module available." }
else { Warn "VSSetup PowerShell module not installed; node-gyp recommends it for more robust VS detection." }

# Git init
try {
  Set-Location $ProjectRoot
  if (-not (Test-Path ".git")) {
    if ($git) { & git init | Out-Null; Pass "Initialized Git repository." }
  } else { Pass "Git repository already initialized." }
} catch { Fail "Could not initialize/read Git repository." }

Write-Host ""
Write-Host "============================================================"
Write-Host "Failures: $script:Failures   Warnings: $script:Warnings"
if ($script:Failures -eq 0) {
  Write-Host "GATE A: PASS" -ForegroundColor Green
  exit 0
} else {
  Write-Host "GATE A: FAIL - fix blockers before coding." -ForegroundColor Red
  exit 1
}
