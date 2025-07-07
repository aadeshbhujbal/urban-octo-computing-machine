import { Router } from 'express';
import { piPlanningSummaryService } from '../../services/piPlanningService';

const router = Router();

/**
 * @swagger
 * /api/v1/pi-planning/summary:
 *   get:
 *     summary: Get PI Planning analytics summary
 *     description: Returns PI Planning summary including releases, sprints, issues, story points, RAG status, epic/sprint breakdowns, burn-up, RAID, WSJF, PI Scope, and Progress.
 *     tags:
 *       - PI Planning
 *     parameters:
 *       - in: query
 *         name: project
 *         schema:
 *           type: string
 *         required: true
 *         description: Jira project key
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
 *           format: date
 *         required: true
 *         description: PI start date (YYYY-MM-DD)
 *       - in: query
 *         name: piEndDate
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: PI end date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: PI Planning analytics summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 releases:
 *                   type: array
 *                   items:
 *                     type: object
 *                 sprints:
 *                   type: array
 *                   items:
 *                     type: object
 *                 issues:
 *                   type: array
 *                   items:
 *                     type: object
 *                 storyPoints:
 *                   type: integer
 *                 ragStatus:
 *                   type: string
 *                 epicBreakdown:
 *                   type: object
 *                 sprintBreakdown:
 *                   type: object
 *                 burnup:
 *                   type: object
 *                 raid:
 *                   type: object
 *                 wsjf:
 *                   type: object
 *                 piScope:
 *                   type: object
 *                 progress:
 *                   type: object
 *       400:
 *         description: Missing required query params
 *       500:
 *         description: Server error
 */
router.get('/summary', async (req, res) => {
  try {
    const { project, boardId, piStartDate, piEndDate } = req.query;
    if (!project || !boardId || !piStartDate || !piEndDate) {
      return res.status(400).json({ error: 'Missing required query params: project, boardId, piStartDate, piEndDate' });
    }
    const result = await piPlanningSummaryService({
      project: project as string,
      boardId: boardId as string,
      piStartDate: piStartDate as string,
      piEndDate: piEndDate as string,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router; 