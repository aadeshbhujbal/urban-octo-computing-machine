import { SprintData, SprintSummaryOptions } from '../types/sprint';
import { 
  JiraSprintResponse, 
  JiraVelocityStats, 
  JiraSearchResponse, 
  JiraSprintListResponse,
  JiraIssue 
} from '../types/jira';
import { getSprintsFromJira, getIssuesFromJira, getBoardIdFromProjectKey } from './jiraService';
import { calculateAddedStoryPoints, calculateTeamMembersCount } from '../utils/storyPointUtils';
import { fetchWithProxy } from '../utils/fetchWithProxy';
import config from '../config';

// Helper function to get board ID from project key or board ID
async function getBoardId(boardIdOrProjectKey: string): Promise<string> {
  // Check if it's numeric (board ID) or string (project key)
  const isNumeric = /^\d+$/.test(boardIdOrProjectKey);
  
  if (isNumeric) {
    return boardIdOrProjectKey;
  } else {
    // It's a project key, need to get the board ID first
    return await getBoardIdFromProjectKey(boardIdOrProjectKey);
  }
}

export async function getSprintDetails(sprintId: number, boardIdOrProjectKey?: string): Promise<SprintData | null> {
  try {
    console.log(`[DEBUG] Getting sprint details for sprint ${sprintId} with board/project: ${boardIdOrProjectKey || 'default'}`);
    
    // Get sprint details using existing Jira service
    // If boardIdOrProjectKey is provided, use it; otherwise try to get sprints from a default board
    const boardIdToUse = boardIdOrProjectKey || '1';
    const actualBoardId = await getBoardId(boardIdToUse);
    console.log(`[DEBUG] Using board ID: ${actualBoardId} for sprint lookup`);
    
    const sprints = await getSprintsFromJira(actualBoardId);
    console.log(`[DEBUG] Found ${sprints.length} sprints in board ${actualBoardId}`);
    
    const sprint = sprints.find(sprintItem => sprintItem.id === sprintId);
    
    if (!sprint) {
      console.error(`Sprint ${sprintId} not found in board ${actualBoardId}`);
      // Try to get sprint details directly from Jira API as fallback
      console.log(`[DEBUG] Trying to get sprint ${sprintId} directly from Jira API`);
      try {
        const directSprintResponse = await fetchWithProxy(`${config.jiraUrl}/rest/agile/latest/sprint/${sprintId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${config.jiraUser}:${config.jiraToken}`).toString('base64')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (directSprintResponse.ok) {
          const directSprintData = await directSprintResponse.json() as JiraSprintResponse;
          console.log(`[DEBUG] Found sprint ${sprintId} directly from Jira API`);
          
          // Use the direct sprint data
          const sprintObjective = directSprintData.goal || '';
          const actualBoardIdNum = directSprintData.originBoardId || parseInt(actualBoardId, 10);
          const velocityStats = await getVelocityStatsForSprint(sprintId, actualBoardIdNum);
          const committed = velocityStats.estimated?.value || 0;
          const completed = velocityStats.completed?.value || 0;

          // Get team members and story points for the sprint
          const sprintIssues = await getSprintIssues(sprintId);
          const teamMembersCount = calculateTeamMembersCount(sprintIssues);
          const addedStoryPoints = directSprintData.startDate ? calculateAddedStoryPoints(sprintIssues, new Date(directSprintData.startDate)) : 0;

          // Calculate efficiency
          const efficiency = committed > 0 ? Math.round((completed / committed) * 100) : 0;

          return {
            sprintId: directSprintData.id,
            sprintName: directSprintData.name || '',
            startDate: directSprintData.startDate || '',
            endDate: directSprintData.endDate || '',
            sprintObjective,
            sprintStatus: directSprintData.state || '',
            storyPoints: {
              committed,
              completed,
              added: addedStoryPoints,
              total: committed + addedStoryPoints
            },
            teamMembers: teamMembersCount,
            efficiency
          };
        } else {
          console.error(`[DEBUG] Failed to get sprint ${sprintId} directly: ${directSprintResponse.status}`);
          return null;
        }
      } catch (directError) {
        console.error(`[DEBUG] Error getting sprint ${sprintId} directly:`, directError);
        return null;
      }
    }

    // Get sprint objective/goal from the sprint API
    const sprintObjective = await getSprintObjective(sprintId);
    
    // Get velocity stats for the sprint
    const actualBoardIdNum = sprint.originBoardId || parseInt(actualBoardId, 10);
    const velocityStats = await getVelocityStatsForSprint(sprintId, actualBoardIdNum);
    const committed = velocityStats.estimated?.value || 0;
    const completed = velocityStats.completed?.value || 0;

    // Get team members and story points for the sprint
    const sprintIssues = await getSprintIssues(sprintId);
    const teamMembersCount = calculateTeamMembersCount(sprintIssues);
    const addedStoryPoints = sprint.startDate ? calculateAddedStoryPoints(sprintIssues, new Date(sprint.startDate)) : 0;

    // Calculate efficiency
    const efficiency = committed > 0 ? Math.round((completed / committed) * 100) : 0;

    console.log(`[DEBUG] Successfully built sprint details for sprint ${sprintId}`);
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
    console.log(`[DEBUG] Fetching sprints for board/project ${boardId} with state: ${state}`);
    
    // Get the actual board ID if a project key was provided
    const actualBoardId = await getBoardId(boardId);
    console.log(`[DEBUG] Using board ID: ${actualBoardId} for input: ${boardId}`);
    
    // Get sprints from board using existing Jira service
    const allSprints = await getSprintsFromJira(actualBoardId, state);
    
    console.log(`[DEBUG] Found ${allSprints.length} sprints for board ${actualBoardId}`);
    if (allSprints.length > 0) {
      console.log(`[DEBUG] First sprint:`, {
        id: allSprints[0].id,
        name: allSprints[0].name,
        state: allSprints[0].state,
        startDate: allSprints[0].startDate,
        endDate: allSprints[0].endDate
      });
    }
    
    // Filter sprints based on provided criteria
    let filteredSprints = allSprints;

    // Filter by sprint IDs if provided
    if (sprintIds && sprintIds.length > 0) {
      filteredSprints = filteredSprints.filter(sprint => sprintIds.includes(sprint.id));
      console.log(`[DEBUG] After sprint ID filter: ${filteredSprints.length} sprints`);
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
      console.log(`[DEBUG] After date filter: ${filteredSprints.length} sprints`);
    }

    // Sort sprints by start date (most recent first)
    filteredSprints.sort((firstSprint, secondSprint) => {
      const firstDate = firstSprint.startDate ? new Date(firstSprint.startDate).getTime() : 0;
      const secondDate = secondSprint.startDate ? new Date(secondSprint.startDate).getTime() : 0;
      return secondDate - firstDate;
    });

    const sprintData: SprintData[] = [];

    for (const sprint of filteredSprints) {
      console.log(`[DEBUG] Processing sprint ${sprint.id}: ${sprint.name}`);
      try {
        const sprintDetails = await getSprintDetails(sprint.id, actualBoardId);
        if (sprintDetails) {
          sprintData.push(sprintDetails);
          console.log(`[DEBUG] Successfully added sprint ${sprint.id} to results`);
        } else {
          console.warn(`[DEBUG] Failed to get details for sprint ${sprint.id}, skipping`);
        }
      } catch (sprintError) {
        console.error(`[DEBUG] Error processing sprint ${sprint.id}:`, sprintError);
        // Continue with other sprints instead of failing completely
      }
    }

    console.log(`[DEBUG] Returning ${sprintData.length} sprint details out of ${filteredSprints.length} sprints`);
    return sprintData;
  } catch (error) {
    console.error('Error fetching sprint summary:', error);
    throw error;
  }
}

async function getSprintObjective(sprintId: number): Promise<string> {
  try {
    const response = await fetchWithProxy(`${config.jiraUrl}/rest/agile/latest/sprint/${sprintId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${config.jiraUser}:${config.jiraToken}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`Failed to get sprint objective for sprint ${sprintId}: ${response.status} ${response.statusText}`);
      return '';
    }

    const sprintData = await response.json() as JiraSprintResponse;
    return sprintData.goal || '';
  } catch (error) {
    console.warn(`Error getting sprint objective for sprint ${sprintId}:`, error);
    return '';
  }
}

async function getVelocityStatsForSprint(sprintId: number, boardId: number): Promise<{ estimated?: { value: number }; completed?: { value: number } }> {
  try {
    const response = await fetchWithProxy(`${config.jiraUrl}/rest/greenhopper/1.0/rapid/charts/velocity?rapidViewId=${boardId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${config.jiraUser}:${config.jiraToken}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`Failed to get velocity stats for sprint ${sprintId}: ${response.status} ${response.statusText}`);
      return {};
    }

    const velocityData = await response.json() as JiraVelocityStats;
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

 