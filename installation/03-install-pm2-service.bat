@echo off
setlocal
cd /d "%~dp0..\backend"

where pm2 >nul 2>nul
if errorlevel 1 call npm install -g pm2

call npx prisma migrate deploy
call pm2 delete medicore-hms 2>nul
call pm2 start src\server.js --name medicore-hms --time
call pm2 save

echo Service started on http://localhost:5000
echo Open from other hospital computers using http://SERVER-LAN-IP:5000
pause
