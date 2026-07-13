@echo off
cd /d C:\medicore\backend
"C:\Users\Shivraj\AppData\Roaming\npm\pm2.cmd" start src\server.js --name medicore-api
"C:\Users\Shivraj\AppData\Roaming\npm\pm2.cmd" save
echo MediCore server is running on http://DESKTOP-2T3MG9J:5000
echo Also available on http://192.168.31.19:5000 while this IP stays assigned.
pause
