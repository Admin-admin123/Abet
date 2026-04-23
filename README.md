# ABET Workflow Control Room

> Faculty-organized student-outcome attainment platform — n8n · PostgreSQL · Docker · Vanilla JS dashboard

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Browser Dashboard                        │
│              webapp/  (Python http.server :8088)                │
│   Upload │ Course Config │ Faculty Report │ At-Risk │ Narrative │
└────────────────────────┬────────────────────────────────────────┘
                         │ REST (x-api-key)
┌────────────────────────▼────────────────────────────────────────┐
│                     n8n  :5678  (Docker)                        │
│  POST /upload            →  parse CSV/XLSX, classify per row    │
│  GET|POST /course-config →  faculty × course × S × metric      │
│  GET /faculty-report     →  per-faculty S attainment            │
│  GET /at-risk            →  GPA / grade risk scoring            │
│  POST /generate-report   →  OpenRouter LLM narrative            │
│  GET|POST /so-mapping    →  legacy SO mapping CRUD              │
└────────────────────────┬────────────────────────────────────────┘
                         │ pg driver
┌────────────────────────▼────────────────────────────────────────┐
│                  PostgreSQL 16  :5432  (Docker)                 │
│  student_grades · assessment_scores · course_faculty_config     │
│  so_mapping · assessment_so_mapping · so_attainment             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Docker Desktop | ≥ 4.x | Must be running before `docker compose up` |
| Python | ≥ 3.8 | Only for the static dashboard server |
| Git | any | For version control |

---

## Quick Start

### 1 — Clone and configure

```bash
git clone https://github.com/<YOUR_USERNAME>/ABET.git
cd ABET
```

```powershell
# Windows PowerShell — copy the env template then fill in your keys
Copy-Item .env.example .env
notepad .env
```

### 2 — Start the backend (n8n + PostgreSQL)

```powershell
# Build the custom n8n image and start both containers
docker compose up --build -d
```

Wait ~15 seconds for PostgreSQL to finish its init scripts, then verify:

```powershell
docker compose ps
# abet-n8n       Up
# abet-postgres  Up (healthy)
```

