const item = $input.first() || { json: {} };
const payload = item.json || {};
const headers = payload.headers || {};

const expected = String($env.ABET_API_KEY || '').trim();
const incoming = String(headers['x-api-key'] ?? headers['X-Api-Key'] ?? '').trim();
if (!expected || incoming !== expected) {
  return [{ json: { status: 'error', message: 'Unauthorized: invalid x-api-key' } }];
}

const body = payload.body || {};
const rawCode = String(body.code || '').trim().toUpperCase();
const name = String(body.name || '').trim();
const description = String(body.description || '').trim();

if (!rawCode) {
  return [{ json: { status: 'error', message: 'code is required' } }];
}
if (!/^[A-Z0-9]{1,20}$/.test(rawCode)) {
  return [{ json: { status: 'error', message: 'code must be 1–20 uppercase letters/digits only' } }];
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
  const result = await client.query(
    `INSERT INTO faculties (code, name, description, active)
     VALUES ($1, $2, $3, TRUE)
     RETURNING id, code, name, description, active, created_at, updated_at`,
    [rawCode, name, description]
  );
  const row = result.rows[0];
  return [{
    json: {
      status: 'success',
      faculty: {
        id: Number(row.id),
        code: String(row.code),
        name: String(row.name),
        description: String(row.description),
        active: Boolean(row.active),
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    },
  }];
} catch (err) {
  if (err.code === '23505') {
    return [{ json: { status: 'error', message: `Faculty code '${rawCode}' already exists` } }];
  }
  if (err.code === '23514') {
    return [{ json: { status: 'error', message: 'Invalid code format: uppercase letters and digits only, max 20 chars' } }];
  }
  throw err;
} finally {
  await client.end();
}
