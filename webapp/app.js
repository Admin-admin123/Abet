const STORAGE_KEY = "abet-workflow-console:v1";
const COURSE_CONFIG_STORAGE_KEY = "abet-course-config:v1";
const REQUEST_TIMEOUT_MS = 120000;
const PDF_FILE_PREFIX = "ABET-Faculty-Report";

const FACULTIES = ["AIE", "AIS", "CE", "CSE", "ADDA", "CONS"];
const S_RANGE = [1, 2, 3, 4, 5, 6];
const METRIC_TYPES = ["QUIZ", "ASSIGNMENT", "EXAM", "LAB", "PROJECT", "COURSE", "OTHER"];

// ── DOM element references ───────────────────────────────────────────────────

const elements = {
  baseUrl: document.getElementById("baseUrl"),
  apiKey: document.getElementById("apiKey"),
  term: document.getElementById("term"),
  program: document.getElementById("program"),
  threshold: document.getElementById("threshold"),
  attainmentThreshold: document.getElementById("attainmentThreshold"),
  reportType: document.getElementById("reportType"),
  gradesFile: document.getElementById("gradesFile"),

  runAllBtn: document.getElementById("runAllBtn"),
  uploadBtn: document.getElementById("uploadBtn"),
  facultyReportBtn: document.getElementById("facultyReportBtn"),
  riskBtn: document.getElementById("riskBtn"),
  reportBtn: document.getElementById("reportBtn"),
  exportPdfBtn: document.getElementById("exportPdfBtn"),
  clearLogsBtn: document.getElementById("clearLogsBtn"),
  rawModeToggle: document.getElementById("rawModeToggle"),

  loadCourseConfigBtn: document.getElementById("loadCourseConfigBtn"),
  extractCoursesBtn: document.getElementById("extractCoursesBtn"),
  addCourseRowBtn: document.getElementById("addCourseRowBtn"),
  saveCourseConfigBtn: document.getElementById("saveCourseConfigBtn"),
  courseConfigTableBody: document.getElementById("courseConfigTableBody"),
  courseConfigStatus: document.getElementById("courseConfigStatus"),

  statusUpload: document.getElementById("status-upload"),
  statusFacultyReport: document.getElementById("status-facultyReport"),
  statusRisk: document.getElementById("status-risk"),
  statusReport: document.getElementById("status-report"),

  outputUpload: document.getElementById("output-upload"),
  outputFacultyReport: document.getElementById("output-facultyReport"),
  outputRisk: document.getElementById("output-risk"),
  outputReport: document.getElementById("output-report"),

  metricRows: document.getElementById("metric-rows"),
  metricCourses: document.getElementById("metric-courses"),
  metricRisk: document.getElementById("metric-risk"),
  metricReport: document.getElementById("metric-report"),

  summaryMeta: document.getElementById("summaryMeta"),
  summaryUpload: document.getElementById("summary-upload"),
  summaryFacultyReport: document.getElementById("summary-facultyReport"),
  summaryRisk: document.getElementById("summary-risk"),
  summaryReportStatus: document.getElementById("summary-report-status"),
  summaryReport: document.getElementById("summary-report"),

  facultyResultsMeta: document.getElementById("facultyResultsMeta"),
  facultyResultsBody: document.getElementById("facultyResultsBody"),

  logConsole: document.getElementById("logConsole"),
};

const stepToCardSelector = {
  upload: '.step-card[data-step="upload"]',
  facultyReport: '.step-card[data-step="facultyReport"]',
  risk: '.step-card[data-step="risk"]',
  report: '.step-card[data-step="report"]',
};

const latestResults = {
  upload: null,
  facultyReport: null,
  risk: null,
  report: null,
  lastRunAt: null,
};

let busy = false;
let courseConfigRows = [];

// ── Utility helpers ──────────────────────────────────────────────────────────

function nowStamp() {
  return new Date().toLocaleTimeString();
}

function formatTimestamp(value) {
  if (!value) return "not run yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function pretty(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function clampText(value, maxLength = 1200) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function simpleMarkdownToHtml(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) { html.push("</ul>"); inUl = false; }
    if (inOl) { html.push("</ol>"); inOl = false; }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) { closeLists(); continue; }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeLists();
      const level = heading[1].length;
      html.push(`<h${level}>${formatInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (inOl) { html.push("</ol>"); inOl = false; }
      if (!inUl) { html.push("<ul>"); inUl = true; }
      html.push(`<li>${formatInlineMarkdown(bullet[1])}</li>`);
      continue;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      if (inUl) { html.push("</ul>"); inUl = false; }
      if (!inOl) { html.push("<ol>"); inOl = true; }
      html.push(`<li>${formatInlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    closeLists();
    html.push(`<p>${formatInlineMarkdown(trimmed)}</p>`);
  }

  closeLists();
  return html.join("\n");
}

function markdownToSafeHtml(markdown) {
  const source = String(markdown || "").trim();
  if (!source) return "<p>No narrative content available.</p>";

  let html;
  if (window.marked && typeof window.marked.parse === "function") {
    html = window.marked.parse(source, { gfm: true, breaks: true, mangle: false, headerIds: false });
  } else {
    html = simpleMarkdownToHtml(source);
  }

  if (window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
    return window.DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  }
  return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

function markdownToPlainText(markdown) {
  return String(markdown || "")
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ""))
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function setTextOutput(target, text) {
  target.classList.remove("markdown-output");
  target.textContent = text;
}

function setMarkdownOutput(target, markdown) {
  target.classList.add("markdown-output");
  target.innerHTML = `<div class="markdown-content">${markdownToSafeHtml(markdown)}</div>`;
}

