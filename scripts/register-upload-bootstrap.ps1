$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

$workflowFiles = Get-ChildItem (Join-Path $repoRoot 'n8n\workflows') -Filter '*.workflow.json' | Sort-Object Name
if (-not $workflowFiles -or $workflowFiles.Count -eq 0) {
  throw 'No workflow JSON files found in n8n/workflows.'
}

$workflowIds = @()
foreach ($file in $workflowFiles) {
  Write-Host "Importing workflow file: $($file.Name)"
  docker compose exec n8n n8n import:workflow --input="/workspace/n8n/workflows/$($file.Name)"
  if ($LASTEXITCODE -ne 0) {
    throw "Workflow import failed for $($file.Name)."
  }

  try {
    $wf = Get-Content $file.FullName -Raw | ConvertFrom-Json
    if ($wf.id) {
      $workflowIds += [string]$wf.id
    }
  }
  catch {
    throw "Could not parse workflow id from $($file.Name): $($_.Exception.Message)"
  }
}

if ($workflowIds.Count -eq 0) {
  throw 'No workflow ids discovered from workflow files.'
}

$workflowIds = $workflowIds | Select-Object -Unique
foreach ($id in $workflowIds) {
  Write-Host "Publishing workflow: $id"
  docker compose exec n8n n8n publish:workflow --id=$id
  if ($LASTEXITCODE -ne 0) {
    throw "Workflow publish failed for $id."
  }
}

Write-Host 'Restarting n8n to apply publish changes...'
docker compose restart n8n
if ($LASTEXITCODE -ne 0) {
  throw 'n8n restart failed.'
}

Write-Host 'Active workflows:'
docker compose exec n8n n8n list:workflow --active=true --onlyId

Write-Host ''
Write-Host 'Registered webhooks:'
docker compose exec postgres psql -U abet_user -d abet_db -c "SELECT * FROM webhook_entity ORDER BY 1,2;"

Write-Host ''
Write-Host 'Endpoint readiness probes:'
$uploadCode = curl.exe -s -o NUL -w "%{http_code}" -X POST "http://localhost:5678/webhook/upload" -H "x-api-key: my-secret-key-2026"
$mappingGetCode = curl.exe -s -o NUL -w "%{http_code}" "http://localhost:5678/webhook/so-mapping?program=CSE" -H "x-api-key: my-secret-key-2026"
$mappingPostCode = curl.exe -s -o NUL -w "%{http_code}" -X POST "http://localhost:5678/webhook/so-mapping" -H "x-api-key: my-secret-key-2026" -H "Content-Type: application/json" -d "{\"program\":\"CSE\",\"mappings\":[{\"course_code\":\"CSE251\",\"so_numbers\":[2,3,6]}]}"
$soCode = curl.exe -s -o NUL -w "%{http_code}" "http://localhost:5678/webhook/so-attainment?term=2242&program=CSE" -H "x-api-key: my-secret-key-2026"
$riskCode = curl.exe -s -o NUL -w "%{http_code}" "http://localhost:5678/webhook/at-risk?term=2242&threshold=2.0" -H "x-api-key: my-secret-key-2026"
$reportCode = curl.exe -s -o NUL -w "%{http_code}" -X POST "http://localhost:5678/webhook/generate-report" -H "x-api-key: my-secret-key-2026" -H "Content-Type: application/json" -d "{\"term\":\"2242\",\"program\":\"CSE\",\"type\":\"annual\"}"

Write-Host "POST /webhook/upload -> HTTP $uploadCode"
Write-Host "GET /webhook/so-mapping -> HTTP $mappingGetCode"
Write-Host "POST /webhook/so-mapping -> HTTP $mappingPostCode"
Write-Host "GET /webhook/so-attainment -> HTTP $soCode"
Write-Host "GET /webhook/at-risk -> HTTP $riskCode"
Write-Host "POST /webhook/generate-report -> HTTP $reportCode"

Write-Host ''
Write-Host 'Done. Run full test script next:'
Write-Host 'powershell -ExecutionPolicy Bypass -File .\scripts\test-api.ps1 -IncludeReport'
