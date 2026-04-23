# Workflow 01 - Upload Grades API

## Endpoint
- Method: `POST`
- Path: `upload`

## Node graph
1. `Webhook` (POST `/upload`, Response Mode: Using Respond to Webhook Node)
2. `Validate API Key` (Code) -> paste from `n8n/code/01_validate_api_key.js`
3. `Parse Upload` (Code) -> paste from `n8n/code/02_upload_parse_grades.js`
4. `Upsert Grades` (Postgres, Execute Query, runs once per item)
5. `Audit Upload` (Postgres, Execute Query)
6. `Respond` (Respond to Webhook)

## SQL - Upsert Grades
```sql
INSERT INTO student_grades (
  term,
  program,
  student_id,
  student_name,
  course_code,
  grade,
  term_gpa,
  cumulative_gpa,
  repeat_flag,
  units,
  source_file
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
ON CONFLICT (term, student_id, course_code)
DO UPDATE SET
  program = EXCLUDED.program,
  student_name = EXCLUDED.student_name,
  grade = EXCLUDED.grade,
  term_gpa = EXCLUDED.term_gpa,
  cumulative_gpa = EXCLUDED.cumulative_gpa,
  repeat_flag = EXCLUDED.repeat_flag,
  units = EXCLUDED.units,
  source_file = EXCLUDED.source_file,
  updated_at = NOW()
RETURNING id;
```

### Upsert query parameters
```text
={{ [
  $json.term,
  $json.program,
  $json.student_id,
  $json.student_name,
  $json.course_code,
  $json.grade,
  $json.term_gpa,
  $json.cumulative_gpa,
  $json.repeat_flag,
  $json.units,
  $json.source_file
] }}
```

## SQL - Audit Upload
```sql
INSERT INTO upload_audit (file_name, file_type, term, program, rows_imported, status, notes)
VALUES ($1, $2, $3, $4, $5, 'SUCCESS', 'Ingested via n8n upload workflow');
```

### Audit parameters
```text
={{ [
  $('Parse Upload').first().json.source_file,
  $('Parse Upload').first().json.file_type,
  $('Parse Upload').first().json.term,
  $('Parse Upload').first().json.program,
  $('Parse Upload').all().length
] }}
```

## Respond body
Set `Respond With: JSON` and body expression:
```text
={{ {
  status: 'success',
  rows_imported: $('Parse Upload').all().length,
  term: $('Parse Upload').first().json.term,
  file_type: $('Parse Upload').first().json.file_type,
  source_file: $('Parse Upload').first().json.source_file
} }}
```

## Test
```bash
curl -X POST http://localhost:5678/webhook/upload \
  -H "x-api-key: my-secret-key-2026" \
  -F "file=@Docs/2026-03-11T2125_Grades-CSE251.csv" \
  -F "file_type=grades" \
  -F "term=2242"
```
