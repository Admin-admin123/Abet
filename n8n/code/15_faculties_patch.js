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
if (!targetCode) {
  return [{ json: { status: 'error', message: 'code query parameter is required' } }];
}

const body = payload.body || {};

// Build SET clause only for fields present in body
const updates = [];
const params = [];

if (body.name !== undefined) {
  params.push(String(body.name).trim());
  updates.push(`name = $${params.length}`);
}
if (body.description !== undefined) {
  params.push(String(body.description).trim());
  updates.push(`description = $${params.length}`);
}
if (body.active !== undefined) {
  params.push(body.active === true || body.active === 'true');
  updates.push(`active = $${params.length}`);
}

if (!updates.length) {
  return [{ json: { status: 'error', message: 'Provide at least one field to update: name, description, or active' } }];
}

// Append updated_at as literal (not a param) then add targetCode as the WHERE param
const setClause = [...updates, 'updated_at = NOW()'].join(', ');
params.push(targetCode);
const whereParam = `$${params.length}`;

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
  // Check usage before deactivating so we can include a warning
  let warning = null;
  const isDeactivating = body.active === false || body.active === 'false';
  if (isDeactivating) {
    const usageRes = await client.query(
      `SELECT
        (SELECT COUNT(*) FROM student_grades       WHERE program = $1)::int AS grade_rows,
        (SELECT COUNT(*) FROM course_faculty_config WHERE faculty = $1)::int AS config_rows`,
      [targetCode]
    );
    const { grade_rows, config_rows } = usageRes.rows[0];
    if (Number(grade_rows) > 0 || Number(config_rows) > 0) {
      warning = `Faculty deactivated. ${grade_rows} grade row(s) and ${config_rows} course config row(s) are preserved.`;
    }
  }

  const result = await client.query(
    `UPDATE faculties SET ${setClause} WHERE code = ${whereParam}
     RETURNING id, code, name, description, active, updated_at`,
    params
  );

  if (!result.rows.length) {
    return [{ json: { status: 'error', message: `Faculty '${targetCode}' not found` } }];
  }

  const row = result.rows[0];
  const response = {
    status: 'success',
    faculty: {
      id: Number(row.id),
      code: String(row.code),
      name: String(row.name),
      description: String(row.description),
      active: Boolean(row.active),
      updated_at: row.updated_at,
    },
  };
  if (warning) response.warning = warning;
  return [{ json: response }];
} finally {
  await client.end();
}
