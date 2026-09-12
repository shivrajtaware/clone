# MediCore HMS Tauri LAN deployment (Windows, no Docker)

MediCore HMS is a central-server hospital system. Install the Tauri client on each laptop, but keep PostgreSQL and the Node backend on the hospital server. All laptops must point to the same backend URL; do not run a separate database on client laptops.

## One-time server setup

1. On the server PC, keep the existing `backend/.env` and database. Do not run any reset or seed command.
2. Right-click `installation\setup-windows-no-docker.cmd` and choose **Run as administrator**. It starts the installed PostgreSQL Windows service, applies only pending Prisma migrations, opens TCP port `5000` on the Private profile, and registers the backend for Windows logon.
3. Confirm `http://localhost:5000/health` and `http://SERVER_IP:5000/health` both return a healthy MediCore response.
4. Keep the server PC and all laptops on the same LAN/VLAN. The Tauri client first tries the configured hostname/localhost, then automatically discovers a MediCore server on the local subnet by checking port `5000` and validating `/health`.

The setup script does not delete, reset, reseed, or import inventory data. The current pharmacy backup is kept under `backups\pharmacy`.

## Build the Windows client

Install Rust and the Tauri prerequisites on the build machine, then from `frontend` run:

```powershell
npm install
npm run tauri:build
```

The installer is produced under `frontend/src-tauri/target/release/bundle/`.

Before building, run the server setup above. It writes the server PC's Windows hostname into `frontend/src-tauri/server-config.json`. This is only a fast first attempt; automatic subnet discovery is the fallback when DHCP changes the server IP:

```json
{ "serverUrl": "http://HOSPITAL-SERVER:5000" }
```

## Adding another laptop

Install the generated Tauri installer. The client opens the central server URL and stores no pharmacy or patient database locally. To change the server later, place a `server-config.json` beside the installed EXE, or set the `MEDICORE_SERVER_URL` environment variable before launching the client.

## Network rules

Keep all client laptops and the server on the same trusted LAN/VLAN, and allow TCP port `5000` in the server firewall only for that network. Automatic discovery expects one MediCore server on the subnet; if several hospitals share the same subnet, use distinct VLANs or configure the hostname per client.