function appendLog(message, level = "info") {
  const prefix = level.toUpperCase().padEnd(5, " ");
  elements.logConsole.textContent += `[${nowStamp()}] ${prefix} ${message}\n`;
  elements.logConsole.scrollTop = elements.logConsole.scrollHeight;
}

// ── Step state management ────────────────────────────────────────────────────

function setStepState(step, state, text) {
  const statusElMap = {
    upload: elements.statusUpload,
    facultyReport: elements.statusFacultyReport,
    risk: elements.statusRisk,
    report: elements.statusReport,
  };

  const card = document.querySelector(stepToCardSelector[step]);
  if (card) {
    card.classList.remove("state-idle", "state-running", "state-success", "state-error");
    card.classList.add(`state-${state}`);
  }

  const statusElement = statusElMap[step];
  if (statusElement) statusElement.textContent = text;
}

function resetStates() {
  setStepState("upload", "idle", "Idle");
  setStepState("facultyReport", "idle", "Idle");
  setStepState("risk", "idle", "Idle");
  setStepState("report", "idle", "Idle");
}

function setBusy(nextBusy) {
  busy = nextBusy;
  [
    elements.runAllBtn,
    elements.uploadBtn,
    elements.facultyReportBtn,
    elements.riskBtn,
    elements.reportBtn,
    elements.exportPdfBtn,
    elements.loadCourseConfigBtn,
    elements.extractCoursesBtn,
    elements.addCourseRowBtn,
    elements.saveCourseConfigBtn,
  ].forEach((btn) => {
    if (btn) btn.disabled = nextBusy;
  });
}

// ── Config read / save ───────────────────────────────────────────────────────

function readConfig() {
  return {
    baseUrl: elements.baseUrl.value.trim().replace(/\/$/, ""),
    apiKey: elements.apiKey.value.trim(),
    term: elements.term.value.trim(),
    program: elements.program.value.trim(),
    threshold: elements.threshold.value.trim(),
    attainmentThreshold: elements.attainmentThreshold.value.trim(),
    reportType: elements.reportType.value.trim(),
  };
}

function ensureCoreConfig(config) {
  if (!config.baseUrl) throw new Error("Base URL is required.");
  if (!config.apiKey) throw new Error("API Key is required.");
  if (!config.term) throw new Error("Term is required.");
}

function ensureApiAccess(config) {
  if (!config.baseUrl) throw new Error("API Base URL is required.");
  if (!config.apiKey) throw new Error("API Key is required.");
}

function saveConfig() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(readConfig()));
}

function restoreConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.baseUrl) elements.baseUrl.value = saved.baseUrl;
    if (saved.apiKey) elements.apiKey.value = saved.apiKey;
    if (saved.term) elements.term.value = saved.term;
    if (saved.program) elements.program.value = saved.program;
    if (saved.threshold) elements.threshold.value = saved.threshold;
    if (saved.attainmentThreshold) elements.attainmentThreshold.value = saved.attainmentThreshold;
    if (saved.reportType) elements.reportType.value = saved.reportType;
  } catch {
    appendLog("Could not restore saved config. Using defaults.", "warn");
  }
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    let body = {};
    try { body = await response.json(); } catch (_) {}
    return { status: response.status, ok: response.ok, _body: body };
  } catch (err) {
    if (err.name === "AbortError") throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function unwrapPayload(result) {
  if (!result.ok) {
    const msg = result._body?.message || result._body?.error || `HTTP ${result.status}`;
    throw new Error(msg);
  }
  return result._body;
}

function getRiskRows(payload) {
  return payload?.students || [];
}

// ── Course config data model ─────────────────────────────────────────────────

function normalizeCourseCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeFaculty(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeChosenS(value) {
  const n = Number.parseInt(String(value), 10);
  return Number.isInteger(n) && n >= 1 && n <= 6 ? n : 1;
}

function normalizeMetric(value) {
  const cleaned = String(value || "").trim().toUpperCase();
  return METRIC_TYPES.includes(cleaned) ? cleaned : "QUIZ";
}

function classifyMetricFromName(name) {
  const n = String(name || "").toLowerCase();
  if (n.includes("quiz")) return "QUIZ";
  if (n.includes("assignment") || n.includes("homework") || n.includes("hw")) return "ASSIGNMENT";
  if (n.includes("exam") || n.includes("midterm") || n.includes("final")) return "EXAM";
  if (n.includes("lab")) return "LAB";
  if (n.includes("project")) return "PROJECT";
  return "QUIZ";
}

function normalizeCourseConfigRows(rows) {
  const index = new Map();
  (rows || []).forEach((row) => {
    const faculty = normalizeFaculty(row.faculty);
    const courseCode = normalizeCourseCode(row.course_code || row.courseCode);
    if (!faculty || !courseCode) return;
    const key = `${faculty}::${courseCode}`;
    index.set(key, {
      faculty,
      course_code: courseCode,
      chosen_s: normalizeChosenS(row.chosen_s ?? row.chosenS ?? 1),
      chosen_metric: normalizeMetric(row.chosen_metric ?? row.chosenMetric ?? "QUIZ"),
    });
  });
  return [...index.values()].sort((a, b) => {
    const byFac = a.faculty.localeCompare(b.faculty);
    return byFac !== 0 ? byFac : a.course_code.localeCompare(b.course_code);
  });
}

function persistCourseConfigRows() {
  localStorage.setItem(
    COURSE_CONFIG_STORAGE_KEY,
    JSON.stringify({ rows: normalizeCourseConfigRows(courseConfigRows) })
  );
}

function restoreCourseConfigRows() {
  try {
    const raw = localStorage.getItem(COURSE_CONFIG_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    courseConfigRows = normalizeCourseConfigRows(parsed.rows || []);
  } catch {
    appendLog("Could not restore local course config cache.", "warn");
  }
}

function setCourseConfigStatus(message, level = "info") {
  if (!elements.courseConfigStatus) return;
  elements.courseConfigStatus.textContent = message;
  elements.courseConfigStatus.classList.remove("level-info", "level-success", "level-error");
  elements.courseConfigStatus.classList.add(`level-${level}`);
}

// ── Course config table rendering ────────────────────────────────────────────

function renderCourseConfigTable() {
  if (!elements.courseConfigTableBody) return;

  if (!courseConfigRows.length) {
    elements.courseConfigTableBody.innerHTML =
      '<tr><td colspan="5" style="text-align:center;color:#a8c2e2;">No courses configured yet. Add rows manually or extract from the grades file.</td></tr>';
    persistCourseConfigRows();
    return;
  }

  const rowsHtml = courseConfigRows
    .map((row, index) => {
      const facSel = FACULTIES.map(
        (f) => `<option value="${f}"${row.faculty === f ? " selected" : ""}>${f}</option>`
      ).join("");
      const sSel = S_RANGE.map(
        (s) => `<option value="${s}"${row.chosen_s === s ? " selected" : ""}>S${s}</option>`
      ).join("");
      const mSel = METRIC_TYPES.map(
        (m) => `<option value="${m}"${row.chosen_metric === m ? " selected" : ""}>${m}</option>`
      ).join("");

      return `<tr>
        <td><select data-field="faculty" data-index="${index}">${facSel}</select></td>
        <td><input type="text" data-field="course_code" data-index="${index}" value="${escapeHtml(row.course_code)}" /></td>
        <td><select data-field="chosen_s" data-index="${index}">${sSel}</select></td>
        <td><select data-field="chosen_metric" data-index="${index}">${mSel}</select></td>
        <td class="remove-cell"><button type="button" class="remove-row-btn" data-field="remove" data-index="${index}">Remove</button></td>
      </tr>`;
    })
    .join("");

  elements.courseConfigTableBody.innerHTML = rowsHtml;
  persistCourseConfigRows();
}

function handleCourseConfigTableChange(event) {
  const target = event.target;
  const field = target?.dataset?.field;
  const index = Number.parseInt(target?.dataset?.index || "", 10);
  if (!Number.isInteger(index) || index < 0 || index >= courseConfigRows.length) return;

  const row = courseConfigRows[index];
  if (!row) return;

  if (field === "faculty") {
    row.faculty = normalizeFaculty(target.value);
  } else if (field === "course_code") {
    row.course_code = normalizeCourseCode(target.value);
    target.value = row.course_code;
  } else if (field === "chosen_s") {
    row.chosen_s = normalizeChosenS(target.value);
  } else if (field === "chosen_metric") {
    row.chosen_metric = normalizeMetric(target.value);
  }

  persistCourseConfigRows();
}

function handleCourseConfigTableClick(event) {
  const target = event.target;
  if (target?.dataset?.field !== "remove") return;
  const index = Number.parseInt(target.dataset.index || "", 10);
  if (!Number.isInteger(index) || index < 0 || index >= courseConfigRows.length) return;
  courseConfigRows.splice(index, 1);
  renderCourseConfigTable();
  setCourseConfigStatus("Row removed.", "info");
}

// ── Extract courses from uploaded file ──────────────────────────────────────

function parseCourseFromSection(sectionValue) {
  const section = String(sectionValue || "").trim();
  if (!section) return { course_code: "" };
  const codeMatch = section.match(/\(([^)]+)\)/);
  return { course_code: normalizeCourseCode(codeMatch ? codeMatch[1] : "") };
}

function guessFacultyFromCourseCode(courseCode) {
  const upper = String(courseCode || "").toUpperCase();
  if (upper.startsWith("AIE")) return "AIE";
  if (upper.startsWith("AIS")) return "AIS";
  if (upper.startsWith("CSE") || upper.startsWith("CS")) return "CSE";
  if (upper.startsWith("CE")) return "CE";
  return "";
}

function pickFirstValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return "";
}

async function readWorkbookRowsFromFile(file) {
  if (!window.XLSX || typeof window.XLSX.read !== "function") {
    throw new Error("XLSX parser is unavailable. Refresh the page and try again.");
  }
  const fileName = String(file.name || "").toLowerCase();
  if (fileName.endsWith(".csv")) {
    const text = await file.text();
    const workbook = window.XLSX.read(text, { type: "string" });
    const firstSheet = workbook.SheetNames[0];
    return window.XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: "", raw: false });
  }
  const buffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.SheetNames[0];
  return window.XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: "", raw: false });
}

