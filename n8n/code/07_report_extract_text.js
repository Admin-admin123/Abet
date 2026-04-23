const response = $input.first().json;

const text = (
  response?.choices?.[0]?.message?.content ||
  response?.choices?.[0]?.text ||
  (response.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
).trim();

const context = $('Build Prompt').first().json;

return [
  {
    json: {
      program: context.program,
      term: context.term,
      type: context.type,
      report: text,
      generated_at: new Date().toISOString(),
      usage: response.usage || null,
    },
  },
];
