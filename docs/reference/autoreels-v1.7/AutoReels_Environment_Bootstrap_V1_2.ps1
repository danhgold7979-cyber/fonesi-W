param(
  [string]$ProjectRoot = "E:\AutoReels",
  [switch]$InstallMissing,
  [switch]$SkipBuildTools,
  [switch]$NoPhoneCheck
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# ------------------------------------------------------------
# AutoReels Toolchain Bootstrap V1.2
# Default: CHECK ONLY
# -InstallMissing: install ONLY missing/incompatible components.
# No uninstall, no replacement of a valid system installation.
# Project-local tools go under E:\AutoReels\.tools
# ------------------------------------------------------------

$Baseline = [ordered]@{
  NodeMajor       = 24
  PythonMajorMinor= "3.14"
  PnpmVersion     = "12.6.0"
  GitMin          = [version]"2.50.0"
  PythonInstaller = "3.14.7"
  PlatformTools   = "37.0.1"
}

$ToolsRoot = Join-Path $ProjectRoot ".tools"
$DownloadRoot = Join-Path $ToolsRoot ".downloads"
$AndroidRoot = Join-Path $ToolsRoot "android"
$PlatformToolsRoot = Join-Path $AndroidRoot "platform-tools"
$PythonRoot = Join-Path $ToolsRoot "Python314"
$PnpmRoot = Join-Path $ToolsRoot ("pnpm-" + $Baseline.PnpmVersion)

$script:Results = @()
$script:SelectedNode = $null
$script:SelectedNpm = $null
$script:SelectedPython = $null
$script:SelectedGit = $null
$script:SelectedAdb = $null
$script:SelectedPnpm = $null

function Add-Result {
  param([string]$Name,[string]$Status,[string]$Version,[string]$Path,[string]$Action,[string]$Note="")
  $script:Results += [pscustomobject]@{
    Component=$Name; Status=$Status; Version=$Version; Path=$Path; Action=$Action; Note=$Note
  }
}

function Write-Status {
  param([string]$Status,[string]$Message)
  switch ($Status) {
    "OK"      { Write-Host "[OK]      $Message" -ForegroundColor Green }
    "MISSING" { Write-Host "[MISSING] $Message" -ForegroundColor Yellow }
    "WRONG"   { Write-Host "[WRONG]   $Message" -ForegroundColor Yellow }
    "FAIL"    { Write-Host "[FAIL]    $Message" -ForegroundColor Red }
    default   { Write-Host "[INFO]    $Message" -ForegroundColor Cyan }
  }
}

function Ensure-Dir([string]$Path) {
  if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null }
}

function Download-File {
  param([string]$Url,[string]$OutFile)
  Ensure-Dir (Split-Path -Parent $OutFile)
  if (Test-Path $OutFile) {
    Write-Host "Using cached download: $OutFile" -ForegroundColor DarkGray
    return
  }
  Write-Host "Downloading: $Url" -ForegroundColor Cyan
  Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing
}

function Assert-Authenticode {
  param([string]$File,[switch]$AllowUnknown)
  $sig = Get-AuthenticodeSignature $File
  if ($sig.Status -eq "Valid") {
    Write-Host "Signature OK: $($sig.SignerCertificate.Subject)" -ForegroundColor DarkGreen
    return $true
  }
  if ($AllowUnknown) {
    Write-Warning "Signature is $($sig.Status): $File"
    return $false
  }
  throw "Authenticode signature is not valid: $File ($($sig.Status))"
}

function Get-VersionFromOutput([string]$Text) {
  $m = [regex]::Match($Text, '\d+\.\d+(?:\.\d+)?')
  if ($m.Success) { return $m.Value }
  return ""
}

function Get-NodeCandidate {
  # Prefer project-local Node 24, then system Node 24.
  $local = Get-ChildItem $ToolsRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "node-v24.*" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($local) {
    $exe = Join-Path $local.FullName "node.exe"
    if (Test-Path $exe) {
      $v = (& $exe -v).Trim()
      if ([int]($v.TrimStart("v").Split(".")[0]) -eq $Baseline.NodeMajor) {
        return [pscustomobject]@{Exe=$exe; Version=$v; Root=$local.FullName; Source="project-local"}
      }
    }
  }
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) {
    $v = (& $cmd.Source -v).Trim()
    $major = [int]($v.TrimStart("v").Split(".")[0])
    if ($major -eq $Baseline.NodeMajor) {
      return [pscustomobject]@{Exe=$cmd.Source; Version=$v; Root=(Split-Path $cmd.Source); Source="system"}
    }
  }
  return $null
}

