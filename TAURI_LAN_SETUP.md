# MediCore HMS Tauri LAN deployment

MediCore HMS is a central-server hospital system. Install the Tauri client on each laptop, but keep PostgreSQL and the Node backend on the hospital server. All laptops must point to the same backend URL; do not run a separate database on client laptops.

## One-time server setup

1. Keep the server PC and all laptops on the same LAN/VLAN. A static IP is not required: the Tauri client automatically discovers a MediCore server on the local subnet by checking port `5000` and validating `/health`.
2. Allow inbound TCP port `5000` in the server PC firewall.
3. Set `PUBLIC_SERVER_URL` and the allowed frontend origin in `backend/.env` if required by the deployment.
4. Build/deploy the backend and frontend on the server. Confirm `http://SERVER_IP:5000/health` works from another laptop.

## Build the Windows client

Install Rust and the Tauri prerequisites on the build machine, then from `frontend` run:

```powershell
npm install
npm run tauri:build
```

The installer is produced under `frontend/src-tauri/target/release/bundle/`.

Before building, edit `frontend/src-tauri/server-config.json` to the server PC's Windows hostname. This is only a fast first attempt; automatic subnet discovery is the fallback when DHCP changes the server IP:

```json
{ "serverUrl": "http://HOSPITAL-SERVER:5000" }
```

## Adding another laptop

Install the generated Tauri installer. The client opens the central server URL and stores no pharmacy or patient database locally. To change the server later, edit `server-config.json` in the installed app's data/resource location, or set the `MEDICORE_SERVER_URL` environment variable before launching the client.

## Network rules

Keep all client laptops and the server on the same trusted LAN/VLAN, and allow TCP port `5000` in the server firewall only for that network. Automatic discovery expects one MediCore server on the subnet; if several hospitals share the same subnet, use distinct VLANs or configure the hostname per client.
