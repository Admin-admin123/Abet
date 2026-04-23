# ABET API Local Stack (n8n + Docker)

This repository now includes a full local implementation foundation for the ABET API platform using:

- n8n (workflow engine + webhooks)
- Postgres (local database mirroring Supabase schema)
- Docker Compose (one-command startup)
- Reusable JS snippets for n8n Code nodes
- Workflow blueprints for upload, attainment, at-risk, reporting, and weekly compliance checks

## What is already implemented

- Docker Compose stack for `n8n` and `postgres`
- Custom n8n image with `xlsx` package enabled for Code node file parsing
- SQL bootstrap scripts for:
  - `student_grades`
  - `so_mapping`
  - `so_attainment`
  - `upload_audit`
- Starter SO seed data including `CSE251` from your attached CSV docs
- Code snippets in `n8n/code` for:
  - API key validation
  - CSV/XLSX upload parsing and normalization
  - SO attainment computation
  - at-risk scoring
  - OpenRouter prompt assembly + extraction
  - weekly compliance summary
- Node-by-node workflow blueprints in `n8n/workflow-blueprints`
- Local helper scripts for start/stop/upload/test

## Quick start (Windows PowerShell)

Make sure Docker Desktop is installed and running before the next command.

```powershell
# From repository root
Copy-Item .env.example .env
.\scripts\start-local.ps1
```

Then open `http://localhost:5678` and sign in with your basic auth values from `.env`.

## Build workflows in n8n

Use these blueprint docs directly in the n8n UI:

1. `n8n/workflow-blueprints/01-upload-workflow.md`
2. `n8n/workflow-blueprints/02-so-attainment-workflow.md`
3. `n8n/workflow-blueprints/03-at-risk-workflow.md`
4. `n8n/workflow-blueprints/04-report-workflow.md`
5. `n8n/workflow-blueprints/05-weekly-check-workflow.md`

Paste JS from matching files in `n8n/code` into the Code nodes.

## Local API smoke tests

After workflows are built and activated:

```powershell
.\scripts\upload-sample.ps1
.\scripts\test-api.ps1
# include report generation only after setting OPENROUTER_API_KEY
.\scripts\test-api.ps1 -IncludeReport
```

## Workflow web app dashboard

A frontend dashboard is now included in `webapp/` to run and visualize the full n8n flow using REST:

- Upload Grades (`POST /upload`)
- Professor SO Mapping (`GET /so-mapping`, `POST /so-mapping`)
- SO Attainment (`GET /so-attainment`)
- At-Risk (`GET /at-risk`)
- Report Generation (`POST /generate-report`)

Start it with:

```powershell
.\scripts\start-webapp.ps1
```

Or from cmd:

```cmd
scripts\start-webapp.cmd
```

Then open:

`http://localhost:8088`

Use the UI to configure API key, term/program, choose the grades file, and run either each step individually or the full workflow.

The dashboard also includes a Professor SO Mapping table where instructors can:

- load existing course-to-SO mappings for a selected program,
- extract course codes from the currently selected grades file,
- check/uncheck SO1-SO6 per course,
- and save updates back to the API.

## Stop stack

```powershell
.\scripts\stop-local.ps1
# or remove containers + volumes
.\scripts\stop-local.ps1 --volumes
```

## Notes

- `.env` is ignored by git.
- Update `OPENROUTER_API_KEY` in `.env` before testing report generation.
- For production deployment, move this to a VPS/domain and switch `WEBHOOK_URL` to HTTPS.