function Install-NodeLocal {
  Write-Host "`nInstalling project-local Node 24 LTS (side-by-side)..." -ForegroundColor Cyan
  $index = Invoke-RestMethod "https://nodejs.org/dist/index.json"
  $rel = $index | Where-Object {
    $_.version -like "v24.*" -and $_.lts
  } | Select-Object -First 1
  if (-not $rel) { throw "Could not resolve latest Node 24 LTS release." }

  $ver = $rel.version.TrimStart("v")
  $zipName = "node-v$ver-win-x64.zip"
  $base = "https://nodejs.org/dist/v$ver"
  $zip = Join-Path $DownloadRoot $zipName
  $sums = Join-Path $DownloadRoot "node-v$ver-SHASUMS256.txt"

  Download-File "$base/$zipName" $zip
  Download-File "$base/SHASUMS256.txt" $sums

  $expectedLine = Get-Content $sums | Where-Object { $_ -match [regex]::Escape($zipName) } | Select-Object -First 1
  if (-not $expectedLine) { throw "Node SHA256 entry not found." }
  $expected = ($expectedLine -split '\s+')[0].Trim()
  $actual = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expected.ToLowerInvariant()) { throw "Node SHA256 mismatch." }
  Write-Host "Node SHA256 OK." -ForegroundColor Green

  $dest = Join-Path $ToolsRoot "node-v$ver"
  if (-not (Test-Path (Join-Path $dest "node.exe"))) {
    $tmp = Join-Path $ToolsRoot ("node-extract-" + [guid]::NewGuid().ToString("N"))
    Ensure-Dir $tmp
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $inner = Get-ChildItem $tmp -Directory | Select-Object -First 1
    if (-not $inner) { throw "Node archive layout unexpected." }
    Move-Item $inner.FullName $dest
    Remove-Item $tmp -Recurse -Force
  }
  return $dest
}

function Get-PythonCandidate {
  $local = Join-Path $PythonRoot "python.exe"
  if (Test-Path $local) {
    $v = (& $local --version 2>&1).ToString()
    if ($v -match "^Python 3\.14") { return [pscustomobject]@{Exe=$local;Version=$v;Source="project-local"} }
  }
  $py = Get-Command py -ErrorAction SilentlyContinue
  if ($py) {
    try {
      $v = (& $py.Source -3.14 --version 2>&1).ToString()
      if ($LASTEXITCODE -eq 0 -and $v -match "^Python 3\.14") {
        $exe = (& $py.Source -3.14 -c "import sys; print(sys.executable)").Trim()
        return [pscustomobject]@{Exe=$exe;Version=$v;Source="system-py"}
      }
    } catch {}
  }
  $cmd = Get-Command python -ErrorAction SilentlyContinue
  if ($cmd) {
    $v = (& $cmd.Source --version 2>&1).ToString()
    if ($v -match "^Python 3\.14") { return [pscustomobject]@{Exe=$cmd.Source;Version=$v;Source="system"} }
  }
  return $null
}

