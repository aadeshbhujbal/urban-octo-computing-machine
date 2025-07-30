import { JiraIssue } from '../types/jira';

export interface StoryPointBreakdown {
  total: number;
  completed: number;
  inProgress: number;
  toDo: number;
}

export interface StoryPointStatus {
  completed: number;
  inProgress: number;
  toDo: number;
}

export const STORY_POINT_STATUSES = {
  completed: ['Done', 'Closed', 'Resolved'],
  inProgress: ['In Progress', 'In Development'],
  toDo: ['To Do', 'Open', 'New']
} as const;

/**
 * Process story points to match Python logic exactly
 * Python: def process_story_points(story_points):
 *     if story_points % 1 == 0:
 *         story_points = int(story_points)
 *     return story_points
 */
export function processStoryPoints(storyPoints: number | undefined): number {
  if (storyPoints === undefined || storyPoints === null) {
    return 0;
  }
  if (storyPoints % 1 === 0) {
    return Math.floor(storyPoints);
  }
  return storyPoints;
}

/**
 * Update story points logic matching Python implementation
 * Python: def update_story_points(child_key, child_status, issue, parent_key, snc_issues, project_sprints, sprint):
 */
export function updateStoryPoints(
  issue: any,
  projectSprints: number[],
  sprint?: number
): {
  storyPoints: number;
  shouldInclude: boolean;
  childKey: string;
  childStatus: string;
  parentKey: string;
} {
  // Get story points with fallback to 5 (Python equivalent)
  let storyPoints = issue.fields?.customfield_10002 || 5;
  storyPoints = storyPoints >= 0 ? storyPoints : 5;
  
  // Process story points (Python equivalent)
  storyPoints = processStoryPoints(storyPoints);
  
  const childKey = issue.key;
  const childStatus = issue.fields?.status?.name || '';
  const parentKey = issue.fields?.parent?.key || '';
  
  let shouldInclude = false;
  
  if (sprint === undefined) {
    // No specific sprint - check if issue belongs to current PI
    let nextPi = false;
    const sprintField = issue.fields?.customfield_10341;
    
    if (sprintField) {
      for (const sprintItem of sprintField) {
        if (!projectSprints.includes(sprintItem.id) && 
            (sprintItem.state === 'active' || sprintItem.state === 'future')) {
          nextPi = true;
          break;
        }
      }
    }
    
    if (!nextPi) {
      shouldInclude = true;
    }
  } else {
    // Specific sprint - check if issue belongs to this sprint
    const sprintField = issue.fields?.customfield_10341;
    if (sprintField) {
      const sprintIds = sprintField.map((s: any) => s.id).filter((id: number) => id !== undefined);
      if (sprintIds.length > 0) {
        const maxSprintId = Math.max(...sprintIds);
        
        if (projectSprints.includes(maxSprintId) && maxSprintId === sprint) {
          shouldInclude = true;
        }
      }
    }
  }
  
  return {
    storyPoints,
    shouldInclude,
    childKey,
    childStatus,
    parentKey
  };
}

/**
 * Get story point breakdown for a single issue
 */
export function getIssueStoryPointBreakdown(issue: JiraIssue): StoryPointStatus {
  const storyPoints = processStoryPoints(issue.fields.customfield_10002);
  const status = (issue.fields.status?.name || '').toLowerCase();
  
  const completed = STORY_POINT_STATUSES.completed.map(statusItem => statusItem.toLowerCase()).includes(status) ? storyPoints : 0;
  const inProgress = STORY_POINT_STATUSES.inProgress.map(statusItem => statusItem.toLowerCase()).includes(status) ? storyPoints : 0;
  const toDo = STORY_POINT_STATUSES.toDo.map(statusItem => statusItem.toLowerCase()).includes(status) ? storyPoints : 0;
  
  return { completed, inProgress, toDo };
}

/**
 * Calculate story point breakdown for a collection of issues
 */
export function calculateStoryPointBreakdown(issues: JiraIssue[]): StoryPointBreakdown {
  let total = 0;
  let completed = 0;
  let inProgress = 0;
  let toDo = 0;

  for (const issue of issues) {
    const storyPoints = processStoryPoints(issue.fields.customfield_10002);
    total += storyPoints;
    
    const breakdown = getIssueStoryPointBreakdown(issue);
    completed += breakdown.completed;
    inProgress += breakdown.inProgress;
    toDo += breakdown.toDo;
  }

  return { total, completed, inProgress, toDo };
}

/**
 * Calculate story point breakdown grouped by a key function
 */
export function calculateGroupedStoryPointBreakdown<T>(
  issues: JiraIssue[],
  groupKey: (issue: JiraIssue) => T
): Map<T, StoryPointBreakdown> {
  const groupedBreakdown = new Map<T, StoryPointBreakdown>();

  for (const issue of issues) {
    const groupKeyValue = groupKey(issue);
    const storyPoints = processStoryPoints(issue.fields.customfield_10002);
    const issueBreakdown = getIssueStoryPointBreakdown(issue);

    if (!groupedBreakdown.has(groupKeyValue)) {
      groupedBreakdown.set(groupKeyValue, { total: 0, completed: 0, inProgress: 0, toDo: 0 });
    }

    const currentBreakdown = groupedBreakdown.get(groupKeyValue)!;
    currentBreakdown.total += storyPoints;
    currentBreakdown.completed += issueBreakdown.completed;
    currentBreakdown.inProgress += issueBreakdown.inProgress;
    currentBreakdown.toDo += issueBreakdown.toDo;
  }

  return groupedBreakdown;
}

/**
 * Calculate RAG status based on completion percentage
 */
export function calculateRagStatus(completed: number, total: number): string {
  if (total === 0) return 'Red';
  
  const percentage = (completed / total) * 100;
  if (percentage > 90) return 'Green';
  if (percentage >= 80) return 'Amber';
  return 'Red';
}

/**
 * Calculate completion percentage
 */
export function calculateCompletionPercentage(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * Get sprint ID from issue's sprint field
 */
export function getSprintIdFromIssue(issue: JiraIssue): string | null {
  const sprintArr = issue.fields.customfield_10341 || [];
  return sprintArr.length > 0 ? sprintArr[sprintArr.length - 1]?.id?.toString() || null : null;
}

/**
 * Get epic key from issue
 */
export function getEpicKeyFromIssue(issue: JiraIssue): string {
  return issue.fields.parent?.key || 'No Epic';
}

/**
 * Calculate added story points (issues created after a specific date)
 */
export function calculateAddedStoryPoints(issues: JiraIssue[], afterDate: Date): number {
  let totalAddedStoryPoints = 0;
  
  for (const issue of issues) {
    const issueCreatedDate = new Date(issue.fields.created || '');
    if (issueCreatedDate > afterDate) {
      totalAddedStoryPoints += processStoryPoints(issue.fields.customfield_10002);
    }
  }
  
  return totalAddedStoryPoints;
}

/**
 * Calculate team members count from issues
 */
export function calculateTeamMembersCount(issues: JiraIssue[]): number {
  const uniqueAssigneeIds = new Set(
    issues
      .map(issue => issue.fields.assignee?.accountId)
      .filter((assigneeId): assigneeId is string => Boolean(assigneeId))
  );
  return uniqueAssigneeIds.size || 15; // Default to 15 if no team members found
} 