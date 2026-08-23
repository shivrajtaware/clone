# Safe production update

The PostgreSQL database is the source of truth for hospital data. The client
application does not contain the database. Updating the code is safe only when
the server's `.env`, PostgreSQL data directory, and upload directory are kept
outside Git.

## Before updating the client's server PC

1. Ask staff to stop using the system and confirm no requests are in progress.
2. Open PowerShell in the deployed project directory and make a dated database
   backup. Use the real production `DATABASE_URL`; do not commit this file:

   ```powershell
   $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
   $backup = "C:\MediCoreBackups\medicore-$stamp.dump"
   New-Item -ItemType Directory -Force (Split-Path $backup) | Out-Null
   pg_dump --dbname="$env:DATABASE_URL" --format=custom --file="$backup"
   ```

   If `DATABASE_URL` is only in `backend\.env`, load it using the PostgreSQL
   client or run `pg_dump` with the same connection details. Verify that the
   dump file exists and has a non-zero size before continuing.

3. Make a separate copy of `backend\uploads` if the deployment uses local file
   storage. Never overwrite `backend\.env`.
4. Stop the backend service:

   ```powershell
   pm2 stop medicore-hms
   ```

## Update the server code

Run these commands from the deployed project directory:

```powershell
git pull --ff-only origin main
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
cd ..
pm2 restart medicore-hms --update-env
```

`prisma migrate deploy` applies only committed, forward migrations. It does
not delete application rows. Do not run `prisma migrate dev`, `reset:clean`,
`clear-local-database-data.bat`, or a restore script during a normal update.
Do not run the seed script on every restart; it is an initial-install action.

Check the service before allowing users back in:

```powershell
Invoke-WebRequest http://127.0.0.1:5000/health
pm2 logs medicore-hms --lines 100 --nostream
```

Then verify login, one existing patient, appointments, pharmacy stock, and a
read-only report. If the migration or health check fails, keep the service
stopped and restore the database dump only after confirming the failure and
choosing a rollback window.

## Client PCs

Client PCs should connect to the server PC and must not have a separate
database. Rebuild and distribute the desktop installer when frontend/native
client code changes. Installing a newer client does not touch the server
PostgreSQL database; keep the server URL pointed at the existing server PC.

## Git safety

Never commit `backend\.env`, `frontend\.env.local`, PostgreSQL dumps, pharmacy
JSON backups, uploads, logs, or build output. Existing historical backup files
must also be removed from the repository's tracked file list before pushing a
release; keep operational backups in a protected folder outside the project.
