import { Router } from 'express';
import { getVelocitySummary } from '../../services/velocityService';

const router = Router();

/**
 * @swagger
 * /api/v1/velocity/summary:
 *   get:
 *     summary: Get velocity and spillover analytics
 *     description: Returns velocity, efficiency, spillover, and team size for a Jira board and sprints.
 *     tags:
 *       - Velocity
 *     parameters:
 *       - in: query
 *         name: boardId
 *         schema:
 *           type: string
 *         required: true
 *         description: Jira board ID
 *       - in: query
 *         name: numSprints
 *         schema:
 *           type: integer
 *         required: false
 *         description: Number of sprints to include
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         required: false
 *         description: Year to filter sprints
 *       - in: query
 *         name: sprintPrefix
 *         schema:
 *           type: string
 *         required: false
 *         description: Sprint name prefix to filter
 *     responses:
 *       200:
 *         description: Velocity analytics summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sprints:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sprintId:
 *                         type: integer
 *                       sprintName:
 *                         type: string
 *                       startDate:
 *                         type: string
 *                       endDate:
 *                         type: string
 *                       committed:
 *                         type: integer
 *                       completed:
 *                         type: integer
 *                       teamMembers:
 *                         type: integer
 *                       addedStoryPoints:
 *                         type: integer
 *                       efficiency:
 *                         type: integer
 *                 boardId:
 *                   type: string
 *                 summary:
 *                   type: string
 *       400:
 *         description: Missing required query param
 *       500:
 *         description: Server error
 */
router.get('/summary', async (req, res) => {
  try {
    const { boardId, numSprints, year, sprintPrefix } = req.query;
    if (!boardId) {
      return res.status(400).json({ error: 'Missing required query param: boardId' });
    }
    const result = await getVelocitySummary({
      boardId: boardId as string,
      numSprints: numSprints ? parseInt(numSprints as string, 10) : undefined,
      year: year ? parseInt(year as string, 10) : undefined,
      sprintPrefix: sprintPrefix as string | undefined,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router; 