import { fetchWithProxy } from '../utils/fetchWithProxy';
import { JiraProject, JiraVersion, JiraSprint, JiraIssue, JiraEpic, JiraIssueFields, JiraSprintState } from '../types/jira';

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
      console.warn(`Project not found: ${projectName}. Available projects: ${allProjects.map(p => p.key).join(', ')}`);
      return []; // Return empty array instead of throwing error
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
    return []; // Return empty array instead of throwing error
  }
}

export async function getSprintsFromJira(
  boardId: string, 
  state: string = 'active,closed,future',
  options?: {
    startDate?: string;
    endDate?: string;
    timezone?: string;
    sprintExcludeFilter?: string;
    sprintIncludeFilter?: string;
    originBoardId?: boolean;
  }
): Promise<JiraSprint[]> {
  if (!JIRA_URL || !JIRA_USER || !JIRA_TOKEN) {
    throw new Error('Jira credentials are not set in environment variables');
  }

  const {
    startDate,
    endDate,
    timezone = 'UTC',
    sprintExcludeFilter,
    sprintIncludeFilter,
    originBoardId = true
  } = options || {};

  const sprints: JiraSprint[] = [];
  let startAt = 0;
  const maxResults = 25; // Match Python optimization

  try {
    const credentials = validateJiraCredentials();
    
    // Convert string dates to timezone-aware datetime objects (Python equivalent)
    let startDateObj: Date | null = null;
    let endDateObj: Date | null = null;
    
    if (startDate) {
      startDateObj = new Date(startDate + 'T00:00:00.000Z');
    }
    if (endDate) {
      endDateObj = new Date(endDate + 'T23:59:59.999Z');
    }

    console.log(`[DEBUG] Fetching sprints for board ${boardId} with state: ${state}`);
    console.log(`[DEBUG] Date range: ${startDate} to ${endDate}`);
    console.log(`[DEBUG] Filters: exclude=${sprintExcludeFilter}, include=${sprintIncludeFilter}, originBoardId=${originBoardId}`);
    
    while (true) {
      try {
        const queryParams = new URLSearchParams({
          state,
          startAt: startAt.toString(),
          maxResults: maxResults.toString()
        });
        
        const apiUrl = `${credentials.url}/rest/agile/1.0/board/${boardId}/sprint?${queryParams}`;
        console.log(`[DEBUG] Making API call to: ${apiUrl}`);
        
        const sprintResponse = await fetchWithProxy(apiUrl, {
          auth: { username: credentials.user, password: credentials.token },
        });

        console.log(`[DEBUG] API response status: ${sprintResponse.status}`);
        
        if (!sprintResponse.ok) {
          console.error(`[DEBUG] API call failed with status ${sprintResponse.status}: ${sprintResponse.statusText}`);
          const errorText = await sprintResponse.text();
          console.error(`[DEBUG] Error response body:`, errorText);
          break;
        }

        const sprintData = await sprintResponse.json() as any;
        console.log(`[DEBUG] API response data:`, {
          valuesCount: sprintData.values?.length || 0,
          isLast: sprintData.isLast || false,
          maxResults: sprintData.maxResults || maxResults,
          startAt: sprintData.startAt || startAt
        });
        
        if (!sprintData.values || sprintData.values.length === 0) {
          console.log(`[DEBUG] No sprints found in response`);
          break;
        }

        // Process this batch immediately (Python equivalent)
        for (const sprint of sprintData.values) {
          // Skip if missing required fields (Python equivalent)
          if (!sprint.id || !sprint.name) {
            console.log(`[DEBUG] Skipping sprint with missing required fields:`, sprint);
            continue;
          }
          
          // Handle null/undefined dates properly
          const startDate = sprint.startDate || null;
          const endDate = sprint.endDate || null;
          
          // Skip sprints without dates (Python equivalent)
          if (!startDate || !endDate) {
            console.log(`[DEBUG] Skipping sprint without dates: ${sprint.id} - ${sprint.name} (startDate: ${startDate}, endDate: ${endDate})`);
            continue;
          }
          
          // Filter by origin board ID if requested (Python equivalent)
          if (originBoardId && sprint.originBoardId && parseInt(sprint.originBoardId.toString()) !== parseInt(boardId)) {
            console.log(`[DEBUG] Skipping sprint with different origin board ID: ${sprint.id} (origin: ${sprint.originBoardId}, current: ${boardId})`);
            continue;
          }
          
          // Filter by sprint name include filter (Python equivalent)
          if (sprintIncludeFilter && !sprint.name.includes(sprintIncludeFilter)) {
            console.log(`[DEBUG] Skipping sprint not matching include filter: ${sprint.id} - ${sprint.name}`);
            continue;
          }
          
          // Filter by sprint name exclude filter (Python equivalent)
          if (sprintExcludeFilter && sprint.name.includes(sprintExcludeFilter)) {
            console.log(`[DEBUG] Skipping sprint matching exclude filter: ${sprint.id} - ${sprint.name}`);
            continue;
          }

          // Parse sprint dates with timezone awareness (Python equivalent)
          try {
            const sprintStart = new Date(startDate);
            const sprintEnd = new Date(endDate);
            
            // Validate parsed dates
            if (isNaN(sprintStart.getTime()) || isNaN(sprintEnd.getTime())) {
              console.log(`[DEBUG] Skipping sprint with invalid dates: ${sprint.id} - ${sprint.name} (startDate: ${startDate}, endDate: ${endDate})`);
              continue;
            }
            
            // Check if sprint is within the date range (Python equivalent)
            if (startDateObj && endDateObj) {
              // Check if sprint overlaps with the date range
              if (sprintEnd < startDateObj || sprintStart > endDateObj) {
                console.log(`[DEBUG] Skipping sprint outside date range: ${sprint.id} - ${sprint.name}`);
                continue;
              }
              // Additional check: sprint must start after start date (Python equivalent)
              if (sprintStart <= startDateObj) {
                console.log(`[DEBUG] Skipping sprint starting before start date: ${sprint.id} - ${sprint.name}`);
                continue;
              }
            } else if (startDateObj) {
              if (sprintStart < startDateObj) {
                console.log(`[DEBUG] Skipping sprint starting before start date: ${sprint.id} - ${sprint.name}`);
                continue;
              }
            } else if (endDateObj) {
              if (sprintEnd > endDateObj) {
                console.log(`[DEBUG] Skipping sprint ending after end date: ${sprint.id} - ${sprint.name}`);
                continue;
              }
            }
            
            // Convert to JiraSprint format for consistency
            const processedSprint: JiraSprint = {
              id: sprint.id,
              name: sprint.name,
              state: sprint.state as JiraSprintState,
              startDate: startDate,
              endDate: endDate,
              completeDate: sprint.completeDate,
              originBoardId: sprint.originBoardId
            };
            
            // Add sprint to filtered results
            sprints.push(processedSprint);
            console.log(`[DEBUG] Added sprint: ${sprint.id} - ${sprint.name} (${startDate} to ${endDate})`);
            
          } catch (dateError) {
            console.error(`[DEBUG] Error parsing dates for sprint ${sprint.id}:`, dateError);
            continue;
          }
        }
        
        // Early termination if we've processed all sprints (Python equivalent)
        if (sprintData.isLast || sprintData.values.length < maxResults) {
          console.log(`[DEBUG] Reached end of sprints (isLast: ${sprintData.isLast}, values: ${sprintData.values.length})`);
          break;
        }
        
        startAt = (sprintData.startAt || startAt) + sprintData.values.length;
      } catch (error) {
        console.error(`[DEBUG] Error fetching sprints for board ${boardId}:`, error);
        break;
      }
    }

    console.log(`[DEBUG] Total filtered sprints found: ${sprints.length}`);
    
    // Sort sprints by start date (chronologically, Python equivalent)
    const sortedSprints = sprints.sort((firstSprint, secondSprint) => {
      const firstDate = firstSprint.startDate ? new Date(firstSprint.startDate).getTime() : 0;
      const secondDate = secondSprint.startDate ? new Date(secondSprint.startDate).getTime() : 0;
      return firstDate - secondDate; // Chronological order (Python equivalent)
    });
    
    return sortedSprints;
  } catch (error) {
    console.error(`[DEBUG] Error in getSprintsFromJira for board ${boardId}:`, error);
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

      const issueData = await issueResponse.json() as any;
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
    const boardData = await boardResponse.json() as { location?: { projectKey: string } };
    if (!boardData.location) {
      throw new Error(`Board ${boardId} has no location/project information`);
    }
    const projectKey = boardData.location.projectKey;

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

    const epicIssues = (await epicResponse.json() as { issues: JiraIssue[] }).issues || [];
    
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
export async function getBoardIdFromProjectKey(projectKey: string): Promise<string> {
  validateJiraCredentials();
  
  try {
    const credentials = validateJiraCredentials();
    
    // First, get all boards
    const boardsResponse = await fetchWithProxy(`${credentials.url}/rest/agile/1.0/board`, {
      auth: { username: credentials.user, password: credentials.token },
    });
    
    if (!boardsResponse.ok) {
      throw new Error(`Failed to fetch boards: ${boardsResponse.status} ${boardsResponse.statusText}`);
    }
    
    const boardsData = await boardsResponse.json() as { values: Array<{ id: number; location?: { projectKey: string } }> };
    
    // Find board for the project - handle boards without location
    const board = boardsData.values.find(b => b.location && b.location.projectKey === projectKey);
    
    if (!board) {
      console.error(`No board found for project key: ${projectKey}. Available boards:`, 
        boardsData.values.map(b => ({ id: b.id, location: b.location })));
      throw new Error(`No board found for project key: ${projectKey}. Please check if the project has any boards configured in Jira.`);
    }
    
    return board.id.toString();
  } catch (error) {
    console.error(`Error getting board ID for project ${projectKey}:`, error);
    throw error;
  }
}

export async function getClosedSprintsFromJira(boardIdOrProjectKey: string): Promise<JiraSprint[]> {
  // Check if boardIdOrProjectKey is numeric (board ID) or string (project key)
  const isNumeric = /^\d+$/.test(boardIdOrProjectKey);
  
  if (isNumeric) {
    // It's already a board ID
    return getSprintsFromJira(boardIdOrProjectKey, 'closed');
  } else {
    // It's a project key, need to get the board ID first
    const boardId = await getBoardIdFromProjectKey(boardIdOrProjectKey);
  return getSprintsFromJira(boardId, 'closed');
  }
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
    return ((await sprintIssuesResponse.json() as { issues: JiraIssue[] }).issues) || [];
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

export async function getVelocityStatsFromJira(boardIdOrProjectKey: string): Promise<JiraVelocityStats> {
  validateJiraCredentials();
  
  try {
    const credentials = validateJiraCredentials();
    
    // Check if boardIdOrProjectKey is numeric (board ID) or string (project key)
    const isNumeric = /^\d+$/.test(boardIdOrProjectKey);
    let boardId = boardIdOrProjectKey;
    
    if (!isNumeric) {
      // It's a project key, need to get the board ID first
      boardId = await getBoardIdFromProjectKey(boardIdOrProjectKey);
    }
    
    // Use the Jira REST API for velocity stats (GreenHopper API is deprecated, but this endpoint still works)
    const velocityResponse = await fetchWithProxy(`${credentials.url}/rest/greenhopper/1.0/rapid/charts/velocity?rapidViewId=${boardId}`, {
      auth: { username: credentials.user, password: credentials.token },
    });
    
    if (!velocityResponse.ok) {
      throw new Error(`Failed to fetch velocity stats: ${velocityResponse.status} ${velocityResponse.statusText}`);
    }
    
    return await velocityResponse.json() as JiraVelocityStats;
  } catch (error) {
    console.error(`Error fetching velocity stats for board/project ${boardIdOrProjectKey}:`, error);
    throw error;
  }
} 

/**
 * Get Jira release status for a version (Python equivalent)
 * Python: def get_jira_release_status(version_id):
 */
export async function getJiraReleaseStatus(versionId: string): Promise<string> {
  try {
    const credentials = validateJiraCredentials();
    
    // Get version details
    const versionResponse = await fetchWithProxy(`${credentials.url}/rest/api/3/version/${versionId}`, {
      auth: { username: credentials.user, password: credentials.token },
    });

    if (!versionResponse.ok) {
      return "On Track";
    }

    const version = await versionResponse.json() as { releaseDate?: string };
    
    if (!version.releaseDate) {
      return "No release date set";
    }

    const releaseDate = new Date(version.releaseDate);
    let startAt = 0;
    const maxResults = 1000;
    let onTrack = false;

    while (true) {
      const jqlQuery = `fixVersion = ${versionId} AND sprint is not EMPTY`;
      const issues = await getIssuesFromJira(jqlQuery);

      if (issues.length === 0) {
        break;
      }

      for (const issue of issues) {
        const sprints = issue.fields.customfield_10341;
        if (sprints) {
          for (const sprint of sprints as any[]) {
            if (sprint.endDate && sprint.state !== 'closed') {
              const sprintEndDate = new Date(sprint.endDate);
              if (sprintEndDate > releaseDate) {
                const daysDifference = Math.floor((sprintEndDate.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24));
                if (daysDifference <= 7) {
                  onTrack = true;
                } else {
                  return 'Off Track';
                }
              }
            }
          }
        }
      }

      if (issues.length < maxResults) {
        break;
      }
      startAt += maxResults;
    }

    return onTrack ? "On Track Threshold" : "On Track";
  } catch (error) {
    console.error(`Error getting release status for version ${versionId}:`, error);
    return "On Track";
  }
}

/**
 * Get project key by exact name (Python equivalent)
 * Python: def get_project_key_by_exact_name(project_name):
 */
export async function getProjectKeyByExactName(projectName: string): Promise<{ key: string | null; name: string | null }> {
  try {
    const credentials = validateJiraCredentials();
    
    // Get all projects
    const projectsResponse = await fetchWithProxy(`${credentials.url}/rest/api/3/project`, {
      auth: { username: credentials.user, password: credentials.token },
    });

    if (!projectsResponse.ok) {
      throw new Error(`Failed to fetch projects: ${projectsResponse.status}`);
    }

    const projects = await projectsResponse.json() as Array<{ key: string; name: string }>;
    
    // Look for exact match first (case-sensitive)
    const exactMatch = projects.find(p => p.name === projectName);
    if (exactMatch) {
      return { key: exactMatch.key, name: exactMatch.name };
    }
    
    // If no exact match, try case-insensitive exact match
    const caseInsensitiveMatch = projects.find(p => p.name.toLowerCase() === projectName.toLowerCase());
    if (caseInsensitiveMatch) {
      return { key: caseInsensitiveMatch.key, name: caseInsensitiveMatch.name };
    }
    
    console.log(`No exact match found for project name: '${projectName}'`);
    return { key: null, name: null };
  } catch (error) {
    console.error(`Error finding project:`, error);
    return { key: null, name: null };
  }
}

/**
 * Get Jira status categories for a project (Python equivalent)
 * Python: def get_jira_status_categories(project_key):
 */
export async function getJiraStatusCategories(projectKey: string): Promise<{
  'To Do': string[];
  'In Progress': string[];
  'Done': string[];
}> {
  const statusCategories = {
    'To Do': [] as string[],
    'In Progress': [] as string[],
    'Done': [] as string[]
  };

  try {
    const credentials = validateJiraCredentials();
    
    // Get project configuration (includes workflow info)
    const projectConfigResponse = await fetchWithProxy(`${credentials.url}/rest/api/3/project/${projectKey}/statuses`, {
      auth: { username: credentials.user, password: credentials.token },
    });

    if (!projectConfigResponse.ok) {
      throw new Error(`Failed to fetch project statuses: ${projectConfigResponse.status}`);
    }

    const projectConfig = await projectConfigResponse.json() as Array<{ statuses: Array<{ name: string; statusCategory: { key: string } }> }>;
    
    // Process each status configuration
    for (const statusConfig of projectConfig) {
      for (const status of statusConfig.statuses || []) {
        const statusName = status.name;
        const categoryKey = status.statusCategory?.key || 'unknown';
        
        // Map category key to our categories
        if (categoryKey === 'new') {
          statusCategories['To Do'].push(statusName);
        } else if (categoryKey === 'indeterminate') {
          statusCategories['In Progress'].push(statusName);
        } else if (categoryKey === 'done') {
          statusCategories['Done'].push(statusName);
        }
      }
    }
  } catch (error) {
    console.error(`Error getting project statuses:`, error);
    console.log("Falling back to getting all statuses (not project-specific)");
  }

  return statusCategories;
}

/**
 * Custom date formatting utility (Python equivalent)
 * Python: def custom_date(date_format, t):
 */
export function customDate(dateFormat: string, date: Date): string {
  const suffix = (d: number): string => {
    if (d >= 11 && d <= 13) return 'th';
    const lastDigit = d % 10;
    switch (lastDigit) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  return dateFormat.replace('{S}', date.getDate() + suffix(date.getDate()));
}

/**
 * Parse date utility (Python equivalent)
 * Python: def parse_date(date_string):
 */
export function parseDate(dateString: string): Date {
  return new Date(dateString);
} 

/**
 * Get release plan for a project (Python equivalent)
 * Python: def get_release_plan(name):
 */
export async function getReleasePlan(projectName: string): Promise<Array<{
  projectKey: string;
  projectName: string;
  version: string;
  startDate: string;
  endDate: string;
  status: string;
  track: string;
}>> {
  try {
    const credentials = validateJiraCredentials();
    
    // Get all projects
    const projectsResponse = await fetchWithProxy(`${credentials.url}/rest/api/3/project`, {
      auth: { username: credentials.user, password: credentials.token },
    });

    if (!projectsResponse.ok) {
      throw new Error(`Failed to fetch projects: ${projectsResponse.status}`);
    }

    const projects = await projectsResponse.json() as Array<{ key: string; name: string }>;
    const releaseData: Array<{
      projectKey: string;
      projectName: string;
      version: string;
      startDate: string;
      endDate: string;
      status: string;
      track: string;
    }> = [];

    for (const project of projects) {
      if (project.name === projectName) {
        // Get project versions
        const versionsResponse = await fetchWithProxy(`${credentials.url}/rest/api/3/project/${project.key}/versions`, {
          auth: { username: credentials.user, password: credentials.token },
        });

        if (!versionsResponse.ok) {
          continue;
        }

        const versions = await versionsResponse.json() as Array<{
          id: string;
          name: string;
          releaseDate?: string;
          startDate?: string;
          released: boolean;
          overdue: boolean;
        }>;

        for (const version of versions) {
          if (version.releaseDate || version.startDate) {
            const startDate = version.startDate || 'N/A';
            const endDate = version.releaseDate || 'N/A';
            const status = version.released ? 'Released' : 'Unreleased';
            const track = version.released ? 'On Track' : await getJiraReleaseStatus(version.id);

            releaseData.push({
              projectKey: project.key,
              projectName: project.name,
              version: version.name,
              startDate,
              endDate,
              status,
              track
            });
          }
        }
        break;
      }
    }

    return releaseData;
  } catch (error) {
    console.error(`Error getting release plan for project ${projectName}:`, error);
    return [];
  }
} 