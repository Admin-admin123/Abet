const rows = $input.all().map((item) => item.json);
const sourceQuery = $('Webhook').first().json.query || {};
const term = String(sourceQuery.term || '2242').trim();

const scored = rows
  .map((row) => {
    let score = 0;
    const flags = [];

    if (row.low_gpa) {
      score += 30;
      flags.push('Low GPA');
    }
    if (row.has_fail) {
      score += 25;
      flags.push('Failing course');
    }
    if (row.has_warning) {
      score += 10;
      flags.push('Warning grade');
    }
    if (row.has_withdrawn) {
      score += 15;
      flags.push('Withdrawn');
    }
    if (row.has_repeat) {
      score += 20;
      flags.push('Repeat course');
    }

    score = Math.min(score, 100);

    let riskLevel = 'MODERATE';
    if (score >= 50) {
      riskLevel = 'CRITICAL';
    } else if (score >= 25) {
      riskLevel = 'HIGH';
    }

    return {
      student_id: row.student_id,
      student_name: row.student_name,
      program: row.program,
      cumulative_gpa: row.cumulative_gpa,
      risk_score: score,
      risk_level: riskLevel,
      flags,
      courses_at_risk: row.courses || [],
      grades: row.grades || [],
    };
  })
  .sort((a, b) => b.risk_score - a.risk_score);

return [
  {
    json: {
      term,
      total_at_risk: scored.length,
      critical: scored.filter((s) => s.risk_level === 'CRITICAL').length,
      high: scored.filter((s) => s.risk_level === 'HIGH').length,
      students: scored,
    },
  },
];
