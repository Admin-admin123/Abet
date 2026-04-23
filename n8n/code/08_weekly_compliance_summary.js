const allResults = $input.all().map((item) => item.json);

const violations = [];
for (const result of allResults) {
  for (const so of result.results || []) {
    if (!so.meets_threshold) {
      violations.push({
        program: result.program,
        so_label: so.so_label,
        rate: so.attainment_rate,
        gap: Number((70 - Number(so.attainment_rate || 0)).toFixed(1)),
      });
    }
  }
}

const compliantPrograms = allResults.filter((r) => r.compliant).map((r) => r.program);

return [
  {
    json: {
      date: new Date().toISOString(),
      total_violations: violations.length,
      violations,
      compliant_programs: compliantPrograms,
      needs_action: violations.length > 0,
    },
  },
];