function extractCourseEntriesFromRows(rows, defaultFaculty = "") {
  const byKey = new Map();
  (rows || []).forEach((row) => {
    let courseCode = normalizeCourseCode(
      pickFirstValue(row, ["Course Code", "course_code", "CourseCode"])
    );
    if (!courseCode) {
      courseCode = parseCourseFromSection(pickFirstValue(row, ["Section", "section"])).course_code;
    }
    if (!courseCode) return;

    const faculty =
      normalizeFaculty(pickFirstValue(row, ["Program", "Faculty", "program", "faculty"])) ||
      defaultFaculty ||
      guessFacultyFromCourseCode(courseCode);

    const assessmentName = pickFirstValue(row, [
      "Assessment Name", "Assignment Name", "Assignment", "Assessment",
      "Item", "Evaluation Item", "Task",
    ]);
    const metricHint = classifyMetricFromName(assessmentName);

    const key = `${faculty || "CSE"}::${courseCode}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        faculty: faculty || "CSE",
        course_code: courseCode,
        chosen_s: 1,
        chosen_metric: metricHint,
      });
    }
  });

  return [...byKey.values()].sort((a, b) => {
    const byFac = a.faculty.localeCompare(b.faculty);
    return byFac !== 0 ? byFac : a.course_code.localeCompare(b.course_code);
  });
}

function mergeCourseConfigRows(incomingRows) {
  const current = normalizeCourseConfigRows(courseConfigRows);
  const index = new Map(current.map((r) => [`${r.faculty}::${r.course_code}`, r]));

  (incomingRows || []).forEach((incoming) => {
    const faculty = normalizeFaculty(incoming.faculty);
    const courseCode = normalizeCourseCode(incoming.course_code);
    if (!faculty || !courseCode) return;
    const key = `${faculty}::${courseCode}`;
    if (!index.has(key)) {
      index.set(key, {
        faculty,
        course_code: courseCode,
        chosen_s: normalizeChosenS(incoming.chosen_s ?? 1),
        chosen_metric: normalizeMetric(incoming.chosen_metric ?? "QUIZ"),
      });
    }
  });

  courseConfigRows = [...index.values()].sort((a, b) => {
    const byFac = a.faculty.localeCompare(b.faculty);
    return byFac !== 0 ? byFac : a.course_code.localeCompare(b.course_code);
  });
  renderCourseConfigTable();
}

async function extractCoursesFromSelectedFile() {
  const file = elements.gradesFile?.files?.[0];
  if (!file) throw new Error("Select a grades file first, then click Extract From File.");

  setCourseConfigStatus("Reading file and extracting courses...", "info");
  const rows = await readWorkbookRowsFromFile(file);
  const defaultFaculty = normalizeFaculty(elements.program?.value || "");
  const extracted = extractCourseEntriesFromRows(rows, defaultFaculty);

  if (!extracted.length) throw new Error("No course codes were detected in the selected file.");

  mergeCourseConfigRows(extracted);
  setCourseConfigStatus(`Extracted ${extracted.length} course(s) from ${file.name}.`, "success");
}

// ── Load / save course config via API ────────────────────────────────────────

async function loadCourseConfig() {
  const config = readConfig();
  ensureApiAccess(config);

  setCourseConfigStatus("Loading course configuration from server...", "info");

  const result = await requestJson(`${config.baseUrl}/course-config`, {
    method: "GET",
    headers: { "x-api-key": config.apiKey },
  });

  const payload = unwrapPayload(result);
  courseConfigRows = normalizeCourseConfigRows(payload.courses || []);
  renderCourseConfigTable();

  const count = courseConfigRows.length;
  setCourseConfigStatus(
    count ? `Loaded ${count} course configuration(s).` : "No course configuration found on server.",
    "success"
  );
  appendLog(`Course config loaded: ${count} row(s)`, "ok");
}

async function saveCourseConfig() {
  const config = readConfig();
  ensureApiAccess(config);

  const courses = normalizeCourseConfigRows(courseConfigRows).filter(
    (r) => r.faculty && r.course_code
  );
  if (!courses.length) throw new Error("Add at least one course row before saving.");

  setCourseConfigStatus(`Saving ${courses.length} course configuration(s)...`, "info");

  const result = await requestJson(`${config.baseUrl}/course-config`, {
    method: "POST",
    headers: { "x-api-key": config.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ courses }),
  });

  const payload = unwrapPayload(result);
  setCourseConfigStatus(
    `Saved. Courses updated: ${payload.courses_updated ?? courses.length}.`,
    "success"
  );
  appendLog(`Course config saved: ${payload.courses_updated ?? courses.length} row(s)`, "ok");
}

async function runCourseConfigAction(label, action) {
  if (busy) return;
  saveConfig();
  setBusy(true);
  try {
    await action();
  } catch (error) {
    const message = error?.message || `Failed to ${label}.`;
    setCourseConfigStatus(message, "error");
    appendLog(`Course config ${label} failed: ${message}`, "error");
  } finally {
    setBusy(false);
  }
}

// ── Summarize helpers ────────────────────────────────────────────────────────

function extractReportText(payload) {
  if (!payload) return "";
  for (const candidate of [payload.report, payload.narrative, payload.summary, payload.output, payload.message]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  if (typeof payload.raw === "string" && payload.raw.trim()) return payload.raw.trim();
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  return "";
}

function formatAttainmentBand(avg) {
  if (avg >= 85) return "Excellent";
  if (avg >= 70) return "Compliant";
  if (avg >= 60) return "Needs focused improvement";
  return "High concern";
}

function summarizeUpload(payload, config = readConfig()) {
  if (!payload) return "No upload has been processed yet.";
  const rows = Number(payload.rows_imported || 0);
  const assessmentRows = Number(payload.assessment_rows_imported || 0);
  const term = payload.term || config.term;
  const program = payload.program || config.program;
  const source = payload.source_file ? ` Source file: ${payload.source_file}.` : "";
  return `Imported ${rows} student grade rows and ${assessmentRows} assessment rows for ${program} in term ${term}.${source}`;
}

function summarizeFacultyReport(payload) {
  if (!payload) return "Faculty report has not been calculated yet.";
  const faculties = payload.faculties || [];
  if (!faculties.length) return "Faculty report returned no data.";

  const totalCourses = faculties.reduce((s, f) => s + (f.courses_total || 0), 0);
  const achievedCourses = faculties.reduce((s, f) => s + (f.courses_achieved || 0), 0);
  const compliant = faculties.filter((f) => f.compliant).map((f) => f.faculty);
  const nonCompliant = faculties.filter((f) => !f.compliant).map((f) => f.faculty);

  const parts = [
    `${achievedCourses}/${totalCourses} courses achieved across ${faculties.length} facult${faculties.length === 1 ? "y" : "ies"}.`,
  ];
  if (compliant.length) parts.push(`Compliant: ${compliant.join(", ")}.`);
  if (nonCompliant.length) parts.push(`Needs attention: ${nonCompliant.join(", ")}.`);
  return parts.join(" ");
}

function summarizeRisk(payload, config = readConfig()) {
  if (!payload) return "At-risk analytics has not been run yet.";
  const total = Number(payload.total_at_risk ?? 0);
  const critical = Number(payload.critical ?? 0);
  const high = Number(payload.high ?? 0);
  const term = payload.term || config.term;
  const top = getRiskRows(payload)
    .slice(0, 3)
    .map((s) => `${s.student_name || s.student_id || "Unknown"} (${String(s.risk_level || "MODERATE").toLowerCase()})`)
    .join(", ");
  return `Term ${term}: ${total} students flagged at risk (${critical} critical, ${high} high).${top ? ` Highest-priority: ${top}.` : ""}`;
}

function summarizeReportStatus(payload) {
  if (!payload) return "No report has been generated yet.";
  const status = String(payload.status || (extractReportText(payload) ? "success" : "unknown"));
  const usage = payload.usage
    ? ` Model usage tokens: prompt ${payload.usage.prompt_tokens || 0}, completion ${payload.usage.completion_tokens || 0}.`
    : "";
  return `Report generation status: ${status}.${usage}`;
}

function summarizeReportNarrative(payload) {
  if (!payload) return "The generated narrative will appear here after report generation.";
  const reportText = extractReportText(payload);
  if (!reportText) return "Report endpoint responded, but no narrative text was returned.";
  return clampText(reportText, 2200);
}

// ── Faculty report display ────────────────────────────────────────────────────

function renderFacultyResults(payload) {
  if (!elements.facultyResultsBody || !elements.facultyResultsMeta) return;

  if (!payload || !Array.isArray(payload.faculties) || !payload.faculties.length) {
    elements.facultyResultsMeta.textContent =
      "Run the Faculty Report to see per-faculty, per-course S attainment results.";
    elements.facultyResultsBody.innerHTML = "";
    return;
  }

  const term = payload.term || "";
  const threshold = payload.threshold || 70;
  const computedAt = payload.computed_at ? formatTimestamp(payload.computed_at) : "";

  elements.facultyResultsMeta.textContent =
    `Term: ${term}  |  Attainment threshold: ${threshold}%  |  Computed: ${computedAt}`;

  const sectionsHtml = payload.faculties
    .map((f) => {
      const complianceTag = f.compliant
        ? `<span class="badge badge-success">COMPLIANT</span>`
        : `<span class="badge badge-danger">NOT COMPLIANT</span>`;

      const coursesHtml = f.courses
        .map((c) => {
          const statusTag = c.meets_threshold
            ? `<span class="badge badge-success">ACHIEVED</span>`
            : `<span class="badge badge-danger">NOT MET</span>`;
          const avgDisplay =
            c.average_score !== null && c.average_score !== undefined
              ? `${Number(c.average_score).toFixed(1)}%`
              : "—";
          return `<tr>
          <td>${escapeHtml(c.course_code)}</td>
          <td>${escapeHtml(c.s_label || `S${c.chosen_s}`)}</td>
          <td>${escapeHtml(c.chosen_metric)}</td>
          <td>${avgDisplay}</td>
          <td>${Number(c.attainment_rate).toFixed(1)}%</td>
          <td>${c.students_attained} / ${c.students_assessed}</td>
          <td>${statusTag}</td>
        </tr>`;
        })
        .join("");

      return `
      <div class="faculty-block">
        <div class="faculty-header">
          <span class="faculty-name">${escapeHtml(f.faculty)}</span>
          <span class="faculty-stats">${f.courses_achieved}/${f.courses_total} courses achieved &nbsp;·&nbsp; avg ${Number(f.overall_avg).toFixed(1)}%</span>
          ${complianceTag}
        </div>
        <div class="mapping-table-wrap">
          <table class="mapping-table faculty-results-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Chosen S</th>
                <th>Metric</th>
                <th>Avg Score</th>
                <th>Attainment %</th>
                <th>Students</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${coursesHtml}</tbody>
          </table>
        </div>
      </div>`;
    })
    .join("");

  elements.facultyResultsBody.innerHTML = sectionsHtml;
}

// ── Output panel rendering ────────────────────────────────────────────────────

function buildReadableFacultyOutput(payload) {
  if (!payload) return "No response yet. Run Faculty Report to view results.";
  const faculties = payload.faculties || [];
  if (!faculties.length) return "Faculty report returned no course data.";

  const lines = [
    `Faculty Report — Term ${payload.term || "?"}, Threshold ${payload.threshold || 70}%`,
    "",
  ];
  for (const f of faculties) {
    const tag = f.compliant ? "COMPLIANT" : "NOT COMPLIANT";
    lines.push(
      `Faculty: ${f.faculty}  (${f.courses_achieved}/${f.courses_total} achieved, avg ${Number(f.overall_avg).toFixed(1)}%)  [${tag}]`
    );
    for (const c of f.courses) {
      const avgStr =
        c.average_score !== null && c.average_score !== undefined
          ? `Avg: ${Number(c.average_score).toFixed(1)}%`
          : "Avg: —";
      lines.push(
        `  ${c.course_code}  ${c.s_label}  ${c.chosen_metric}  ${avgStr}  Attainment: ${Number(c.attainment_rate).toFixed(1)}%  [${c.status}]`
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

function buildReadableOutput(step, payload) {
  if (!payload) return "No response yet. Run this endpoint to view results.";

  if (step === "upload") {
    return [
      "Readable summary:",
      summarizeUpload(payload),
      "",
      `Status: ${payload.status || "unknown"}`,
      `Message: ${payload.message || "N/A"}`,
    ].join("\n");
  }

  if (step === "facultyReport") return buildReadableFacultyOutput(payload);

  if (step === "risk") {
    const students = getRiskRows(payload)
      .slice(0, 8)
      .map((student, index) => {
        const name = student.student_name || student.student_id || "Unknown";
        const score = Number(student.risk_score || 0);
        const level = String(student.risk_level || "MODERATE");
        const gpa = Number(student.cumulative_gpa || 0).toFixed(2);
        return `${index + 1}. ${name} - ${level} (score ${score}, GPA ${gpa})`;
      });
    return [
      "Readable summary:",
      summarizeRisk(payload),
      "",
      "Highest priority students:",
      ...(students.length ? students : ["No at-risk students in this run."]),
    ].join("\n");
  }

  if (step === "report") {
    return [
      "Readable summary:",
      summarizeReportStatus(payload),
      "",
      "Narrative preview:",
      clampText(summarizeReportNarrative(payload), 900),
    ].join("\n");
  }

  return pretty(payload);
}

function renderEndpointOutput(step) {
  const outputMap = {
    upload: elements.outputUpload,
    facultyReport: elements.outputFacultyReport,
    risk: elements.outputRisk,
    report: elements.outputReport,
  };

  const target = outputMap[step];
  if (!target) return;

  const payload = latestResults[step];
  if (!payload) {
    setTextOutput(target, "No response yet. Run this endpoint to view results.");
    return;
  }

  if (elements.rawModeToggle && elements.rawModeToggle.checked) {
    setTextOutput(target, pretty(payload));
    return;
  }

  if (step === "report") {
    const reportMarkdown = `### Readable Summary\n${summarizeReportStatus(payload)}\n\n${summarizeReportNarrative(payload)}`;
    setMarkdownOutput(target, reportMarkdown);
    return;
  }

  setTextOutput(target, buildReadableOutput(step, payload));
}

function renderAllEndpointOutputs() {
  renderEndpointOutput("upload");
  renderEndpointOutput("facultyReport");
  renderEndpointOutput("risk");
  renderEndpointOutput("report");
}

function refreshExecutiveSummary() {
  elements.summaryMeta.textContent =
    latestResults.lastRunAt === null
      ? "Run the workflow to generate a reader-friendly accreditation brief."
      : `Last updated: ${formatTimestamp(latestResults.lastRunAt)}`;

  elements.summaryUpload.textContent = summarizeUpload(latestResults.upload);
  elements.summaryFacultyReport.textContent = summarizeFacultyReport(latestResults.facultyReport);
  elements.summaryRisk.textContent = summarizeRisk(latestResults.risk);
  elements.summaryReportStatus.textContent = summarizeReportStatus(latestResults.report);
  elements.summaryReport.innerHTML = markdownToSafeHtml(
    summarizeReportNarrative(latestResults.report)
  );
}

function clearOutputs() {
  latestResults.upload = null;
  latestResults.facultyReport = null;
  latestResults.risk = null;
  latestResults.report = null;
  latestResults.lastRunAt = null;
  renderAllEndpointOutputs();
  renderFacultyResults(null);
  refreshExecutiveSummary();
}

function setOutput(step, payload) {
  latestResults[step] = payload;
  latestResults.lastRunAt = new Date().toISOString();
  renderEndpointOutput(step);
  if (step === "facultyReport") renderFacultyResults(payload);
  refreshExecutiveSummary();
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function runUpload() {
  const config = readConfig();
  ensureCoreConfig(config);

  const file = elements.gradesFile.files[0];
  if (!file) throw new Error("Select a grades file before upload.");

  setStepState("upload", "running", "Running...");
  appendLog(`Uploading ${file.name} to /upload`);

  const form = new FormData();
  form.append("file", file);
  form.append("file_type", "grades");
  form.append("term", config.term);
  form.append("program", config.program);

  const result = await requestJson(`${config.baseUrl}/upload`, {
    method: "POST",
    headers: { "x-api-key": config.apiKey },
    body: form,
  });

  const payload = unwrapPayload(result);
  setOutput("upload", payload);
  setStepState("upload", "success", `HTTP ${result.status}`);
  elements.metricRows.textContent = String(payload.rows_imported ?? 0);
  appendLog(`Upload complete. Rows imported: ${payload.rows_imported ?? 0}`, "ok");
  return payload;
}

async function runFacultyReport() {
  const config = readConfig();
  ensureCoreConfig(config);

  setStepState("facultyReport", "running", "Running...");
  appendLog("Calling /faculty-report");

  const qs = new URLSearchParams({
    term: config.term,
    threshold: config.attainmentThreshold || "70",
  });

  const result = await requestJson(`${config.baseUrl}/faculty-report?${qs.toString()}`, {
    method: "GET",
    headers: { "x-api-key": config.apiKey },
  });

  const payload = unwrapPayload(result);
  setOutput("facultyReport", payload);
  setStepState("facultyReport", "success", `HTTP ${result.status}`);

  const totalCourses = (payload.faculties || []).reduce((s, f) => s + (f.courses_total || 0), 0);
  elements.metricCourses.textContent = String(totalCourses);
  appendLog(
    `Faculty report complete. ${(payload.faculties || []).length} facult${(payload.faculties || []).length === 1 ? "y" : "ies"}, ${totalCourses} course(s)`,
    "ok"
  );
  return payload;
}

async function runRisk() {
  const config = readConfig();
  ensureCoreConfig(config);

  setStepState("risk", "running", "Running...");
  appendLog("Calling /at-risk");

  const qs = new URLSearchParams({
    term: config.term,
    threshold: config.threshold || "2.0",
  });

  const result = await requestJson(`${config.baseUrl}/at-risk?${qs.toString()}`, {
    method: "GET",
    headers: { "x-api-key": config.apiKey },
  });

  const payload = unwrapPayload(result);
  setOutput("risk", payload);
  setStepState("risk", "success", `HTTP ${result.status}`);
  elements.metricRisk.textContent = String(payload.total_at_risk ?? 0);
  appendLog(`At-risk analysis complete. Total: ${payload.total_at_risk ?? 0}`, "ok");
  return payload;
}

async function runReport() {
  const config = readConfig();
  ensureCoreConfig(config);

  setStepState("report", "running", "Running...");
  appendLog("Calling /generate-report");

  const result = await requestJson(`${config.baseUrl}/generate-report`, {
    method: "POST",
    headers: { "x-api-key": config.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      term: config.term,
      program: config.program,
      type: config.reportType || "annual",
    }),
  });

  const payload = unwrapPayload(result);
  setOutput("report", payload);
  setStepState("report", "success", `HTTP ${result.status}`);
  const reportStatus = payload.status || (extractReportText(payload) ? "success" : "unknown");
  elements.metricReport.textContent = reportStatus;
  appendLog(`Report generation complete. Status: ${reportStatus}`, "ok");
  return payload;
}

function handleStepFailure(step, error) {
  const detail = error?.message || "Unknown error";
  setStepState(step, "error", detail.slice(0, 40));
  if (error?.payload) setOutput(step, error.payload);
  appendLog(`${step} failed: ${detail}`, "error");
}

async function runFullWorkflow() {
  if (busy) return;
  saveConfig();
  setBusy(true);
  appendLog("Starting full workflow run");
  try {
    try { await runUpload(); } catch (e) { handleStepFailure("upload", e); throw e; }
    try { await runFacultyReport(); } catch (e) { handleStepFailure("facultyReport", e); throw e; }
    try { await runRisk(); } catch (e) { handleStepFailure("risk", e); throw e; }
    try { await runReport(); } catch (e) { handleStepFailure("report", e); throw e; }
    appendLog("Full workflow finished successfully", "ok");
  } catch (error) {
    appendLog(`Workflow stopped: ${error.message}`, "error");
  } finally {
    setBusy(false);
  }
}

// ── PDF export ────────────────────────────────────────────────────────────────

function ensurePdfSpace(doc, y, spaceNeeded = 40) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + spaceNeeded > pageHeight - 44) { doc.addPage(); return 52; }
  return y;
}

