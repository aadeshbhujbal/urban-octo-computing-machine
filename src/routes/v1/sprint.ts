import { Router } from 'express';
import { getSprintDetails, getSprintSummary } from '../../services/sprintService';
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
 * /api/v1/sprint/project/{projectKey}/boards:
 *   get:
 *     summary: Get all board IDs and their sprints for a project key
 *     description: Returns all board IDs associated with a project key (e.g., FRN) along with their sprints
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
 *         description: Maximum number of sprints per board to return
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
 *     responses:
 *       200:
 *         description: List of board IDs and their sprints for the project
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

    const boardsData = await boardsResponse.json() as { values: Array<{ id: number; name: string; type: string; location: { projectKey: string } }> };
    const projectBoards = boardsData.values.filter(board => board.location.projectKey === projectKey);

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

/**
 * @swagger
 * /api/v1/sprint/board/{boardId}/sprints:
 *   get:
 *     summary: Get all sprints for a specific board ID
 *     description: Returns all sprints associated with a specific board ID
 *     tags:
 *       - Sprint
 *     parameters:
 *       - in: path
 *         name: boardId
 *         schema:
 *           type: string
 *         required: true
 *         description: Jira board ID (e.g., 59059)
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
 *     responses:
 *       200:
 *         description: List of sprints for the board
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 boardId:
 *                   type: string
 *                 totalSprints:
 *                   type: integer
 *                 filteredSprints:
 *                   type: integer
 *                 sprints:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sprintId:
 *                         type: integer
 *                       sprintName:
 *                         type: string
 *                       state:
 *                         type: string
 *                       startDate:
 *                         type: string
 *                       endDate:
 *                         type: string
 *       400:
 *         description: Missing board ID
 *       500:
 *         description: Server error
 */
