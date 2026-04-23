const item = $input.first();
const query = item?.json?.query || {};

const term = String(query.term || '2242').trim();
const program = String(query.program || 'CSE').trim().toUpperCase();
const threshold = Number.parseFloat(String(query.threshold || '70'));

const validPrograms = ['CSE', 'AIS', 'CE', 'AIE', 'ADDA', 'CONS'];
if (!validPrograms.includes(program)) {
  throw new Error(`Invalid program. Allowed values: ${validPrograms.join(', ')}`);
}

if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 100) {
  throw new Error('threshold must be a number between 1 and 100.');
}

return [
  {
    json: {
      term,
      program,
      threshold,
    },
  },
];
