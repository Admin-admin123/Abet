$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

function Assert-LastExitCode([string]$message) {
  if ($LASTEXITCODE -ne 0) {
    throw $message
  }
}

if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  Write-Host 'Created .env from .env.example'
}

Write-Host 'Checking Docker engine...'
try {
  docker info | Out-Null
  Assert-LastExitCode 'Docker engine is not running. Start Docker Desktop and retry.'
}
catch {
  throw 'Docker engine is not running. Start Docker Desktop and retry.'
}

Write-Host 'Building n8n image (with XLSX support)...'
docker compose build n8n
Assert-LastExitCode 'n8n image build failed.'

Write-Host 'Starting postgres + n8n...'
docker compose up -d
Assert-LastExitCode 'docker compose up failed.'

Write-Host ''
Write-Host 'Stack status:'
docker compose ps
Assert-LastExitCode 'Unable to read docker compose status.'

Write-Host ''
Write-Host 'n8n UI: http://localhost:5678'
Write-Host 'Default n8n login from .env (basic auth): admin / aiu_abet_2026'
Write-Host ''
Write-Host 'Next steps:'
Write-Host '1) Open n8n and create the Postgres credential.'
Write-Host '2) Build workflows using files in n8n/workflow-blueprints.'
Write-Host '3) Run scripts/test-api.ps1 after activating workflows.'
