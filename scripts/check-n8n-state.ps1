$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

Write-Host '=== Containers ==='
docker compose ps

Write-Host "`n=== n8n Workflows (id, name, active) ==="
docker compose exec postgres psql -U abet_user -d abet_db -c "SELECT id, name, active FROM workflow_entity ORDER BY id;"

Write-Host "`n=== Registered Webhooks ==="
docker compose exec postgres psql -U abet_user -d abet_db -c "SELECT * FROM webhook_entity ORDER BY 1,2;"

Write-Host "`n=== Endpoint Probes ==="
$uploadCode = curl.exe -s -o NUL -w "%{http_code}" -X POST "http://localhost:5678/webhook/upload" -H "x-api-key: my-secret-key-2026"
$soCode = curl.exe -s -o NUL -w "%{http_code}" "http://localhost:5678/webhook/so-attainment?term=2242&program=CSE" -H "x-api-key: my-secret-key-2026"
$riskCode = curl.exe -s -o NUL -w "%{http_code}" "http://localhost:5678/webhook/at-risk?term=2242&threshold=2.0" -H "x-api-key: my-secret-key-2026"
$reportCode = curl.exe -s -o NUL -w "%{http_code}" -X POST "http://localhost:5678/webhook/generate-report" -H "x-api-key: my-secret-key-2026" -H "Content-Type: application/json" -d "{\"term\":\"2242\",\"program\":\"CSE\",\"type\":\"annual\"}"

Write-Host "POST /webhook/upload -> HTTP $uploadCode"
Write-Host "GET /webhook/so-attainment -> HTTP $soCode"
Write-Host "GET /webhook/at-risk -> HTTP $riskCode"
Write-Host "POST /webhook/generate-report -> HTTP $reportCode"
