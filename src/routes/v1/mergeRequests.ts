import { Router } from 'express';
import { 
  getMergeRequestsHeatmap, 
  getMergeRequestsAnalytics, 
  getUniqueMembers, 
  processMergeRequest, 
  createDashboardData 
} from '../../services/mergeRequestsService';
import { Gitlab } from '@gitbeaker/node';

const router = Router();

/**
 * @swagger
 * /api/v1/merge-requests/heatmap:
 *   get:
 *     summary: Get merge request analytics heatmap
 *     description: Returns per-user merge request, commit, approval, and comment stats for a GitLab group and date range.
 *     tags:
 *       - Merge Requests
 *     parameters:
 *       - in: query
 *         name: groupId  
 *         schema:
 *           type: string
 *         required: true
 *         description: GitLab group ID or path
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Merge request analytics with heatmap data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       username:
 *                         type: string
 *                       name:
 *                         type: string
 *                       commits:
 *                         type: integer
 *                       mergeRequests:
 *                         type: integer
 *                       approvals:
 *                         type: integer
 *                       comments:
 *                         type: integer
 *                 totalMergeRequests:
 *                   type: integer
 *                 totalCommits:
 *                   type: integer
 *                 totalApprovals:
 *                   type: integer
 *                 totalComments:
 *                   type: integer
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
router.get('/heatmap', async (req, res) => {
  try {
    const { groupId, startDate, endDate } = req.query;
    if (!groupId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required query params: groupId, startDate, endDate' });
    }
    const result = await getMergeRequestsHeatmap({
      groupId: groupId as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/merge-requests/analytics:
 *   get:
 *     summary: Get detailed merge request analytics
 *     description: Returns detailed analytics for merge requests including approval times and commit metrics.
 *     tags:
 *       - Merge Requests
 *     parameters:
 *       - in: query
 *         name: groupId
 *         schema:
 *           type: string
 *         required: true
 *         description: GitLab group ID or path
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Detailed merge request analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   status:
 *                     type: string
 *                   title:
 *                     type: string
 *                   author:
 *                     type: string
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                   updated_at:
 *                     type: string
 *                     format: date-time
 *                   project:
 *                     type: string
 *                   approval_duration:
 *                     type: number
 *                     description: Time in hours from creation to merge
 *                   last_commit_to_merge:
 *                     type: number
 *                     description: Time in hours from last commit to merge
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server error
 */
