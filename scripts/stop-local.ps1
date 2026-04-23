$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

$removeVolumes = $false
if ($args -contains '--volumes') {
  $removeVolumes = $true
}

if ($removeVolumes) {
  Write-Host 'Stopping stack and removing volumes...'
  docker compose down -v
} else {
  Write-Host 'Stopping stack...'
  docker compose down
}

Write-Host 'Done.'
