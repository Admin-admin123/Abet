# Workflow 04 - OpenRouter Report Generator API

## Endpoint

- Method: `POST`
- Path: `generate-report`

## Request body

```json
{ "term": "2242", "program": "CSE", "type": "annual" }
```

## Node graph

1. `Webhook` (POST `/generate-report`)
2. `Validate API Key` (Code) -> `n8n/code/01_validate_api_key.js`
3. `Fetch SO Attainment` (HTTP Request)
4. `Build Prompt` (Code) -> `n8n/code/06_report_build_prompt.js`
5. `Call OpenRouter` (HTTP Request)
6. `Extract Report` (Code) -> `n8n/code/07_report_extract_text.js`
7. `Respond` (Respond to Webhook)

## HTTP - Fetch SO Attainment

- Method: `GET`
- URL: `http://abet-n8n:5678/webhook/so-attainment`
- Query params:
  - `term` = `={{ $('Webhook').first().json.body.term }}`
  - `program` = `={{ $('Webhook').first().json.body.program }}`
- Headers:
  - `x-api-key` = `={{ $env.ABET_API_KEY }}`

## HTTP - Call OpenRouter

- Method: `POST`
- URL: `https://openrouter.ai/api/v1/chat/completions`
- Headers:
  - `Authorization` = `={{ 'Bearer ' + $env.OPENROUTER_API_KEY }}`
  - `content-type` = `application/json`
- Body (JSON):

```json
{
  "model": "={{ $json.model }}",
  "max_tokens": 2000,
  "messages": [
    {
      "role": "user",
      "content": "={{ $json.prompt }}"
    }
  ],
  "temperature": 0.3
}
```

## Respond body

```text
={{ $('Extract Report').first().json }}
```

## Test

```bash
curl -X POST http://localhost:5678/webhook/generate-report \
  -H "x-api-key: my-secret-key-2026" \
  -H "Content-Type: application/json" \
  -d '{"term":"2242","program":"CSE","type":"annual"}'
```
