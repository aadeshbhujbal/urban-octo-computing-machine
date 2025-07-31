import { Router } from 'express';
import { getSprintDetails, getSprintSummary, getCurrentSprintObjectives } from '../../services/sprintService';
import { getSprintsFromJira, getBoardIdFromProjectKey } from '../../services/jiraService';
import { fetchWithProxy } from '../../utils/fetchWithProxy';

const router = Router();

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

/**
 * @swagger
 * /api/v1/sprint/{sprintId}:
 *   get:
 *     summary: Get comprehensive sprint information
 *     description: Returns complete sprint information including basic details, analytics, objectives, and team data
 *     tags:
 *       - Sprint
 *     parameters:
 *       - in: path
 *         name: sprintId
 *         schema:
 *           type: integer
 *         required: true
 *         description: Sprint ID
 *       - in: query
 *         name: projectKey
 *         schema:
 *           type: string
 *         required: false
 *         description: Jira project key (e.g., FRN) - use this OR boardId, not both
 *       - in: query
 *         name: boardId
 *         schema:
 *           type: string
 *         required: false
 *         description: Jira board ID (e.g., 59059) - use this OR projectKey, not both
 *       - in: query
 *         name: includeAnalytics
 *         schema:
 *           type: boolean
 *         required: false
 *         description: Include sprint analytics and metrics - default true
 *       - in: query
 *         name: includeObjectives
 *         schema:
 *           type: boolean
 *         required: false
 *         description: Include sprint objectives and story points - default true
 *     responses:
 *       200:
 *         description: Comprehensive sprint information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 basic:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     state:
 *                       type: string
 *                     startDate:
 *                       type: string
 *                     endDate:
 *                       type: string
 *                     goal:
 *                       type: string
 *                 analytics:
 *                   type: object
 *                   properties:
 *                     totalIssues:
 *                       type: number
 *                     completedIssues:
 *                       type: number
 *                     totalStoryPoints:
 *                       type: number
 *                     completedStoryPoints:
 *                       type: number
 *                     velocity:
 *                       type: number
 *                     efficiency:
 *                       type: number
 *                 objectives:
 *                   type: object
 *                   properties:
 *                     completedStoryPoints:
 *                       type: number
 *                     inProgressStoryPoints:
 *                       type: number
 *                     toDoStoryPoints:
 *                       type: number
 *                     objectives:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           issueKey:
 *                             type: string
 *                           issueUrl:
 *                             type: string
 *                           description:
 *                             type: string
 *       400:
 *         description: Missing sprint ID or invalid parameters
 *       404:
 *         description: Sprint not found
 *       500:
 *         description: Server error
 */
