# ABET n8n Workflow Blueprints

This folder gives you copy/paste-ready build specs for all core APIs.

## Required setup before building workflows

1. Start stack with Docker Compose.
2. Open n8n at `http://localhost:5678`.
3. Set environment variables in your n8n container via `.env`:
   - `ABET_API_KEY`
   - `OPENROUTER_API_KEY`
   - `OPENROUTER_MODEL` (optional, defaults to `openai/gpt-4o-mini`)
4. Create one Postgres credential in n8n:
   - Host: `postgres`
   - Port: `5432`
   - Database/User/Password from `.env`
5. For each Code node, paste JS from matching file in `n8n/code`.

## Workflow build order

1. [01-upload-workflow.md](01-upload-workflow.md)
2. [02-so-attainment-workflow.md](02-so-attainment-workflow.md)
3. [03-at-risk-workflow.md](03-at-risk-workflow.md)
4. [04-report-workflow.md](04-report-workflow.md)
5. [05-weekly-check-workflow.md](05-weekly-check-workflow.md)

## Naming convention (important)

Some snippets reference other nodes by name (`$('Node Name')`).
Use the exact names shown in each blueprint.