router.get('/board/:boardId/sprints', async (req, res) => {
  try {
    const { boardId } = req.params;
    const { 
      state = 'active,closed,future', 
      limit, 
      startDate, 
      endDate, 
      sprintIncludeFilter, 
      sprintExcludeFilter 
    } = req.query;
    
    if (!boardId) {
      return res.status(400).json({ error: 'Missing board ID' });
    }

    console.log(`[DEBUG] Getting sprints for board: ${boardId} with state: ${state}`);

    // Get sprints for the specific board
    const sprints = await getSprintsFromJira(boardId, state as string, {
      startDate: startDate as string,
      endDate: endDate as string,
      timezone: 'UTC',
      sprintExcludeFilter: sprintExcludeFilter as string,
      sprintIncludeFilter: sprintIncludeFilter as string,
      originBoardId: true
    });
    
    console.log(`[DEBUG] Found ${sprints.length} sprints for board ${boardId}`);

    // Sort sprints by start date (most recent first)
    const sortedSprints = sprints.sort((firstSprint, secondSprint) => {
      const firstDate = firstSprint.startDate ? new Date(firstSprint.startDate).getTime() : 0;
      const secondDate = secondSprint.startDate ? new Date(secondSprint.startDate).getTime() : 0;
      return secondDate - firstDate;
    });

    // Apply limit if specified
    const limitedSprints = limit ? sortedSprints.slice(0, parseInt(limit as string, 10)) : sortedSprints;

    // Transform to the expected format
    const sprintList = limitedSprints.map(sprint => ({
      sprintId: sprint.id,
      sprintName: sprint.name || '',
      state: sprint.state || '',
      startDate: sprint.startDate || '',
      endDate: sprint.endDate || ''
    }));

    res.json({
      boardId,
      totalSprints: sprints.length,
      returnedSprints: sprintList.length,
      sprints: sprintList
    });
  } catch (err) {
    console.error('Error in board sprints endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/sprint/{sprintId}/details:
 *   get:
 *     summary: Get detailed sprint information
 *     description: Returns comprehensive sprint details including metrics, objectives, and team information
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
 *         name: projectKeyOrBoardId
 *         schema:
 *           type: string
 *         required: false
 *         description: Jira project key (e.g., FRN) or board ID (e.g., 59059) to help locate the sprint
 *     responses:
 *       200:
 *         description: Detailed sprint information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sprintId:
 *                   type: number
 *                 sprintName:
 *                   type: string
 *                 startDate:
 *                   type: string
 *                 endDate:
 *                   type: string
 *                 sprintObjective:
 *                   type: string
 *                 sprintStatus:
 *                   type: string
 *                 storyPoints:
 *                   type: object
 *                   properties:
 *                     committed:
 *                       type: number
 *                     completed:
 *                       type: number
 *                     added:
 *                       type: number
 *                     total:
 *                       type: number
 *                 teamMembers:
 *                   type: number
 *                 efficiency:
 *                   type: number
 *                 velocity:
 *                   type: object
 *                   properties:
 *                     estimated:
 *                       type: number
 *                     completed:
 *                       type: number
 *       404:
 *         description: Sprint not found
 *       500:
 *         description: Server error
 */
router.get('/:sprintId/details', async (req, res) => {
  try {
    const { sprintId } = req.params;
    const { projectKeyOrBoardId } = req.query;
    
    if (!sprintId) {
      return res.status(400).json({ error: 'Missing sprint ID' });
    }

    console.log(`[DEBUG] Getting detailed sprint info for sprint: ${sprintId}`);

    const result = await getSprintDetails(parseInt(sprintId, 10), projectKeyOrBoardId as string);
    
    if (!result) {
      return res.status(404).json({ error: 'Sprint not found' });
    }

    res.json(result);
  } catch (err) {
    console.error('Error in sprint details endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/sprint/summary:
 *   get:
 *     summary: Get sprint summary data
 *     description: Returns sprint data including name, story points, start/end dates, sprint objective, and status.
 *     tags:
 *       - Sprint
 *     parameters:
 *       - in: query
 *         name: projectKeyOrBoardId
 *         schema:
 *           type: string
 *         required: true
 *         description: Jira project key (e.g., FRN) or board ID (e.g., 59059)
 *       - in: query
 *         name: sprintIds
 *         schema:
 *           type: string
 *         required: false
 *         description: Comma-separated list of sprint IDs
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         required: false
 *         description: Sprint state filter - active,closed,future
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
 *     responses:
 *       200:
 *         description: Sprint summary data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   sprintId:
 *                     type: number
 *                   sprintName:
 *                     type: string
 *                   startDate:
 *                     type: string
 *                   endDate:
 *                     type: string
 *                   sprintObjective:
 *                     type: string
 *                   sprintStatus:
 *                     type: string
 *                   storyPoints:
 *                     type: object
 *                     properties:
 *                       committed:
 *                         type: number
 *                       completed:
 *                         type: number
 *                       added:
 *                         type: number
 *                       total:
 *                         type: number
 *                   teamMembers:
 *                     type: number
 *                   efficiency:
 *                     type: number
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
router.get('/summary', async (req, res) => {
  try {
    const { projectKeyOrBoardId, sprintIds, state, startDate, endDate } = req.query;
    
    if (!projectKeyOrBoardId) {
      return res.status(400).json({ error: 'Missing required parameter: projectKeyOrBoardId' });
    }

    const sprintIdsArray = sprintIds ? (sprintIds as string).split(',').map(id => parseInt(id.trim(), 10)) : undefined;

    const result = await getSprintSummary({
      boardId: projectKeyOrBoardId as string,
      sprintIds: sprintIdsArray,
      state: state as string,
      startDate: startDate as string,
      endDate: endDate as string
    });

    res.json(result);
  } catch (err) {
    console.error('Error in sprint summary endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/sprint/list:
 *   get:
 *     summary: List sprints by project key or board ID
 *     description: Returns a list of sprints with their IDs, names, and basic information
 *     tags:
 *       - Sprint
 *     parameters:
 *       - in: query
 *         name: projectKeyOrBoardId
 *         schema:
 *           type: string
 *         required: true
 *         description: Jira project key (e.g., FRN) or board ID (e.g., 59059)
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
 *     responses:
 *       200:
 *         description: List of sprints
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 projectKeyOrBoardId:
 *                   type: string
 *                 totalSprints:
 *                   type: integer
 *                 filteredSprints:
 *                   type: integer
 *                 sprints:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sprintId:
 *                         type: integer
 *                       sprintName:
 *                         type: string
 *                       state:
 *                         type: string
 *                       startDate:
 *                         type: string
 *                       endDate:
 *                         type: string
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
router.get('/list', async (req, res) => {
  try {
    const { 
      projectKeyOrBoardId, 
      state = 'active,closed,future', 
      limit, 
      startDate, 
      endDate, 
      sprintIncludeFilter, 
      sprintExcludeFilter 
    } = req.query;
    
    if (!projectKeyOrBoardId) {
      return res.status(400).json({ error: 'Missing required parameter: projectKeyOrBoardId' });
    }

    console.log(`[DEBUG] Listing sprints for project/board: ${projectKeyOrBoardId} with state: ${state}`);

    // Get board ID from project key if provided
    const boardIdToUse = await getBoardId(projectKeyOrBoardId as string);

    // Get sprints using the existing service
    const sprints = await getSprintsFromJira(boardIdToUse, state as string, {
      startDate: startDate as string,
      endDate: endDate as string,
      timezone: 'UTC',
      sprintExcludeFilter: sprintExcludeFilter as string,
      sprintIncludeFilter: sprintIncludeFilter as string,
      originBoardId: true
    });
    
    console.log(`[DEBUG] Found ${sprints.length} sprints for ${projectKeyOrBoardId}`);

    // Sort sprints by start date (most recent first)
    const sortedSprints = sprints.sort((firstSprint, secondSprint) => {
      const firstDate = firstSprint.startDate ? new Date(firstSprint.startDate).getTime() : 0;
      const secondDate = secondSprint.startDate ? new Date(secondSprint.startDate).getTime() : 0;
      return secondDate - firstDate;
    });

    // Apply limit if specified
    const limitedSprints = limit ? sortedSprints.slice(0, parseInt(limit as string, 10)) : sortedSprints;

    // Transform to the expected format
    const sprintList = limitedSprints.map(sprint => ({
      sprintId: sprint.id,
      sprintName: sprint.name || '',
      state: sprint.state || '',
      startDate: sprint.startDate || '',
      endDate: sprint.endDate || ''
    }));

    res.json({
      projectKeyOrBoardId: projectKeyOrBoardId as string,
      totalSprints: sprints.length,
      returnedSprints: sprintList.length,
      sprints: sprintList
    });
  } catch (err) {
    console.error('Error in sprint list endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/sprint/sorted-ids:
 *   get:
 *     summary: Get sorted sprint IDs matching Python get_sorted_sprint_ids function
 *     description: Returns sprint IDs from a Jira board within a date range, optimized for performance (Python equivalent)
 *     tags:
 *       - Sprint
 *     parameters:
 *       - in: query
 *         name: boardId
 *         schema:
 *           type: string
 *         required: true
 *         description: Jira board ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: Start date in format YYYY-MM-DD
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: End date in format YYYY-MM-DD
 *       - in: query
 *         name: timezone
 *         schema:
 *           type: string
 *         required: false
 *         description: Timezone for date comparisons - default UTC
 *       - in: query
 *         name: sprintExcludeFilter
 *         schema:
 *           type: string
 *         required: false
 *         description: Exclude sprints with names containing this filter
 *       - in: query
 *         name: sprintIncludeFilter
 *         schema:
 *           type: string
 *         required: false
 *         description: Include only sprints with names containing this filter
 *       - in: query
 *         name: originBoardId
 *         schema:
 *           type: boolean
 *         required: false
 *         description: Filter by origin board ID - default true
 *     responses:
 *       200:
 *         description: List of sprint IDs sorted chronologically
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 boardId:
 *                   type: string
 *                 startDate:
 *                   type: string
 *                 endDate:
 *                   type: string
 *                 totalSprints:
 *                   type: integer
 *                 sprintIds:
 *                   type: array
 *                   items:
 *                     type: integer
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
router.get('/sorted-ids', async (req, res) => {
  try {
    const { 
      boardId, 
      startDate, 
      endDate, 
      timezone = 'UTC',
      sprintExcludeFilter,
      sprintIncludeFilter,
      originBoardId = 'true'
    } = req.query;
    
    if (!boardId || !startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Missing required parameters: boardId, startDate, endDate' 
      });
    }

    console.log(`[DEBUG] Getting sorted sprint IDs for board: ${boardId} from ${startDate} to ${endDate}`);

    // Get sprints using the enhanced service with Python-equivalent logic
    const sprints = await getSprintsFromJira(boardId as string, 'active,closed,future', {
      startDate: startDate as string,
      endDate: endDate as string,
      timezone: timezone as string,
      sprintExcludeFilter: sprintExcludeFilter as string,
      sprintIncludeFilter: sprintIncludeFilter as string,
      originBoardId: originBoardId === 'true'
    });
    
    // Return just the IDs sorted chronologically (Python equivalent)
    const sprintIds = sprints.map(sprint => sprint.id);
    
    console.log(`[DEBUG] Found ${sprintIds.length} sprint IDs for board ${boardId}`);

    res.json({
      boardId: boardId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      timezone: timezone as string,
      totalSprints: sprintIds.length,
      sprintIds: sprintIds
    });
  } catch (err) {
    console.error('Error in sorted sprint IDs endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router; 