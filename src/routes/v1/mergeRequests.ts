import { Router } from 'express';
import { getMergeRequestsHeatmap } from '../../services/mergeRequestsService';

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
 *         description: Analytics summary
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
 *         description: Missing required query params
 *       500:
 *         description: Server error
 */
router.get('/heatmap', async (req, res) => {
  try {
    // Accept groupId, startDate, endDate as query params
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

export default router; 