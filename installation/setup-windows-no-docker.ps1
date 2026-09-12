$ErrorActionPreference = 'Stop'

# One-time Windows setup for MediCore HMS without Docker.
# Run on the PC that owns PostgreSQL and the hospital database. This script
# never deletes, resets, reseeds, or imports application data.

$repo = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $repo 'backend'
$envPath = Join-Path $backend '.env'
$logDir = Join-Path $backend 'logs'
$taskName = 'MediCore HMS Server'
$startupVbs = Join-Path $repo 'installation\server-startup.vbs'

function Require-Command([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "$name was not found on PATH. Install Node.js LTS, then run this setup again."
  }
}

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run installation\setup-windows-no-docker.cmd as Administrator.'
}

Require-Command 'node'
Require-Command 'npm'

if (-not (Test-Path -LiteralPath $envPath)) {
  throw 'backend\.env is missing. Restore the existing backend\.env before continuing; this script will not overwrite it.'
}

$postgres = Get-Service -Name 'postgresql-x64-*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
if (-not $postgres) {
  throw 'No PostgreSQL Windows service was found. Install PostgreSQL locally, then run this setup again.'
}
if ($postgres.Status -ne 'Running') {
  Start-Service -Name $postgres.Name
  $postgres.WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
}

New-Item -ItemType Directory -Path $logDir -Force | Out-Null

$backendHealthy = $false
try {
  $health = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5000/health' -TimeoutSec 3
  $backendHealthy = $health.StatusCode -eq 200 -and $health.Content -match 'MediCore HMS API'
} catch {
  $backendHealthy = $false
}

if ($backendHealthy) {
  # Do not replace Prisma's native query engine while a live backend is using
  # it. The running service already proves its loaded dependencies and
  # configured database are usable; migration status is checked separately
  # during deployment validation.
  Write-Host 'Backend is already healthy; leaving its running Prisma client untouched.'
} else {
  Push-Location $backend
  try {
    Write-Host 'Installing backend dependencies...'
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }

    Write-Host 'Generating Prisma client...'
    & npm.cmd exec prisma generate
    if ($LASTEXITCODE -ne 0) { throw 'Prisma client generation failed.' }

    Write-Host 'Applying pending migrations without changing existing rows...'
    & npm.cmd exec prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { throw 'Prisma migration deployment failed.' }
  }
  finally {
    Pop-Location
  }
}

# Permit only the backend port on the Windows Private network profile.
netsh advfirewall firewall delete rule name="MediCore HMS LAN" | Out-Null
netsh advfirewall firewall add rule name="MediCore HMS LAN" dir=in action=allow protocol=TCP localport=5000 profile=private | Out-Null

# Start the existing backend at user logon through the hidden VBScript.
$wscript = Join-Path $env:WINDIR 'System32\wscript.exe'
$taskAction = New-ScheduledTaskAction -Execute $wscript -Argument "`"$startupVbs`""
$taskTrigger = New-ScheduledTaskTrigger -AtLogOn
$taskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable
Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -RunLevel Limited -Force | Out-Null
if (-not (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue)) {
  throw 'Windows logon task registration failed.'
}

# Make the build-time Tauri hint use this server's Windows hostname.
$serverConfig = Join-Path $repo 'frontend\src-tauri\server-config.json'
$serverUrl = "http://$env:COMPUTERNAME`:5000"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($serverConfig, ("{`n  `"serverUrl`": `"$serverUrl`"`n}`n"), $utf8NoBom)

Write-Host ''
Write-Host 'MediCore HMS no-Docker setup completed.' -ForegroundColor Green
Write-Host "PostgreSQL service: $($postgres.Name)"
Write-Host "Backend URL:        http://$env:COMPUTERNAME`:5000"
Write-Host 'Health check:       http://localhost:5000/health'
Write-Host 'Existing inventory and application rows were not deleted or reseeded.'
Write-Host ''
Write-Host 'Build the Tauri client with: cd frontend; npm run tauri:build'