function Install-PythonLocal {
  Write-Host "`nInstalling project-local Python $($Baseline.PythonInstaller) (side-by-side)..." -ForegroundColor Cyan
  $ver = $Baseline.PythonInstaller
  $exe = Join-Path $DownloadRoot "python-$ver-amd64.exe"
  Download-File "https://www.python.org/ftp/python/$ver/python-$ver-amd64.exe" $exe
  Assert-Authenticode $exe | Out-Null

  Ensure-Dir $PythonRoot
  $args = @(
    "/quiet",
    "InstallAllUsers=0",
    "TargetDir=`"$PythonRoot`"",
    "Include_launcher=0",
    "Include_pip=1",
    "Include_test=0",
    "Include_doc=0",
    "AssociateFiles=0",
    "Shortcuts=0",
    "PrependPath=0"
  )
  $p = Start-Process -FilePath $exe -ArgumentList $args -Wait -PassThru
  if ($p.ExitCode -ne 0) { throw "Python installer failed: exit $($p.ExitCode)" }
  if (-not (Test-Path (Join-Path $PythonRoot "python.exe"))) { throw "Python installation did not create python.exe." }
}

function Get-GitCandidate {
  $cmd = Get-Command git -ErrorAction SilentlyContinue
  if ($cmd) {
    $text = (& $cmd.Source --version).Trim()
    $vs = Get-VersionFromOutput $text
    if ($vs) {
      try {
        if ([version]$vs -ge $Baseline.GitMin) {
          return [pscustomobject]@{Exe=$cmd.Source;Version=$text;Root=(Split-Path (Split-Path $cmd.Source));Source="system"}
        }
      } catch {}
    }
  }
  $localExe = Get-ChildItem $ToolsRoot -Filter git.exe -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match 'PortableGit.*\\cmd\\git\.exe$' } |
    Select-Object -First 1
  if ($localExe) {
    $text = (& $localExe.FullName --version).Trim()
    return [pscustomobject]@{Exe=$localExe.FullName;Version=$text;Root=(Split-Path (Split-Path $localExe.FullName));Source="project-local"}
  }
  return $null
}

function Install-GitPortable {
  Write-Host "`nInstalling project-local PortableGit (side-by-side)..." -ForegroundColor Cyan
  $headers = @{ "User-Agent" = "AutoReels-Bootstrap" }
  $release = Invoke-RestMethod -Headers $headers "https://api.github.com/repos/git-for-windows/git/releases/latest"
  $asset = $release.assets | Where-Object { $_.name -match '^PortableGit-.*-64-bit\.7z\.exe$' } | Select-Object -First 1
  if (-not $asset) { throw "Could not find PortableGit x64 asset in latest stable release." }

  $exe = Join-Path $DownloadRoot $asset.name
  Download-File $asset.browser_download_url $exe
  Assert-Authenticode $exe -AllowUnknown | Out-Null

  $dest = Join-Path $ToolsRoot ("PortableGit-" + $release.tag_name.Replace("v",""))
  if (-not (Test-Path (Join-Path $dest "cmd\git.exe"))) {
    Ensure-Dir $dest
    $arg = "-o`"$dest`" -y"
    $p = Start-Process -FilePath $exe -ArgumentList $arg -Wait -PassThru
    if ($p.ExitCode -ne 0) { throw "PortableGit extraction failed: exit $($p.ExitCode)" }
  }
}

function Get-AdbCandidate {
  $local = Join-Path $PlatformToolsRoot "adb.exe"
  if (Test-Path $local) {
    $v = (& $local version | Select-Object -First 2) -join " "
    return [pscustomobject]@{Exe=$local;Version=$v;Source="project-local"}
  }
  $cmd = Get-Command adb -ErrorAction SilentlyContinue
  if ($cmd) {
    $v = (& $cmd.Source version | Select-Object -First 2) -join " "
    return [pscustomobject]@{Exe=$cmd.Source;Version=$v;Source="system"}
  }
  return $null
}

function Install-PlatformToolsLocal {
  Write-Host "`nInstalling project-local Android Platform-Tools..." -ForegroundColor Cyan
  $zip = Join-Path $DownloadRoot "platform-tools-latest-windows.zip"
  Download-File "https://dl.google.com/android/repository/platform-tools-latest-windows.zip" $zip

  Ensure-Dir $AndroidRoot
  $tmp = Join-Path $ToolsRoot ("android-extract-" + [guid]::NewGuid().ToString("N"))
  Ensure-Dir $tmp
  Expand-Archive $zip -DestinationPath $tmp -Force
  $src = Join-Path $tmp "platform-tools"
  if (-not (Test-Path (Join-Path $src "adb.exe"))) { throw "Platform-Tools archive layout unexpected." }
  if (Test-Path $PlatformToolsRoot) {
    # Do not overwrite a valid existing folder; versioned backup instead.
    $backup = $PlatformToolsRoot + "-backup-" + (Get-Date -Format "yyyyMMdd-HHmmss")
    Move-Item $PlatformToolsRoot $backup
  }
  Move-Item $src $PlatformToolsRoot
  Remove-Item $tmp -Recurse -Force
}

function Find-VsWhere {
  @(
    "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe",
    "$env:ProgramFiles\Microsoft Visual Studio\Installer\vswhere.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
}

function Test-BuildTools {
  $vswhere = Find-VsWhere
  if (-not $vswhere) { return $null }
  $path = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  if ($path) { return $path.Trim() }
  return $null
}

function Install-BuildTools {
  if ($SkipBuildTools) { return }
  Write-Host "`nInstalling missing Visual Studio Build Tools C++ workload..." -ForegroundColor Cyan
  $exe = Join-Path $DownloadRoot "vs_BuildTools.exe"
  Download-File "https://aka.ms/vs/17/release/vs_BuildTools.exe" $exe
  Assert-Authenticode $exe | Out-Null

  # System-level component: use Microsoft's default installation location.
  # UAC prompt may appear. No existing Visual Studio installation is removed.
  $args = '--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended'
  $p = Start-Process -FilePath $exe -ArgumentList $args -Verb RunAs -Wait -PassThru
  if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) {
    throw "Visual Studio Build Tools installer failed: exit $($p.ExitCode)"
  }
}

function Find-Pnpm {
  $local = Join-Path $PnpmRoot "pnpm.cmd"
  if (Test-Path $local) {
    $v = (& $local --version).Trim()
    if ($v -eq $Baseline.PnpmVersion) { return [pscustomobject]@{Exe=$local;Version=$v;Source="project-local"} }
  }
  $cmd = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($cmd) {
    $v = (& $cmd.Source --version).Trim()
    if ($v -eq $Baseline.PnpmVersion) { return [pscustomobject]@{Exe=$cmd.Source;Version=$v;Source="system"} }
  }
  return $null
}

function Install-PnpmLocal {
  param([string]$NodeRoot)
  Write-Host "`nInstalling project-local pnpm $($Baseline.PnpmVersion)..." -ForegroundColor Cyan
  $npm = Join-Path $NodeRoot "npm.cmd"
  if (-not (Test-Path $npm)) {
    $sysNpm = Get-Command npm -ErrorAction SilentlyContinue
    if ($sysNpm) { $npm = $sysNpm.Source }
  }
  if (-not (Test-Path $npm)) { throw "npm not found; cannot install pnpm." }

  Ensure-Dir $PnpmRoot
  & $npm install --global --prefix $PnpmRoot ("pnpm@" + $Baseline.PnpmVersion)
  if ($LASTEXITCODE -ne 0) { throw "pnpm installation failed." }
  if (-not (Test-Path (Join-Path $PnpmRoot "pnpm.cmd"))) {
    throw "pnpm.cmd not found in expected local prefix."
  }
}

function Write-ActivationScript {
  $path = Join-Path $ToolsRoot "Activate-AutoReels.ps1"
  $content = @'
$ProjectRoot = "E:\AutoReels"
$ToolsRoot = Join-Path $ProjectRoot ".tools"

$paths = @()

$node = Get-ChildItem $ToolsRoot -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like "node-v24.*" } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if ($node) { $paths += $node.FullName }

$git = Get-ChildItem $ToolsRoot -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like "PortableGit-*" } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if ($git) {
  $paths += (Join-Path $git.FullName "cmd")
  $paths += (Join-Path $git.FullName "bin")
}

$android = Join-Path $ToolsRoot "android\platform-tools"
if (Test-Path $android) { $paths += $android }

$python = Join-Path $ToolsRoot "Python314"
if (Test-Path (Join-Path $python "python.exe")) {
  $paths += $python
  $paths += (Join-Path $python "Scripts")
  $env:npm_config_python = Join-Path $python "python.exe"
}

$pnpm = Join-Path $ToolsRoot "pnpm-12.6.0"
if (Test-Path (Join-Path $pnpm "pnpm.cmd")) { $paths += $pnpm }

foreach ($p in [array]::Reverse([array]$paths.Clone())) {
  if ($p -and ($env:Path -notlike "*$p*")) { $env:Path = "$p;$env:Path" }
}

Set-Location $ProjectRoot
Write-Host "AutoReels toolchain activated for this PowerShell session." -ForegroundColor Green
node -v 2>$null
pnpm -v 2>$null
adb version 2>$null | Select-Object -First 1
'@
  Set-Content -Path $path -Value $content -Encoding UTF8
  return $path
}

