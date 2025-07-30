# Epic and Sprint API Documentation

This document describes the separate API endpoints for retrieving Epic and Sprint data from Jira. The modules are now separated for better organization and maintainability, with proper TypeScript types and integration with the existing Jira service.

## Related APIs

### Current API (`/api/v1/current/summary`)
The existing current API provides a unified view of current sprint information:
- **Current Jira Sprint**: Active sprint details
- **Current Jira Release**: Latest release information  
- **Current PI Planning Sprints**: Sprints in current PI
- **Current Velocity Sprint**: Latest velocity metrics

**Example:** `GET /api/v1/current/summary?project=RAFDT&boardId=123`

### Epic, Sprint & Milestone APIs (This Document)
These new APIs provide detailed, focused data for specific use cases:
- **Epic API**: Detailed epic information with PI objectives, RAID, and story points
- **Sprint API**: Comprehensive sprint metrics including objectives, efficiency, and team data
- **Milestone API**: Milestone tracking, PI progression charts, and sprint objectives

### API Comparison

| Feature | Current API | Epic API | Sprint API | Milestone API |
|---------|-------------|----------|------------|---------------|
| **Purpose** | Unified current view | Epic management | Sprint analytics | Milestone tracking |
| **Current Sprint** | ✅ Basic info | ❌ | ✅ Detailed metrics | ✅ Objectives |
| **Sprint Objective** | ❌ | ❌ | ✅ Full objective text | ✅ Current objectives |
| **Story Points** | ✅ Basic | ✅ Epic breakdown | ✅ Detailed tracking | ✅ PI progression |
| **PI Objectives** | ❌ | ✅ Full details | ❌ | ✅ PI progression chart |
| **RAID Information** | ❌ | ✅ Complete RAID | ❌ | ❌ |
| **Team Members** | ❌ | ❌ | ✅ Count & efficiency | ✅ Team breakdown |
| **Historical Data** | ❌ | ❌ | ✅ Multiple sprints | ✅ Milestone history |
| **Epic Table Format** | ❌ | ✅ Table-ready | ❌ | ❌ |
| **Milestones** | ❌ | ❌ | ❌ | ✅ Version tracking |
| **PI Progression** | ❌ | ❌ | ❌ | ✅ Chart data |

**Use Cases:**
- **Current API**: Dashboard overview, current status
- **Epic API**: PI planning, epic tracking, RAID management
- **Sprint API**: Sprint retrospectives, velocity analysis, team metrics
- **Milestone API**: Release tracking, PI progression charts, milestone management

## Epic Data Endpoints

### 1. Get Epic Summary Table
**Endpoint:** `GET /api/v1/epic/summary`

Returns epic data in the format shown in your table, including:
- Epic links and keys
- PI Objectives
- PI Progress Updates  
- RAID information (Risks, Assumptions, Issues, Dependencies)
- Story Points tracking (formatted like "(OSP (+4SP)/4SP / 2SP)")

**Query Parameters:**
- `projectKey` (required): Jira project key (e.g., "RAFDT")
- `boardId` (required): Jira board ID
- `piStartDate` (optional): PI start date (YYYY-MM-DD)
- `piEndDate` (optional): PI end date (YYYY-MM-DD)
- `sprintIds` (optional): Comma-separated list of sprint IDs

**Example Request:**
```bash
GET /api/v1/epic/summary?projectKey=RAFDT&boardId=123&piStartDate=2024-01-01&piEndDate=2024-03-31
```

**Example Response:**
```json
[
  {
    "epic": "https://natwest.atlassian.net/browse/RAFDT-72 RAFDT-72 Can't find link",
    "piObjective": "Capability Build for SC03 - Disclosure Name: Contractual Maturity",
    "piProgressUpdate": "Development and Automation Testing",
    "raid": "Risk - Rework in SC03 functionality informed by 9/4/2024 Kamal",
    "storyPoints": "(76SP (+4SP)/ 76SP / 4SP)"
  }
]
```

### 2. Get Epic Details
**Endpoint:** `GET /api/v1/epic/{epicKey}`

Returns detailed information for a specific epic.

**Example Request:**
```bash
GET /api/v1/epic/RAFDT-72
```

## Sprint Data Endpoints

### 1. Get Sprint Summary
**Endpoint:** `GET /api/v1/sprint/summary`

Returns sprint data including:
- Sprint Name
- Start Date and End Date
- Sprint Objective/Goal
- Sprint Status (active, closed, future)
- Story Points (committed, completed, added, total)
- Team Members count
- Efficiency percentage