### 3 — Import and activate all n8n workflows

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-upload-bootstrap.ps1
```

This imports every `n8n/workflows/*.workflow.json`, publishes them, and restarts n8n.

### 4 — Start the dashboard

```powershell
# Option A — helper script
powershell -ExecutionPolicy Bypass -File .\scripts\start-webapp.ps1

# Option B — direct Python command
python -m http.server 8088 --directory webapp
```

Open **<http://localhost:8088>** in your browser.

---

## Using the Dashboard

### Step-by-step workflow

```text
 ① Upload Grades  →  ② Configure Courses  →  ③ Faculty Report  →  ④ At-Risk  →  ⑤ Generate Report
```

#### ① Upload Grades

- Pick a CSV or XLSX file from your institution's grade export.
- Set **Upload Faculty** to **AUTO — detect per row** (default).
  The dashboard scans the file instantly and shows a detection banner, e.g.:
  `⚡ 3 faculties detected · AIE 18 rows · CSE 24 rows · CE 12 rows`
- Click **Upload**. Each row is tagged to the correct faculty automatically.

#### ② Configure Courses

In the **Faculty Course Configuration** table, for every course assign:

| Column | Description |
| --- | --- |
| Faculty | AIE · AIS · CE · CSE · ADDA · CONS |
| Course Code | e.g. `AIE111`, `CSE251` |
| Chosen S | Which student outcome (S1–S6) this course targets |
| Metric Type | QUIZ · ASSIGNMENT · EXAM · LAB · PROJECT |

Use **Extract From File** to auto-populate from the uploaded file, adjust per course, then click **Save Config**.

#### ③ Faculty Report

Click **Faculty Report**. Results appear in a dedicated section organised by faculty:

- Per-faculty header — `AIE — 4/5 achieved · avg 78.2% · [COMPLIANT]`
- Per-course row — course code · S · metric · avg score · attainment % · student count · status
- **Filter pills** (`All · AIE · CSE · CE`) focus on one faculty instantly
- **Cross-Faculty Matrix** (amber section) — appears automatically when the same course is configured in more than one faculty, showing a side-by-side comparison

#### ④ At-Risk

Flags students by GPA threshold, fail grades, and repeat flags.
Set **At-Risk Threshold (GPA)** (default 2.0) and click **At-Risk**.

#### ⑤ Generate Report

Click **Generate Report** for an LLM-written ABET narrative via OpenRouter.
Requires `OPENROUTER_API_KEY` in `.env`.

#### Export PDF

Click **Export PDF Report** at any point — generates a multi-page A4 PDF with:

- Executive snapshot
- One table per faculty
- At-risk student list
- Accreditation narrative

---

## Environment Variables (`.env`)

```ini
# n8n
N8N_PORT=5678
WEBHOOK_URL=http://localhost:5678
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=change_me

# Security
ABET_API_KEY=change_me_to_a_strong_key

# AI narrative (optional)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openai/gpt-4o-mini

# PostgreSQL
POSTGRES_DB=abet_db
POSTGRES_USER=abet_user
POSTGRES_PASSWORD=change_me
```

> **Never commit `.env`** — it is listed in `.gitignore`.

---

## API Reference

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/webhook/upload` | Upload CSV/XLSX; `program=AUTO` classifies per row |
| `GET` | `/webhook/course-config` | List faculty × course configurations |
| `POST` | `/webhook/course-config` | Upsert faculty × course configurations |
| `GET` | `/webhook/faculty-report` | Compute per-faculty, per-course S attainment |
| `GET` | `/webhook/at-risk` | Score and rank at-risk students |
| `POST` | `/webhook/generate-report` | Generate ABET narrative via LLM |
| `GET` | `/webhook/so-mapping` | Legacy SO mapping read |
| `POST` | `/webhook/so-mapping` | Legacy SO mapping write |

All endpoints require the header `x-api-key: <ABET_API_KEY>`.

---

## Database Schema

```sql
student_grades          -- uploaded grade rows, one per student per course
assessment_scores       -- individual assessment scores (quiz, assignment, …)
course_faculty_config   -- faculty × course × chosen_s × chosen_metric
so_mapping              -- legacy course-to-SO mapping
assessment_so_mapping   -- assessment-level SO mapping
so_attainment           -- cached attainment results
upload_audit            -- upload history log
```

---

## Project Structure

```text
ABET/
├── docker/
│   ├── n8n/Dockerfile                   # extends n8nio/n8n, adds xlsx + pg
│   └── postgres/init/                   # SQL migrations (run on first start)
│       ├── 001_schema.sql
│       ├── 002_so_mapping_seed.sql
│       ├── 003_assessment_support.sql
│       └── 004_course_faculty_config.sql
├── n8n/
│   ├── code/                            # readable JS for each Code node
│   └── workflows/                       # importable n8n workflow JSONs
├── scripts/
│   ├── start-local.ps1                  # docker compose up
│   ├── start-webapp.ps1                 # python http.server
│   ├── register-upload-bootstrap.ps1    # import + activate all workflows
│   ├── stop-local.ps1                   # docker compose down
│   └── test-api.ps1                     # endpoint smoke tests
├── webapp/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── .env.example                         # template — copy to .env
├── docker-compose.yml
└── README.md
```

---

## Stop / Tear Down

```powershell
# Stop containers, keep data volumes
docker compose down

# Stop containers AND wipe all database + n8n data
docker compose down --volumes
```

---

## Common Troubleshooting

| Symptom | Fix |
| --- | --- |
| `abet-postgres` not healthy | Wait 20 s and re-run `docker compose ps` |
| Workflow import fails | Check that Docker Desktop is using the Linux engine |
| `x-api-key` rejected | Make sure `.env` `ABET_API_KEY` matches the key in the dashboard |
| Faculty report returns empty | Upload grades first; check `course_faculty_config` has rows |
| PDF blank narrative | Run Generate Report before exporting PDF |
