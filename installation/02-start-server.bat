@echo off
setlocal
cd /d "%~dp0..\backend"

if not exist ".env" (
  copy ".env.example" ".env"
  echo Created backend\.env. Edit DATABASE_URL and secrets, then run this file again.
  pause
  exit /b 1
)

call npx prisma migrate deploy
if errorlevel 1 exit /b 1

set NODE_ENV=production
set PORT=5000
node src\server.js
