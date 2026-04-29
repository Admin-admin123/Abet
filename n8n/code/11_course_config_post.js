const item = $input.first() || { json: {} };
const payload = item.json || {};
const headers = payload.headers || {};

const expected = String($env.ABET_API_KEY || '').trim();
const incoming = String(headers['x-api-key'] ?? headers['X-Api-Key'] ?? '').trim();
if (!expected || incoming !== expected) {
  return [{ json: { status: 'error', message: 'Unauthorized: invalid x-api-key' } }];
}

const body = payload.body || {};
const courses = Array.isArray(body.courses) ? body.courses : [];

if (!courses.length) {
  return [{ json: { status: 'error', message: 'courses array is required and must not be empty' } }];
}

const VALID_METRICS = new Set(['QUIZ', 'ASSIGNMENT', 'EXAM', 'LAB', 'PROJECT', 'COURSE', 'OTHER']);

const { Client } = require('pg');
const client = new Client({
  host: $env.DB_POSTGRESDB_HOST || 'postgres',
  port: Number($env.DB_POSTGRESDB_PORT || 5432),
  database: $env.DB_POSTGRESDB_DATABASE,
  user: $env.DB_POSTGRESDB_USER,
  password: $env.DB_POSTGRESDB_PASSWORD,
});

await client.connect();

// Load active faculties from DB — stays in sync with the faculties table
const { rows: facRows } = await client.query('SELECT code FROM faculties WHERE active = TRUE');
const VALID_FACULTIES = new Set(facRows.map((r) => String(r.code)));

let updatedCount = 0;
try {
  await client.query('BEGIN');

  for (const course of courses) {
    const courseCode = String(course.course_code || '').trim().toUpperCase();
    const faculty = String(course.faculty || '').trim().toUpperCase();
    const chosenS = Number.parseInt(String(course.chosen_s), 10);

    // chosen_metrics: accept array or single string (backward compat)
    let rawMetrics = course.chosen_metrics ?? course.chosen_metric ?? ['QUIZ'];
    if (!Array.isArray(rawMetrics)) rawMetrics = [rawMetrics];
    const chosenMetrics = rawMetrics
      .map((m) => String(m || '').trim().toUpperCase())
      .filter((m) => VALID_METRICS.has(m));
    if (!chosenMetrics.length) chosenMetrics.push('QUIZ');

    // threshold: null means use the global threshold at report time
    const rawThreshold = course.threshold;
    const threshold =
      rawThreshold === null || rawThreshold === undefined || rawThreshold === ''
        ? null
        : (() => {
            const n = Number(rawThreshold);
            return Number.isFinite(n) && n >= 1 && n <= 100 ? Math.round(n * 10) / 10 : null;
          })();

    if (!courseCode || !faculty) continue;
    if (!VALID_FACULTIES.has(faculty)) continue;
    if (!Number.isFinite(chosenS) || chosenS < 1 || chosenS > 6) continue;

    await client.query(
      `INSERT INTO course_faculty_config
         (course_code, faculty, chosen_s, chosen_metric, chosen_metrics, threshold, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (course_code, faculty) DO UPDATE SET
         chosen_s      = EXCLUDED.chosen_s,
         chosen_metric = EXCLUDED.chosen_metric,
         chosen_metrics = EXCLUDED.chosen_metrics,
         threshold     = EXCLUDED.threshold,
         updated_at    = NOW()`,
      [courseCode, faculty, chosenS, chosenMetrics[0], chosenMetrics, threshold]
    );
    updatedCount++;
  }

  await client.query('COMMIT');
  return [{ json: { status: 'success', courses_updated: updatedCount } }];
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  await client.end();
}
