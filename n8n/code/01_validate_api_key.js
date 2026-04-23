const expected = ($env.ABET_API_KEY || '').trim();
const items = $input.all();
const first = items[0] || { json: {} };
const headers = first.json.headers || {};
const incoming = String(
  headers['x-api-key'] ??
  headers['X-Api-Key'] ??
  headers['x-api-Key'] ??
  ''
).trim();

if (!expected) {
  throw new Error('ABET_API_KEY is not configured in n8n environment variables.');
}

if (!incoming || incoming !== expected) {
  throw new Error('Unauthorized: missing or invalid x-api-key header.');
}

return items;