router.get('/:sprintId', async (req, res) => {
  try {
    const { sprintId } = req.params;
    const { projectKey, boardId, includeAnalytics = 'true', includeObjectives = 'true' } = req.query;
    
    if (!sprintId) {
      return res.status(400).json({ error: 'Missing sprint ID' });
    }

    // Validate that either projectKey or boardId is provided, but not both
    if (!projectKey && !boardId) {
      return res.status(400).json({ 
        error: 'Either projectKey or boardId must be provided',
        example: 'Use ?projectKey=FRN or ?boardId=59059'
      });
    }

    if (projectKey && boardId) {
      return res.status(400).json({ 
        error: 'Provide either projectKey OR boardId, not both',
        example: 'Use ?projectKey=FRN or ?boardId=59059'
      });
    }

    console.log(`[DEBUG] Getting comprehensive sprint info for sprint: ${sprintId} with ${projectKey ? 'projectKey: ' + projectKey : 'boardId: ' + boardId}`);

    const sprintIdNum = parseInt(sprintId, 10);
    const includeAnalyticsBool = includeAnalytics === 'true';
    const includeObjectivesBool = includeObjectives === 'true';

    // Determine the board ID to use
    let actualBoardId: string;
    if (projectKey) {
      try {
        actualBoardId = await getBoardIdFromProjectKey(projectKey as string);
        console.log(`[DEBUG] Converted project key ${projectKey} to board ID: ${actualBoardId}`);
      } catch (error) {
        return res.status(404).json({ 
          error: `No board found for project key: ${projectKey}`,
          message: 'Please check if the project has any boards configured in Jira'
        });
      }
    } else {
      actualBoardId = boardId as string;
    }

    // Get basic sprint details
    const sprintDetails = await getSprintDetails(sprintIdNum, actualBoardId);
    
    if (!sprintDetails) {
      return res.status(404).json({ error: 'Sprint not found' });
    }

    const result: {
      basic: {
        id: number;
        name: string;
        state: string;
        startDate: string;
        endDate: string;
        goal: string;
      };
      analytics?: {
        totalIssues: number;
        completedIssues: number;
        totalStoryPoints: number;
        completedStoryPoints: number;
        velocity: number;
        efficiency: number;
      } | null;
      objectives?: {
        completedStoryPoints: number;
        inProgressStoryPoints: number;
        toDoStoryPoints: number;
        objectives: Array<{
          issueKey: string;
          issueUrl: string;
          description: string;
        }>;
      } | null;
    } = {
      basic: {
        id: sprintDetails.sprintId,
        name: sprintDetails.sprintName,
        state: sprintDetails.sprintStatus,
        startDate: sprintDetails.startDate,
        endDate: sprintDetails.endDate,
        goal: sprintDetails.sprintObjective
      }
    };

    // Include analytics if requested
    if (includeAnalyticsBool) {
      try {
        const analytics = await getSprintSummary({
          boardId: actualBoardId,
          sprintIds: [sprintIdNum]
        });
        
        if (analytics && analytics.length > 0) {
          const sprintAnalytics = analytics[0];
          result.analytics = {
            totalIssues: sprintAnalytics.storyPoints?.total || 0,
            completedIssues: sprintAnalytics.storyPoints?.completed || 0,
            totalStoryPoints: sprintAnalytics.storyPoints?.total || 0,
            completedStoryPoints: sprintAnalytics.storyPoints?.completed || 0,
            velocity: sprintAnalytics.storyPoints?.total || 0,
            efficiency: sprintAnalytics.efficiency || 0
          };
        }
      } catch (analyticsError) {
        console.error('Error getting sprint analytics:', analyticsError);
        result.analytics = null;
      }
    }

    // Include objectives if requested
    if (includeObjectivesBool) {
      try {
        const objectives = await getCurrentSprintObjectives(actualBoardId);
        result.objectives = objectives;
      } catch (objectivesError) {
        console.error('Error getting sprint objectives:', objectivesError);
        result.objectives = null;
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error in sprint details endpoint:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/sprint/list:
 *   get:
 *     summary: Get sprints with comprehensive filtering and sorting
 *     description: Returns a list of sprints with filtering, sorting, and optional analytics
 *     tags:
 *       - Sprint
 *     parameters:
 *       - in: query
 *         name: projectKey
 *         schema:
 *           type: string
 *         required: false
 *         description: Jira project key (e.g., FRN) - use this OR boardId, not both
 *       - in: query
 *         name: boardId
 *         schema:
 *           type: string
 *         required: false
 *         description: Jira board ID (e.g., 59059) - use this OR projectKey, not both
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         required: false
 *         description: Sprint state filter - active,closed,future
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         required: false
 *         description: Maximum number of sprints to return
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: Start date filter YYYY-MM-DD - only sprints starting after this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: End date filter YYYY-MM-DD - only sprints ending before this date
 *       - in: query
 *         name: sprintIncludeFilter
 *         schema:
 *           type: string
 *         required: false
 *         description: Include only sprints with names containing this filter
 *       - in: query
 *         name: sprintExcludeFilter
 *         schema:
 *           type: string
 *         required: false
 *         description: Exclude sprints with names containing this filter
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [startDate, endDate, name, id]
 *         required: false
 *         description: Sort field - default startDate
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         required: false
 *         description: Sort order - default desc
 *       - in: query
 *         name: includeAnalytics
 *         schema:
 *           type: boolean
 *         required: false
 *         description: Include sprint analytics for each sprint - default false
 *     responses:
 *       200:
 *         description: List of sprints with optional analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sprints:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       state:
 *                         type: string
 *                       startDate:
 *                         type: string
 *                       endDate:
 *                         type: string
 *                       analytics:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           totalIssues:
 *                             type: number
 *                           completedIssues:
 *                             type: number
 *                           totalStoryPoints:
 *                             type: number
 *                           completedStoryPoints:
 *                             type: number
 *                           velocity:
 *                             type: number
 *                           efficiency:
 *                             type: number
 *                 totalCount:
 *                   type: integer
 *                 filteredCount:
 *                   type: integer
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
router.get('/list', async (req, res) => {
  try {
    const { 
      projectKey,
      boardId,
      state = 'active,closed,future', 
      limit, 
      startDate, 
      endDate, 
      sprintIncludeFilter, 
      sprintExcludeFilter,
      sortBy = 'startDate',
      sortOrder = 'desc',
      includeAnalytics = 'false'
    } = req.query;
    
    // Validate that either projectKey or boardId is provided, but not both
    if (!projectKey && !boardId) {
      return res.status(400).json({ 
        error: 'Either projectKey or boardId must be provided',
        example: 'Use ?projectKey=FRN or ?boardId=59059'
      });
    }

    if (projectKey && boardId) {
      return res.status(400).json({ 
        error: 'Provide either projectKey OR boardId, not both',
        example: 'Use ?projectKey=FRN or ?boardId=59059'
      });
    }

    console.log(`[DEBUG] Getting sprints for: ${projectKey ? 'projectKey: ' + projectKey : 'boardId: ' + boardId}`);

    // Determine the board ID to use
    let boardIdToUse: string;
    if (projectKey) {
      try {
        boardIdToUse = await getBoardIdFromProjectKey(projectKey as string);
        console.log(`[DEBUG] Converted project key ${projectKey} to board ID: ${boardIdToUse}`);
      } catch (error) {
        return res.status(404).json({ 
          error: `No board found for project key: ${projectKey}`,
          message: 'Please check if the project has any boards configured in Jira'
        });
      }
    } else {
      boardIdToUse = boardId as string;
    }
    const includeAnalyticsBool = includeAnalytics === 'true';

    // Get sprints with filtering
    let sprints = await getSprintsFromJira(boardIdToUse, state as string, {
      startDate: startDate as string,
      endDate: endDate as string,
      timezone: 'UTC',
      sprintExcludeFilter: sprintExcludeFilter as string,
      sprintIncludeFilter: sprintIncludeFilter as string,
      originBoardId: true
    });

    console.log(`[DEBUG] Found ${sprints.length} sprints for board ${boardIdToUse}`);

    if (sprints.length === 0) {
      console.log(`[DEBUG] No sprints found with origin_board_id=true, trying with origin_board_id=false`);
      
      // Python fallback logic: try without origin board ID filter
      const fallbackSprints = await getSprintsFromJira(boardIdToUse, state as string, {
        startDate: startDate as string,
        endDate: endDate as string,
        timezone: 'UTC',
        sprintExcludeFilter: sprintExcludeFilter as string,
        sprintIncludeFilter: sprintIncludeFilter as string,
        originBoardId: false
      });
      
      if (fallbackSprints.length === 0) {
        return res.status(404).json({ 
          error: `No sprints found for ${projectKey || boardId} (board ID: ${boardIdToUse})`,
          boardId: boardIdToUse,
          projectKey: projectKey || null,
          inputBoardId: boardId || null,
          message: 'Try checking if the project has boards configured in Jira'
        });
      }
      
      // Use fallback sprints
      sprints = fallbackSprints;
      console.log(`[DEBUG] Found ${sprints.length} sprints with fallback logic`);
    }

    // Sort sprints
    const sortedSprints = sprints.sort((firstSprint, secondSprint) => {
      let firstValue: number | string;
      let secondValue: number | string;

      switch (sortBy) {
        case 'startDate':
          firstValue = firstSprint.startDate ? new Date(firstSprint.startDate).getTime() : 0;
          secondValue = secondSprint.startDate ? new Date(secondSprint.startDate).getTime() : 0;
          break;
        case 'endDate':
          firstValue = firstSprint.endDate ? new Date(firstSprint.endDate).getTime() : 0;
          secondValue = secondSprint.endDate ? new Date(secondSprint.endDate).getTime() : 0;
          break;
        case 'name':
          firstValue = firstSprint.name || '';
          secondValue = secondSprint.name || '';
          break;
        case 'id':
          firstValue = firstSprint.id;
          secondValue = secondSprint.id;
          break;
        default:
          firstValue = firstSprint.startDate ? new Date(firstSprint.startDate).getTime() : 0;
          secondValue = secondSprint.startDate ? new Date(secondSprint.startDate).getTime() : 0;
      }

      if (sortOrder === 'asc') {
        return firstValue > secondValue ? 1 : -1;
      } else {
        return firstValue < secondValue ? 1 : -1;
      }
    });

    // Apply limit
    const limitedSprints = limit ? sortedSprints.slice(0, parseInt(limit as string, 10)) : sortedSprints;

    // Add analytics if requested
    let sprintsWithAnalytics = limitedSprints.map(sprint => ({
      id: sprint.id,
      name: sprint.name || '',
      state: sprint.state || '',
      startDate: sprint.startDate || '',
      endDate: sprint.endDate || ''
    }));

    if (includeAnalyticsBool) {
      try {
        const sprintIds = limitedSprints.map(s => s.id);
        const analytics = await getSprintSummary({
          boardId: boardIdToUse,
          sprintIds
        });

        // Merge analytics with sprint data
        sprintsWithAnalytics = sprintsWithAnalytics.map(sprint => {
          const sprintAnalytics = analytics.find(a => a.sprintId === sprint.id);
          return {
            ...sprint,
                         analytics: sprintAnalytics ? {
               totalIssues: sprintAnalytics.storyPoints?.total || 0,
               completedIssues: sprintAnalytics.storyPoints?.completed || 0,
               totalStoryPoints: sprintAnalytics.storyPoints?.total || 0,
               completedStoryPoints: sprintAnalytics.storyPoints?.completed || 0,
               velocity: sprintAnalytics.storyPoints?.total || 0,
               efficiency: sprintAnalytics.efficiency || 0
             } : null
          };
        });
      } catch (analyticsError) {
        console.error('Error getting sprint analytics:', analyticsError);
        // Continue without analytics
      }
    }

    res.json({
      sprints: sprintsWithAnalytics,
      totalCount: sprints.length,
      filteredCount: limitedSprints.length
    });
  } catch (err) {
    console.error('Error in sprint list endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/sprint/project/{projectKey}/boards:
 *   get:
 *     summary: Get project boards with sprints
 *     description: Returns all boards for a project with their associated sprints
 *     tags:
 *       - Sprint
 *     parameters:
 *       - in: path
 *         name: projectKey
 *         schema:
 *           type: string
 *         required: true
 *         description: Jira project key (e.g., FRN)
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         required: false
 *         description: Sprint state filter - active,closed,future
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         required: false
 *         description: Maximum number of sprints per board
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: Start date filter YYYY-MM-DD
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: End date filter YYYY-MM-DD
 *       - in: query
 *         name: sprintIncludeFilter
 *         schema:
 *           type: string
 *         required: false
 *         description: Include only sprints with names containing this filter
 *       - in: query
 *         name: sprintExcludeFilter
 *         schema:
 *           type: string
 *         required: false
 *         description: Exclude sprints with names containing this filter
 *     responses:
 *       200:
 *         description: Project boards with sprints
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 projectKey:
 *                   type: string
 *                 totalBoards:
 *                   type: integer
 *                 boards:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       boardId:
 *                         type: string
 *                       boardName:
 *                         type: string
 *                       boardType:
 *                         type: string
 *                       totalSprints:
 *                         type: integer
 *                       returnedSprints:
 *                         type: integer
 *                       sprints:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             sprintId:
 *                               type: integer
 *                             sprintName:
 *                               type: string
 *                             state:
 *                               type: string
 *                             startDate:
 *                               type: string
 *                             endDate:
 *                               type: string
 *       400:
 *         description: Missing project key
 *       500:
 *         description: Server error
 */
router.get('/project/:projectKey/boards', async (req, res) => {
  try {
    const { projectKey } = req.params;
    const { 
      state = 'active,closed,future', 
      limit, 
      startDate, 
      endDate, 
      sprintIncludeFilter, 
      sprintExcludeFilter 
    } = req.query;
    
    if (!projectKey) {
      return res.status(400).json({ error: 'Missing project key' });
    }

    console.log(`[DEBUG] Getting boards and sprints for project: ${projectKey}`);

    // Get all boards for the project
    const credentials = {
      url: process.env.JIRA_URL!,
      user: process.env.JIRA_USER!,
      token: process.env.JIRA_TOKEN!
    };

    const boardsResponse = await fetchWithProxy(`${credentials.url}/rest/agile/1.0/board`, {
      auth: { username: credentials.user, password: credentials.token },
    });

    if (!boardsResponse.ok) {
      throw new Error(`Failed to fetch boards: ${boardsResponse.status} ${boardsResponse.statusText}`);
    }

    const boardsData = await boardsResponse.json() as { values: Array<{ id: number; name: string; type: string; location?: { projectKey: string } }> };
    const projectBoards = boardsData.values.filter(board => board.location && board.location.projectKey === projectKey);

    // Get sprints for each board
    const boardsWithSprints = await Promise.all(
      projectBoards.map(async (board) => {
        try {
          console.log(`[DEBUG] Getting sprints for board ${board.id}`);
          const sprints = await getSprintsFromJira(board.id.toString(), state as string, {
            startDate: startDate as string,
            endDate: endDate as string,
            timezone: 'UTC',
            sprintExcludeFilter: sprintExcludeFilter as string,
            sprintIncludeFilter: sprintIncludeFilter as string,
            originBoardId: true
          });
          
          // Sort sprints by start date (most recent first)
          const sortedSprints = sprints.sort((firstSprint, secondSprint) => {
            const firstDate = firstSprint.startDate ? new Date(firstSprint.startDate).getTime() : 0;
            const secondDate = secondSprint.startDate ? new Date(secondSprint.startDate).getTime() : 0;
            return secondDate - firstDate;
          });

          // Apply limit if specified
          const limitedSprints = limit ? sortedSprints.slice(0, parseInt(limit as string, 10)) : sortedSprints;

          const sprintList = limitedSprints.map(sprint => ({
            sprintId: sprint.id,
            sprintName: sprint.name || '',
            state: sprint.state || '',
            startDate: sprint.startDate || '',
            endDate: sprint.endDate || ''
          }));

          return {
            boardId: board.id.toString(),
            boardName: board.name,
            boardType: board.type,
            totalSprints: sprints.length,
            returnedSprints: sprintList.length,
            sprints: sprintList
          };
        } catch (error) {
          console.error(`[DEBUG] Error getting sprints for board ${board.id}:`, error);
          return {
            boardId: board.id.toString(),
            boardName: board.name,
            boardType: board.type,
            totalSprints: 0,
            returnedSprints: 0,
            sprints: [],
            error: (error as Error).message
          };
        }
      })
    );

    res.json({
      projectKey,
      totalBoards: projectBoards.length,
      boards: boardsWithSprints
    });
  } catch (err) {
    console.error('Error in project boards endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router; 