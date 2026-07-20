# Pharmacy inventory backups

The JSON backup in this folder contains all pharmacy items and their drug batches, including original IDs, quantities, prices, expiry dates, and hospital links.

The backup is created by:

```powershell
cd backend
node scripts/backup-pharmacy-inventory.js
```

Keep a copy of the JSON file outside the application folder as well. Do not edit the backup file manually; use it as the source for a controlled restore.
