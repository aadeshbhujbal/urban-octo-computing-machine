import { Router } from 'express';
import { getPiPlanningData } from '../../services/piPlanningService';

const router = Router();

/**
 * @swagger
 * /api/v1/pi-planning:
 *   get:
 *     summary: Get PI Planning data
 *     description: Returns PI Planning data including sprints, story points, epics, and releases.
 *     tags:
 *       - PI Planning
 *     parameters:
 *       - in: query
 *         name: projectName
 *         schema:
 *           type: string
 *         required: true
 *         description: Jira project name (e.g., FRN)
 *       - in: query
 *         name: boardId
 *         schema:
 *           type: string
 *         required: true
 *         description: Jira board ID
 *       - in: query
 *         name: piStartDate
 *         schema:
 *           type: string
 *         required: true
 *         description: PI start date in YYYY-MM-DD format
 *       - in: query
 *         name: piEndDate
 *         schema:
 *           type: string
 *         required: true
 *         description: PI end date in YYYY-MM-DD format
 *       - in: query
 *         name: sprintExcludeFilter
 *         schema:
 *           type: string
 *         description: Filter to exclude sprints by name
 *       - in: query
 *         name: sprintIncludeFilter
 *         schema:
 *           type: string
 *         description: Filter to include sprints by name
 *     responses:
 *       200:
 *         description: PI Planning data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 projectSprints:
 *                   type: array
 *                   items:
 *                     type: string
 *                 totalStoryPoints:
 *                   type: number
 *                 completedStoryPoints:
 *                   type: number
 *                 inProgressStoryPoints:
 *                   type: number
 *                 toDoStoryPoints:
 *                   type: number
 *                 piEpics:
 *                   type: array
 *                   items:
 *                     type: string
 *                 releases:
 *                   type: array
 *                   items:
 *                     type: object
 *                 currentSprints:
 *                   type: array
 *                   items:
 *                     type: string
 *                 sprints:
 *                   type: object
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res) => {
  try {
    const { 
      projectName,
      boardId,
      piStartDate,
      piEndDate,
      sprintExcludeFilter,
      sprintIncludeFilter
    } = req.query;

    // Validate required parameters
    if (!projectName || !boardId || !piStartDate || !piEndDate) {
      return res.status(400).json({ 
        error: 'Missing required parameters. Required: projectName, boardId, piStartDate, piEndDate' 
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(piStartDate as string) || !dateRegex.test(piEndDate as string)) {
      return res.status(400).json({ 
        error: 'Invalid date format. Required format: YYYY-MM-DD' 
      });
    }

    const piPlanningData = await getPiPlanningData({
      projectName: projectName as string,
      boardId: boardId as string,
      piStartDate: piStartDate as string,
      piEndDate: piEndDate as string,
      sprintExcludeFilter: sprintExcludeFilter as string,
      sprintIncludeFilter: sprintIncludeFilter as string
    });

    res.json(piPlanningData);
  } catch (err) {
    console.error('Error in PI Planning endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router; 