@echo off
setlocal
cd /d "%~dp0.."

if "%~1"=="" (
  echo Usage: installation\05-create-super-admin.bat admin@example.com StrongPass123!
  pause
  exit /b 1
)

node installation\create-super-admin.js %1 %2
pause
