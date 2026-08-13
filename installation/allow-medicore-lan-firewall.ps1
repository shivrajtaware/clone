# Run once from an elevated PowerShell window (Run as Administrator) on the hospital server PC.
# This rule is network-scoped and does not depend on a static IP address.
$ErrorActionPreference = 'Stop'
$ruleName = 'MediCore HMS API - Hospital LAN'
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if (-not $existing) {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort 5000 -RemoteAddress LocalSubnet -Action Allow -Profile Domain,Private -Description 'Allow MediCore HMS clients on the hospital LAN to reach the central API.'
}
Write-Host 'MediCore LAN firewall rule is ready for TCP port 5000.'
