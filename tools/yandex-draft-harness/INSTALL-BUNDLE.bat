@echo off
setlocal
cd /d "%~dp0"
title Install Yandex Draft Runtime Harness
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0INSTALL-BUNDLE.ps1"
if errorlevel 1 (
  echo.
  echo Installation failed.
  pause
  exit /b 1
)
echo.
pause
endlocal
