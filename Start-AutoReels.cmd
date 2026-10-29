@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-windows.ps1"
if errorlevel 1 (
  echo.
  echo AutoReels could not start. Read the error above and docs\implementation\WINDOWS_START.md.
  pause
  exit /b 1
)
endlocal
