const rows = $input.all().map((item) => item.json);
const meta = $('Validate Query Params').first().json;

const term = meta.term;
const program = meta.program;
const thresholdPercent = Number(meta.threshold || 70);
const thresholdRate = thresholdPercent / 100;

const PASS_GRADES = new Set(['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C']);

const soGroups = new Map();
for (const row of rows) {
  const soNumber = Number.parseInt(String(row.so_number), 10);
  const studentId = String(row.student_id || '').trim();
  const grade = String(row.grade || '').trim().toUpperCase();

  if (!Number.isFinite(soNumber) || !studentId) {
    continue;
  }

  if (!soGroups.has(soNumber)) {
    soGroups.set(soNumber, {
      assessed: new Set(),
      attained: new Set(),
    });
  }

  const group = soGroups.get(soNumber);
  group.assessed.add(studentId);

  if (PASS_GRADES.has(grade)) {
    group.attained.add(studentId);
  }
}

const results = [...soGroups.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([soNumber, group]) => {
    const studentsAssessed = group.assessed.size;
    const studentsAttained = group.attained.size;
    const rate = studentsAssessed > 0 ? studentsAttained / studentsAssessed : 0;
    const attainmentRate = Math.round(rate * 1000) / 10;
    const meetsThreshold = rate >= thresholdRate;

    return {
      so_label: `SO${soNumber}`,
      so_number: soNumber,
      students_assessed: studentsAssessed,
      students_attained: studentsAttained,
      attainment_rate: attainmentRate,
      meets_threshold: meetsThreshold,
      status: meetsThreshold ? 'ACHIEVED' : 'NOT_MET',
    };
  });

const overallAvg = results.length
  ? Math.round((results.reduce((sum, so) => sum + so.attainment_rate, 0) / results.length) * 10) / 10
  : 0;

return [
  {
    json: {
      term,
      program,
      threshold: thresholdPercent,
      overall_avg: overallAvg,
      sos_achieved: results.filter((r) => r.meets_threshold).length,
      sos_total: results.length,
      compliant: results.length ? results.every((r) => r.meets_threshold) : false,
      results,
      computed_at: new Date().toISOString(),
    },
  },
];
