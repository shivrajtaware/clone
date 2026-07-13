@echo off
net session >nul 2>&1
if errorlevel 1 (
  echo Right-click this file and choose "Run as administrator".
  pause
  exit /b 1
)

powershell.exe -ExecutionPolicy Bypass -File "%~dp0fix-postgres-and-seed.ps1"
pause
