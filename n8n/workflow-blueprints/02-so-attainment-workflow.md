# Workflow 02 - SO Attainment API

## Endpoint
- Method: `GET`
- Path: `so-attainment`

## Node graph
1. `Webhook` (GET `/so-attainment`)
2. `Validate API Key` (Code) -> `n8n/code/01_validate_api_key.js`
3. `Validate Query Params` (Code) -> `n8n/code/03_so_validate_query.js`
4. `Fetch Grades + SO Mapping` (Postgres, Execute Query)
5. `Compute SO Attainment` (Code) -> `n8n/code/04_so_compute_attainment.js`
6. `Cache SO Attainment` (Postgres, Execute Query)
7. `Respond` (Respond to Webhook)

## SQL - Fetch Grades + SO Mapping
```sql
SELECT
  g.student_id,
  g.grade,
  m.so_number,
  m.program
FROM student_grades g
JOIN so_mapping m
  ON g.course_code = m.course_code
 AND m.program = $1
WHERE g.term = $2
  AND m.program = $1
ORDER BY m.so_number, g.student_id;
```

### Fetch parameters
```text
={{ [
  $('Validate Query Params').first().json.program,
  $('Validate Query Params').first().json.term
] }}
```

## SQL - Cache SO Attainment
```sql
INSERT INTO so_attainment (
  term,
  program,
  so_number,
  attainment_rate,
  students_assessed,
  students_attained,
  meets_threshold
)
SELECT
  $1,
  $2,
  r.so_number,
  r.attainment_rate,
  r.students_assessed,
  r.students_attained,
  r.meets_threshold
FROM json_to_recordset($3::json) AS r(
  so_number INT,
  attainment_rate FLOAT,
  students_assessed INT,
  students_attained INT,
  meets_threshold BOOLEAN
)
ON CONFLICT (term, program, so_number)
DO UPDATE SET
  attainment_rate = EXCLUDED.attainment_rate,
  students_assessed = EXCLUDED.students_assessed,
  students_attained = EXCLUDED.students_attained,
  meets_threshold = EXCLUDED.meets_threshold,
  computed_at = NOW();
```

### Cache parameters
```text
={{ [
  $('Compute SO Attainment').first().json.term,
  $('Compute SO Attainment').first().json.program,
  JSON.stringify($('Compute SO Attainment').first().json.results)
] }}
```

## Respond body
```text
={{ $('Compute SO Attainment').first().json }}
```

## Test
```bash
curl "http://localhost:5678/webhook/so-attainment?term=2242&program=CSE" \
  -H "x-api-key: my-secret-key-2026"
```
