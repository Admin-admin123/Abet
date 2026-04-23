# Workflow 03 - At-Risk Students API

## Endpoint
- Method: `GET`
- Path: `at-risk`

## Node graph
1. `Webhook` (GET `/at-risk`)
2. `Validate API Key` (Code) -> `n8n/code/01_validate_api_key.js`
3. `Validate At-Risk Query` (Code) -> `n8n/code/09_at_risk_validate_query.js`
4. `Fetch At-Risk Students` (Postgres, Execute Query)
5. `Score At-Risk Students` (Code) -> `n8n/code/05_at_risk_score.js`
6. `Respond` (Respond to Webhook)

## SQL - Fetch At-Risk Students
```sql
SELECT
  g.student_id,
  MAX(g.student_name) AS student_name,
  MAX(g.program) AS program,
  MAX(g.cumulative_gpa) AS cumulative_gpa,
  ARRAY_AGG(DISTINCT g.course_code) AS courses,
  ARRAY_AGG(DISTINCT g.grade) AS grades,
  BOOL_OR(g.grade = 'F') AS has_fail,
  BOOL_OR(g.grade = 'D') AS has_warning,
  BOOL_OR(g.grade = 'W') AS has_withdrawn,
  BOOL_OR(g.repeat_flag IS NOT NULL) AS has_repeat,
  MAX(g.cumulative_gpa) < $2::float AS low_gpa
FROM student_grades g
WHERE g.term = $1
  AND (
    g.grade IN ('F', 'D', 'W')
    OR g.cumulative_gpa < $2::float
    OR g.repeat_flag IS NOT NULL
  )
GROUP BY g.student_id
ORDER BY MAX(g.cumulative_gpa) ASC;
```

### Query parameters
```text
={{ [
  $('Validate At-Risk Query').first().json.term,
  $('Validate At-Risk Query').first().json.threshold
] }}
```

## Respond body
```text
={{ $('Score At-Risk Students').first().json }}
```

## Test
```bash
curl "http://localhost:5678/webhook/at-risk?term=2242&threshold=2.0" \
  -H "x-api-key: my-secret-key-2026"
```
