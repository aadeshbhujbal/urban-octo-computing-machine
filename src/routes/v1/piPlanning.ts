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

/**
 * @swagger
 * /api/v1/pi-planning/summary:
 *   get:
 *     summary: Get comprehensive PI Planning analytics
 *     description: Returns comprehensive PI Planning analytics including all key metrics and breakdowns.
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
 *         description: Comprehensive PI Planning analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
router.get('/summary', async (req, res) => {
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
    console.error('Error in PI Planning summary endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/pi-planning/releases:
 *   get:
 *     summary: Get release information
 *     description: Returns release information for the PI Planning period.
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
 *         description: Release information
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
router.get('/releases', async (req, res) => {
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

    res.json({
      releases: piPlanningData.releases,
      fixVersions: piPlanningData.fixVersions || [],
      issuesWithoutFixVersion: piPlanningData.issuesWithoutFixVersion || 0
    });
  } catch (err) {
    console.error('Error in PI Planning releases endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/pi-planning/sprints:
 *   get:
 *     summary: Get sprint details
 *     description: Returns detailed sprint information for the PI Planning period.
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
 *         description: Sprint details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
router.get('/sprints', async (req, res) => {
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

    res.json({
      projectSprints: piPlanningData.projectSprints,
      currentSprints: piPlanningData.currentSprints,
      sprints: piPlanningData.sprints,
      totalSprints: piPlanningData.projectSprints.length
    });
  } catch (err) {
    console.error('Error in PI Planning sprints endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/pi-planning/issues:
 *   get:
 *     summary: Get issues list
 *     description: Returns list of issues for the PI Planning period.
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
 *         description: Issues list
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
router.get('/issues', async (req, res) => {
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

    // This would need to be implemented in the service to return actual issues
    res.json({
      message: "Issues endpoint - implementation needed in piPlanningService",
      totalIssues: 0,
      issues: []
    });
  } catch (err) {
    console.error('Error in PI Planning issues endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/pi-planning/rag-status:
 *   get:
 *     summary: Get RAG status
 *     description: Returns RAG (Red, Amber, Green) status for PI Planning.
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
 *         description: RAG status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
router.get('/rag-status', async (req, res) => {
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

    // Calculate RAG status based on story points completion
    const totalPoints = piPlanningData.totalStoryPoints;
    const completedPoints = piPlanningData.completedStoryPoints;
    const completionRate = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;

    let ragStatus = 'GREEN';
    if (completionRate < 70) {
      ragStatus = 'RED';
    } else if (completionRate < 85) {
      ragStatus = 'AMBER';
    }

    res.json({
      ragStatus,
      completionRate: Math.round(completionRate * 100) / 100,
      totalStoryPoints: totalPoints,
      completedStoryPoints: completedPoints,
      inProgressStoryPoints: piPlanningData.inProgressStoryPoints,
      toDoStoryPoints: piPlanningData.toDoStoryPoints
    });
  } catch (err) {
    console.error('Error in PI Planning RAG status endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/pi-planning/burnup:
 *   get:
 *     summary: Get burn-up charts
 *     description: Returns burn-up chart data for PI Planning.
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
 *         description: Burn-up chart data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
router.get('/burnup', async (req, res) => {
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

    res.json({
      message: "Burn-up chart endpoint - implementation needed in piPlanningService",
      totalStoryPoints: piPlanningData.totalStoryPoints,
      completedStoryPoints: piPlanningData.completedStoryPoints,
      burnupData: []
    });
  } catch (err) {
    console.error('Error in PI Planning burnup endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/pi-planning/raid:
 *   get:
 *     summary: Get RAID data
 *     description: Returns RAID (Risks, Assumptions, Issues, Dependencies) data for PI Planning.
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
 *         description: RAID data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
router.get('/raid', async (req, res) => {
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

    // Extract RAID data from epic details
    const raidData = piPlanningData.epicDetails?.filter(epic => epic.raid) || [];

    res.json({
      raidItems: raidData,
      totalRaidItems: raidData.length,
      risks: raidData.filter(item => item.raid?.toLowerCase().includes('risk')),
      assumptions: raidData.filter(item => item.raid?.toLowerCase().includes('assumption')),
      issues: raidData.filter(item => item.raid?.toLowerCase().includes('issue')),
      dependencies: raidData.filter(item => item.raid?.toLowerCase().includes('dependency'))
    });
  } catch (err) {
    console.error('Error in PI Planning RAID endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/pi-planning/wsjf:
 *   get:
 *     summary: Get WSJF metrics
 *     description: Returns WSJF (Weighted Shortest Job First) metrics for PI Planning.
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
 *         description: WSJF metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
router.get('/wsjf', async (req, res) => {
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

    // Extract WSJF data from epic details
    const wsjfData = piPlanningData.epicDetails?.filter(epic => epic.wsjf) || [];

    res.json({
      wsjfItems: wsjfData,
      totalWsjfItems: wsjfData.length,
      averageWsjf: wsjfData.length > 0 ? 
        wsjfData.reduce((sum, item) => sum + (parseFloat(item.wsjf || '0') || 0), 0) / wsjfData.length : 0
    });
  } catch (err) {
    console.error('Error in PI Planning WSJF endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/pi-planning/pi-scope:
 *   get:
 *     summary: Get PI scope
 *     description: Returns PI scope information for PI Planning.
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
 *         description: PI scope information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
router.get('/pi-scope', async (req, res) => {
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

    // Extract PI scope data from epic details
    const piScopeData = piPlanningData.epicDetails?.filter(epic => epic.piScope) || [];

    res.json({
      piScopeItems: piScopeData,
      totalPiScopeItems: piScopeData.length,
      inScope: piScopeData.filter(item => item.piScope?.toLowerCase().includes('in scope')),
      outOfScope: piScopeData.filter(item => item.piScope?.toLowerCase().includes('out of scope'))
    });
  } catch (err) {
    console.error('Error in PI Planning PI scope endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/pi-planning/progress:
 *   get:
 *     summary: Get progress metrics
 *     description: Returns progress metrics for PI Planning.
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
 *         description: Progress metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
router.get('/progress', async (req, res) => {
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

    // Extract progress data from epic details
    const progressData = piPlanningData.epicDetails?.filter(epic => epic.piProgress) || [];

    const totalStoryPoints = piPlanningData.totalStoryPoints;
    const completedStoryPoints = piPlanningData.completedStoryPoints;
    const inProgressStoryPoints = piPlanningData.inProgressStoryPoints;
    const toDoStoryPoints = piPlanningData.toDoStoryPoints;

    const completionRate = totalStoryPoints > 0 ? (completedStoryPoints / totalStoryPoints) * 100 : 0;
    const inProgressRate = totalStoryPoints > 0 ? (inProgressStoryPoints / totalStoryPoints) * 100 : 0;

    res.json({
      overallProgress: {
        completionRate: Math.round(completionRate * 100) / 100,
        inProgressRate: Math.round(inProgressRate * 100) / 100,
        totalStoryPoints,
        completedStoryPoints,
        inProgressStoryPoints,
        toDoStoryPoints
      },
      epicProgress: progressData,
      sprintProgress: piPlanningData.sprints,
      currentSprints: piPlanningData.currentSprints
    });
  } catch (err) {
    console.error('Error in PI Planning progress endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router; 