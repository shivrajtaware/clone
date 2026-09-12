@echo off
setlocal
cd /d "%~dp0..\backend"

if not exist ".env" (
  echo backend\.env is missing. Restore the existing configuration; it will not be generated automatically.
  pause
  exit /b 1
)

call npm.cmd exec prisma migrate deploy
if errorlevel 1 exit /b 1

set NODE_ENV=production
set PORT=5000
node src\server.js
