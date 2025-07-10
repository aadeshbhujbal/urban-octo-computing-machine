import { Router } from 'express';
import { generateHtmlReport } from '../../controllers/v1/htmlReportController';

const router = Router();

/**
 * @swagger
 * /api/v1/reports/html:
 *   post:
 *     summary: Generate HTML report
 *     description: Generates an HTML report from analytics data.
 *     tags:
 *       - Reports
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: HTML report
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Server error
 */
// POST /api/v1/reports/html
router.post('/html', generateHtmlReport);

export default router; 