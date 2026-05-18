[CmdletBinding()]
param(
  [switch]$StopTunnel
)

$ErrorActionPreference = 'Stop'

$running = (& docker ps --filter "name=openhands-app" --format "{{.Names}}")
if ($running -contains 'openhands-app') {
  Write-Host "Stopping OpenHands container" -ForegroundColor Cyan
  & docker stop openhands-app | Out-Null
  Write-Host "OpenHands stopped." -ForegroundColor Green
} else {
  Write-Host "OpenHands is not running." -ForegroundColor Yellow
}

if ($StopTunnel) {
  $tunnels = Get-CimInstance Win32_Process -Filter "name = 'ssh.exe'" |
    Where-Object { $_.CommandLine -match '-L 11434:localhost:11434' }

  foreach ($tunnel in $tunnels) {
    Write-Host "Stopping SSH tunnel process $($tunnel.ProcessId)" -ForegroundColor Cyan
    Stop-Process -Id $tunnel.ProcessId -Force
  }
}
