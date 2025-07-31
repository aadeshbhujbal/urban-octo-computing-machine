# Node.js Microservice — Final API Overview (Python to Node.js Conversion)

This document summarizes the complete set of REST API endpoints implemented in the Node.js microservice, converted from the original Python analytics/reporting scripts. All endpoints are up-to-date, use clear and consistent paths, and are ready for frontend or automation use.

---

## API Endpoints

### PI Planning
- **GET `/api/v1/pi-planning`** — Complete PI Planning data including sprints, story points, epics, releases, and current sprint information
  - **Parameters:** `projectName`, `boardId`, `piStartDate`, `piEndDate`, `sprintIncludeFilter` (optional), `sprintExcludeFilter` (optional)
  - **Returns:** Project sprints, story points breakdown, PI epics, releases, current sprints, and sprint details
- **GET `/api/v1/pi-planning/epic-breakdown`** — Epic breakdown with story points, status, and additional information
- **GET `/api/v1/pi-planning/sprint-breakdown`** — Sprint breakdown with story points and status information
- **GET `/api/v1/pi-planning/story-points`** — Detailed story points analysis with breakdown by status and epics

### Velocity & Chart Data
- **GET `/api/v1/velocity/summary`** — Velocity, efficiency, spillover, and team size per sprint
- **GET `/api/v1/charts/velocity-data`** — Chart-friendly arrays for sprints, committed/completed/allotted/added story points, spillover, efficiency, team members, and dates

### Merge Requests Analytics
- **GET `/api/v1/merge-requests/heatmap`** — Per-user MR/commit/approval/comment stats (heatmap)
- **GET `/api/v1/merge-requests/analytics`** — Per-merge-request analytics (author, status, project, etc.)

### Confluence Integration
- **POST `/api/v1/confluence/update`** — Update a Confluence page with analytics data

### Jira Data
- **GET `/api/v1/jira/boards`** — Unified boards endpoint with filtering by project key and board type
- **GET `/api/v1/jira/boards/{boardId}`** — Get board details
- **GET `/api/v1/jira/boards/{boardId}/configuration`** — Get board configuration (columns, statuses)
- **GET `/api/v1/jira/boards/{boardId}/issues`** — Get issues for a board
- **GET `/api/v1/jira/boards/{boardId}/backlog`** — Get backlog issues for a board
- **GET `/api/v1/jira/boards/{boardId}/statistics`** — Get board statistics and metrics
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
- All endpoints are documented with Swagger/OpenAPI and ready for frontend or automation use.
- No UI is included (API only).

---

## How to Use
- See the main README for setup and environment variables.
- Use any HTTP client (Postman, Swagger UI, frontend app) to call the endpoints.

---

**This document can be shared with your manager to confirm the migration is complete, correct, and production-ready.** 