import { Router } from 'express';
import { 
  getReleasesFromJira, 
  getIssuesFromJira, 
  getEpicsFromJira,
  getJiraReleaseStatus,
  getProjectKeyByExactName,
  getJiraStatusCategories,
  getReleasePlan
} from '../../services/jiraService';

const router = Router();

/**
 * @swagger
 * /api/v1/jira/releases:
 *   get:
 *     summary: Get Jira releases
 *     description: Returns a list of releases for a Jira project.
 *     tags:
 *       - Jira
 *     parameters:
 *       - in: query
 *         name: project
 *         schema:
 *           type: string
 *         required: true
 *         description: Jira project key
 *     responses:
 *       200:
 *         description: Releases array
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       400:
 *         description: Missing required query param
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /api/v1/jira/sprints:
 *   get:
 *     summary: Get Jira sprints
 *     description: Returns a list of sprints for a Jira board.
 *     tags:
 *       - Jira
 *     parameters:
 *       - in: query
 *         name: boardId
 *         schema:
 *           type: string
 *         required: true
 *         description: Jira board ID
 *     responses:
 *       200:
 *         description: Sprints array
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       400:
 *         description: Missing required query param
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /api/v1/jira/issues:
 *   get:
 *     summary: Get Jira issues
 *     description: Returns a list of issues for a Jira project.
 *     tags:
 *       - Jira
 *     parameters:
 *       - in: query
 *         name: jql
 *         schema:
 *           type: string
 *         required: true
 *         description: Jira Query Language (JQL) string, e.g. 'project=FRN'
 *     responses:
 *       200:
 *         description: Issues array
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       400:
 *         description: Missing required query param
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /api/v1/jira/epics:
 *   get:
 *     summary: Get Jira epics
 *     description: Returns a list of epics for a Jira board.
 *     tags:
 *       - Jira
 *     parameters:
 *       - in: query
 *         name: boardId
 *         schema:
 *           type: string
 *         required: true
 *         description: Jira board ID
 *     responses:
 *       200:
 *         description: Epics array
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       400:
 *         description: Missing required query param
 *       500:
 *         description: Server error
 */
router.get('/releases', async (req, res) => {
  try {
    const { projectName } = req.query;
    const releases = await getReleasesFromJira(projectName as string);
    res.json(releases);
  } catch (err) {
    console.error('Error in releases endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/sprints', async (req, res) => {
  try {
    const { boardId, state } = req.query;
    if (!boardId) {
      return res.status(400).json({ error: 'Missing board ID' });
    }
    // Note: This would need to be implemented or use existing sprint service
    res.status(501).json({ error: 'Sprints endpoint not implemented yet' });
  } catch (err) {
    console.error('Error in sprints endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/issues', async (req, res) => {
  try {
    const { jql } = req.query;
    if (!jql) {
      return res.status(400).json({ error: 'Missing JQL query' });
    }
    const issues = await getIssuesFromJira(jql as string);
    res.json(issues);
  } catch (err) {
    console.error('Error in issues endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/epics', async (req, res) => {
  try {
    const { boardId } = req.query;
    if (!boardId) {
      return res.status(400).json({ error: 'Missing board ID' });
    }
    const epics = await getEpicsFromJira(boardId as string);
    res.json(epics);
  } catch (err) {
    console.error('Error in epics endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/jira/release-status/{versionId}:
 *   get:
 *     summary: Get Jira release status for a version
 *     description: Returns the release status (On Track, Off Track, etc.) for a specific version
 *     tags:
 *       - Jira
 *     parameters:
 *       - in: path
 *         name: versionId
 *         schema:
 *           type: string
 *         required: true
 *         description: Jira version ID
 *     responses:
 *       200:
 *         description: Release status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 versionId:
 *                   type: string
 *                 status:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.get('/release-status/:versionId', async (req, res) => {
  try {
    const { versionId } = req.params;
    
    if (!versionId) {
      return res.status(400).json({ error: 'Missing version ID' });
    }

    const status = await getJiraReleaseStatus(versionId);
    
    res.json({
      versionId,
      status
    });
  } catch (err) {
    console.error('Error in release status endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/jira/project-by-name:
 *   get:
 *     summary: Get project key by exact name
 *     description: Find a Jira project key based on exact project name
 *     tags:
 *       - Jira
 *     parameters:
 *       - in: query
 *         name: projectName
 *         schema:
 *           type: string
 *         required: true
 *         description: Exact project name to search for
 *     responses:
 *       200:
 *         description: Project information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 projectName:
 *                   type: string
 *                 key:
 *                   type: string
 *                 name:
 *                   type: string
 *       400:
 *         description: Missing project name
 *       500:
 *         description: Server error
 */
router.get('/project-by-name', async (req, res) => {
  try {
    const { projectName } = req.query;
    
    if (!projectName) {
      return res.status(400).json({ error: 'Missing project name' });
    }

    const result = await getProjectKeyByExactName(projectName as string);
    
    res.json({
      projectName: projectName as string,
      key: result.key,
      name: result.name
    });
  } catch (err) {
    console.error('Error in project by name endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/jira/status-categories/{projectKey}:
 *   get:
 *     summary: Get Jira status categories for a project
 *     description: Get Jira status categories (To Do, In Progress, Done) for a specific project
 *     tags:
 *       - Jira
 *     parameters:
 *       - in: path
 *         name: projectKey
 *         schema:
 *           type: string
 *         required: true
 *         description: Jira project key (e.g., CAFT)
 *     responses:
 *       200:
 *         description: Status categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 projectKey:
 *                   type: string
 *                 statusCategories:
 *                   type: object
 *                   properties:
 *                     "To Do":
 *                       type: array
 *                       items:
 *                         type: string
 *                     "In Progress":
 *                       type: array
 *                       items:
 *                         type: string
 *                     "Done":
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Missing project key
 *       500:
 *         description: Server error
 */
router.get('/status-categories/:projectKey', async (req, res) => {
  try {
    const { projectKey } = req.params;
    
    if (!projectKey) {
      return res.status(400).json({ error: 'Missing project key' });
    }

    const statusCategories = await getJiraStatusCategories(projectKey);
    
    res.json({
      projectKey,
      statusCategories
    });
  } catch (err) {
    console.error('Error in status categories endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/jira/release-plan:
 *   get:
 *     summary: Get release plan for a project
 *     description: Get release plan with versions, dates, and status for a specific project
 *     tags:
 *       - Jira
 *     parameters:
 *       - in: query
 *         name: projectName
 *         schema:
 *           type: string
 *         required: true
 *         description: Project name to get release plan for
 *     responses:
 *       200:
 *         description: Release plan data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 projectName:
 *                   type: string
 *                 releases:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       projectKey:
 *                         type: string
 *                       projectName:
 *                         type: string
 *                       version:
 *                         type: string
 *                       startDate:
 *                         type: string
 *                       endDate:
 *                         type: string
 *                       status:
 *                         type: string
 *                       track:
 *                         type: string
 *       400:
 *         description: Missing project name
 *       500:
 *         description: Server error
 */
router.get('/release-plan', async (req, res) => {
  try {
    const { projectName } = req.query;
    
    if (!projectName) {
      return res.status(400).json({ error: 'Missing project name' });
    }

    const releases = await getReleasePlan(projectName as string);
    
    res.json({
      projectName: projectName as string,
      releases
    });
  } catch (err) {
    console.error('Error in release plan endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router; 