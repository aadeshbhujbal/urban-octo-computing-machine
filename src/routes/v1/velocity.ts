import { Router } from 'express';
import { getVelocitySummary } from '../../services/velocityService';

const router = Router();

/**
 * @swagger
 * /api/v1/velocity/data:
 *   get:
 *     summary: Get velocity and spillover data
 *     description: Returns velocity data including sprints, committed/completed story points, efficiency, and team metrics.
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
 *         description: Velocity data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 labels:
 *                   type: array
 *                   items:
 *                     type: string
 *                 committed:
 *                   type: array
 *                   items:
 *                     type: integer
 *                 completed:
 *                   type: array
 *                   items:
 *                     type: integer
 *                 allotted:
 *                   type: array
 *                   items:
 *                     type: integer
 *                 added:
 *                   type: array
 *                   items:
 *                     type: integer
 *                 spillover:
 *                   type: array
 *                   items:
 *                     type: integer
 *                 efficiency:
 *                   type: array
 *                   items:
 *                     type: integer
 *                 team_members:
 *                   type: array
 *                   items:
 *                     type: integer
 *                 start_dates:
 *                   type: array
 *                   items:
 *                     type: string
 *                 end_dates:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Missing required query param
 *       500:
 *         description: Server error
 */
router.get('/data', async (req, res) => {
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
    // Transform to data format
    const labels = result.sprints.map(s => s.sprintName);
    const committed = result.sprints.map(s => s.committed);
    const completed = result.sprints.map(s => s.completed);
    const allotted = result.sprints.map(s => s.committed); // Uses 'Allotted SPs' as committed
    const added = result.sprints.map(s => s.addedStoryPoints);
    const spillover = result.sprints.map(s => s.committed - s.completed);
    const efficiency = result.sprints.map(s => s.efficiency);
    const team_members = result.sprints.map(s => s.teamMembers);
    const start_dates = result.sprints.map(s => s.startDate);
    const end_dates = result.sprints.map(s => s.endDate);
    res.json({ labels, committed, completed, allotted, added, spillover, efficiency, team_members, start_dates, end_dates });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /api/v1/velocity/summary:
 *   get:
 *     summary: Get velocity and spillover analytics summary
 *     description: Returns detailed velocity analytics including efficiency, spillover, and team size metrics.
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
 *         default: 6
 *         description: Number of sprints to analyze (default 6)
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         required: false
 *         description: Filter sprints by year (e.g., 2024)
 *       - in: query
 *         name: sprintPrefix
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter sprints by name prefix
 *     responses:
 *       200:
 *         description: Velocity and spillover analytics
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
 *                         format: date-time
 *                       endDate:
 *                         type: string
 *                         format: date-time
 *                       committed:
 *                         type: integer
 *                         description: Story points committed at sprint start
 *                       completed:
 *                         type: integer
 *                         description: Story points completed by sprint end
 *                       teamMembers:
 *                         type: integer
 *                         description: Number of team members in sprint
 *                       addedStoryPoints:
 *                         type: integer
 *                         description: Story points added after sprint start
 *                       efficiency:
 *                         type: integer
 *                         description: Sprint completion efficiency (%)
 *                 boardId:
 *                   type: string
 *                 summary:
 *                   type: string
 *       400:
 *         description: Missing required parameters
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