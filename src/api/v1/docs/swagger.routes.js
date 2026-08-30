import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { logger } from '../../../config/logger.js';
import { swaggerSpec } from './swagger.js';

const router = Router();

// Startup visibility: the path count makes a half-generated spec obvious
// (e.g. auth docs missing => fewer paths than expected).
logger.info(
  `OpenAPI spec generated: ${Object.keys(swaggerSpec.paths).length} paths at /api/docs`,
);

// Raw machine-readable OpenAPI 3.0 spec: GET /api/docs.json
router.get('/docs.json', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(swaggerSpec);
});

// Interactive UI: GET /api/docs
router.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, { customSiteTitle: 'GenAI API Docs' }),
);

export default router;