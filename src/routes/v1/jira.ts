import { Router } from 'express';
import { 
  getReleasesFromJira, 
  getSprintsFromJira,
  getIssuesFromJira, 
  getEpicsFromJira
} from '../../services/jiraService';
import { fetchWithProxy } from '../../utils/fetchWithProxy';

// Import validateJiraCredentials from jiraService
function validateJiraCredentials() {
  const JIRA_URL = process.env.JIRA_URL;
  const JIRA_USER = process.env.JIRA_USER;
  const JIRA_TOKEN = process.env.JIRA_TOKEN;
  
  if (!JIRA_URL || !JIRA_USER || !JIRA_TOKEN) {
    throw new Error('Jira credentials are not set in environment variables');
  }
  return { 
    url: JIRA_URL, 
    user: JIRA_USER, 
    token: JIRA_TOKEN 
  };
}

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

/**
 * @swagger
 * /api/v1/jira/project/{projectKey}/boards:
 *   get:
 *     summary: Get project boards
 *     description: Returns all boards associated with a Jira project key.
 *     tags:
 *       - Jira
 *     parameters:
 *       - in: path
 *         name: projectKey
 *         schema:
 *           type: string
 *         required: true
 *         description: Jira project key
 *     responses:
 *       200:
 *         description: Project boards
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       400:
 *         description: Missing required path param
 *       500:
 *         description: Server error
 */
router.get('/project/:projectKey/boards', async (req, res) => {
  try {
    const { projectKey } = req.params;
    if (!projectKey) {
      return res.status(400).json({ error: 'Missing required path param: projectKey' });
    }
    
    // Get all boards and filter by project
    const credentials = validateJiraCredentials();
    const boardsResponse = await fetchWithProxy(`${credentials.url}/rest/agile/1.0/board`, {
      auth: { username: credentials.user, password: credentials.token },
    });
    
    if (!boardsResponse.ok) {
      throw new Error(`Failed to fetch boards: ${boardsResponse.status}`);
    }
    
    const boardsData = await boardsResponse.json() as { values: Array<{ id: number; name: string; location?: { projectKey: string } }> };
    const projectBoards = boardsData.values.filter(board => 
      board.location && board.location.projectKey === projectKey
    );
    
    res.json(projectBoards);
  } catch (err) {
    console.error('Error in project boards endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router; 