import { 
  getSprintsFromJira, 
  getProjectKeyByExactName, 
  getJiraStatusCategories,
  getIssuesFromJira,
  getReleasesFromJira
} from './jiraService';

// Extend JiraIssueFields to include additional fields
interface ExtendedJiraIssueFields {
  storyPoints?: number;
  epic?: { key: string };
  sprint?: Array<{
    id: number;
    state: string;
    startDate: string;
    endDate: string;
    name: string;
  }>;
  customfield_10002?: number;  // Story points field
  customfield_10341?: Array<{  // Sprint field
    id: number;
    state: string;
    startDate: string;
    endDate: string;
    name: string;
  }>;
  parent?: { key: string };
  status?: { name: string };
}

interface PiPlanningOptions {
  projectName: string;
  boardId: string;
  piStartDate: string;
  piEndDate: string;
  sprintExcludeFilter?: string;
  sprintIncludeFilter?: string;
}

interface SprintDetails {
  startDate: Date;
  endDate: Date;
  name: string;
}

interface PiPlanningResult {
  projectSprints: string[];
  totalStoryPoints: number;
  completedStoryPoints: number;
  inProgressStoryPoints: number;
  toDoStoryPoints: number;
  piEpics: string[];
  releases: any[];
  currentSprints: string[];
  sprints: Record<string, SprintDetails>;
}

export async function getPiPlanningData(options: PiPlanningOptions): Promise<PiPlanningResult> {
  const {
    projectName,
    boardId,
    piStartDate,
    piEndDate,
    sprintExcludeFilter,
    sprintIncludeFilter
  } = options;

  try {
    // 1. Get project key and status categories
    const { key: projectKey } = await getProjectKeyByExactName(projectName);
    if (!projectKey) {
      throw new Error(`Project not found: ${projectName}`);
    }

    // Get status categories with proper error handling
    const statusCategories = await getJiraStatusCategories(projectKey);
    if (!statusCategories) {
      throw new Error(`Failed to get status categories for project: ${projectKey}`);
    }
    
    // Match Python's status category names
    const openStatusList = statusCategories['To Do'] || [];
    const inProgressStatusList = statusCategories['In Progress'] || [];
    const doneStatusList = statusCategories['Done'] || [];
    
    // Validate we have at least some statuses
    if (!openStatusList.length && !inProgressStatusList.length && !doneStatusList.length) {
      throw new Error(`No status categories found for project: ${projectKey}`);
    }

    // 2. Get sprints for the PI with proper timezone handling
    const sprints = await getSprintsFromJira(boardId, 'active,closed,future', {
      startDate: piStartDate,
      endDate: piEndDate,
      timezone: 'UTC',  // Match Python's timezone handling
      sprintExcludeFilter,
      sprintIncludeFilter,
      originBoardId: true  // Match Python's default behavior
    });

    if (!sprints.length) {
      // Try again without origin board ID check
      const sprintsWithoutOrigin = await getSprintsFromJira(boardId, 'active,closed,future', {
        startDate: piStartDate,
        endDate: piEndDate,
        sprintExcludeFilter,
        sprintIncludeFilter,
        originBoardId: false
      });
      
      if (!sprintsWithoutOrigin.length) {
        throw new Error('No sprints found for the given date range');
      }
      sprints.push(...sprintsWithoutOrigin);
    }

    const projectSprints = sprints.map(sprint => sprint.id.toString());

    // 3. Get issues for the sprints
    // Build JQL query matching Python's implementation
    const issueTypes = ['Story', 'Bug', 'User Story', 'Task', 'Sub-task'];
    const jql = `project = "${projectName}" AND issuetype in (${issueTypes.map(t => `"${t}"`).join(',')}) AND Sprint in (${projectSprints.join(',')}) ORDER BY Rank ASC`;

  const issues = await getIssuesFromJira(jql);

    // 4. Process issues
    let totalStoryPoints = 0;
    let completedStoryPoints = 0;
    let inProgressStoryPoints = 0;
    let toDoStoryPoints = 0;
    const piEpics = new Set<string>();
    const currentSprints = new Set<string>();
    const sprintDetails: Record<string, any> = {};

    for (const issue of issues as Array<{ fields: ExtendedJiraIssueFields; key: string }>) {
      // Get story points (default to 0 if not set, matching Python)
      const storyPoints = issue.fields.storyPoints || issue.fields.customfield_10002 || 0;
      
      // Track epic
      if (issue.fields.parent) {
        piEpics.add(issue.fields.parent.key);
      } else if (issue.fields.epic) {
        piEpics.add(issue.fields.epic.key);
      }

      // Track sprints - handle both customfield and standard field
      const issueSprints = (issue.fields.sprint || issue.fields.customfield_10341 || []) as Array<{
        id: number;
        state: string;
        startDate: string;
        endDate: string;
        name: string;
      }>;

      for (const sprint of issueSprints) {
        if (sprint.state === 'active') {
          currentSprints.add(sprint.id.toString());
        }

        const sprintId = sprint.id.toString();
        if (projectSprints.includes(sprintId)) {
          if (!sprintDetails[sprintId]) {
            sprintDetails[sprintId] = {
              startDate: new Date(sprint.startDate),
              endDate: new Date(sprint.endDate),
              name: sprint.name
            };
          }
        }
      }

      // Track story points by status
      const statusName = issue.fields.status?.name;
      if (statusName) {
        if (doneStatusList.includes(statusName)) {
          completedStoryPoints += storyPoints;
        } else if (inProgressStatusList.includes(statusName)) {
          inProgressStoryPoints += storyPoints;
        } else {
          toDoStoryPoints += storyPoints;
        }
      }

      totalStoryPoints += storyPoints;
    }

    // 5. Get releases
    const releases = await getReleasesFromJira(projectName);

    // 6. Return results
    return {
      projectSprints,
      totalStoryPoints: Math.round(totalStoryPoints),
      completedStoryPoints: Math.round(completedStoryPoints),
      inProgressStoryPoints: Math.round(inProgressStoryPoints),
      toDoStoryPoints: Math.round(toDoStoryPoints),
      piEpics: Array.from(piEpics),
      releases,
      currentSprints: Array.from(currentSprints),
      sprints: sprintDetails
    };

  } catch (error) {
    console.error('Error in getPiPlanningData:', error);
    throw error;
  }
} 