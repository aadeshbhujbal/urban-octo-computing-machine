# Node.js Microservice — API Endpoints & Features

This microservice provides a full-featured analytics/reporting backend, converted from the original Python scripts. All endpoints are RESTful, return JSON (or CSV/HTML where noted), and are ready for frontend or automation use.

---

## API Endpoints

### PI Planning
- **GET `/api/v1/pi-planning/summary`**  
  Returns a full PI Planning summary (releases, sprints, issues, story points, RAG, epic/sprint breakdowns, burn-up, RAID, WSJF, PI Scope, Progress).
  - **Query params:** `project`, `boardId`, `piStartDate`, `piEndDate`
- **Granular Endpoints:**  
  Each returns only one field from the summary (same query params as above):
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

---

### Velocity & Chart Data
- **GET `/api/v1/velocity/summary`**  
  Returns velocity, efficiency, spillover, and team size per sprint.
  - **Query params:** `boardId` (required), `numSprints`, `year`, `sprintPrefix`
- **GET `/api/v1/charts/velocity-data`**  
  Returns chart-friendly arrays for sprints, committed/completed/allotted/added story points, spillover, efficiency, team members, and dates.
  - **Query params:** same as above

---

### Merge Requests Analytics
- **GET `/api/v1/merge-requests/heatmap`**  
  Returns per-user MR/commit/approval/comment stats (heatmap).
  - **Query params:** `groupId`, `startDate`, `endDate`
- **GET `/api/v1/merge-requests/analytics`**  
  Returns per-merge-request analytics (author, status, project, etc.).
  - **Query params:** `groupId`, `startDate`, `endDate`
- **POST `/api/v1/merge-requests/export-csv`**  
  Exports merge request analytics as CSV.

---

### Text Analytics
- **POST `/api/v1/text/keyphrases`**  
  Extracts key phrases from an array of input texts.
  - **Body:** `{ "texts": [ ... ] }`
  - **Response:** `{ "keyPhrases": [ ... ] }`

---

### CSV Export
- **POST `/api/v1/csv/export-team-csv`**  
  Exports team member data as CSV.
- **POST `/api/v1/csv/export-sprints-csv`**  
  Exports sprints data as CSV.

---

### HTML Report
- **POST `/api/v1/reports/html`**  
  Generates an HTML report from analytics data.

---

### Confluence Integration
- **POST `/api/v1/confluence/update`**  
  Updates a Confluence page with analytics data.
  - **Body:** `{ "pageId": "...", "content": "..." }`

---

### Jira Data
- **GET `/api/v1/jira/releases`**  
  Returns a list of releases for a Jira project.
  - **Query param:** `project`
- **GET `/api/v1/jira/sprints`**  
  Returns a list of sprints for a Jira board.
  - **Query param:** `boardId`
- **GET `/api/v1/jira/issues`**  
  Returns a list of issues for a Jira project.
  - **Query param:** `project`
- **GET `/api/v1/jira/epics`**  
  Returns a list of epics for a Jira project.
  - **Query param:** `project`

---

### Orchestration
- **GET `/api/v1/orchestration/run`**  
  Runs config-driven analytics orchestration for all projects in the config CSV.

---

## Features Summary
- Full parity with original Python analytics/reporting scripts
- Modular endpoints for PI Planning, Velocity, Merge Requests, Jira, Confluence, and more
- CSV and HTML export capabilities
- All endpoints documented with Swagger/OpenAPI (viewable in Swagger UI)
- No UI included (API only)

---

## How to Use
- See the main README for installation and configuration.
- Use any HTTP client (Postman, Swagger UI, frontend app) to call the endpoints. 