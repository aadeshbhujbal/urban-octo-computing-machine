import { getReleasesFromJira, getSprintsFromJira, getIssuesFromJira } from './jiraService';
import { PiPlanningSummaryOptions, EpicAdvancedAnalytics } from '../types/piPlanning';
import { 
  processStoryPoints, 
  calculateStoryPointBreakdown, 
  calculateGroupedStoryPointBreakdown,
  calculateRagStatus,
  calculateCompletionPercentage,
  getSprintIdFromIssue,
  getEpicKeyFromIssue
} from '../utils/storyPointUtils';



function parseDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  // Jira dates are usually ISO 8601
  return new Date(dateStr);
}

function getEpicRag(completed: number, total: number): string {
  if (total === 0) return 'Red';
  const pct = (completed / total) * 100;
  if (pct > 90) return 'Green';
  if (pct >= 80) return 'Amber';
  return 'Red';
}

export async function piPlanningSummaryService(options: PiPlanningSummaryOptions) {
  const { project, boardId, piStartDate, piEndDate } = options;

  console.log(`[DEBUG] PI Planning - Project: ${project}, Board: ${boardId}, PI Dates: ${piStartDate} to ${piEndDate}`);

  // 1. Fetch releases for the project
  const releases = await getReleasesFromJira(project);
  console.log(`[DEBUG] PI Planning - Found ${releases.length} releases`);

  // 2. Fetch sprints for the board
  const sprints = await getSprintsFromJira(boardId);
  console.log(`[DEBUG] PI Planning - Found ${sprints.length} total sprints`);

  // 3. Filter sprints by PI date range (if dates are provided)
  const filteredSprints = sprints.filter(sprint => {
    if (!sprint.startDate || !sprint.endDate) return false;
    const sprintStartDate = new Date(sprint.startDate);
    const sprintEndDate = new Date(sprint.endDate);
    const piStartDateObj = new Date(piStartDate);
    const piEndDateObj = new Date(piEndDate);
    
    // Include sprints that overlap with the PI period
    const overlaps = (sprintStartDate <= piEndDateObj && sprintEndDate >= piStartDateObj);
    console.log(`[DEBUG] Sprint ${sprint.name} (${sprint.startDate} to ${sprint.endDate}) overlaps with PI: ${overlaps}`);
    return overlaps;
  });

  console.log(`[DEBUG] PI Planning - Found ${filteredSprints.length} sprints in PI date range`);

  // Check if we have any sprints in the PI date range
  if (filteredSprints.length === 0) {
    return {
      releases,
      sprints: [],
      issues: [],
      storyPoints: 0,
      completedStoryPoints: 0,
      inProgressStoryPoints: 0,
      toDoStoryPoints: 0,
      completedPercentage: 0,
      ragStatus: 'Red',
      epicBreakdown: {},
      sprintBreakdown: {},
      currentSprints: [],
      previousSprints: [],
      futureSprints: [],
      currentSprintStats: { groupTotal: 0, groupCompleted: 0, groupInProgress: 0, groupToDo: 0 },
      previousSprintStats: { groupTotal: 0, groupCompleted: 0, groupInProgress: 0, groupToDo: 0 },
      futureSprintStats: { groupTotal: 0, groupCompleted: 0, groupInProgress: 0, groupToDo: 0 },
      burnup: [],
      storyPointsCurrent: 0,
      epicProgress: {},
      raid: {},
      wsjf: {},
      piScope: {},
      progress: {}
    };
  }

  // 4. Fetch issues for the project and filtered sprints
  const sprintIds = filteredSprints.map(sprint => sprint.id);
  const sprintClause = sprintIds.length > 0 ? `OR Sprint in (${sprintIds.join(',')})` : '';
  
  const jql = `project = "${project}" 
    AND issuetype in (Story, Bug, "User Story", Task) 
    AND (
      (created >= "${piStartDate}" AND created <= "${piEndDate}")
      OR (updated >= "${piStartDate}" AND updated <= "${piEndDate}")
      OR (resolutiondate >= "${piStartDate}" AND resolutiondate <= "${piEndDate}")
      ${sprintClause}
    )`;
  

  const issues = await getIssuesFromJira(jql);

  // 5. Calculate story points and group by status using shared utilities
  const breakdown = calculateStoryPointBreakdown(issues);
  
  // Epic and sprint breakdowns using shared utilities
  const epicBreakdown = calculateGroupedStoryPointBreakdown(issues, getEpicKeyFromIssue);
  const sprintBreakdown = calculateGroupedStoryPointBreakdown(issues, getSprintIdFromIssue);

  // Convert Maps to Records for compatibility
  const epicStoryPoints: Record<string, { completed: number; inProgress: number; toDo: number; total: number }> = {};
  const sprintStoryPoints: Record<string, { completed: number; inProgress: number; toDo: number; total: number }> = {};

  for (const [epic, data] of epicBreakdown) {
    epicStoryPoints[epic] = data;
  }

  for (const [sprintId, data] of sprintBreakdown) {
    sprintStoryPoints[sprintId || 'No Sprint'] = data;
  }

  // 6. Calculate RAG status using shared utilities
  const completedPercentage = calculateCompletionPercentage(breakdown.completed, breakdown.total);
  const ragStatus = calculateRagStatus(breakdown.completed, breakdown.total);

  // 7. Identify current, previous, and future sprints
  const today = new Date();
  const currentSprints = filteredSprints.filter(sprint => {
    const start = parseDate(sprint.startDate);
    const end = parseDate(sprint.endDate);
    return start && end && start <= today && today <= end;
  });
  const previousSprints = filteredSprints.filter(sprint => {
    const end = parseDate(sprint.endDate);
    return end && end < today;
  });
  const futureSprints = filteredSprints.filter(sprint => {
    const start = parseDate(sprint.startDate);
    return start && start > today;
  });

  // 8. Calculate stats for each group using shared utilities
  function calculateSprintGroupStats(sprintGroup: typeof filteredSprints) {
    const sprintIds = new Set(sprintGroup.map(sprint => sprint.id));
    const groupIssues = issues.filter(issue => {
      const issueSprintId = getSprintIdFromIssue(issue);
      return issueSprintId && sprintIds.has(parseInt(issueSprintId));
    });
    const groupBreakdown = calculateStoryPointBreakdown(groupIssues);
    return { 
      groupTotal: groupBreakdown.total, 
      groupCompleted: groupBreakdown.completed, 
      groupInProgress: groupBreakdown.inProgress, 
      groupToDo: groupBreakdown.toDo 
    };
  }

  const currentSprintStats = calculateSprintGroupStats(currentSprints);
  const previousSprintStats = calculateSprintGroupStats(previousSprints);
  const futureSprintStats = calculateSprintGroupStats(futureSprints);

  // 9. Calculate story points progress over time (burn-up)
  const burnupData: Array<{ date: string; completed: number }> = [];
  let cumulativeCompletedStoryPoints = 0;
  const chronologicallySortedSprints = [...filteredSprints].sort((firstSprint, secondSprint) => (firstSprint.startDate || '').localeCompare(secondSprint.startDate || ''));
  for (const sprint of chronologicallySortedSprints) {
    const sprintId = sprint.id;
    const sprintCompletedStoryPoints = sprintStoryPoints[sprintId]?.completed || 0;
    cumulativeCompletedStoryPoints += sprintCompletedStoryPoints;
    burnupData.push({ date: sprint.endDate || '', completed: cumulativeCompletedStoryPoints });
  }

  // 10. Calculate expected story points by now (story_points_current)
  let storyPointsCurrent = 0;
  let totalDays = 0;
  let daysPast = 0;
  for (const sprint of chronologicallySortedSprints) {
    const start = parseDate(sprint.startDate);
    const end = parseDate(sprint.endDate);
    if (!start || !end) continue;
    const sprintDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    totalDays += sprintDays;
    if (today > end) {
      daysPast += sprintDays;
    } else if (today >= start && today <= end) {
      daysPast += Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
  }
  if (totalDays > 0) {
    storyPointsCurrent = Math.round((daysPast / totalDays) * breakdown.total);
  }

  // 11. Advanced analytics: fetch RAID, WSJF, PI Scope, Progress for each epic
  const epicAdvanced: Record<string, EpicAdvancedAnalytics> = {};
  const epicKeys = Object.keys(epicStoryPoints).filter(epicKey => epicKey !== 'No Epic');
  if (epicKeys.length > 0) {
    // Fetch all epics in one JQL call
    const epicJql = `key in (${epicKeys.map(epicKey => `"${epicKey}"`).join(',')})`;
    const epicIssues = await getIssuesFromJira(epicJql);
    for (const epic of epicIssues) {
      const key = epic.key;
      epicAdvanced[key] = {
        raid: epic.fields['customfield_30160'] || '',
        wsjf: epic.fields['customfield_42105'] || '',
        piScope: epic.fields['customfield_20046'] || '',
        progress: epic.fields['customfield_30195'] || '',
      };
    }
  }

  // 12. Epic progress summary
  const epicProgress: Record<string, { completed: number; inProgress: number; toDo: number; total: number; completedPct: number; rag: string; raid?: string; wsjf?: string; piScope?: string; progress?: string }> = {};
  for (const epicKey in epicStoryPoints) {
    const epicStoryPointData = epicStoryPoints[epicKey];
    const completedPercentage = epicStoryPointData.total > 0 ? Math.round((epicStoryPointData.completed / epicStoryPointData.total) * 100) : 0;
    epicProgress[epicKey] = {
      ...epicStoryPointData,
      completedPct: completedPercentage,
      rag: getEpicRag(epicStoryPointData.completed, epicStoryPointData.total),
      ...(epicAdvanced[epicKey] || {}),
    };
  }

  // 13. Prepare RAID, WSJF, PI Scope, and Progress summaries
  const raidSummary: Record<string, string> = {};
  const wsjfSummary: Record<string, string> = {};
  const piScopeSummary: Record<string, string> = {};
  const progressSummary: Record<string, string> = {};

  for (const epicKey in epicAdvanced) {
    const epicAnalyticsData = epicAdvanced[epicKey];
    if (epicAnalyticsData.raid) raidSummary[epicKey] = epicAnalyticsData.raid;
    if (epicAnalyticsData.wsjf) wsjfSummary[epicKey] = epicAnalyticsData.wsjf;
    if (epicAnalyticsData.piScope) piScopeSummary[epicKey] = epicAnalyticsData.piScope;
    if (epicAnalyticsData.progress) progressSummary[epicKey] = epicAnalyticsData.progress;
  }

  return {
    releases,
    sprints: filteredSprints,
    issues,
    storyPoints: breakdown.total,
    completedStoryPoints: breakdown.completed,
    inProgressStoryPoints: breakdown.inProgress,
    toDoStoryPoints: breakdown.toDo,
    completedPercentage,
    ragStatus,
    epicBreakdown: epicStoryPoints,
    sprintBreakdown: sprintStoryPoints,
    currentSprints,
    previousSprints,
    futureSprints,
    currentSprintStats,
    previousSprintStats,
    futureSprintStats,
    burnup: burnupData,
    storyPointsCurrent,
    epicProgress,
    raid: raidSummary,
    wsjf: wsjfSummary,
    piScope: piScopeSummary,
    progress: progressSummary
  };
} 