function writePdfParagraph(doc, text, x, y, maxWidth, lineHeight = 14) {
  const cleanText = String(text || "N/A").trim();
  const lines = doc.splitTextToSize(cleanText, maxWidth);
  for (const line of lines) {
    y = ensurePdfSpace(doc, y, lineHeight + 6);
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

function addPdfFooter(doc) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110, 120, 135);
    doc.text("Generated from ABET Workflow Control Room", 40, pageHeight - 20);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - 90, pageHeight - 20);
  }
}

function exportPdfReport() {
  const JsPdf = window.jspdf && window.jspdf.jsPDF;
  if (!JsPdf) {
    appendLog("PDF library is unavailable in this browser session.", "error");
    window.alert("PDF export library failed to load. Please refresh and try again.");
    return;
  }

  const config = readConfig();
  const generatedAt = formatTimestamp(latestResults.lastRunAt || new Date().toISOString());

  const doc = new JsPdf({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - 80;

  // Header
  doc.setFillColor(19, 43, 74);
  doc.rect(0, 0, pageWidth, 92, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.text("ABET Faculty Performance Report", 40, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Term: ${config.term}    Report Type: ${config.reportType}    Generated: ${generatedAt}`,
    40,
    68
  );
  doc.setDrawColor(56, 214, 182);
  doc.setLineWidth(1.2);
  doc.line(40, 78, pageWidth - 40, 78);

  let y = 116;
  doc.setTextColor(24, 32, 44);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Executive Snapshot", 40, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  y = writePdfParagraph(doc, summarizeUpload(latestResults.upload, config), 40, y, contentWidth, 14) + 4;
  y = writePdfParagraph(doc, summarizeFacultyReport(latestResults.facultyReport), 40, y, contentWidth, 14) + 4;
  y = writePdfParagraph(doc, summarizeRisk(latestResults.risk, config), 40, y, contentWidth, 14) + 4;
  y = writePdfParagraph(doc, summarizeReportStatus(latestResults.report), 40, y, contentWidth, 14) + 12;

  // Per-faculty tables
  const faculties = latestResults.facultyReport?.faculties || [];
  for (const f of faculties) {
    y = ensurePdfSpace(doc, y, 100);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const compTag = f.compliant ? "COMPLIANT" : "NOT COMPLIANT";
    doc.text(
      `Faculty: ${f.faculty}   (${f.courses_achieved}/${f.courses_total} achieved, avg ${Number(f.overall_avg).toFixed(1)}%)   [${compTag}]`,
      40,
      y
    );
    y += 8;

    const tableRows = f.courses.map((c) => [
      c.course_code,
      c.s_label || `S${c.chosen_s}`,
      c.chosen_metric,
      c.average_score !== null && c.average_score !== undefined
        ? `${Number(c.average_score).toFixed(1)}%`
        : "—",
      `${Number(c.attainment_rate).toFixed(1)}%`,
      `${c.students_attained}/${c.students_assessed}`,
      c.status,
    ]);

    if (typeof doc.autoTable === "function") {
      doc.autoTable({
        startY: y,
        margin: { left: 40, right: 40 },
        head: [["Course", "S", "Metric", "Avg Score", "Attainment", "Students", "Status"]],
        body: tableRows,
        theme: "grid",
        headStyles: { fillColor: [22, 63, 110] },
        alternateRowStyles: { fillColor: [245, 248, 252] },
        styles: { fontSize: 9, cellPadding: 4 },
      });
      y = doc.lastAutoTable.finalY + 20;
    } else {
      const fallback = tableRows
        .map((r) => `${r[0]} | ${r[1]} | ${r[2]} | Avg ${r[3]} | Attainment ${r[4]} | ${r[6]}`)
        .join("\n");
      y = writePdfParagraph(doc, fallback, 40, y + 8, contentWidth, 13) + 16;
    }
  }

  // At-risk table
  const riskRows = getRiskRows(latestResults.risk)
    .slice(0, 10)
    .map((student) => [
      student.student_name || student.student_id || "Unknown",
      student.risk_level || "MODERATE",
      Number(student.risk_score || 0),
      Number(student.cumulative_gpa || 0).toFixed(2),
    ]);

  if (riskRows.length) {
    y = ensurePdfSpace(doc, y, 80);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("At-Risk Student Priority List", 40, y);
    y += 8;
    if (typeof doc.autoTable === "function") {
      doc.autoTable({
        startY: y,
        margin: { left: 40, right: 40 },
        head: [["Student", "Risk Level", "Risk Score", "Cumulative GPA"]],
        body: riskRows,
        theme: "striped",
        headStyles: { fillColor: [130, 47, 47] },
        alternateRowStyles: { fillColor: [252, 245, 245] },
        styles: { fontSize: 9, cellPadding: 4 },
      });
      y = doc.lastAutoTable.finalY + 16;
    }
  }

  // Narrative
  y = ensurePdfSpace(doc, y, 80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Generated Accreditation Narrative", 40, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  writePdfParagraph(
    doc,
    markdownToPlainText(summarizeReportNarrative(latestResults.report)),
    40,
    y,
    contentWidth,
    14
  );

  addPdfFooter(doc);

  const datePart = new Date().toISOString().slice(0, 10);
  const fileName = `${PDF_FILE_PREFIX}-${config.term}-${datePart}.pdf`;
  doc.save(fileName);

  appendLog(`PDF exported successfully: ${fileName}`, "ok");
  elements.metricReport.textContent = "PDF Ready";
}

// ── Event wiring ──────────────────────────────────────────────────────────────

function wireEvents() {
  [
    elements.baseUrl,
    elements.apiKey,
    elements.term,
    elements.program,
    elements.threshold,
    elements.attainmentThreshold,
    elements.reportType,
  ].forEach((input) => {
    if (input) input.addEventListener("change", saveConfig);
  });

  elements.runAllBtn.addEventListener("click", runFullWorkflow);

  elements.uploadBtn.addEventListener("click", async () => {
    if (busy) return;
    saveConfig();
    setBusy(true);
    try { await runUpload(); } catch (e) { handleStepFailure("upload", e); } finally { setBusy(false); }
  });

  elements.facultyReportBtn.addEventListener("click", async () => {
    if (busy) return;
    saveConfig();
    setBusy(true);
    try { await runFacultyReport(); } catch (e) { handleStepFailure("facultyReport", e); } finally { setBusy(false); }
  });

  elements.riskBtn.addEventListener("click", async () => {
    if (busy) return;
    saveConfig();
    setBusy(true);
    try { await runRisk(); } catch (e) { handleStepFailure("risk", e); } finally { setBusy(false); }
  });

  elements.reportBtn.addEventListener("click", async () => {
    if (busy) return;
    saveConfig();
    setBusy(true);
    try { await runReport(); } catch (e) { handleStepFailure("report", e); } finally { setBusy(false); }
  });

  if (elements.rawModeToggle) {
    elements.rawModeToggle.addEventListener("change", () => renderAllEndpointOutputs());
  }

  if (elements.exportPdfBtn) {
    elements.exportPdfBtn.addEventListener("click", () => exportPdfReport());
  }

  if (elements.addCourseRowBtn) {
    elements.addCourseRowBtn.addEventListener("click", () => {
      if (busy) return;
      courseConfigRows.push({
        faculty: normalizeFaculty(elements.program?.value || "CSE"),
        course_code: "",
        chosen_s: 1,
        chosen_metric: "QUIZ",
      });
      renderCourseConfigTable();
      setCourseConfigStatus("New row added.", "info");
    });
  }

  if (elements.extractCoursesBtn) {
    elements.extractCoursesBtn.addEventListener("click", () => {
      runCourseConfigAction("extract courses", extractCoursesFromSelectedFile);
    });
  }

  if (elements.loadCourseConfigBtn) {
    elements.loadCourseConfigBtn.addEventListener("click", () => {
      runCourseConfigAction("load", loadCourseConfig);
    });
  }

  if (elements.saveCourseConfigBtn) {
    elements.saveCourseConfigBtn.addEventListener("click", () => {
      runCourseConfigAction("save", saveCourseConfig);
    });
  }

  if (elements.courseConfigTableBody) {
    elements.courseConfigTableBody.addEventListener("change", handleCourseConfigTableChange);
    elements.courseConfigTableBody.addEventListener("click", handleCourseConfigTableClick);
  }

  elements.clearLogsBtn.addEventListener("click", () => {
    elements.logConsole.textContent = "";
  });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

function bootstrap() {
  restoreConfig();
  restoreCourseConfigRows();
  renderCourseConfigTable();
  setCourseConfigStatus(
    "Add courses per faculty, set the Chosen S and Metric Type, then click Save Config.",
    "info"
  );
  resetStates();
  clearOutputs();
  appendLog("Dashboard ready. Configure courses and run the workflow.");
  wireEvents();
}

bootstrap();
