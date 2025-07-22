import { Router } from 'express';
import { getReleases, getSprints, getIssues, getEpics } from '../../controllers/v1/jiraController';

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
router.get('/releases', getReleases);
router.get('/sprints', getSprints);
router.get('/issues', getIssues);
router.get('/epics', getEpics);

export default router; 