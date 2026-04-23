const attainment = $input.first().json;
const payload = $('Webhook').first().json.body || {};

const term = String(payload.term || attainment.term || '2242').trim();
const program = String(payload.program || attainment.program || 'CSE').trim().toUpperCase();
const type = String(payload.type || 'annual').trim().toLowerCase();

const soLines = (attainment.results || [])
  .map(
    (so) =>
      `${so.so_label}: ${so.attainment_rate}% - ${so.status} (${so.students_attained}/${so.students_assessed} students)`
  )
  .join('\n');

const prompt = `You are an ABET accreditation analyst writing a formal self-study report section.

PROGRAM: ${program}
TERM: ${term}
REPORT TYPE: ${type}

STUDENT OUTCOME ATTAINMENT DATA:
${soLines}

SUMMARY: ${attainment.sos_achieved}/${attainment.sos_total} SOs achieved. Average attainment: ${attainment.overall_avg}%.
ABET THRESHOLD: 70% attainment required per SO.

Write a formal ABET self-study narrative that:
1. Summarizes overall attainment for this term in 2-3 sentences.
2. For each SO below 70%, provides root-cause analysis plus one specific Continuous Improvement Action.
3. Highlights high-performing SOs as best practices.
4. Ends with exactly 3 bullet-point recommendations for the next assessment cycle.

Use formal academic language and reference percentages directly with clear headings.`;

return [
  {
    json: {
      model: $env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      max_tokens: 2000,
      prompt,
      term,
      program,
      type,
    },
  },
];
