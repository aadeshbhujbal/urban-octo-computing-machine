# Node.js Microservice (TypeScript)

This microservice is a TypeScript/Express.js REST API that replicates the features of the original Python project.

## Features
- Jira, Confluence, and GitLab integrations
- REST API endpoints for all major features
- No UI (API only)

## Setup

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Configure environment variables:**
   - Copy `.env` and fill in your credentials (see `.env` for required variables).

3. **Run in development mode:**
   ```sh
   npm run dev
   ```

4. **Build and run in production:**
   ```sh
   npm run build
   npm start
   ```

## Project Structure
- `src/controllers/` – API route handlers
- `src/services/` – Business logic (Jira, Confluence, GitLab, etc.)
- `src/routes/` – Route definitions
- `src/utils/` – Utility functions
- `src/types/` – TypeScript types/interfaces
- `src/config/` – Configuration and environment

## API
- Health check: `GET /health`
- (More endpoints will be documented as implemented)

# Environment Variables

The following environment variables must be set in your `.env` file at the project root:

| Variable         | Description                                 |
|------------------|---------------------------------------------|
| PORT             | Port for the Express server (default: 3000) |
| JIRA_URL         | Base URL for your Jira instance             |
| JIRA_USER        | Jira username/email for API auth            |
| JIRA_TOKEN       | Jira API token/password                     |
| GITLAB_TOKEN     | GitLab API token                            |
| GITLAB_HOST      | (Optional) GitLab host URL (default: gitlab.com) |
| CONFLUENCE_URL   | Base URL for your Confluence instance       |

**Note:** All analytics and orchestration endpoints require the relevant credentials to be set. The service will throw clear errors if any required variable is missing.

## Note on Chart/Image Endpoints

Chart/image endpoints (wordcloud, bar/velocity charts) are not available in this build due to removal of native dependencies (canvas, d3-cloud, chartjs-node-canvas). All CSV and JSON analytics endpoints remain fully functional and available.

---

**No UI is included. This is a backend microservice only.** 

GET http://localhost:3000/api/v1/pi-planning/sprints?project=FRN&boardId=59059&piStartDate=2024-01-01&piEndDate=2024-03-31
GET http://localhost:3000/api/v1/pi-planning/story-points?project=FRN&boardId=59059&piStartDate=2024-01-01&piEndDate=2024-03-31
GET http://localhost:3000/api/v1/pi-planning/epic-breakdown?project=FRN&boardId=59059&piStartDate=2024-01-01&piEndDate=2024-03-31
GET http://localhost:3000/api/v1/pi-planning/sprint-breakdown?project=FRN&boardId=59059&piStartDate=2024-01-01&piEndDate=2024-03-31
GET http://localhost:3000/api/v1/pi-planning/burnup?project=FRN&boardId=59059&piStartDate=2024-01-01&piEndDate=2024-03-31
GET http://localhost:3000/api/v1/pi-planning/raid?project=FRN&boardId=59059&piStartDate=2024-01-01&piEndDate=2024-03-31
GET http://localhost:3000/api/v1/pi-planning/wsjf?project=FRN&boardId=59059&piStartDate=2024-01-01&piEndDate=2024-03-31
GET http://localhost:3000/api/v1/pi-planning/pi-scope?project=FRN&boardId=59059&piStartDate=2024-01-01&piEndDate=2024-03-31
GET http://localhost:3000/api/v1/pi-planning/progress?project=FRN&boardId=59059&piStartDate=2024-01-01&piEndDate=2024-03-31