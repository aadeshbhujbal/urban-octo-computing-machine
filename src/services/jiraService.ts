import { fetchWithProxy } from '../utils/fetchWithProxy';
import { JiraProject, JiraVersion, JiraSprint, JiraIssue, JiraEpic, JiraIssueFields } from '../types/jira';

const JIRA_URL = process.env.JIRA_URL;
const JIRA_USER = process.env.JIRA_USER;
const JIRA_TOKEN = process.env.JIRA_TOKEN;

interface JiraCredentials {
  url: string;
  user: string;
  token: string;
}

function validateJiraCredentials(): JiraCredentials {
  if (!JIRA_URL || !JIRA_USER || !JIRA_TOKEN) {
    throw new Error('Jira credentials are not set in environment variables');
  }
  return { 
    url: JIRA_URL, 
    user: JIRA_USER, 
    token: JIRA_TOKEN 
  };
}

export async function getReleasesFromJira(projectName?: string): Promise<JiraVersion[]> {
  validateJiraCredentials();

  try {
    const credentials = validateJiraCredentials();
    
    // 1. Get all projects
    const projectsResponse = await fetchWithProxy(`${credentials.url}/rest/api/3/project`, {
      auth: { username: credentials.user, password: credentials.token },
    });
    const allProjects = await projectsResponse.json() as JiraProject[];

    // 2. Find project by name or key (case-insensitive)
    const targetProject = allProjects.find((project) =>
      projectName
        ? project.name.toLowerCase() === projectName.toLowerCase() ||
          project.key.toLowerCase() === projectName.toLowerCase()
        : true
    );
    if (!targetProject) {
      throw new Error(`Project not found: ${projectName}`);
    }

    // 3. Get versions (releases) for the project
    const versionsResponse = await fetchWithProxy(`${credentials.url}/rest/api/3/project/${targetProject.key}/versions`, {
      auth: { username: credentials.user, password: credentials.token },
    });
    const projectVersions = await versionsResponse.json() as JiraVersion[];

    // 4. Get detailed version information for each version
    const detailedVersions = await Promise.all(
      projectVersions.map(async (version) => {
        try {
          const versionResponse = await fetchWithProxy(`${credentials.url}/rest/api/3/version/${version.id}`, {
            auth: { username: credentials.user, password: credentials.token },
          });
          return await versionResponse.json() as JiraVersion;
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
  } catch (error) {
    console.error(`Error fetching releases for project ${projectName}:`, error);
    throw error;
  }
}

export async function getSprintsFromJira(boardId: string, state: string = 'active,closed,future'): Promise<JiraSprint[]> {
  validateJiraCredentials();

  const sprints: JiraSprint[] = [];
  let startAt = 0;
  const maxResults = 50;

  try {
    const credentials = validateJiraCredentials();
    
    while (true) {
      try {
        const queryParams = new URLSearchParams({
          state,
          startAt: startAt.toString(),
          maxResults: maxResults.toString()
        });
        
        const sprintResponse = await fetchWithProxy(`${credentials.url}/rest/agile/1.0/board/${boardId}/sprint?${queryParams}`, {
          auth: { username: credentials.user, password: credentials.token },
        });

        const sprintData = await sprintResponse.json() as JiraSprintListResponse;
        if (!sprintData.values || sprintData.values.length === 0) break;

        sprints.push(...sprintData.values);
        
        if (sprintData.isLast) break;
        startAt += sprintData.values.length;
      } catch (error) {
        console.error(`Error fetching sprints for board ${boardId}:`, error);
        break;
      }
    }

    // Sort sprints by start date
    return sprints.sort((sprintA, sprintB) => {
      const sprintADate = sprintA.startDate ? new Date(sprintA.startDate).getTime() : 0;
      const sprintBDate = sprintB.startDate ? new Date(sprintB.startDate).getTime() : 0;
      return sprintBDate - sprintADate; // Most recent first
    });
  } catch (error) {
    console.error(`Error in getSprintsFromJira for board ${boardId}:`, error);
    throw error;
  }
}

export async function getIssuesFromJira(jql: string): Promise<JiraIssue[]> {
  if (!JIRA_URL || !JIRA_USER || !JIRA_TOKEN) {
    throw new Error('Jira credentials are not set in environment variables');
  }

  const issues: JiraIssue[] = [];
  let startAt = 0;
  const maxResults = 1000;

  try {
    const credentials = validateJiraCredentials();
    
    while (true) {
      const requiredFields = [
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
      ];
      
      const queryParams = new URLSearchParams({
        jql,
        startAt: startAt.toString(),
        maxResults: maxResults.toString(),
        fields: requiredFields.join(',')
      });
      
      const issueResponse = await fetchWithProxy(`${credentials.url}/rest/api/3/search?${queryParams}`, {
        auth: { username: credentials.user, password: credentials.token },
      });

      const issueData = await issueResponse.json() as JiraSearchResponse;
      if (!issueData.issues || issueData.issues.length === 0) break;

      issues.push(...issueData.issues);
      if (issueData.issues.length < maxResults) break;
      startAt += maxResults;
    }

    return issues;
  } catch (error) {
    console.error(`Error fetching issues with JQL: ${jql}`, error);
    throw error;
  }
}

export async function getEpicsFromJira(boardId: string): Promise<JiraEpic[]> {
  if (!JIRA_URL || !JIRA_USER || !JIRA_TOKEN) {
    throw new Error('Jira credentials are not set in environment variables');
  }

  try {
    const credentials = validateJiraCredentials();
    
    // Get the project key for the board
    const boardResponse = await fetchWithProxy(`${credentials.url}/rest/agile/1.0/board/${boardId}`, {
      auth: { username: credentials.user, password: credentials.token },
    });
    const projectKey = (await boardResponse.json() as JiraBoardResponse).location.projectKey;

    // Search for epics in that project
    const epicJql = `project = "${projectKey}" AND issuetype in (Epic, Feature) ORDER BY created DESC`;
    const epicFields = [
      'summary',
      'status',
      'customfield_10002',
      'parent',
      'assignee',
      'created',
      'updated',
      'customfield_10341',
      'customfield_30160',
      'customfield_42105',
      'customfield_20046',
      'customfield_30195',
      'issuetype',
      'project',
      'description'
    ];
    
    const queryParams = new URLSearchParams({
      jql: epicJql, 
      maxResults: '100',
      fields: epicFields.join(',')
    });
    
    const epicResponse = await fetchWithProxy(`${credentials.url}/rest/api/3/search?${queryParams}`, {
      auth: { username: credentials.user, password: credentials.token },
    });

    const epicIssues = (await epicResponse.json() as JiraSearchResponse).issues || [];
    
    // Convert JiraIssue to JiraEpic format
    return epicIssues.map((epicIssue: JiraIssue): JiraEpic => ({
      id: epicIssue.id,
      key: epicIssue.key,
      fields: epicIssue.fields
    }));
  } catch (error) {
    console.error(`Error fetching epics for board ${boardId}:`, error);
    throw error;
  }
}

// New helpers for velocityService
export async function getClosedSprintsFromJira(boardId: string): Promise<JiraSprint[]> {
  return getSprintsFromJira(boardId, 'closed');
}

export async function getSprintIssuesWithAssignee(sprintId: number): Promise<JiraIssue[]> {
  validateJiraCredentials();
  
  try {
    const credentials = validateJiraCredentials();
    
    const queryParams = new URLSearchParams({
      fields: 'assignee,created,customfield_10002,summary,status,issuetype,project'
    });
    
    const sprintIssuesResponse = await fetchWithProxy(`${credentials.url}/rest/agile/1.0/sprint/${sprintId}/issue?${queryParams}`, {
      auth: { username: credentials.user, password: credentials.token },
    });
    return ((await sprintIssuesResponse.json() as JiraSearchResponse).issues) || [];
  } catch (error) {
    console.error(`Error fetching sprint issues for sprint ${sprintId}:`, error);
    throw error;
  }
}

export interface JiraVelocityStats {
  velocityStatEntries: Record<string, {
    estimated: { value: number };
    completed: { value: number };
  }>;
  sprints: JiraSprint[];
}

export interface JiraSearchResponse {
  issues: JiraIssue[];
  total: number;
  startAt: number;
  maxResults: number;
}

export interface JiraSprintListResponse {
  values: JiraSprint[];
  isLast: boolean;
  maxResults: number;
  startAt: number;
}

export interface JiraBoardResponse {
  location: {
    projectKey: string;
    projectName: string;
  };
}

export async function getVelocityStatsFromJira(boardId: string): Promise<JiraVelocityStats> {
  validateJiraCredentials();
  
  try {
    const credentials = validateJiraCredentials();
    
    const queryParams = new URLSearchParams({
      rapidViewId: boardId
    });
    
    const velocityResponse = await fetchWithProxy(`${credentials.url}/rest/greenhopper/1.0/rapid/charts/velocity?${queryParams}`, {
      auth: { username: credentials.user, password: credentials.token },
    });
    return await velocityResponse.json() as JiraVelocityStats;
  } catch (error) {
    console.error(`Error fetching velocity stats for board ${boardId}:`, error);
    throw error;
  }
} 