router.get('/analytics', async (req, res) => {
  try {
    const { groupId, startDate, endDate } = req.query;
    if (!groupId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required query params: groupId, startDate, endDate' });
    }
    const result = await getMergeRequestsAnalytics({
      groupId: groupId as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/merge-requests/unique-members/{boardId}/{sprintId}:
 *   get:
 *     summary: Get unique members for a sprint
 *     description: Get the unique team members assigned to issues in a sprint with commit requirements
 *     tags:
 *       - Merge Requests
 *     parameters:
 *       - in: path
 *         name: boardId
 *         schema:
 *           type: string
 *         required: true
 *         description: Jira board ID
 *       - in: path
 *         name: sprintId
 *         schema:
 *           type: integer
 *         required: true
 *         description: Sprint ID
 *     responses:
 *       200:
 *         description: Unique team members
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 boardId:
 *                   type: string
 *                 sprintId:
 *                   type: integer
 *                 members:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *       500:
 *         description: Server error
 */
router.get('/unique-members/:boardId/:sprintId', async (req, res) => {
  try {
    const { boardId, sprintId } = req.params;
    const sprintIdNum = parseInt(sprintId);
    
    if (isNaN(sprintIdNum)) {
      return res.status(400).json({ error: 'Invalid sprint ID' });
    }

    const members = await getUniqueMembers(boardId, sprintIdNum);
    
    res.json({
      boardId,
      sprintId: sprintIdNum,
      members
    });
  } catch (err) {
    console.error('Error in unique members endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/merge-requests/process/{projectId}/{mergeRequestId}:
 *   get:
 *     summary: Process merge request details
 *     description: Get detailed information about a specific merge request including approval duration and commit analysis
 *     tags:
 *       - Merge Requests
 *     parameters:
 *       - in: path
 *         name: projectId
 *         schema:
 *           type: integer
 *         required: true
 *         description: GitLab project ID
 *       - in: path
 *         name: mergeRequestId
 *         schema:
 *           type: integer
 *         required: true
 *         description: Merge request ID
 *       - in: query
 *         name: sprintStart
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: Sprint start date (YYYY-MM-DD)
 *       - in: query
 *         name: sprintEnd
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: Sprint end date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Merge request details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 status:
 *                   type: string
 *                 title:
 *                   type: string
 *                 author:
 *                   type: string
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *                 project:
 *                   type: string
 *                 approvers:
 *                   type: string
 *                 source_branch:
 *                   type: string
 *                 target_branch:
 *                   type: string
 *                 approval_duration:
 *                   type: number
 *                   nullable: true
 *                 last_commit_date:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 last_commit_to_merge:
 *                   type: number
 *                   nullable: true
 *       400:
 *         description: Missing parameters
 *       500:
 *         description: Server error
 */
router.get('/process/:projectId/:mergeRequestId', async (req, res) => {
  try {
    const { projectId, mergeRequestId } = req.params;
    const { sprintStart, sprintEnd } = req.query;
    
    const projectIdNum = parseInt(projectId);
    const mergeRequestIdNum = parseInt(mergeRequestId);
    
    if (isNaN(projectIdNum) || isNaN(mergeRequestIdNum)) {
      return res.status(400).json({ error: 'Invalid project ID or merge request ID' });
    }
    
    if (!sprintStart || !sprintEnd) {
      return res.status(400).json({ error: 'Missing sprint start or end date' });
    }

    const token = process.env.GITLAB_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'GITLAB_TOKEN not set in environment' });
    }

    const api = new Gitlab({
      token,
      host: process.env.GITLAB_HOST || 'https://gitlab.com',
    });

    const projectCache = new Map<number, string>();
    const result = await processMergeRequest(
      api,
      projectIdNum,
      mergeRequestIdNum,
      new Date(sprintStart as string),
      new Date(sprintEnd as string),
      projectCache
    );
    
    if (!result) {
      return res.status(404).json({ error: 'Merge request not found or outside sprint range' });
    }
    
    res.json(result);
  } catch (err) {
    console.error('Error in process merge request endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/merge-requests/dashboard:
 *   post:
 *     summary: Create dashboard data
 *     description: Generate dashboard data including distributions, statistics, and team member correlations
 *     tags:
 *       - Merge Requests
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mergeRequests:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     status:
 *                       type: string
 *                     title:
 *                       type: string
 *                     author:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                     project:
 *                       type: string
 *                     approvers:
 *                       type: string
 *                     source_branch:
 *                       type: string
 *                     target_branch:
 *                       type: string
 *                     approval_duration:
 *                       type: number
 *                       nullable: true
 *                     last_commit_date:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     last_commit_to_merge:
 *                       type: number
 *                       nullable: true
 *               jiraMembers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *               gitlabAuthors:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusDistribution:
 *                   type: object
 *                 authorDistribution:
 *                   type: object
 *                 dailyDistribution:
 *                   type: object
 *                 projectDistribution:
 *                   type: object
 *                 approvalDurationStats:
 *                   type: object
 *                   properties:
 *                     average:
 *                       type: number
 *                     median:
 *                       type: number
 *                     min:
 *                       type: number
 *                     max:
 *                       type: number
 *                 teamMemberCorrelation:
 *                   type: object
 *                   properties:
 *                     exactMatches:
 *                       type: array
 *                     closeMatches:
 *                       type: array
 *                     jiraOnly:
 *                       type: array
 *                       items:
 *                         type: string
 *                     gitlabOnly:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Server error
 */
router.post('/dashboard', async (req, res) => {
  try {
    const { mergeRequests, jiraMembers, gitlabAuthors } = req.body;
    
    if (!mergeRequests || !Array.isArray(mergeRequests)) {
      return res.status(400).json({ error: 'mergeRequests must be an array' });
    }
    
    if (!jiraMembers || !Array.isArray(jiraMembers)) {
      return res.status(400).json({ error: 'jiraMembers must be an array' });
    }
    
    if (!gitlabAuthors || !Array.isArray(gitlabAuthors)) {
      return res.status(400).json({ error: 'gitlabAuthors must be an array' });
    }

    // Convert date strings to Date objects
    const processedMergeRequests = mergeRequests.map((mr: any) => ({
      ...mr,
      created_at: new Date(mr.created_at),
      updated_at: new Date(mr.updated_at),
      last_commit_date: mr.last_commit_date ? new Date(mr.last_commit_date) : null
    }));

    const dashboardData = createDashboardData(processedMergeRequests, jiraMembers, gitlabAuthors);
    
    res.json(dashboardData);
  } catch (err) {
    console.error('Error in dashboard endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router; 