**Query Parameters:**
- `boardId` (required): Jira board ID
- `sprintIds` (optional): Comma-separated list of sprint IDs
- `state` (optional): Sprint state filter (active,closed,future)
- `startDate` (optional): Start date filter (YYYY-MM-DD)
- `endDate` (optional): End date filter (YYYY-MM-DD)

**Example Request:**
```bash
GET /api/v1/sprint/summary?boardId=123&state=active,closed
```

**Example Response:**
```json
[
  {
    "sprintId": 1234,
    "sprintName": "Sprint 1",
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-01-14T23:59:59.000Z",
    "sprintObjective": "Complete user authentication feature",
    "sprintStatus": "closed",
    "storyPoints": {
      "committed": 20,
      "completed": 18,
      "added": 2,
      "total": 22
    },
    "teamMembers": 8,
    "efficiency": 90
  }
]
```

### 2. Get Sprint Details
**Endpoint:** `GET /api/v1/sprint/{sprintId}`

Returns detailed information for a specific sprint.

**Tip:** Get the current sprint ID from the Current API first:
```bash
# Get current sprint ID
GET /api/v1/current/summary?project=RAFDT&boardId=123

# Then get detailed sprint info
GET /api/v1/sprint/{sprintId}
```

**Example Request:**
```bash
GET /api/v1/sprint/1234
```

## Data Sources

The API retrieves data from the following Jira fields and endpoints, using the existing Jira service for consistency:

### Epic Data Sources:
- **PI Objective**: `customfield_20046` (PI Scope field)
- **PI Progress Update**: `customfield_30195` (Progress field)
- **RAID**: `customfield_30160` (RAID field)
- **Story Points**: `customfield_10002` (Story Points field)
- **Epic Details**: Uses `getIssuesFromJira()` service method

### Sprint Data Sources:
- **Sprint Details**: Uses `getSprintsFromJira()` service method
- **Sprint Objective**: `goal` field from sprint API
- **Velocity Stats**: `/rest/greenhopper/1.0/rapid/charts/velocity`
- **Sprint Issues**: Uses `getIssuesFromJira()` service method with JQL `Sprint = {sprintId}`

## Type Safety

All endpoints use proper TypeScript types:
- `JiraIssue`, `JiraSprint`, `JiraEpic`, `JiraVersion` for Jira entities
- `EpicData`, `EpicTableRow` for Epic responses
- `SprintData`, `SprintSummaryOptions` for Sprint responses
- `MilestoneData`, `PIProgressionData`, `MilestoneStatus`, `TrackStatus` for Milestone responses
- No `any` types used - all responses are properly typed

## Environment Variables Required

Make sure these environment variables are set in your `.env` file:

```env
JIRA_URL=https://your-domain.atlassian.net
JIRA_USER=your-email@domain.com
JIRA_TOKEN=your-api-token
```

## Usage Examples

### JavaScript/Node.js
```javascript
// Get current unified summary (existing API)
const currentResponse = await fetch('/api/v1/current/summary?project=RAFDT&boardId=123');
const currentData = await currentResponse.json();

// Get epic summary table
const epicResponse = await fetch('/api/v1/epic/summary?projectKey=RAFDT&boardId=123');
const epicData = await epicResponse.json();

// Get sprint summary
const sprintResponse = await fetch('/api/v1/sprint/summary?boardId=123');
const sprintData = await sprintResponse.json();

// Get specific sprint details
const sprintDetailsResponse = await fetch('/api/v1/sprint/1234');
const sprintDetails = await sprintDetailsResponse.json();
```

### Python
```python
import requests

# Get current unified summary (existing API)
current_response = requests.get('http://localhost:3000/api/v1/current/summary', 
                               params={'project': 'RAFDT', 'boardId': '123'})
current_data = current_response.json()

# Get epic summary table
epic_response = requests.get('http://localhost:3000/api/v1/epic/summary', 
                            params={'projectKey': 'RAFDT', 'boardId': '123'})
epic_data = epic_response.json()

# Get sprint summary
sprint_response = requests.get('http://localhost:3000/api/v1/sprint/summary', 
                              params={'boardId': '123'})
sprint_data = sprint_response.json()

# Get specific sprint details
sprint_details_response = requests.get('http://localhost:3000/api/v1/sprint/1234')
sprint_details = sprint_details_response.json()
```

