# Workflow 05 - Weekly Compliance Check

## Trigger
- `Schedule Trigger`
- Every Sunday, 23:00 (Africa/Cairo)

## Node graph
1. `Schedule Trigger`
2. `Program List` (Code)
3. `Split In Batches` (size: 1)
4. `Fetch Program Attainment` (HTTP Request)
5. `Merge Results` (Merge, Append)
6. `Compile Weekly Summary` (Code) -> `n8n/code/08_weekly_compliance_summary.js`
7. `Has Violations?` (IF)
8. `Telegram Violations` (Telegram)
9. `Telegram All Clear` (Telegram)

## Program List code
```javascript
return [
  { json: { program: 'CSE', label: 'Computer Science' } },
  { json: { program: 'AIS', label: 'AI Science' } },
  { json: { program: 'CE', label: 'Computer Engineering' } },
  { json: { program: 'AIE', label: 'AI Engineering' } },
  { json: { program: 'ADDA', label: 'Architecture and Design' } },
  { json: { program: 'CONS', label: 'Construction' } }
];
```

## HTTP fetch settings
- Method: `GET`
- URL: `http://abet-n8n:5678/webhook/so-attainment`
- Query params:
  - `term` = `2242`
  - `program` = `={{ $json.program }}`
- Header:
  - `x-api-key` = `={{ $env.ABET_API_KEY }}`

## IF condition
- Expression: `={{ $json.needs_action }}` is `true`

## Telegram alert text
```text
🚨 ABET Weekly Compliance Report
Date: {{ $json.date }}

{{ $json.violations.map(v => `⚠ ${v.program} - ${v.so_label}: ${v.rate}% (gap ${v.gap}%)`).join('\n') }}
```

## Telegram all-clear text
```text
✅ ABET Weekly Compliance Report
Date: {{ $json.date }}
All programs are currently above the threshold.
```
