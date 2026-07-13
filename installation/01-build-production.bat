@echo off
setlocal
cd /d "%~dp0.."

echo Building MediCore browser app...
cd frontend
call npm install
call npm run build
if errorlevel 1 exit /b 1

echo Preparing backend...
cd ..\backend
call npm install
call npx prisma generate
if errorlevel 1 exit /b 1

echo Build complete. Run installation\02-start-server.bat
pause
