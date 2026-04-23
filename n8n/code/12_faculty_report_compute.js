// Faculty-organized S attainment report.
// Builds on the dual-path logic in 04_so_compute_attainment.js:
//   - Primary path: assessment_scores joined with course_faculty_config on
//     course_code, faculty=program, assessment_type=chosen_metric
//   - Fallback path (no assessment rows): grade-based attainment via student_grades
//     joined with course_faculty_config, using PASS_GRADES set.
// Results are grouped by faculty, each course showing chosen_s, chosen_metric,
// average_score, and attainment_rate (% of students scoring >= threshold).

const item = $input.first() || { json: {} };
const payload = item.json || {};
const headers = payload.headers || {};

const expected = String($env.ABET_API_KEY || '').trim();
const incoming = String(headers['x-api-key'] ?? headers['X-Api-Key'] ?? '').trim();
if (!expected || incoming !== expected) {
  return [{ json: { status: 'error', message: 'Unauthorized: invalid x-api-key' } }];
}

const query = payload.query || {};
const term = String(query.term || '').trim();
const thresholdPercent = Number(query.threshold || 70);

if (!term) {
  return [{ json: { status: 'error', message: 'term query parameter is required' } }];
}
if (thresholdPercent < 1 || thresholdPercent > 100) {
  return [{ json: { status: 'error', message: 'threshold must be between 1 and 100' } }];
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
  // Primary path: assessment-level scores per student per course.
  // Mirrors the CTE from 04_so_compute_attainment.js but groups by course, not SO.
  const assessmentResult = await client.query(
    `WITH student_avg AS (
       SELECT
         s.program          AS faculty,
         s.course_code,
         c.chosen_s,
         c.chosen_metric,
         s.student_id,
         AVG(s.score_percent) AS student_score
       FROM assessment_scores s
       INNER JOIN course_faculty_config c
         ON  c.course_code = s.course_code
         AND c.faculty     = s.program
         AND s.assessment_type = c.chosen_metric
       WHERE s.term = $1
       GROUP BY s.program, s.course_code, c.chosen_s, c.chosen_metric, s.student_id
     )
     SELECT
       faculty,
       course_code,
       chosen_s,
       chosen_metric,
       COUNT(*)::int                                                          AS students_assessed,
       COUNT(CASE WHEN student_score >= $2 THEN 1 END)::int                  AS students_attained,
       ROUND(AVG(student_score)::numeric, 1)::float                          AS average_score,
       ROUND(
         COUNT(CASE WHEN student_score >= $2 THEN 1 END)::numeric
         / NULLIF(COUNT(*), 0)::numeric * 100,
       1)::float                                                              AS attainment_rate
     FROM student_avg
     GROUP BY faculty, course_code, chosen_s, chosen_metric
     ORDER BY faculty, course_code`,
    [term, thresholdPercent]
  );

  let courseRows = assessmentResult.rows;

  // Fallback path: if no assessment-level data exists, use final grades.
  // Replicates the PASS_GRADES logic from 04_so_compute_attainment.js.
  if (!courseRows.length) {
    const PASS_GRADES_SQL = "('A+','A','A-','B+','B','B-','C+','C')";
    const fallbackResult = await client.query(
      `SELECT
         g.program                                                              AS faculty,
         g.course_code,
         c.chosen_s,
         c.chosen_metric,
         COUNT(*)::int                                                          AS students_assessed,
         COUNT(CASE WHEN UPPER(g.grade) = ANY(ARRAY['A+','A','A-','B+','B','B-','C+','C']) THEN 1 END)::int
                                                                                AS students_attained,
         NULL::float                                                            AS average_score,
         ROUND(
           COUNT(CASE WHEN UPPER(g.grade) = ANY(ARRAY['A+','A','A-','B+','B','B-','C+','C']) THEN 1 END)::numeric
           / NULLIF(COUNT(*), 0)::numeric * 100,
         1)::float                                                              AS attainment_rate
       FROM student_grades g
       INNER JOIN course_faculty_config c
         ON  c.course_code = g.course_code
         AND c.faculty     = g.program
       WHERE g.term = $1
       GROUP BY g.program, g.course_code, c.chosen_s, c.chosen_metric
       ORDER BY g.program, g.course_code`,
      [term]
    );
    courseRows = fallbackResult.rows;
  }

  // Group by faculty — same Map pattern as soGroups in 04_so_compute_attainment.js
  const facultyMap = new Map();
  for (const row of courseRows) {
    const faculty = String(row.faculty);
    if (!facultyMap.has(faculty)) {
      facultyMap.set(faculty, { faculty, courses: [] });
    }
    const attainmentRate = Number(row.attainment_rate || 0);
    const averageScore = row.average_score !== null ? Number(row.average_score) : null;
    const meetsThreshold = attainmentRate >= thresholdPercent;

    facultyMap.get(faculty).courses.push({
      course_code: String(row.course_code),
      chosen_s: Number(row.chosen_s),
      s_label: `S${row.chosen_s}`,
      chosen_metric: String(row.chosen_metric),
      students_assessed: Number(row.students_assessed),
      students_attained: Number(row.students_attained),
      average_score: averageScore,
      attainment_rate: attainmentRate,
      meets_threshold: meetsThreshold,
      status: meetsThreshold ? 'ACHIEVED' : 'NOT_MET',
    });
  }

  const faculties = [...facultyMap.values()].sort((a, b) => a.faculty.localeCompare(b.faculty));

  // Per-faculty summary stats (mirrors overall_avg from 04_so_compute_attainment.js)
  for (const f of faculties) {
    const rates = f.courses.map((c) => c.attainment_rate);
    f.overall_avg = rates.length
      ? Math.round((rates.reduce((s, r) => s + r, 0) / rates.length) * 10) / 10
      : 0;
    f.courses_achieved = f.courses.filter((c) => c.meets_threshold).length;
    f.courses_total = f.courses.length;
    f.compliant = f.courses.length > 0 && f.courses.every((c) => c.meets_threshold);
  }

  return [{
    json: {
      status: 'success',
      term,
      threshold: thresholdPercent,
      faculties,
      computed_at: new Date().toISOString(),
    },
  }];
} finally {
  await client.end();
}
