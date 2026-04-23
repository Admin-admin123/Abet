param(
  [int]$Port = 8088
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location (Join-Path $repoRoot 'webapp')

Write-Host "Starting ABET workflow web app at http://localhost:$Port"
python -m http.server $Port
