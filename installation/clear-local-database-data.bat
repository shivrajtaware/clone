@echo off
setlocal
cd /d "%~dp0.."
echo This clears all application data from the DATABASE_URL in backend\.env.
node installation\clear-local-database-data.js
pause
