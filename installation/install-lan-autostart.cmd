@echo off
net session >nul 2>&1 || (echo Run this file as administrator.& exit /b 1)
netsh advfirewall firewall delete rule name="MediCore HMS LAN" >nul 2>&1
netsh advfirewall firewall add rule name="MediCore HMS LAN" dir=in action=allow protocol=TCP localport=5000 profile=private
schtasks /Create /TN "MediCore HMS Server" /SC ONLOGON /RL LIMITED /TR "C:\clone-main\Aisolnex\installation\server-startup.cmd" /F
