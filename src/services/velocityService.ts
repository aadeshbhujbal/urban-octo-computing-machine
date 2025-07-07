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
    // 4. Get added story points (issues created after sprint start)
    let addedStoryPoints = 0;
    for (const issue of issues || []) {
      const created = new Date(issue.fields.created || '');
      const start = new Date(sprint.startDate || '');
      if (created > start) {
        addedStoryPoints += issue.fields.customfield_10002 || 0;
      }
    }
    // 5. Calculate efficiency
    const efficiency = committed > 0 ? Math.round((completed / committed) * 100) : 0;
    sprintVelocities.push({
      sprintId: sprint.id,
      sprintName: sprint.name || '',
      startDate: sprint.startDate || '',
      endDate: sprint.endDate || '',
      committed,
      completed,
      teamMembers: assignees.size,
      addedStoryPoints,
      efficiency,
    });
  }
  return {
    sprints: sprintVelocities,
    boardId,
    summary: `Velocity summary for board ${boardId}`,
  };
} 