### Combined Usage Example
```javascript
// Get current sprint info and then detailed data
const currentData = await fetch('/api/v1/current/summary?project=RAFDT&boardId=123').then(r => r.json());

if (currentData.jira.currentSprint) {
  const currentSprintId = currentData.jira.currentSprint.id;
  
  // Get detailed current sprint information
  const sprintDetails = await fetch(`/api/v1/sprint/${currentSprintId}`).then(r => r.json());
  
  // Get epics for current PI
  const epicData = await fetch('/api/v1/epic/summary?projectKey=RAFDT&boardId=123').then(r => r.json());
  
  // Get PI progression chart data
  const piProgression = await fetch('/api/v1/milestone/pi-progression?projectKey=RAFDT&boardId=123').then(r => r.json());
  
  // Get current sprint objectives
  const sprintObjectives = await fetch('/api/v1/milestone/sprint-objectives?boardId=123').then(r => r.json());
  
  console.log('Current Sprint:', sprintDetails);
  console.log('Epic Summary:', epicData);
  console.log('PI Progression:', piProgression);
  console.log('Sprint Objectives:', sprintObjectives);
}
```

## Milestone Data Endpoints

### 1. Get Milestones List
**Endpoint:** `GET /api/v1/milestone/list`

Returns milestone data including version, dates, status, and track information.

**Query Parameters:**
- `projectKey` (required): Jira project key
- `status` (optional): Comma-separated list of statuses (RELEASED,UNRELEASED,IN_PROGRESS,PLANNED)
- `track` (optional): Comma-separated list of track statuses (ON_TRACK,OFF_TRACK,AT_RISK,DELAYED,PLANNED)
- `startDate` (optional): Start date filter (YYYY-MM-DD)
- `endDate` (optional): End date filter (YYYY-MM-DD)

**Example Request:**
```bash
GET /api/v1/milestone/list?projectKey=RAFDT&status=UNRELEASED&track=ON_TRACK
```

**Example Response:**
```json
[
  {
    "version": "Technical Build SC3 - View ETL Business Rules",
    "startDate": null,
    "endDate": "2024-10-25",
    "status": "UNRELEASED",
    "track": "ON_TRACK",
    "description": "Technical Build SC3 - View ETL Business Rules",
    "projectKey": "RAFDT"
  }
]
```

### 2. Get PI Progression
**Endpoint:** `GET /api/v1/milestone/pi-progression`

Returns PI progression data for creating donut charts like the one shown in your image.

**Query Parameters:**
- `projectKey` (required): Jira project key
- `boardId` (required): Jira board ID
- `piStartDate` (optional): PI start date (YYYY-MM-DD)
- `piEndDate` (optional): PI end date (YYYY-MM-DD)

**Example Request:**
```bash
GET /api/v1/milestone/pi-progression?projectKey=RAFDT&boardId=123
```

**Example Response:**
```json
{
  "totalStoryPoints": 442,
  "statusBreakdown": {
    "completed": 200.5,
    "inProgress": 57,
    "toDo": 184.5
  },
  "teamBreakdown": {
    "teamName": "SOS",
    "totalStoryPoints": 442,
    "completed": 200.5,
    "inProgress": 57,
    "toDo": 184.5
  }
}
```

### 3. Get Current Sprint Objectives
**Endpoint:** `GET /api/v1/milestone/sprint-objectives`

Returns current sprint objectives with story points breakdown and list of objectives.

**Query Parameters:**
- `boardId` (required): Jira board ID

**Example Request:**
```bash
GET /api/v1/milestone/sprint-objectives?boardId=123
```

**Example Response:**
```json
{
  "completedStoryPoints": 138,
  "inProgressStoryPoints": 26,
  "toDoStoryPoints": 17,
  "objectives": [
    {
      "issueKey": "RAFDT-7276",
      "issueUrl": "https://natwest.atlassian.net/browse/RAFDT-7276",
      "description": "Development and Automation Testing"
    },
    {
      "issueKey": "RAFDT-7274",
      "issueUrl": "https://natwest.atlassian.net/browse/RAFDT-7274",
      "description": "Development and Automation Testing"
    }
  ]
}
```

## Error Handling

The API returns appropriate HTTP status codes:
- `200`: Success
- `400`: Missing required parameters
- `404`: Epic or Sprint not found
- `500`: Server error

Error responses include a message describing the issue:
```json
{
  "error": "Missing required parameters: projectKey and boardId"
}
``` 