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

/**
 * @swagger
 * /api/v1/pi-planning/epic-breakdown:
 *   get:
 *     summary: Get PI Planning epic breakdown
 *     description: Returns epic breakdown with story points, status, and additional information.
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
 *     responses:
 *       200:
 *         description: Epic breakdown data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
router.get('/epic-breakdown', async (req, res) => {
  try {
    const { 
      projectName,
      boardId,
      piStartDate,
      piEndDate
    } = req.query;

    // Validate required parameters
    if (!projectName || !boardId || !piStartDate || !piEndDate) {
      return res.status(400).json({ 
        error: 'Missing required parameters. Required: projectName, boardId, piStartDate, piEndDate' 
      });
    }

    const piPlanningData = await getPiPlanningData({
      projectName: projectName as string,
      boardId: boardId as string,
      piStartDate: piStartDate as string,
      piEndDate: piEndDate as string
    });

    // Return epic breakdown data
    res.json({
      epics: piPlanningData.piEpics,
      epicDetails: piPlanningData.epicDetails || [],
      totalEpics: piPlanningData.piEpics.length
    });
  } catch (err) {
    console.error('Error in PI Planning epic breakdown endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/pi-planning/sprint-breakdown:
 *   get:
 *     summary: Get PI Planning sprint breakdown
 *     description: Returns sprint breakdown with story points and status information.
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
 *     responses:
 *       200:
 *         description: Sprint breakdown data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
router.get('/sprint-breakdown', async (req, res) => {
  try {
    const { 
      projectName,
      boardId,
      piStartDate,
      piEndDate
    } = req.query;

    // Validate required parameters
    if (!projectName || !boardId || !piStartDate || !piEndDate) {
      return res.status(400).json({ 
        error: 'Missing required parameters. Required: projectName, boardId, piStartDate, piEndDate' 
      });
    }

    const piPlanningData = await getPiPlanningData({
      projectName: projectName as string,
      boardId: boardId as string,
      piStartDate: piStartDate as string,
      piEndDate: piEndDate as string
    });

    // Return sprint breakdown data
    res.json({
      sprints: piPlanningData.sprints,
      currentSprints: piPlanningData.currentSprints,
      totalSprints: Object.keys(piPlanningData.sprints).length
    });
  } catch (err) {
    console.error('Error in PI Planning sprint breakdown endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/pi-planning/story-points:
 *   get:
 *     summary: Get PI Planning story points analysis
 *     description: Returns detailed story points analysis with breakdown by status and epics.
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
 *     responses:
 *       200:
 *         description: Story points analysis data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
router.get('/story-points', async (req, res) => {
  try {
    const { 
      projectName,
      boardId,
      piStartDate,
      piEndDate
    } = req.query;

    // Validate required parameters
    if (!projectName || !boardId || !piStartDate || !piEndDate) {
      return res.status(400).json({ 
        error: 'Missing required parameters. Required: projectName, boardId, piStartDate, piEndDate' 
      });
    }

    const piPlanningData = await getPiPlanningData({
      projectName: projectName as string,
      boardId: boardId as string,
      piStartDate: piStartDate as string,
      piEndDate: piEndDate as string
    });

    // Return story points analysis data
    res.json({
      totalStoryPoints: piPlanningData.totalStoryPoints,
      completedStoryPoints: piPlanningData.completedStoryPoints,
      inProgressStoryPoints: piPlanningData.inProgressStoryPoints,
      toDoStoryPoints: piPlanningData.toDoStoryPoints,
      storyPointsBreakdown: piPlanningData.storyPointsBreakdown || {}
    });
  } catch (err) {
    console.error('Error in PI Planning story points endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router; 