function Refresh-SelectedTools {
  $n = Get-NodeCandidate
  if ($n) {
    $script:SelectedNode = $n.Exe
    $script:SelectedNpm = Join-Path $n.Root "npm.cmd"
  }

  $p = Get-PythonCandidate
  if ($p) { $script:SelectedPython = $p.Exe }

  $g = Get-GitCandidate
  if ($g) { $script:SelectedGit = $g.Exe }

  $a = Get-AdbCandidate
  if ($a) { $script:SelectedAdb = $a.Exe }

  $pn = Find-Pnpm
  if ($pn) { $script:SelectedPnpm = $pn.Exe }
}

function Check-All {
  $script:Results = @()
  Refresh-SelectedTools

  # Project root
  if (Test-Path $ProjectRoot) {
    Add-Result "Workspace" "OK" "" $ProjectRoot "none"
  } else {
    Add-Result "Workspace" "MISSING" "" $ProjectRoot "create"
  }

  # Git
  $git = Get-GitCandidate
  if ($git) {
    Add-Result "Git" "OK" $git.Version $git.Exe "none" $git.Source
  } else {
    $sys = Get-Command git -ErrorAction SilentlyContinue
    if ($sys) {
      $v = (& $sys.Source --version).Trim()
      Add-Result "Git" "WRONG" $v $sys.Source "install-local" "Existing Git is kept; local maintained Git will be added."
    } else {
      Add-Result "Git" "MISSING" "" "" "install-local"
    }
  }

  # Node
  $node = Get-NodeCandidate
  if ($node) {
    Add-Result "Node" "OK" $node.Version $node.Exe "none" $node.Source
  } else {
    $sys = Get-Command node -ErrorAction SilentlyContinue
    $note = if ($sys) { "Existing Node is kept; Node 24 will be installed side-by-side." } else { "" }
    $v = if ($sys) { (& $sys.Source -v).Trim() } else { "" }
    Add-Result "Node" $(if($sys){"WRONG"}else{"MISSING"}) $v $(if($sys){$sys.Source}else{""}) "install-local" $note
  }

  # Python
  $py = Get-PythonCandidate
  if ($py) {
    Add-Result "Python" "OK" $py.Version $py.Exe "none" $py.Source
  } else {
    $sys = Get-Command python -ErrorAction SilentlyContinue
    $note = if ($sys) { "Existing Python is kept; Python 3.14 will be installed side-by-side." } else { "" }
    Add-Result "Python" $(if($sys){"WRONG"}else{"MISSING"}) $(if($sys){(& $sys.Source --version 2>&1).ToString()}else{""}) $(if($sys){$sys.Source}else{""}) "install-local" $note
  }

  # Build Tools
  $vs = Test-BuildTools
  if ($vs) {
    Add-Result "VS C++ Build Tools" "OK" "VC x64/x86 workload" $vs "none"
  } else {
    Add-Result "VS C++ Build Tools" "MISSING" "" "" $(if($SkipBuildTools){"manual"}else{"install-system"}) "Adds missing Microsoft C++ workload; does not remove existing VS."
  }

  # ADB
  $adb = Get-AdbCandidate
  if ($adb) {
    Add-Result "ADB" "OK" $adb.Version $adb.Exe "none" $adb.Source
  } else {
    Add-Result "ADB" "MISSING" "" "" "install-local"
  }

  # pnpm
  $pnpm = Find-Pnpm
  if ($pnpm) {
    Add-Result "pnpm" "OK" $pnpm.Version $pnpm.Exe "none" $pnpm.Source
  } else {
    $sys = Get-Command pnpm -ErrorAction SilentlyContinue
    $v = if($sys){(& $sys.Source --version).Trim()}else{""}
    Add-Result "pnpm" $(if($sys){"WRONG"}else{"MISSING"}) $v $(if($sys){$sys.Source}else{""}) "install-local" "Existing pnpm is kept; 12.6.0 is project-local."
  }

  return $script:Results
}

