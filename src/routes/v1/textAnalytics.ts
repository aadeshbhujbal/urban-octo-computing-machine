import { Router } from 'express';
import { extractKeyPhrases } from '../../controllers/v1/textAnalyticsController';

const router = Router();

/**
 * @swagger
 * /api/v1/text/keyphrases:
 *   post:
 *     summary: Extract key phrases from text
 *     description: Returns extracted key phrases from the input text array.
 *     tags:
 *       - Text Analytics
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               texts:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Extracted key phrases
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 keyPhrases:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Server error
 */
// POST /api/v1/text/keyphrases
router.post('/keyphrases', extractKeyPhrases);

export default router; 