const item = $input.first() || { json: {} };
const payload = item.json || {};
const headers = payload.headers || {};

const expected = String($env.ABET_API_KEY || '').trim();
const incoming = String(headers['x-api-key'] ?? headers['X-Api-Key'] ?? '').trim();
if (!expected || incoming !== expected) {
  return [{ json: { status: 'error', message: 'Unauthorized: invalid x-api-key' } }];
}

const query = payload.query || {};
const faculty = String(query.faculty || '').trim().toUpperCase();

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
  let sql = 'SELECT course_code, faculty, chosen_s, chosen_metric FROM course_faculty_config';
  const params = [];

  if (faculty) {
    sql += ' WHERE faculty = $1';
    params.push(faculty);
  }
  sql += ' ORDER BY faculty, course_code';

  const { rows } = await client.query(sql, params);

  return [{
    json: {
      status: 'success',
      faculty: faculty || 'ALL',
      courses: rows.map((r) => ({
        course_code: String(r.course_code),
        faculty: String(r.faculty),
        chosen_s: Number(r.chosen_s),
        chosen_metric: String(r.chosen_metric),
      })),
      count: rows.length,
    },
  }];
} finally {
  await client.end();
}
