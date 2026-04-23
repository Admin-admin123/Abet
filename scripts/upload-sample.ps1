$ErrorActionPreference = 'Stop'

param(
  [string]$ApiBase = 'http://localhost:5678/webhook',
  [string]$ApiKey = 'my-secret-key-2026',
  [string]$FilePath = 'Docs/2026-03-11T2125_Grades-CSE251.csv',
  [string]$Term = '2242',
  [string]$FileType = 'grades'
)

if (-not (Test-Path $FilePath)) {
  throw "File not found: $FilePath"
}

$result = curl.exe -s -X POST "$ApiBase/upload" `
  -H "x-api-key: $ApiKey" `
  -F "file=@$FilePath" `
  -F "file_type=$FileType" `
  -F "term=$Term"

try {
  ($result | ConvertFrom-Json) | ConvertTo-Json -Depth 50
} catch {
  Write-Host $result
}
