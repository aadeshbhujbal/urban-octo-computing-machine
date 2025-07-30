import { SprintData, SprintSummaryOptions } from '../types/sprint';
import { 
  JiraSprintResponse, 
  JiraVelocityStats, 
  JiraSearchResponse, 
  JiraSprintListResponse,
  JiraIssue 
} from '../types/jira';
import { getSprintsFromJira, getIssuesFromJira } from './jiraService';
import { calculateAddedStoryPoints, calculateTeamMembersCount } from '../utils/storyPointUtils';
import config from '../config';

export async function getSprintDetails(sprintId: number): Promise<SprintData | null> {
  try {
    // Get sprint details using existing Jira service
    const sprints = await getSprintsFromJira('1'); // We'll get the board ID from the sprint
    const sprint = sprints.find(sprintItem => sprintItem.id === sprintId);
    
    if (!sprint) {
      console.error(`Sprint ${sprintId} not found`);
      return null;
    }

    // Get sprint objective/goal from the sprint API
    const sprintObjective = await getSprintObjective(sprintId);
    
    // Get velocity stats for the sprint
    const velocityStats = await getVelocityStatsForSprint(sprintId, sprint.originBoardId || 1);
    const committed = velocityStats.estimated?.value || 0;
    const completed = velocityStats.completed?.value || 0;

    // Get team members and story points for the sprint
    const sprintIssues = await getSprintIssues(sprintId);
    const teamMembersCount = calculateTeamMembersCount(sprintIssues);
    const addedStoryPoints = sprint.startDate ? calculateAddedStoryPoints(sprintIssues, new Date(sprint.startDate)) : 0;

    // Calculate efficiency
    const efficiency = committed > 0 ? Math.round((completed / committed) * 100) : 0;

    return {
      sprintId: sprint.id,
      sprintName: sprint.name || '',
      startDate: sprint.startDate || '',
      endDate: sprint.endDate || '',
      sprintObjective,
      sprintStatus: sprint.state || '',
      storyPoints: {
        committed,
        completed,
        added: addedStoryPoints,
        total: committed + addedStoryPoints
      },
      teamMembers: teamMembersCount,
      efficiency
    };
  } catch (error) {
    console.error(`Error fetching sprint ${sprintId}:`, error);
    return null;
  }
}

export async function getSprintSummary(options: SprintSummaryOptions): Promise<SprintData[]> {
  const { boardId, sprintIds, state = 'active,closed,future', startDate, endDate } = options;

  try {
    // Get sprints from board using existing Jira service
    const allSprints = await getSprintsFromJira(boardId, state);
    
    // Filter sprints based on provided criteria
    let filteredSprints = allSprints;

    // Filter by sprint IDs if provided
    if (sprintIds && sprintIds.length > 0) {
      filteredSprints = filteredSprints.filter(sprint => sprintIds.includes(sprint.id));
    }

    // Filter by date range if provided
    if (startDate && endDate) {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      filteredSprints = filteredSprints.filter(sprint => {
        if (!sprint.startDate || !sprint.endDate) return false;
        const sprintStart = new Date(sprint.startDate);
        const sprintEnd = new Date(sprint.endDate);
        return sprintStart <= endDateObj && sprintEnd >= startDateObj;
      });
    }

    // Sort sprints by start date (most recent first)
    filteredSprints.sort((sprintA, sprintB) => {
      const aDate = sprintA.startDate ? new Date(sprintA.startDate).getTime() : 0;
      const bDate = sprintB.startDate ? new Date(sprintB.startDate).getTime() : 0;
      return bDate - aDate;
    });

    const sprintData: SprintData[] = [];

    for (const sprint of filteredSprints) {
      const sprintDetails = await getSprintDetails(sprint.id);
      if (sprintDetails) {
        sprintData.push(sprintDetails);
      }
    }

    return sprintData;
  } catch (error) {
    console.error('Error fetching sprint summary:', error);
    throw error;
  }
}

async function getSprintObjective(sprintId: number): Promise<string> {
  try {
    const response = await fetch(`${config.jiraUrl}/rest/agile/latest/sprint/${sprintId}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${config.jiraUser}:${config.jiraToken}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`Failed to get sprint objective for sprint ${sprintId}`);
      return '';
    }

    const sprintData: JiraSprintResponse = await response.json();
    return sprintData.goal || '';
  } catch (error) {
    console.warn(`Error getting sprint objective for sprint ${sprintId}:`, error);
    return '';
  }
}

async function getVelocityStatsForSprint(sprintId: number, boardId: number): Promise<{ estimated?: { value: number }; completed?: { value: number } }> {
  try {
    const response = await fetch(`${config.jiraUrl}/rest/greenhopper/1.0/rapid/charts/velocity?rapidViewId=${boardId}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${config.jiraUser}:${config.jiraToken}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`Failed to get velocity stats for sprint ${sprintId}`);
      return {};
    }

    const velocityData: JiraVelocityStats = await response.json();
    return velocityData.velocityStatEntries?.[sprintId.toString()] || {};
  } catch (error) {
    console.warn(`Error getting velocity stats for sprint ${sprintId}:`, error);
    return {};
  }
}

async function getSprintIssues(sprintId: number): Promise<JiraIssue[]> {
  try {
    const jql = `Sprint = ${sprintId}`;
    return await getIssuesFromJira(jql);
  } catch (error) {
    console.warn(`Error getting issues for sprint ${sprintId}:`, error);
    return [];
  }
}

 