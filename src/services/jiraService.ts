import axios from 'axios';
import { JiraProject, JiraVersion, JiraSprint, JiraIssue, JiraEpic } from '../types/jira';

const JIRA_URL = process.env.JIRA_URL;
const JIRA_USER = process.env.JIRA_USER;
const JIRA_TOKEN = process.env.JIRA_TOKEN;

export async function getReleasesFromJira(projectName?: string): Promise<JiraVersion[]> {
  if (!JIRA_URL || !JIRA_USER || !JIRA_TOKEN) {
    throw new Error('Jira credentials are not set in environment variables');
  }

  // 1. Get all projects
  const projectsResp = await axios.get(`${JIRA_URL}/rest/api/3/project`, {
    auth: { username: JIRA_USER, password: JIRA_TOKEN },
  });
  const projects = projectsResp.data as JiraProject[];

  // 2. Find project by name or key (case-insensitive)
  const project = projects.find((p) =>
    projectName
      ? p.name.toLowerCase() === projectName.toLowerCase() ||
        p.key.toLowerCase() === projectName.toLowerCase()
      : true
  );
  if (!project) {
    throw new Error(`Project not found: ${projectName}`);
  }

  // 3. Get versions (releases) for the project
  const versionsResp = await axios.get(`${JIRA_URL}/rest/api/3/project/${project.key}/versions`, {
    auth: { username: JIRA_USER, password: JIRA_TOKEN },
  });
  const versions = versionsResp.data as JiraVersion[];

  // 4. Get detailed version information for each version
  const detailedVersions = await Promise.all(
    versions.map(async (version) => {
      try {
        const versionResp = await axios.get(`${JIRA_URL}/rest/api/3/version/${version.id}`, {
          auth: { username: JIRA_USER, password: JIRA_TOKEN },
        });
        return versionResp.data as JiraVersion;
      } catch (error) {
        console.error(`Error fetching version details for ${version.id}:`, error);
        return version;
      }
    })
  );

  // 5. Map to relevant fields with detailed information
  return detailedVersions.map((version) => ({
    id: version.id,
    name: version.name,
    startDate: version.startDate,
    releaseDate: version.releaseDate,
    released: version.released,
    overdue: version.overdue,
  }));
}

export async function getSprintsFromJira(boardId: string, state: string = 'active,closed,future'): Promise<JiraSprint[]> {
  if (!JIRA_URL || !JIRA_USER || !JIRA_TOKEN) {
    throw new Error('Jira credentials are not set in environment variables');
  }
  const resp = await axios.get(`${JIRA_URL}/rest/agile/1.0/board/${boardId}/sprint`, {
    auth: { username: JIRA_USER, password: JIRA_TOKEN },
    params: { state },
  });
  return ((resp.data as { values: JiraSprint[] }).values) || [];
}

export async function getIssuesFromJira(jql: string): Promise<JiraIssue[]> {
  if (!JIRA_URL || !JIRA_USER || !JIRA_TOKEN) {
    throw new Error('Jira credentials are not set in environment variables');
  }

  const issues: JiraIssue[] = [];
  let startAt = 0;
  const maxResults = 1000;

  while (true) {
    const resp = await axios.get(`${JIRA_URL}/rest/api/3/search`, {
      auth: { username: JIRA_USER, password: JIRA_TOKEN },
      params: { 
        jql,
        startAt,
        maxResults,
        fields: [
          'summary',
          'status',
          'customfield_10002', // Story Points
          'parent',
          'assignee',
          'created',
          'updated',
          'customfield_10341', // Sprint
          'customfield_30160', // RAID
          'customfield_42105', // WSJF
          'customfield_20046', // PI Scope
          'customfield_30195', // Progress
          'issuetype',
          'project',
          'fixVersions',
          'components',
          'priority',
          'labels',
          'description',
          'resolution',
          'resolutiondate'
        ]
      },
    });

    const data = resp.data as { issues: JiraIssue[]; total: number };
    if (!data.issues || data.issues.length === 0) break;

    issues.push(...data.issues);
    if (data.issues.length < maxResults) break;
    startAt += maxResults;
  }

  return issues;
}

export async function getEpicsFromJira(boardId: string): Promise<JiraEpic[]> {
  if (!JIRA_URL || !JIRA_USER || !JIRA_TOKEN) {
    throw new Error('Jira credentials are not set in environment variables');
  }

  // First get the project key for the board
  const boardResp = await axios.get(`${JIRA_URL}/rest/agile/1.0/board/${boardId}`, {
    auth: { username: JIRA_USER, password: JIRA_TOKEN },
  });
  const projectKey = (boardResp.data as { location: { projectKey: string } }).location.projectKey;

  // Then search for epics in that project
  const jql = `project = "${projectKey}" AND issuetype in (Epic, Feature) ORDER BY created DESC`;
  const resp = await axios.get(`${JIRA_URL}/rest/api/3/search`, {
    auth: { username: JIRA_USER, password: JIRA_TOKEN },
    params: { jql, maxResults: 100 },
  });

  return ((resp.data as { issues: any[] }).issues || []).map((issue) => ({
    id: issue.id,
    key: issue.key,
    name: issue.fields.summary,
    summary: issue.fields.summary,
    done: issue.fields.status.statusCategory.key === 'done'
  }));
}

// New helpers for velocityService
export async function getClosedSprintsFromJira(boardId: string): Promise<JiraSprint[]> {
  return getSprintsFromJira(boardId, 'closed');
}

export async function getSprintIssuesWithAssignee(sprintId: number): Promise<any[]> {
  if (!JIRA_URL || !JIRA_USER || !JIRA_TOKEN) {
    throw new Error('Jira credentials are not set in environment variables');
  }
  const resp = await axios.get(`${JIRA_URL}/rest/agile/1.0/sprint/${sprintId}/issue`, {
    auth: { username: JIRA_USER, password: JIRA_TOKEN },
    params: { fields: 'assignee,created,customfield_10002' },
  });
  return ((resp.data as { issues: any[] }).issues) || [];
}

export async function getVelocityStatsFromJira(boardId: string): Promise<any> {
  if (!JIRA_URL || !JIRA_USER || !JIRA_TOKEN) {
    throw new Error('Jira credentials are not set in environment variables');
  }
  const resp = await axios.get(`${JIRA_URL}/rest/greenhopper/1.0/rapid/charts/velocity`, {
    auth: { username: JIRA_USER, password: JIRA_TOKEN },
    params: { rapidViewId: boardId },
  });
  return resp.data;
} 