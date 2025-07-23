import { getReleasesFromJira, getSprintsFromJira, getIssuesFromJira } from './jiraService';
import { PiPlanningSummaryOptions, EpicAdvancedAnalytics } from '../types/piPlanning';

function processStoryPoints(sp: any): number {
  // Python: if story_points % 1 == 0: story_points = int(story_points)
  if (typeof sp === 'number') {
    return Number.isInteger(sp) ? sp : Math.round(sp);
  }
  if (typeof sp === 'string') {
    const n = parseFloat(sp);
    return isNaN(n) ? 0 : Math.round(n);
  }
  return 0;
}

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

  // 1. Fetch releases for the project
  const releases = await getReleasesFromJira(project);

  // 2. Fetch sprints for the board
  const sprints = await getSprintsFromJira(boardId);

  // 3. Filter sprints by PI date range (if dates are provided)
  const filteredSprints = sprints.filter(sprint => {
    if (!sprint.startDate || !sprint.endDate) return false;
    return (
      sprint.startDate >= piStartDate &&
      sprint.endDate <= piEndDate
    );
  });

  // Check if we have any sprints in the PI date range
  if (filteredSprints.length === 0) {
    return {
      releases,
      sprints: [],
      issues: [],
      totalStoryPoints: 0,
      completedStoryPoints: 0,
      inProgressStoryPoints: 0,
      toDoStoryPoints: 0,
      completedPercentage: 0,
      ragStatus: 'Red',
      epicStoryPoints: {},
      sprintStoryPoints: {},
      currentSprints: [],
      previousSprints: [],
      futureSprints: [],
      currentSprintStats: { groupTotal: 0, groupCompleted: 0, groupInProgress: 0, groupToDo: 0 },
      previousSprintStats: { groupTotal: 0, groupCompleted: 0, groupInProgress: 0, groupToDo: 0 },
      futureSprintStats: { groupTotal: 0, groupCompleted: 0, groupInProgress: 0, groupToDo: 0 },
      burnup: [],
      storyPointsCurrent: 0,
      epicProgress: {},
    };
  }

  // 4. Fetch issues for the project and filtered sprints
  const sprintIds = filteredSprints.map(s => s.id);
  const jql = `project = "${project}" AND issuetype in (Story, Bug, \"User Story\",Task) AND Sprint in (${sprintIds.join(',')})`;
  const issues = await getIssuesFromJira(jql);

  // 5. Calculate story points and group by status
  let totalStoryPoints = 0;
  let completedStoryPoints = 0;
  let inProgressStoryPoints = 0;
  let toDoStoryPoints = 0;
  const completedStatuses = ['Done', 'Closed', 'Resolved'];
  const inProgressStatuses = ['In Progress', 'In Development'];
  const toDoStatuses = ['To Do', 'Open', 'New'];

  // Epic and sprint breakdowns
  const epicStoryPoints: Record<string, { completed: number; inProgress: number; toDo: number; total: number }> = {};
  const sprintStoryPoints: Record<string, { completed: number; inProgress: number; toDo: number; total: number }> = {};

  for (const issue of issues) {
    const sp = processStoryPoints(issue.fields['customfield_10002']);
    totalStoryPoints += sp;
    const status = (issue.fields.status?.name || '').toLowerCase();
    const epic = issue.fields.parent?.key || 'No Epic';
    const sprintArr = issue.fields.customfield_10341 || [];
    // Use the latest sprint for grouping
    const sprintId = sprintArr.length > 0 ? sprintArr[sprintArr.length - 1]?.id?.toString() : 'No Sprint';

    // Epic breakdown
    if (!epicStoryPoints[epic]) epicStoryPoints[epic] = { completed: 0, inProgress: 0, toDo: 0, total: 0 };
    epicStoryPoints[epic].total += sp;
    // Sprint breakdown
    if (!sprintStoryPoints[sprintId]) sprintStoryPoints[sprintId] = { completed: 0, inProgress: 0, toDo: 0, total: 0 };
    sprintStoryPoints[sprintId].total += sp;

    if (completedStatuses.map(s => s.toLowerCase()).includes(status)) {
      completedStoryPoints += sp;
      epicStoryPoints[epic].completed += sp;
      sprintStoryPoints[sprintId].completed += sp;
    } else if (inProgressStatuses.map(s => s.toLowerCase()).includes(status)) {
      inProgressStoryPoints += sp;
      epicStoryPoints[epic].inProgress += sp;
      sprintStoryPoints[sprintId].inProgress += sp;
    } else if (toDoStatuses.map(s => s.toLowerCase()).includes(status)) {
      toDoStoryPoints += sp;
      epicStoryPoints[epic].toDo += sp;
      sprintStoryPoints[sprintId].toDo += sp;
    }
  }

  // 6. Calculate RAG status
  let ragStatus = 'Red';
  let completedPercentage = 0;
  if (totalStoryPoints > 0) {
    completedPercentage = Math.round((completedStoryPoints / totalStoryPoints) * 100);
    if (completedPercentage > 90) {
      ragStatus = 'Green';
    } else if (completedPercentage >= 80) {
      ragStatus = 'Amber';
    }
  }

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

  // 8. Calculate stats for each group
  function groupStats(sprintGroup: typeof filteredSprints) {
    const ids = new Set(sprintGroup.map(s => s.id));
    let groupTotal = 0, groupCompleted = 0, groupInProgress = 0, groupToDo = 0;
    for (const issue of issues) {
      const sprintArr = issue.fields.customfield_10341 || [];
      const sprintId = sprintArr.length > 0 ? sprintArr[sprintArr.length - 1]?.id : null;
      if (sprintId && ids.has(sprintId)) {
        const sp = processStoryPoints(issue.fields['customfield_10002']);
        const status = (issue.fields.status?.name || '').toLowerCase();
        groupTotal += sp;
        if (completedStatuses.map(s => s.toLowerCase()).includes(status)) groupCompleted += sp;
        else if (inProgressStatuses.map(s => s.toLowerCase()).includes(status)) groupInProgress += sp;
        else if (toDoStatuses.map(s => s.toLowerCase()).includes(status)) groupToDo += sp;
      }
    }
    return { groupTotal, groupCompleted, groupInProgress, groupToDo };
  }

  const currentSprintStats = groupStats(currentSprints);
  const previousSprintStats = groupStats(previousSprints);
  const futureSprintStats = groupStats(futureSprints);

  // 9. Calculate story points progress over time (burn-up)
  const burnup: Array<{ date: string; completed: number }> = [];
  let runningCompleted = 0;
  const sortedSprints = [...filteredSprints].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  for (const sprint of sortedSprints) {
    const sprintId = sprint.id;
    const completed = sprintStoryPoints[sprintId]?.completed || 0;
    runningCompleted += completed;
    burnup.push({ date: sprint.endDate || '', completed: runningCompleted });
  }

  // 10. Calculate expected story points by now (story_points_current)
  let storyPointsCurrent = 0;
  let totalDays = 0;
  let daysPast = 0;
  for (const sprint of sortedSprints) {
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
    storyPointsCurrent = Math.round((daysPast / totalDays) * totalStoryPoints);
  }

  // 11. Advanced analytics: fetch RAID, WSJF, PI Scope, Progress for each epic
  const epicAdvanced: Record<string, EpicAdvancedAnalytics> = {};
  const epicKeys = Object.keys(epicStoryPoints).filter(e => e !== 'No Epic');
  if (epicKeys.length > 0) {
    // Fetch all epics in one JQL call
    const epicJql = `key in (${epicKeys.map(e => `"${e}"`).join(',')})`;
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
  for (const epic in epicStoryPoints) {
    const e = epicStoryPoints[epic];
    const completedPct = e.total > 0 ? Math.round((e.completed / e.total) * 100) : 0;
    epicProgress[epic] = {
      ...e,
      completedPct,
      rag: getEpicRag(e.completed, e.total),
      ...(epicAdvanced[epic] || {}),
    };
  }

  return {
    releases,
    sprints: filteredSprints,
    issues,
    totalStoryPoints,
    completedStoryPoints,
    inProgressStoryPoints,
    toDoStoryPoints,
    completedPercentage,
    ragStatus,
    epicStoryPoints,
    sprintStoryPoints,
    currentSprints,
    previousSprints,
    futureSprints,
    currentSprintStats,
    previousSprintStats,
    futureSprintStats,
    burnup,
    storyPointsCurrent,
    epicProgress,
    // Add more summary/calculation fields as you port more logic
  };
} 