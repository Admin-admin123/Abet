param(
  [string]$BaseUrl = 'http://localhost:5678/webhook',
  [string]$ApiKey = 'my-secret-key-2026',
  [string]$Term = '2242',
  [string]$Program = 'CSE',
  [switch]$IncludeReport
)

$ErrorActionPreference = 'Stop'

function Print-Json([string]$Title, [string]$JsonText) {
  Write-Host "`n=== $Title ==="
  try {
    ($JsonText | ConvertFrom-Json) | ConvertTo-Json -Depth 100
  } catch {
    Write-Host $JsonText
  }
}

$headers = @(
  '-H', "x-api-key: $ApiKey"
)

$mapping = curl.exe -s "$BaseUrl/so-mapping?program=$Program" @headers
Print-Json 'SO Mapping' $mapping

$so = curl.exe -s "$BaseUrl/so-attainment?term=$Term&program=$Program" @headers
Print-Json 'SO Attainment' $so

$atRisk = curl.exe -s "$BaseUrl/at-risk?term=$Term&threshold=2.0" @headers
Print-Json 'At-Risk' $atRisk

if ($IncludeReport) {
  $reportBody = @{
    term = $Term
    program = $Program
    type = 'annual'
  } | ConvertTo-Json -Compress

  try {
    $reportObj = Invoke-RestMethod -Method Post -Uri "$BaseUrl/generate-report" -Headers @{ 'x-api-key' = $ApiKey } -ContentType 'application/json' -Body $reportBody
    $report = $reportObj | ConvertTo-Json -Depth 100
  }
  catch {
    $report = $_.Exception.Message
  }

  Print-Json 'Generated Report' $report
}
else {
  Write-Host "`n=== Generated Report ==="
  Write-Host 'Skipped. Re-run with -IncludeReport after setting OPENROUTER_API_KEY.'
}

Write-Host "`nDone."
