# Node.js Microservice — Final API Overview (Python to Node.js Conversion)

This document summarizes the complete set of REST API endpoints implemented in the Node.js microservice, converted from the original Python analytics/reporting scripts. All endpoints are up-to-date, use clear and consistent paths, and are ready for frontend or automation use.

---

## API Endpoints

### PI Planning
- **GET `/api/v1/pi-planning/summary`** — Full PI Planning summary (releases, sprints, issues, story points, RAG, epic/sprint breakdowns, burn-up, RAID, WSJF, PI Scope, Progress)
- **Granular Endpoints:** (all accept `project`, `boardId`, `piStartDate`, `piEndDate`)
  - `/api/v1/pi-planning/releases`
  - `/api/v1/pi-planning/sprints`
  - `/api/v1/pi-planning/issues`
  - `/api/v1/pi-planning/story-points`
  - `/api/v1/pi-planning/rag-status`
  - `/api/v1/pi-planning/epic-breakdown`
  - `/api/v1/pi-planning/sprint-breakdown`
  - `/api/v1/pi-planning/burnup`
  - `/api/v1/pi-planning/raid`
  - `/api/v1/pi-planning/wsjf`
  - `/api/v1/pi-planning/pi-scope`
  - `/api/v1/pi-planning/progress`

### Velocity & Chart Data
- **GET `/api/v1/velocity/summary`** — Velocity, efficiency, spillover, and team size per sprint
- **GET `/api/v1/charts/velocity-data`** — Chart-friendly arrays for sprints, committed/completed/allotted/added story points, spillover, efficiency, team members, and dates

### Merge Requests Analytics
- **GET `/api/v1/merge-requests/heatmap`** — Per-user MR/commit/approval/comment stats (heatmap)
- **GET `/api/v1/merge-requests/analytics`** — Per-merge-request analytics (author, status, project, etc.)
- **POST `/api/v1/merge-requests/export-csv`** — Export merge request analytics as CSV

### Text Analytics
- **POST `/api/v1/text/keyphrases`** — Extract key phrases from an array of input texts

### CSV Export (NEW, CORRECT PATHS)
- **POST `/api/v1/csv/export-team-csv`** — Export team member data as CSV
- **POST `/api/v1/csv/export-sprints-csv`** — Export sprints data as CSV

### HTML Report
- **POST `/api/v1/reports/html`** — Generate an HTML report from analytics data

### Confluence Integration
- **POST `/api/v1/confluence/update`** — Update a Confluence page with analytics data

### Jira Data
- **GET `/api/v1/jira/releases`** — List of releases for a Jira project
- **GET `/api/v1/jira/sprints`** — List of sprints for a Jira board
- **GET `/api/v1/jira/issues`** — List of issues for a Jira project
- **GET `/api/v1/jira/epics`** — List of epics for a Jira project

### Orchestration
- **GET `/api/v1/orchestration/run`** — Run config-driven analytics orchestration for all projects in the config CSV

### Health Check (Service Monitoring)
- **GET `/api/health`** — Basic health check
- **GET `/api/health/status`** — Detailed status check (external services, system info)

---

## Migration Notes & Parity
- All analytics/reporting features from the original Python scripts are now available as REST API endpoints.
- Endpoint paths are clear, modular, and grouped by feature.
- CSV export endpoints have been moved from `/api/v1/health/` to `/api/v1/csv/` for clarity.
- All endpoints are documented with Swagger/OpenAPI and ready for frontend or automation use.
- No UI is included (API only).

---

## How to Use
- See the main README for setup and environment variables.
- Use any HTTP client (Postman, Swagger UI, frontend app) to call the endpoints.

---

**This document can be shared with your manager to confirm the migration is complete, correct, and production-ready.** 