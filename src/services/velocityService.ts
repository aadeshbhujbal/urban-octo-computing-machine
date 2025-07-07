import fetch from 'node-fetch';
import { VelocitySummaryOptions, SprintVelocity, VelocitySummaryResult } from '../types/velocity';

const JIRA_BASE_URL = process.env.JIRA_URL || 'https://your-domain.atlassian.net';
const JIRA_USER = process.env.JIRA_USER;
const JIRA_TOKEN = process.env.JIRA_TOKEN;

async function jiraFetch(path: string) {
  if (!JIRA_USER || !JIRA_TOKEN) throw new Error('JIRA_USER or JIRA_TOKEN not set');
  const url = `${JIRA_BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${JIRA_USER}:${JIRA_TOKEN}`).toString('base64'),
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Jira API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function getVelocitySummary(options: VelocitySummaryOptions): Promise<VelocitySummaryResult> {
  const { boardId, numSprints, year, sprintPrefix } = options;
  // 1. Get sprints for the board
  const sprintsData = await jiraFetch(`/rest/agile/1.0/board/${boardId}/sprint?state=closed`);
  let sprints = sprintsData.values || [];
  if (sprintPrefix) {
    sprints = sprints.filter((s: any) => s.name.startsWith(sprintPrefix));
  }
  if (year) {
    sprints = sprints.filter((s: any) => s.startDate && new Date(s.startDate).getFullYear() === year);
  }
  sprints = sprints.sort((a: any, b: any) => new Date(b.startDate || '').getTime() - new Date(a.startDate || '').getTime());
  if (numSprints) {
    sprints = sprints.slice(0, numSprints);
  }

  const sprintVelocities: SprintVelocity[] = [];
  for (const sprint of sprints) {
    // 2. Get velocity stats for the sprint
    const velocityData = await jiraFetch(`/rest/greenhopper/1.0/rapid/charts/velocity?rapidViewId=${boardId}`);
    const sprintStat = (velocityData.velocityStatEntries && velocityData.velocityStatEntries[sprint.id]) || {};
    const committed = sprintStat.estimated?.value || 0;
    const completed = sprintStat.completed?.value || 0;
    // 3. Get team members for the sprint
    const issuesData = await jiraFetch(`/rest/agile/1.0/sprint/${sprint.id}/issue?fields=assignee`);
    const assignees = new Set(
      (issuesData.issues || []).map((issue: any) => issue.fields.assignee?.accountId).filter(Boolean)
    );
    // 4. Get added story points (issues created after sprint start)
    let addedStoryPoints = 0;
    for (const issue of issuesData.issues || []) {
      const created = new Date(issue.fields.created);
      const start = new Date(sprint.startDate);
      if (created > start) {
        addedStoryPoints += issue.fields.customfield_10002 || 0;
      }
    }
    // 5. Calculate efficiency
    const efficiency = committed > 0 ? Math.round((completed / committed) * 100) : 0;
    sprintVelocities.push({
      sprintId: sprint.id,
      sprintName: sprint.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
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