import { VelocitySummaryOptions, SprintVelocity, VelocitySummaryResult } from '../types/velocity';
import { getClosedSprintsFromJira, getSprintIssuesWithAssignee, getVelocityStatsFromJira } from './jiraService';
import { JiraSprintState } from '../types/jira';

export async function getVelocitySummary(options: VelocitySummaryOptions): Promise<VelocitySummaryResult> {
  const { boardId, numSprints, year, sprintPrefix } = options;
  // 1. Get closed sprints for the board
  let sprints = await getClosedSprintsFromJira(boardId);
  if (sprintPrefix) {
    sprints = sprints.filter((sprint) => sprint.name.startsWith(sprintPrefix));
  }
  if (year) {
    sprints = sprints.filter((sprint) => sprint.startDate && new Date(sprint.startDate).getFullYear() === year);
  }
  sprints = sprints.sort((sprintA, sprintB) => {
    const sprintAStartDate = sprintA.startDate ? new Date(sprintA.startDate).getTime() : 0;
    const sprintBStartDate = sprintB.startDate ? new Date(sprintB.startDate).getTime() : 0;
    return sprintBStartDate - sprintAStartDate;
  });
  if (numSprints) {
    sprints = sprints.slice(0, numSprints);
  }

  const velocityData = await getVelocityStatsFromJira(boardId);
  const sprintVelocities: SprintVelocity[] = [];
  for (const sprint of sprints) {
    // 2. Get velocity stats for the sprint
    const sprintStat = (velocityData.velocityStatEntries && velocityData.velocityStatEntries[sprint.id]) || {};
    const committed = sprintStat.estimated?.value || 0;
    const completed = sprintStat.completed?.value || 0;
    // 3. Get team members for the sprint
    const issues = await getSprintIssuesWithAssignee(sprint.id);
    const assigneeAccountIds = new Set(
      (issues || []).map((issue) => issue.fields.assignee?.accountId).filter((accountId): accountId is string => Boolean(accountId))
    );
    const teamMembersCount = assigneeAccountIds.size || 15; // Default to 15 if no team members found

    // 4. Calculate allotted and optimal story points
    const allottedStoryPoints = teamMembersCount * 8;  // 8 SP per team member
    const optimalStoryPoints = teamMembersCount * 5;   // 5 SP per team member

    // 5. Get added story points (issues created after sprint start)
    let addedStoryPoints = 0;
    for (const issue of issues || []) {
      const createdDate = new Date(issue.fields.created || '');
      const sprintStartDate = new Date(sprint.startDate || '');
      if (createdDate > sprintStartDate) {
        addedStoryPoints += issue.fields.customfield_10002 || 0;
      }
    }

    // 6. Calculate efficiencies and spillover
    const efficiency = committed > 0 ? Math.round((completed / committed) * 100) : 0;
    const efficiencyBasedOnAllotted = allottedStoryPoints > 0 ? Math.round((completed / allottedStoryPoints) * 100) : 0;
    const spillover = Math.max(0, committed - completed);

    sprintVelocities.push({
      sprintId: sprint.id,
      sprintName: sprint.name || '',
      startDate: sprint.startDate || '',
      endDate: sprint.endDate || '',
      committed,
      completed,
      teamMembers: teamMembersCount,
      addedStoryPoints,
      efficiency,
      allottedStoryPoints,
      optimalStoryPoints,
      efficiencyBasedOnAllotted,
      spillover
    });
  }

  // 7. Calculate latest sprint efficiency for summary
  const latestSprint = sprintVelocities[0];
  const summaryEfficiency = latestSprint ? latestSprint.efficiency : 0;

  return {
    sprints: sprintVelocities,
    boardId,
    summary: `Velocity summary for board ${boardId} (Latest Sprint Efficiency: ${summaryEfficiency}%)`,
    latestSprintEfficiency: summaryEfficiency
  };
} 