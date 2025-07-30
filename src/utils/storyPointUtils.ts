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
 * Process story points from various formats (number, string, etc.)
 * Ensures consistent handling across all services
 */
export function processStoryPoints(storyPoints: number | string | undefined): number {
  if (typeof storyPoints === 'number') {
    return Number.isInteger(storyPoints) ? storyPoints : Math.round(storyPoints);
  }
  if (typeof storyPoints === 'string') {
    const parsed = parseFloat(storyPoints);
    return isNaN(parsed) ? 0 : Math.round(parsed);
  }
  return 0;
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