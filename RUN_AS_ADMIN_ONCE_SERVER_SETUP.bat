@echo off
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Please right-click this file and choose "Run as administrator".
  pause
  exit /b 1
)

netsh advfirewall firewall delete rule name="MediCore HMS API 5000" >nul 2>&1
netsh advfirewall firewall add rule name="MediCore HMS API 5000" dir=in action=allow protocol=TCP localport=5000 profile=any
netsh advfirewall firewall add rule name="MediCore HMS Node Backend" dir=in action=allow program="C:\Program Files\nodejs\node.exe" enable=yes profile=any

schtasks /Create /TN "MediCore HMS Server" /SC ONLOGON /TR "\"C:\Users\Shivraj\AppData\Roaming\npm\pm2.cmd\" resurrect" /F

cd /d C:\medicore\backend
"C:\Users\Shivraj\AppData\Roaming\npm\pm2.cmd" start src\server.js --name medicore-api
"C:\Users\Shivraj\AppData\Roaming\npm\pm2.cmd" save

echo.
echo Done. MediCore server will restore when this Windows user logs in.
echo Server URL for other PCs: http://DESKTOP-2T3MG9J:5000
echo Backup URL: http://192.168.31.19:5000
pause
