import { Router } from 'express';
import { 
  getReleasesFromJira, 
  getSprintsFromJira,
  getIssuesFromJira, 
  getEpicsFromJira
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
router.get('/releases', async (req, res) => {
  try {
    const { project } = req.query;
    if (!project) {
      return res.status(400).json({ error: 'Missing required query param: project' });
    }
    const releases = await getReleasesFromJira(project as string);
    res.json(releases);
  } catch (err) {
    console.error('Error in releases endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

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
router.get('/sprints', async (req, res) => {
  try {
    const { boardId } = req.query;
    if (!boardId) {
      return res.status(400).json({ error: 'Missing required query param: boardId' });
    }
    const sprints = await getSprintsFromJira(boardId as string);
    res.json(sprints);
  } catch (err) {
    console.error('Error in sprints endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

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
router.get('/issues', async (req, res) => {
  try {
    const { jql } = req.query;
    if (!jql) {
      return res.status(400).json({ error: 'Missing required query param: jql' });
    }
    const issues = await getIssuesFromJira(jql as string);
    res.json(issues);
  } catch (err) {
    console.error('Error in issues endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

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
router.get('/epics', async (req, res) => {
  try {
    const { boardId } = req.query;
    if (!boardId) {
      return res.status(400).json({ error: 'Missing required query param: boardId' });
    }
    const epics = await getEpicsFromJira(boardId as string);
    res.json(epics);
  } catch (err) {
    console.error('Error in epics endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router; 