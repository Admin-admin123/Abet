const item = $input.first() || { json: {} };
const payload = item.json || {};
const headers = payload.headers || {};

const expected = String($env.ABET_API_KEY || '').trim();
const incoming = String(headers['x-api-key'] ?? headers['X-Api-Key'] ?? '').trim();
if (!expected || incoming !== expected) {
  return [{ json: { status: 'error', message: 'Unauthorized: invalid x-api-key' } }];
}

const query = payload.query || {};
const includeInactive = String(query.include_inactive || '').toLowerCase() === 'true';

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
  const sql = includeInactive
    ? 'SELECT id, code, name, description, active, created_at, updated_at FROM faculties ORDER BY code'
    : 'SELECT id, code, name, description, active, created_at, updated_at FROM faculties WHERE active = TRUE ORDER BY code';

  const { rows } = await client.query(sql);

  return [{
    json: {
      status: 'success',
      faculties: rows.map((r) => ({
        id: Number(r.id),
        code: String(r.code),
        name: String(r.name),
        description: String(r.description),
        active: Boolean(r.active),
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
      count: rows.length,
    },
  }];
} finally {
  await client.end();
}
