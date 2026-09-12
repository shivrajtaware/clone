$ErrorActionPreference = 'Stop'
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$sourcePath = Join-Path $projectRoot 'frontend\public\brand-mark.png'

if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw "Logo source not found: $sourcePath"
}

Push-Location (Join-Path $projectRoot 'frontend')
try {
  & npx.cmd tauri icon 'public\brand-mark.png'
  if ($LASTEXITCODE -ne 0) { throw "Tauri icon generation failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}

Write-Host "Generated Tauri icons from $sourcePath"
