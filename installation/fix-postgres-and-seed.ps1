$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $repo 'backend'
$envPath = Join-Path $backend '.env'
$hbaPath = 'C:\Program Files\PostgreSQL\18\data\pg_hba.conf'
$service = 'postgresql-x64-18'
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'

function SqlLiteral($value) {
  return "'" + ($value -replace "'", "''") + "'"
}

function SqlIdent($value) {
  return '"' + ($value -replace '"', '""') + '"'
}

$databaseUrlLine = Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $databaseUrlLine) { throw 'DATABASE_URL missing from backend\.env' }

$databaseUrl = ($databaseUrlLine -replace '^DATABASE_URL=', '').Trim().Trim('"').Trim("'")
$uri = [Uri]$databaseUrl
$dbUser = [Uri]::UnescapeDataString($uri.UserInfo.Split(':')[0])
$dbPass = [Uri]::UnescapeDataString($uri.UserInfo.Substring($uri.UserInfo.IndexOf(':') + 1))
$dbName = $uri.AbsolutePath.TrimStart('/')

$backupPath = "$hbaPath.codex-backup"
Copy-Item -LiteralPath $hbaPath -Destination $backupPath -Force

$original = Get-Content -LiteralPath $hbaPath -Raw
$trustBlock = @"
# Temporary local admin access for MediCore repair
host    all             postgres        127.0.0.1/32            trust
host    all             postgres        ::1/128                 trust

"@

try {
  Set-Content -LiteralPath $hbaPath -Value ($trustBlock + $original) -Encoding ASCII
  Restart-Service -Name $service -Force
  Start-Sleep -Seconds 3

  $roleSql = @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $(SqlLiteral $dbUser)) THEN
    CREATE ROLE $(SqlIdent $dbUser) LOGIN PASSWORD $(SqlLiteral $dbPass);
  ELSE
    ALTER ROLE $(SqlIdent $dbUser) WITH LOGIN PASSWORD $(SqlLiteral $dbPass);
  END IF;
END
`$`$;
"@
  & $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c $roleSql | Out-Null

  $dbExists = & $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = $(SqlLiteral $dbName)"
  if (-not $dbExists) {
    & $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $(SqlIdent $dbName) OWNER $(SqlIdent $dbUser)" | Out-Null
  }

  & $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "GRANT ALL PRIVILEGES ON DATABASE $(SqlIdent $dbName) TO $(SqlIdent $dbUser)" | Out-Null
  & $psql -h 127.0.0.1 -p 5432 -U postgres -d $dbName -v ON_ERROR_STOP=1 -c "GRANT USAGE, CREATE ON SCHEMA public TO $(SqlIdent $dbUser); GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $(SqlIdent $dbUser); GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $(SqlIdent $dbUser); ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $(SqlIdent $dbUser); ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $(SqlIdent $dbUser);" | Out-Null
}
finally {
  Copy-Item -LiteralPath $backupPath -Destination $hbaPath -Force
  Restart-Service -Name $service -Force
  Start-Sleep -Seconds 3
}

Push-Location $backend
try {
  npm.cmd exec prisma migrate deploy
  npm.cmd run seed
}
finally {
  Pop-Location
}

Write-Host 'PostgreSQL repaired and MediCore seed completed.'
