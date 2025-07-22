import { VelocitySummaryOptions, SprintVelocity, VelocitySummaryResult } from '../types/velocity';
import { getClosedSprintsFromJira, getSprintIssuesWithAssignee, getVelocityStatsFromJira } from './jiraService';

export async function getVelocitySummary(options: VelocitySummaryOptions): Promise<VelocitySummaryResult> {
  const { boardId, numSprints, year, sprintPrefix } = options;
  // 1. Get closed sprints for the board
  let sprints = await getClosedSprintsFromJira(boardId);
  if (sprintPrefix) {
    sprints = sprints.filter((s: any) => s.name.startsWith(sprintPrefix));
  }
  if (year) {
    sprints = sprints.filter((s: any) => s.startDate && new Date(s.startDate || '').getFullYear() === year);
  }
  sprints = sprints.sort((a: any, b: any) => new Date(b.startDate || '').getTime() - new Date(a.startDate || '').getTime());
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
    const assignees = new Set(
      (issues || []).map((issue: any) => issue.fields.assignee?.accountId).filter(Boolean)
    );
    const teamMembers = assignees.size || 15; // Default to 15 if no team members found

    // 4. Calculate allotted and optimal story points
    const allottedStoryPoints = teamMembers * 8;  // 8 SP per team member
    const optimalStoryPoints = teamMembers * 5;   // 5 SP per team member

    // 5. Get added story points (issues created after sprint start)
    let addedStoryPoints = 0;
    for (const issue of issues || []) {
      const created = new Date(issue.fields.created || '');
      const start = new Date(sprint.startDate || '');
      if (created > start) {
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
      teamMembers,
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