@echo off
setlocal
cd /d "%~dp0"
call "%~dp0Start-AutoReels.cmd"
set "launcherExitCode=%ERRORLEVEL%"
endlocal & exit /b %launcherExitCode%
