@echo off
setlocal
cd /d "%~dp0..\backend"

if not exist ".env" exit /b 1
if not exist "logs" mkdir "logs"

rem PostgreSQL is a Windows service. No Docker or PM2 is required.
rem Do not start a second API if the scheduled task is run more than once.
powershell.exe -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5000/health' -TimeoutSec 2; if ($r.StatusCode -eq 200 -and $r.Content -match 'MediCore HMS API') { exit 0 } } catch {}; exit 1" >nul 2>&1
if not errorlevel 1 exit /b 0

rem PostgreSQL may finish starting shortly after Windows logon.
powershell.exe -NoProfile -Command "$deadline=(Get-Date).AddSeconds(60); while ((Get-Date) -lt $deadline) { if (Test-NetConnection 127.0.0.1 -Port 5432 -InformationLevel Quiet) { exit 0 }; Start-Sleep -Seconds 2 }; exit 1" >> "logs\startup.log" 2>&1
if errorlevel 1 exit /b 1

set /a MIGRATION_ATTEMPTS=0
:migrate
call npm.cmd exec prisma generate >> "logs\startup.log" 2>&1
if errorlevel 1 goto :migration_retry
call npm.cmd exec prisma migrate deploy >> "logs\startup.log" 2>&1
if not errorlevel 1 goto :start_backend
:migration_retry
set /a MIGRATION_ATTEMPTS+=1
if %MIGRATION_ATTEMPTS% GEQ 10 exit /b 1
timeout /t 3 /nobreak >nul
goto :migrate

:start_backend
set NODE_ENV=production
set PORT=5000
node src\server.js >> "logs\server.log" 2>&1