function Install-OnlyMissing {
  Ensure-Dir $ProjectRoot
  Ensure-Dir $ToolsRoot
  Ensure-Dir $DownloadRoot

  $check = Check-All

  if (($check | Where-Object Component -eq "Git").Status -ne "OK") {
    Install-GitPortable
  }
  if (($check | Where-Object Component -eq "Node").Status -ne "OK") {
    Install-NodeLocal | Out-Null
  }
  if (($check | Where-Object Component -eq "Python").Status -ne "OK") {
    Install-PythonLocal
  }
  if (($check | Where-Object Component -eq "VS C++ Build Tools").Status -ne "OK" -and -not $SkipBuildTools) {
    Install-BuildTools
  }
  if (($check | Where-Object Component -eq "ADB").Status -ne "OK") {
    Install-PlatformToolsLocal
  }

  # Refresh after Node install, then pnpm
  Refresh-SelectedTools
  $node = Get-NodeCandidate
  if (-not $node) { throw "Node 24 is still unavailable after installation." }
  if (-not (Find-Pnpm)) {
    Install-PnpmLocal -NodeRoot $node.Root
  }

  $activate = Write-ActivationScript
  Write-Host "`nActivation script: $activate" -ForegroundColor Cyan
}

# ------------------------------------------------------------
# MAIN
# ------------------------------------------------------------
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " AutoReels Environment Bootstrap V1.2" -ForegroundColor Cyan
Write-Host " Workspace: $ProjectRoot" -ForegroundColor Cyan
Write-Host " Mode: $(if($InstallMissing){'CHECK + INSTALL ONLY MISSING'}else{'CHECK ONLY - NO INSTALL'})" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if ($InstallMissing) {
  Install-OnlyMissing
}

