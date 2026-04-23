const item = $input.first();
const query = item?.json?.query || {};

const term = String(query.term || '2242').trim();
const threshold = Number.parseFloat(String(query.threshold || '2.0'));

if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 4.0) {
  throw new Error('threshold must be a GPA value between 0.1 and 4.0.');
}

return [
  {
    json: {
      term,
      threshold,
    },
  },
];
