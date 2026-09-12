@echo off
setlocal
net session >nul 2>&1
if errorlevel 1 (
  echo Right-click this file and choose "Run as administrator".
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-windows-no-docker.ps1"
if errorlevel 1 (
  echo.
  echo Setup failed. No application data was reset by the setup script.
  pause
  exit /b 1
)
pause
