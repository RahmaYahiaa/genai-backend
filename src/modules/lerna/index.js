import { authenticate } from '../auth/index.js';
import { createLernaClient } from './lerna.client.js';
import { createLernaService } from './lerna.service.js';
import { createLernaController, createLernaRouter } from './lerna.routes.js';

// Composition root (manual DI): HTTP client -> domain adapter -> controller.
export const lernaClient = createLernaClient();
export const lernaService = createLernaService({ lernaClient });

const controller = createLernaController({ lernaService });

// User-scoped LeRna surface: /students/me/learning, /learning/review,
// /ai-preferences, /ai-health (mounted at the API root by api/v1/routes).
export const lernaRouter = createLernaRouter({
  controller,
  middlewares: { authenticate },
});