$results = Check-All
$results | Format-Table -AutoSize

$blocking = @($results | Where-Object { $_.Status -ne "OK" })
Write-Host ""

# Device phone check uses selected adb if available
Refresh-SelectedTools
if (-not $NoPhoneCheck -and $script:SelectedAdb) {
  Write-Host "ADB phone status:" -ForegroundColor Cyan
  try {
    & $script:SelectedAdb start-server | Out-Null
    $lines = & $script:SelectedAdb devices -l
    $phones = @($lines | Select-Object -Skip 1 | Where-Object { $_.Trim() })
    if ($phones.Count -eq 0) {
      Write-Host "  No phone connected yet (not an install blocker for Phase 0)." -ForegroundColor Yellow
    } else {
      foreach($line in $phones) {
        if ($line -match "\bunauthorized\b") {
          Write-Host "  [BLOCK] $line" -ForegroundColor Red
          Write-Host "          Unlock phone and accept the USB debugging RSA prompt." -ForegroundColor Yellow
        } elseif ($line -match "\boffline\b") {
          Write-Host "  [WARN]  $line" -ForegroundColor Yellow
        } elseif ($line -match "\bdevice\b") {
          Write-Host "  [OK]    $line" -ForegroundColor Green
        } else {
          Write-Host "  [INFO]  $line"
        }
      }
    }
  } catch {
    Write-Warning "ADB phone enumeration failed: $($_.Exception.Message)"
  }
}

# Write machine-readable report if workspace exists
if (Test-Path $ProjectRoot) {
  Ensure-Dir $ToolsRoot
  $report = Join-Path $ToolsRoot "environment-report.json"
  [pscustomobject]@{
    timestamp=(Get-Date).ToString("o")
    projectRoot=$ProjectRoot
    installMode=[bool]$InstallMissing
    baseline=$Baseline
    results=$results
  } | ConvertTo-Json -Depth 6 | Set-Content $report -Encoding UTF8
  Write-Host "`nReport: $report" -ForegroundColor DarkGray
}

if ($blocking.Count -eq 0) {
  Write-Host "`nENVIRONMENT BASELINE: PASS" -ForegroundColor Green
  if (Test-Path (Join-Path $ToolsRoot "Activate-AutoReels.ps1")) {
    Write-Host "For a new PowerShell session run:" -ForegroundColor Cyan
    Write-Host "  . E:\AutoReels\.tools\Activate-AutoReels.ps1" -ForegroundColor White
  }
  exit 0
} else {
  Write-Host "`nENVIRONMENT BASELINE: NOT READY" -ForegroundColor Yellow
  if (-not $InstallMissing) {
    Write-Host "Nothing was installed. To install only missing/incompatible components:" -ForegroundColor Cyan
    Write-Host "  .\AutoReels_Environment_Bootstrap_V1_2.ps1 -InstallMissing" -ForegroundColor White
  } else {
    Write-Host "Some components are still not ready. Review the table above before coding." -ForegroundColor Yellow
  }
  exit 1
}
