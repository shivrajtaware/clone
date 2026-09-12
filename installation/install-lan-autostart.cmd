@echo off
setlocal
net session >nul 2>&1 || (echo Run this file as administrator.& exit /b 1)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-windows-no-docker.ps1"
if errorlevel 1 (
  echo Setup failed. No application data was reset by the setup script.
  pause
  exit /b 1
)
pause
