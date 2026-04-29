const item = $input.first() || { json: {} };
const payload = item.json || {};
const headers = payload.headers || {};

const expected = String($env.ABET_API_KEY || '').trim();
const incoming = String(headers['x-api-key'] ?? headers['X-Api-Key'] ?? '').trim();
if (!expected || incoming !== expected) {
  return [{ json: { status: 'error', message: 'Unauthorized: invalid x-api-key' } }];
}

const query = payload.query || {};
const targetCode = String(query.code || '').trim().toUpperCase();
const hardDelete = String(query.hard || '').toLowerCase() === 'true';

if (!targetCode) {
  return [{ json: { status: 'error', message: 'code query parameter is required' } }];
}

const { Client } = require('pg');
const client = new Client({
  host: $env.DB_POSTGRESDB_HOST || 'postgres',
  port: Number($env.DB_POSTGRESDB_PORT || 5432),
  database: $env.DB_POSTGRESDB_DATABASE,
  user: $env.DB_POSTGRESDB_USER,
  password: $env.DB_POSTGRESDB_PASSWORD,
});

await client.connect();
try {
  const usageRes = await client.query(
    `SELECT
      (SELECT COUNT(*) FROM student_grades        WHERE program = $1)::int AS grade_rows,
      (SELECT COUNT(*) FROM course_faculty_config WHERE faculty = $1)::int AS config_rows`,
    [targetCode]
  );
  const { grade_rows, config_rows } = usageRes.rows[0];
  const gradeRows = Number(grade_rows);
  const configRows = Number(config_rows);

  if (hardDelete) {
    if (gradeRows > 0 || configRows > 0) {
      return [{
        json: {
          status: 'error',
          message: `Cannot hard-delete: '${targetCode}' has ${gradeRows} grade row(s) and ${configRows} course config row(s). Use soft-delete or remove associated data first.`,
          grade_rows: gradeRows,
          config_rows: configRows,
        },
      }];
    }
    const result = await client.query('DELETE FROM faculties WHERE code = $1 RETURNING code', [targetCode]);
    if (!result.rows.length) {
      return [{ json: { status: 'error', message: `Faculty '${targetCode}' not found` } }];
    }
    return [{ json: { status: 'success', deleted: targetCode, mode: 'hard', grade_rows: 0, config_rows: 0 } }];
  }

  // Soft delete
  const result = await client.query(
    'UPDATE faculties SET active = FALSE, updated_at = NOW() WHERE code = $1 RETURNING code',
    [targetCode]
  );
  if (!result.rows.length) {
    return [{ json: { status: 'error', message: `Faculty '${targetCode}' not found` } }];
  }

  const response = { status: 'success', deleted: targetCode, mode: 'soft', grade_rows: gradeRows, config_rows: configRows };
  if (gradeRows > 0 || configRows > 0) {
    response.warning = `Faculty deactivated. ${gradeRows} grade row(s) and ${configRows} course config row(s) are preserved.`;
  }
  return [{ json: response }];
} finally {
  await client.end();
}
