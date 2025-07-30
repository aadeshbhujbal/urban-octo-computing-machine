import { Router } from 'express';
import { getSprintDetails, getSprintSummary } from '../../services/sprintService';

const router = Router();

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
 *         name: boardId
 *         schema:
 *           type: string
 *         required: true
 *         description: Jira board ID
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
 *         description: Sprint state filter (active,closed,future)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: Start date filter (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: End date filter (YYYY-MM-DD)
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
    const { boardId, sprintIds, state, startDate, endDate } = req.query;
    
    if (!boardId) {
      return res.status(400).json({ error: 'Missing required parameter: boardId' });
    }

    const sprintIdsArray = sprintIds ? (sprintIds as string).split(',').map(id => parseInt(id.trim(), 10)) : undefined;

    const result = await getSprintSummary({
      boardId: boardId as string,
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
 * /api/v1/sprint/{sprintId}:
 *   get:
 *     summary: Get detailed sprint information
 *     description: Returns detailed information for a specific sprint including all metrics and objectives.
 *     tags:
 *       - Sprint
 *     parameters:
 *       - in: path
 *         name: sprintId
 *         schema:
 *           type: integer
 *         required: true
 *         description: Sprint ID
 *     responses:
 *       200:
 *         description: Sprint details
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
 *       404:
 *         description: Sprint not found
 *       500:
 *         description: Server error
 */
router.get('/:sprintId', async (req, res) => {
  try {
    const { sprintId } = req.params;
    
    if (!sprintId) {
      return res.status(400).json({ error: 'Missing sprint ID' });
    }

    const result = await getSprintDetails(parseInt(sprintId, 10));
    
    if (!result) {
      return res.status(404).json({ error: 'Sprint not found' });
    }

    res.json(result);
  } catch (err) {
    console.error('Error in sprint details endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router; 