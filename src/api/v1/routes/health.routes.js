import { Router } from 'express';
import { getHealth } from '../controllers/health.controller.js';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Service health probe
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is up (database reachability included in payload)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: ok
 *                     service:
 *                       type: string
 *                       example: genai-backend
 *                     environment:
 *                       type: string
 *                       example: development
 *                     database:
 *                       type: string
 *                       example: connected
 *                     uptimeSeconds:
 *                       type: integer
 *                       example: 42
 */
router.get('/health', getHealth);

export default router;
