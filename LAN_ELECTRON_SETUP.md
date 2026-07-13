# MediCore LAN Server

This PC is the server. Open this from any device on the same Wi-Fi/LAN:

`http://192.168.1.8:5000`

The server starts silently whenever **shree** signs in to Windows; no terminal window is shown.

Run `installation\install-lan-autostart.cmd` once as Administrator to allow LAN traffic through Windows Firewall. Then create Chrome shortcuts using the URL above.

If the router changes this PC's IP address, use `http://DESKTOP-5OD2NDB:5000` instead, or reserve `192.168.1.8` in the router.
