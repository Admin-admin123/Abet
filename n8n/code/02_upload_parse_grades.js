const XLSX = require('xlsx');

function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toFloatOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIntOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function guessProgram(courseCode, explicitProgram) {
  if (explicitProgram) return explicitProgram.toUpperCase();
  const code = asText(courseCode).toUpperCase();
  if (code.startsWith('CSE')) return 'CSE';
  if (code.startsWith('AIS')) return 'AIS';
  if (code.startsWith('AIE')) return 'AIE';
  if (code.startsWith('CE')) return 'CE';
  if (code.startsWith('ADD') || code.startsWith('ARC')) return 'ADDA';
  if (code.startsWith('CON')) return 'CONS';
  return 'CSE';
}

function extractCourseCode(sectionValue) {
  const section = asText(sectionValue);
  const match = section.match(/\(([^)]+)\)/);
  if (!match) return '';
  return match[1].trim().toUpperCase();
}

const item = $input.first();
const payload = item?.json || {};
const body = payload.body || payload;
const binary = item?.binary || {};

const binaryKey = Object.keys(binary)[0];
if (!binaryKey) {
  throw new Error('No file found. Send multipart/form-data with key "file".');
}

const file = binary[binaryKey];
const fileName = asText(file.fileName || 'upload');
const mimeType = asText(file.mimeType).toLowerCase();
const lowerFileName = fileName.toLowerCase();

const term = asText(body.term || '2242');
const fileType = asText(body.file_type || 'grades').toLowerCase();
const explicitProgram = asText(body.program || '').toUpperCase();

const sourceBuffer = Buffer.from(file.data, 'base64');

let workbook;
if (lowerFileName.endsWith('.csv') || mimeType.includes('csv')) {
  workbook = XLSX.read(sourceBuffer.toString('utf8'), { type: 'string' });
} else if (
  lowerFileName.endsWith('.xlsx') ||
  lowerFileName.endsWith('.xls') ||
  mimeType.includes('spreadsheet') ||
  mimeType.includes('excel')
) {
  workbook = XLSX.read(sourceBuffer, { type: 'buffer' });
} else {
  throw new Error(`Unsupported file type for ${fileName}. Use CSV or XLSX.`);
}

const firstSheet = workbook.SheetNames[0];
if (!firstSheet) {
  throw new Error('Uploaded workbook has no sheets.');
}

const worksheet = workbook.Sheets[firstSheet];
const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: false });

const normalized = [];
for (const row of rawRows) {
  const studentName = asText(row.Student || row['Student Name'] || row.Name);
  const rowStudentKey = studentName.toLowerCase();

  if (!studentName || rowStudentKey.includes('points possible')) {
    continue;
  }

  const studentId = asText(
    row['SIS User ID'] ||
      row['Student ID'] ||
      row.student_id ||
      row.ID ||
      row.id
  );

  if (!studentId) {
    continue;
  }

  const courseCode = asText(row['Course Code'] || extractCourseCode(row.Section || row.section)).toUpperCase();
  const finalGrade = asText(row['Final Grade'] || row.Grade || row['Current Grade']).toUpperCase() || null;
  const program = guessProgram(courseCode, explicitProgram || asText(row['Academic Program']));

  normalized.push({
    term,
    program,
    student_id: studentId,
    student_name: studentName,
    course_code: courseCode,
    grade: finalGrade,
    term_gpa: toFloatOrNull(row['Term GPA']),
    cumulative_gpa: toFloatOrNull(row['Cumulative GPA']),
    repeat_flag: asText(row.Repeat || row['Repeat Flag']) || null,
    units: toIntOrNull(row['Unit Taken'] || row.Units || row.Unit),
    source_file: fileName,
    file_type: fileType,
  });
}

if (!normalized.length) {
  throw new Error('No grade rows were parsed from the uploaded file.');
}

return normalized.map((record) => ({ json: record }));
