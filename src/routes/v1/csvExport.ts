import { exportTeamCsv, exportSprintsCsv } from '../../controllers/v1/csvExportController';
import { Router } from 'express';

const router = Router();

/**
 * @swagger
 * /api/v1/csv/export-team-csv:
 *   post:
 *     summary: Export team data as CSV
 *     description: Exports team member data as a CSV file.
 *     tags:
 *       - CSV Export
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               team:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Server error
 */
/**
 * @swagger
 * /api/v1/csv/export-sprints-csv:
 *   post:
 *     summary: Export sprints data as CSV
 *     description: Exports sprints data as a CSV file.
 *     tags:
 *       - CSV Export
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sprints:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Server error
 */
router.post('/export-team-csv', exportTeamCsv);
router.post('/export-sprints-csv', exportSprintsCsv);

export default router; 